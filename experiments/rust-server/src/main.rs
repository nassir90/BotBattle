// The dedicated server's networking and rooms in Rust, speaking the same protocol as server/index.mjs, far enough for
// bench.mjs's bots: make a room, sign in with a test token, pick, ready, start, send controls, get snapshots. One task per
// room, one per connection's writes, on THREADS threads (default 1). SOCKET: a Unix socket to listen on, else PORT.
// SNAP_HZ changes how often snapshots go out, to see what that does.
mod rules;
use axum::{extract::{ws::{Message, Utf8Bytes, WebSocket, WebSocketUpgrade}, Path, State}, response::Response, routing::{get, post}, Json, Router};
use futures_util::{SinkExt, StreamExt};
use rules::*;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashMap, sync::{atomic::{AtomicU64, AtomicUsize, Ordering::Relaxed}, Arc, Mutex}, time::{Duration, Instant}};
use tokio::sync::mpsc;

const API: &str = "/games/botbattle/api";
const STEP: f64 = 1.0 / 60.0;
const LONG_MS: f64 = 4.0;

static STEPS: AtomicU64 = AtomicU64::new(0);
static BUSY_NS: AtomicU64 = AtomicU64::new(0);
static WORST_NS: AtomicU64 = AtomicU64::new(0);
static LONG: AtomicU64 = AtomicU64::new(0);
static MATCHES: AtomicUsize = AtomicUsize::new(0);

#[derive(Deserialize)]
#[serde(tag = "t")]
enum In {
    #[serde(rename = "hello")] Hello { token: String, name: String },
    #[serde(rename = "pick")] Pick { kind: String },
    #[serde(rename = "ready")] Ready { on: bool },
    #[serde(rename = "start")] Start,
    #[serde(rename = "in")] Controls { b: u32, s: u32 },
    #[serde(other)] Other,
}
enum ToRoom { Join { id: String, name: String, out: mpsc::Sender<Utf8Bytes> }, Msg(String, In), Leave(String) }

struct Seat { id: String, name: String, kind: Option<String>, ready: bool, out: mpsc::Sender<Utf8Bytes> }
struct Keys { id: String, held: u32, pend: u32, seq: u32, last: u32 }
struct Playing { rules: Rules, keys: Vec<Keys>, snap_t: f64 }

