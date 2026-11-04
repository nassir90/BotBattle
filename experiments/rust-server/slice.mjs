// src/main.rs and src/rules.rs in JavaScript, line for line and on one thread: the same work on Node, so the difference
// from the Rust server is the language, not how much it does. node slice.mjs (SOCKET or PORT, as there). Run from anywhere
// with server/node_modules beside it: NODE_PATH doesn't reach ES modules, so it asks for ws by path.
import { createServer } from 'node:http';
import { chmodSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.WS_FROM || new URL('../../server/', import.meta.url).pathname);
const { WebSocketServer } = require('ws');

const API = '/games/botbattle/api', STEP = 1 / 60, STEP_MS = 1000 / 60, LONG_MS = 4;
const SNAP_EVERY = 1 / (Number(process.env.SNAP_HZ) || 30) - 1e-9;
const GRAV = -24, STAGE_HALF = 10.5, BOX_W = 0.5, BOX_H = 3.2, RING_OUT_Y = -9, KB_MAX = 10, CROUCH_SLOW = 0.55, PASS_TIME = 0.32, PASS_SPEED = 9,
  PASS_EASE = 0.45, DASH_SETTLE = 0.3, BURST_TIME = 0.16, BURST_K = 0.6, GAP = 1.24, VERSUS_S = 3;
const LEFT = 1, RIGHT = 2, DOWN = 4, JUMP = 32, DASH_L = 128, DASH_R = 256, STRIKE = 8192, GUARD = 16384, HELD = 31 | 16384 | 32768;
const PUNCH = { dur: 0.32, from: 0.07, to: 0.17, cd: 0.38, reach: 1.95, y0: 1.5, y1: 2.7, dmg: 4, kbx: 3.5, kby: 1.2 };
const KICK = { dur: 0.36, from: 0.08, to: 0.2, cd: 0.5, reach: 1.35, y0: 0, y1: 0.8, dmg: 5, kbx: 1.5, kby: 0 };
const r2 = v => Math.round(v * 100) / 100, smooth = t => t * t * (3 - 2 * t), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let stats = { steps: 0, busy: 0, worst: 0, long: 0 }, matches = 0;

const fighter = (spawnX, jumps, stocks) => ({ x: spawnX, y: 0, vx: 0, vy: 0, facing: spawnX < 0 ? 1 : -1, hp: 100, stocks, dead: false, out: false, spawnX, deadT: 0, onGround: true,
  jumpsLeft: jumps, jumps, crouch: 0, passT: 0, passDir: 0, dashSettle: 0, burstT: 0, lastMove: 0, stun: 0, busy: 0, invuln: 0, strike: null, strikeCd: 0, kbT: 0 });