struct Room { name: String, key: String, invite: String, seats: Vec<Seat>, host: Option<String>, playing: Option<Playing>, snap_every: f64 }
impl Room {
    fn send(&self, except: Option<&str>, data: impl Into<Utf8Bytes>) {
        let data = data.into();
        for s in &self.seats { if except != Some(s.id.as_str()) { let _ = s.out.try_send(data.clone()); } }
    }
    fn lobby(&self) {
        let players: Vec<Value> = self.seats.iter().map(|p| json!({ "id": p.id, "name": p.name, "kind": p.kind, "variant": null, "ready": p.ready, "away": false })).collect();
        self.send(None, json!({ "t": "lobby", "host": self.host, "lives": 3, "playing": self.playing.is_some(), "format": "ffa", "dedicated": true, "bracket": null, "players": players }).to_string());
    }
    fn start(&mut self) {
        if self.playing.is_some() || self.seats.len() < 2 || !self.seats.iter().all(|p| p.kind.is_some() && p.ready) { return; }
        let n = self.seats.len() as f64;
        let fighters = self.seats.iter().enumerate().map(|(i, p)| Fighter::new(-5.0 + 10.0 * i as f64 / (n - 1.0), if p.kind.as_deref() == Some("so") { 1 } else { 2 }, 3)).collect();
        let keys = self.seats.iter().map(|p| Keys { id: p.id.clone(), held: 0, pend: 0, seq: 0, last: 0 }).collect();
        self.playing = Some(Playing { rules: Rules::new(fighters), keys, snap_t: 0.0 });
        MATCHES.fetch_add(1, Relaxed);
        let list: Vec<Value> = self.seats.iter().map(|p| json!({ "id": p.id, "name": p.name, "kind": p.kind, "variant": null })).collect();
        self.send(None, json!({ "t": "start", "mid": self.invite, "lives": 3, "host": "@server", "players": list, "bracket": false }).to_string());
        self.lobby();
    }
    fn on_message(&mut self, id: String, m: In) {
        match m {
            In::Controls { b, s } => {
                let Some(p) = self.playing.as_mut() else { return };
                let Some(k) = p.keys.iter_mut().find(|k| k.id == id) else { return };
                k.held = b & HELD; k.pend |= b & !HELD; k.seq = s;
                if b != k.last || b & !HELD != 0 { k.last = b; self.send(Some(&id), format!("{{\"t\":\"in\",\"id\":\"{id}\",\"b\":{b}}}")); }
            }
            In::Pick { kind } => { if let Some(p) = self.seats.iter_mut().find(|p| p.id == id) { p.kind = Some(kind); } self.lobby(); }
            In::Ready { on } => { if let Some(p) = self.seats.iter_mut().find(|p| p.id == id) { p.ready = on; } self.lobby(); }
            In::Start => if self.host.as_deref() == Some(id.as_str()) { self.start(); },
            _ => {}
        }
    }
    fn step(&mut self) {
        let t0 = Instant::now();
        let Some(p) = self.playing.as_mut() else { return };
        let inputs: Vec<u32> = p.keys.iter_mut().map(|k| { let b = k.held | k.pend; k.pend = 0; b }).collect();
        p.rules.step(&inputs, STEP);
        p.snap_t += STEP;
        let mut snap = None;
        if p.snap_t >= self.snap_every || !p.rules.ev.is_empty() {
            p.snap_t = 0.0;
            let seqs: Vec<(&str, u32)> = p.keys.iter().map(|k| (k.id.as_str(), k.seq)).collect();
            snap = Some(p.rules.snapshot(&seqs));
        }
        let over = p.rules.over;
        if let Some(s) = snap { self.send(None, s); }
        let ns = t0.elapsed().as_nanos() as u64;
        STEPS.fetch_add(1, Relaxed); BUSY_NS.fetch_add(ns, Relaxed); WORST_NS.fetch_max(ns, Relaxed);
        if ns as f64 / 1e6 > LONG_MS { LONG.fetch_add(1, Relaxed); }
        if over { self.playing = None; MATCHES.fetch_sub(1, Relaxed); self.lobby(); }
    }
}

async fn room_task(mut room: Room, mut rx: mpsc::UnboundedReceiver<ToRoom>, app: Arc<App>) {
    let mut tick = tokio::time::interval(Duration::from_nanos(1_000_000_000 / 60));
    loop {
        tokio::select! {
            m = rx.recv() => match m {
                None => return,
                Some(ToRoom::Join { id, name, out }) => {
                    if room.host.is_none() { room.host = Some(id.clone()); }
                    let _ = out.try_send(json!({ "t": "welcome", "id": id, "room": room.name, "key": room.key, "invite": room.invite, "casual": false, "again": false }).to_string().into());
                    room.seats.push(Seat { id, name, kind: None, ready: false, out });
                    room.lobby();
                }
                Some(ToRoom::Msg(id, m)) => room.on_message(id, m),
                Some(ToRoom::Leave(id)) => {
                    room.seats.retain(|s| s.id != id);
                    if room.seats.is_empty() {
                        if room.playing.take().is_some() { MATCHES.fetch_sub(1, Relaxed); }
                        app.rooms.lock().unwrap().remove(&room.key);
                        return;
                    }
                    room.lobby();
                }
            },
            _ = tick.tick(), if room.playing.is_some() => room.step(),
        }
    }
}

struct App { rooms: Mutex<HashMap<String, mpsc::UnboundedSender<ToRoom>>>, made: AtomicU64, snap_every: f64 }

async fn make_room(State(app): State<Arc<App>>, Json(body): Json<Value>) -> Json<Value> {
    let name = body["name"].as_str().unwrap_or("Room").to_string();
    let key = name.trim().to_lowercase();
    let invite = format!("i{}", app.made.fetch_add(1, Relaxed));
    let (tx, rx) = mpsc::unbounded_channel();
    app.rooms.lock().unwrap().insert(key.clone(), tx);
    let room = Room { name: name.clone(), key: key.clone(), invite: invite.clone(), seats: vec![], host: None, playing: None, snap_every: app.snap_every };
    tokio::spawn(room_task(room, rx, app));
    Json(json!({ "name": name, "key": key, "invite": invite }))
}
async fn health(State(app): State<Arc<App>>) -> Json<Value> {
    let steps = STEPS.swap(0, Relaxed);
    let busy = BUSY_NS.swap(0, Relaxed);
    Json(json!({ "ok": true, "rooms": app.rooms.lock().unwrap().len(), "matches": MATCHES.load(Relaxed), "step": { "steps": steps, "meanMs": if steps > 0 { busy as f64 / steps as f64 / 1e6 } else { 0.0 }, "worstMs": WORST_NS.swap(0, Relaxed) as f64 / 1e6, "long": LONG.swap(0, Relaxed) } }))
}
async fn join(Path(key): Path<String>, State(app): State<Arc<App>>, up: WebSocketUpgrade) -> Response {
    up.max_message_size(8192).on_upgrade(move |socket| connection(socket, key, app))
}
async fn connection(socket: WebSocket, key: String, app: Arc<App>) {
    let (mut sink, mut stream) = socket.split();
    let Some(Ok(Message::Text(first))) = stream.next().await else { return };
    let Ok(In::Hello { token, name }) = serde_json::from_str(&first) else { return };
    let id = format!("dev:{}", token.rsplit(':').next().unwrap_or("x"));
    let Some(room) = app.rooms.lock().unwrap().get(&key).cloned() else {
        let _ = sink.send(Message::Text(json!({ "t": "error", "error": "There's no room with that name." }).to_string().into())).await;
        return;
    };
    let (out, mut rx) = mpsc::channel::<Utf8Bytes>(64);
    let writer = tokio::spawn(async move { while let Some(m) = rx.recv().await { if sink.send(Message::Text(m)).await.is_err() { break; } } });
    let _ = room.send(ToRoom::Join { id: id.clone(), name, out });
    while let Some(Ok(msg)) = stream.next().await {
        if let Message::Text(t) = msg { if let Ok(m) = serde_json::from_str::<In>(&t) { let _ = room.send(ToRoom::Msg(id.clone(), m)); } }
    }
    let _ = room.send(ToRoom::Leave(id));
    writer.abort();
}

fn main() {
    let env = |k: &str| std::env::var(k).ok();
    let threads = env("THREADS").and_then(|v| v.parse().ok()).unwrap_or(1);
    let hz: f64 = env("SNAP_HZ").and_then(|v| v.parse().ok()).unwrap_or(30.0);
    let app = Arc::new(App { rooms: Mutex::new(HashMap::new()), made: AtomicU64::new(0), snap_every: 1.0 / hz - 1e-9 });
    let router = Router::new()
        .route(&format!("{API}/rooms"), post(make_room))
        .route(&format!("{API}/health"), get(health))
        .route(&format!("{API}/rooms/{{key}}/ws"), get(join))
        .with_state(app);
    tokio::runtime::Builder::new_multi_thread().worker_threads(threads).enable_all().build().unwrap().block_on(async move {
        if let Some(path) = env("SOCKET") {
            let _ = std::fs::remove_file(&path);
            let l = tokio::net::UnixListener::bind(&path).unwrap();
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o660)).unwrap();
            println!("rust server on {path}");
            axum::serve(l, router).await.unwrap();
        } else {
            let port = env("PORT").unwrap_or("8090".into());
            let l = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}")).await.unwrap();
            println!("rust server on {port}");
            axum::serve(l, router).await.unwrap();
        }
    });
}