class Rules {
  constructor(fighters) { this.fighters = fighters; this.ev = []; this.versus = VERSUS_S; this.over = false; }
  hurt(h, from, m) {
    const t = this.fighters[h], kbx = this.fighters[from].facing * m.kbx, kby = m.kby;
    if (t.dead || t.invuln > 0) return;
    if (t.busy < 0) { t.vx = clamp(t.vx + kbx * 0.3, -KB_MAX, KB_MAX); this.ev.push(['hit', h, 'b', m.dmg, r2(kbx), r2(kby), from, 0]); return; }
    t.hp = Math.max(0, t.hp - m.dmg);
    t.vx = clamp(t.vx + kbx, -KB_MAX, KB_MAX);
    if (Math.abs(kbx) > 1 || kby > 2) t.kbT = 0.7;
    if (kby > 0) { t.vy = Math.max(t.vy, kby); t.onGround = false; }
    this.ev.push(['hit', h, 'h', m.dmg, r2(kbx), r2(kby), from, 0]);
    if (t.hp <= 0) this.die(h, false);
  }
  die(h, ringOut) {
    const f = this.fighters[h];
    if (f.dead) return;
    f.dead = true; f.deadT = 0; f.stun = 0; f.strike = null;
    f.stocks = Math.max(0, f.stocks - 1);
    if (f.stocks === 0) f.out = true;
    this.ev.push(['die', h, ringOut ? 1 : 0]);
  }
  update(i, inp, dt) {
    const f = this.fighters[i];
    if (f.dead) { f.deadT += dt; return; }
    for (const k of ['kbT', 'invuln', 'passT', 'dashSettle', 'burstT', 'strikeCd']) f[k] = Math.max(0, f[k] - dt);
    if (f.stun > 0) { f.stun -= dt; inp = 0; }
    const guarding = inp & GUARD && !f.strike;
    f.busy = guarding ? -1 : Math.max(0, Math.max(f.busy, 0) - dt);
    const rooted = f.busy !== 0;
    let mv = (inp & RIGHT ? 1 : 0) - (inp & LEFT ? 1 : 0);
    const crouching = inp & DOWN && f.onGround && !rooted;
    f.crouch = clamp(f.crouch + (crouching ? dt : -dt) * 9, 0, 1);
    if (rooted) mv = 0;
    const dash = inp & DASH_L ? -1 : inp & DASH_R ? 1 : 0;
    if (dash && !rooted && f.passT <= 0) { f.passT = PASS_TIME; f.passDir = dash; f.facing = dash; }
    const kick = mv && mv !== f.lastMove && f.passT <= 0 && f.onGround;
    if (kick) f.burstT = BURST_TIME;
    f.lastMove = mv;
    const speed = 5.5 * (1 - CROUCH_SLOW * f.crouch) * (1 + BURST_K * f.burstT / BURST_TIME);
    if (f.passT > 0) {
      const k = smooth(Math.min(1, f.passT / (PASS_TIME * PASS_EASE))), after = mv === f.passDir ? speed : 0;
      f.vx = f.passDir * (after + (PASS_SPEED - after) * k);
      f.dashSettle = DASH_SETTLE;
    } else if (kick) f.vx = mv * speed;
    else {
      const rate = !f.onGround ? 12 : f.kbT > 0 ? 30 : f.dashSettle > 0 ? 24 : Infinity;
      f.vx += clamp(mv * speed - f.vx, -rate * dt, rate * dt);
    }
    if (mv && f.passT <= 0) f.facing = mv;
    if (inp & JUMP && !rooted && f.jumpsLeft > 0) { f.jumpsLeft--; f.vy = 9.6; f.onGround = false; }
    const wasY = f.y;
    f.vy += GRAV * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    const overStage = Math.abs(f.x) <= STAGE_HALF;
    if (f.y <= 0 && wasY >= -0.05 && overStage) { f.y = 0; f.vy = Math.max(0, f.vy); f.onGround = true; f.jumpsLeft = f.jumps; }
    else f.onGround = f.y === 0 && overStage;
    if (f.y < -0.05 && Math.abs(f.x) < STAGE_HALF + BOX_W * 0.6) { f.x = (f.x < 0 ? -1 : 1) * (STAGE_HALF + BOX_W * 0.6); f.vx = 0; }
    if (f.y < RING_OUT_Y) { f.hp = 0; this.die(i, true); return; }
    if (inp & STRIKE && !f.strike && f.strikeCd <= 0 && !rooted) {
      const low = f.onGround && f.crouch > 0.5;
      f.strike = { t: 0, low, hit: new Set() };
      f.strikeCd = low ? KICK.cd : PUNCH.cd;
    }
    this.updateStrike(i, dt);
  }
  updateStrike(i, dt) {
    const f = this.fighters[i], st = f.strike;
    if (!st) return;
    const m = st.low ? KICK : PUNCH;
    st.t += dt;
    if (st.t >= m.dur) { f.strike = null; return; }
    if (st.t < m.from || st.t > m.to) return;
    const x0 = f.x + f.facing * 0.2, x1 = f.x + f.facing * m.reach, ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1), y0 = f.y + m.y0, y1 = f.y + m.y1;
    for (let h = 0; h < this.fighters.length; h++) {
      if (h === i || st.hit.has(h)) continue;
      const t = this.fighters[h];
      if (ax1 > t.x - BOX_W && ax0 < t.x + BOX_W && y1 > t.y && y0 < t.y + BOX_H) { st.hit.add(h); this.hurt(h, i, m); }
    }
  }
  separate(dt) {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j];
      if (a.dead || b.dead || Math.abs(a.y - b.y) > BOX_H * 0.7) continue;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= GAP) continue;
      const dir = dx ? Math.sign(dx) : 1, push = Math.min((GAP - Math.abs(dx)) / 2, 6 * dt);
      a.x -= dir * push; b.x += dir * push;
    }
  }
  checkResult() {
    if (this.fighters.filter(f => !f.out).length <= 1) { this.over = true; return; }
    this.fighters.forEach((f, i) => {
      if (f.dead && !f.out && f.deadT > 1.8) {
        const nf = this.fighters[i] = fighter(f.spawnX, f.jumps, f.stocks);
        nf.y = 4; nf.onGround = false; nf.invuln = 2;
        this.ev.push(['respawn', i]);
      }
    });
  }
  step(inputs, dt) {
    if (this.versus > 0) this.versus -= dt;
    const waiting = this.versus > 0;
    for (let i = 0; i < this.fighters.length; i++) this.update(i, waiting ? 0 : inputs[i], dt);
    this.separate(dt);
    this.checkResult();
  }
  snapshot(keys) {
    const a = {};
    for (const k of keys) if (k.seq) a[k.id] = k.seq;
    const s = JSON.stringify({ t: 'snap', f: this.fighters.map(f => [r2(f.x), r2(f.y), r2(f.vx), r2(f.vy), f.facing, Math.round(f.hp * 10) / 10, f.stocks, f.dead ? 1 : 0, f.out ? 1 : 0, 0, -1, -1]), ev: this.ev, a });
    this.ev = [];
    return s;
  }
}

class Room {
  constructor(name, key, invite) { Object.assign(this, { name, key, invite, seats: [], host: null, playing: null, timer: null, next: 0 }); }
  send(except, data) { for (const s of this.seats) if (s.id !== except && s.ws.readyState === 1 && s.ws.bufferedAmount < 256 * 1024) s.ws.send(data); }
  lobby() {
    this.send(null, JSON.stringify({ t: 'lobby', host: this.host, lives: 3, playing: !!this.playing, format: 'ffa', dedicated: true, bracket: null,
      players: this.seats.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: null, ready: p.ready, away: false })) }));
  }
  start() {
    if (this.playing || this.seats.length < 2 || !this.seats.every(p => p.kind && p.ready)) return;
    const n = this.seats.length;
    this.playing = { rules: new Rules(this.seats.map((p, i) => fighter(-5 + 10 * i / (n - 1), p.kind === 'so' ? 1 : 2, 3))), keys: this.seats.map(p => ({ id: p.id, held: 0, pend: 0, seq: 0, last: 0 })), snapT: 0 };
    matches++;
    this.send(null, JSON.stringify({ t: 'start', mid: this.invite, lives: 3, host: '@server', players: this.seats.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: null })), bracket: false }));
    this.lobby();
    this.next = performance.now(); this.loop();
  }
  // as server/sim-worker.mjs paces a match
  loop() {
    if (!this.playing) return;
    const now = performance.now();
    let n = 0;
    while (now >= this.next && n < 5 && this.playing) { this.step(); this.next += STEP_MS; n++; }
    if (now - this.next > 250) this.next = now;
    if (this.playing) this.timer = setTimeout(() => this.loop(), Math.max(0, this.next - performance.now()));
  }
  step() {
    const t0 = performance.now(), p = this.playing;
    const inputs = p.keys.map(k => { const b = k.held | k.pend; k.pend = 0; return b; });
    p.rules.step(inputs, STEP);
    p.snapT += STEP;
    if (p.snapT >= SNAP_EVERY || p.rules.ev.length) { p.snapT = 0; this.send(null, p.rules.snapshot(p.keys)); }
    const over = p.rules.over, ms = performance.now() - t0;
    stats.steps++; stats.busy += ms; stats.worst = Math.max(stats.worst, ms); if (ms > LONG_MS) stats.long++;
    if (over) { this.playing = null; matches--; this.lobby(); }
  }
  onMessage(id, m) {
    switch (m.t) {
      case 'in': {
        const k = this.playing?.keys.find(x => x.id === id);
        if (!k) return;
        k.held = m.b & HELD; k.pend |= m.b & ~HELD; k.seq = m.s;
        if (m.b !== k.last || m.b & ~HELD) { k.last = m.b; this.send(id, JSON.stringify({ t: 'in', id, b: m.b })); }
        return;
      }
      case 'pick': { const p = this.seats.find(x => x.id === id); if (p) p.kind = m.kind; this.lobby(); return; }
      case 'ready': { const p = this.seats.find(x => x.id === id); if (p) p.ready = m.on; this.lobby(); return; }
      case 'start': if (this.host === id) this.start(); return;
    }
  }
  leave(id) {
    this.seats = this.seats.filter(s => s.id !== id);
    if (!this.seats.length) { if (this.playing) { this.playing = null; matches--; } clearTimeout(this.timer); rooms.delete(this.key); return; }
    this.lobby();
  }
}

const rooms = new Map();
let made = 0;
const json = (res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = createServer(async (req, res) => {
  if (req.url === `${API}/rooms` && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    const name = JSON.parse(body).name || 'Room', key = name.trim().toLowerCase(), invite = `i${made++}`;
    rooms.set(key, new Room(name, key, invite));
    return json(res, { name, key, invite });
  }
  if (req.url === `${API}/health`) {
    const s = stats; stats = { steps: 0, busy: 0, worst: 0, long: 0 };
    return json(res, { ok: true, rooms: rooms.size, matches, step: { steps: s.steps, meanMs: s.steps ? s.busy / s.steps : 0, worstMs: s.worst, long: s.long } });
  }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
server.on('upgrade', (req, socket, head) => {
  const m = req.url.match(/\/api\/rooms\/([^/]+)\/ws$/);
  const room = m && rooms.get(decodeURIComponent(m[1]));
  wss.handleUpgrade(req, socket, head, ws => {
    let id = null;
    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (!id) {
        if (msg.t !== 'hello') return;
        if (!room) { ws.send(JSON.stringify({ t: 'error', error: "There's no room with that name." })); ws.close(4000, 'refused'); return; }
        id = `dev:${msg.token.split(':').pop()}`;
        room.host ??= id;
        ws.send(JSON.stringify({ t: 'welcome', id, room: room.name, key: room.key, invite: room.invite, casual: false, again: false }));
        room.seats.push({ id, name: msg.name, kind: null, ready: false, ws });
        room.lobby();
        return;
      }
      room.onMessage(id, msg);
    });
    ws.on('close', () => { if (id) room.leave(id); });
  });
});
if (process.env.SOCKET) {
  rmSync(process.env.SOCKET, { force: true });
  server.listen(process.env.SOCKET, () => { chmodSync(process.env.SOCKET, 0o660); console.log(`js slice on ${process.env.SOCKET}`); });
} else server.listen(Number(process.env.PORT) || 8091, '127.0.0.1', () => console.log('js slice listening'));
