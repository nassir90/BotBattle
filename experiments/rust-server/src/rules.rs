// A slice of the game's rules, with the game's own numbers: walking, dashing, jumping, gravity, the stage's edge,
// punches and kicks, the guard, knockback, knockouts and lives. Left out: abilities, projectiles, grabs, ragdolls, ledges
// and the arm and leg maths. slice.mjs is the same code in JavaScript.
use std::fmt::Write;

const GRAV: f64 = -24.0;
const STAGE_HALF: f64 = 10.5;
const BOX_W: f64 = 0.5;
const BOX_H: f64 = 3.2;
const RING_OUT_Y: f64 = -9.0;
const KB_MAX: f64 = 10.0;
const CROUCH_SLOW: f64 = 0.55;
const PASS_TIME: f64 = 0.32;
const PASS_SPEED: f64 = 9.0;
const PASS_EASE: f64 = 0.45;
const DASH_SETTLE: f64 = 0.3;
const BURST_TIME: f64 = 0.16;
const BURST_K: f64 = 0.6;
const GAP: f64 = 1.24;
const VERSUS_S: f64 = 3.0;

pub const LEFT: u32 = 1;
pub const RIGHT: u32 = 2;
pub const DOWN: u32 = 4;
pub const JUMP: u32 = 32;
pub const DASH_L: u32 = 128;
pub const DASH_R: u32 = 256;
pub const STRIKE: u32 = 8192;
pub const GUARD: u32 = 16384;
pub const HELD: u32 = 31 | 16384 | 32768;

struct Move { dur: f64, from: f64, to: f64, cd: f64, reach: f64, y0: f64, y1: f64, dmg: f64, kbx: f64, kby: f64 }
const PUNCH: Move = Move { dur: 0.32, from: 0.07, to: 0.17, cd: 0.38, reach: 1.95, y0: 1.5, y1: 2.7, dmg: 4.0, kbx: 3.5, kby: 1.2 };
const KICK: Move = Move { dur: 0.36, from: 0.08, to: 0.2, cd: 0.5, reach: 1.35, y0: 0.0, y1: 0.8, dmg: 5.0, kbx: 1.5, kby: 0.0 };

struct Strike { t: f64, low: bool, hit: [bool; 8] }

pub struct Fighter {
    pub x: f64, pub y: f64, pub vx: f64, pub vy: f64, pub facing: f64, pub hp: f64, pub stocks: i32,
    pub dead: bool, pub out: bool, spawn_x: f64, dead_t: f64, on_ground: bool, jumps_left: i32, jumps: i32, crouch: f64,
    pass_t: f64, pass_dir: f64, dash_settle: f64, burst_t: f64, last_move: f64, stun: f64, busy: f64,
    invuln: f64, strike: Option<Strike>, strike_cd: f64, kb_t: f64,
}
impl Fighter {
    pub fn new(spawn_x: f64, jumps: i32, stocks: i32) -> Self {
        Fighter { x: spawn_x, y: 0.0, vx: 0.0, vy: 0.0, facing: if spawn_x < 0.0 { 1.0 } else { -1.0 }, hp: 100.0, stocks,
            dead: false, out: false, spawn_x, dead_t: 0.0, on_ground: true, jumps_left: jumps, jumps, crouch: 0.0,
            pass_t: 0.0, pass_dir: 0.0, dash_settle: 0.0, burst_t: 0.0, last_move: 0.0, stun: 0.0, busy: 0.0,
            invuln: 0.0, strike: None, strike_cd: 0.0, kb_t: 0.0 }
    }
}

pub struct Rules { pub fighters: Vec<Fighter>, pub ev: String, versus: f64, pub over: bool }
fn r2(v: f64) -> f64 { (v * 100.0).round() / 100.0 }
fn smooth(t: f64) -> f64 { t * t * (3.0 - 2.0 * t) }

impl Rules {
    pub fn new(fighters: Vec<Fighter>) -> Self { Rules { fighters, ev: String::new(), versus: VERSUS_S, over: false } }
    fn event(&mut self, body: std::fmt::Arguments) {
        if !self.ev.is_empty() { self.ev.push(','); }
        let _ = self.ev.write_fmt(body);
    }
    fn hurt(&mut self, h: usize, from: usize, m: &Move) {
        let facing = self.fighters[from].facing;
        let (kbx, kby) = (facing * m.kbx, m.kby);
        if self.fighters[h].dead || self.fighters[h].invuln > 0.0 { return; }
        if self.fighters[h].busy < 0.0 {                 // (the guard is held in `busy`'s sign: see step)
            let f = &mut self.fighters[h];
            f.vx = (f.vx + kbx * 0.3).clamp(-KB_MAX, KB_MAX);
            self.event(format_args!("[\"hit\",{h},\"b\",{},{},{},{from},0]", m.dmg, r2(kbx), r2(kby)));
            return;
        }
        let f = &mut self.fighters[h];
        f.hp = (f.hp - m.dmg).max(0.0);
        f.vx = (f.vx + kbx).clamp(-KB_MAX, KB_MAX);
        if kbx.abs() > 1.0 || kby > 2.0 { f.kb_t = 0.7; }
        if kby > 0.0 { f.vy = f.vy.max(kby); f.on_ground = false; }
        let gone = f.hp <= 0.0;
        self.event(format_args!("[\"hit\",{h},\"h\",{},{},{},{from},0]", m.dmg, r2(kbx), r2(kby)));
        if gone { self.die(h, false); }
    }
    fn die(&mut self, h: usize, ring_out: bool) {
        let f = &mut self.fighters[h];
        if f.dead { return; }
        f.dead = true; f.dead_t = 0.0; f.stun = 0.0; f.strike = None;
        f.stocks = (f.stocks - 1).max(0);
        if f.stocks == 0 { f.out = true; }
        self.event(format_args!("[\"die\",{h},{}]", ring_out as u8));
    }
    fn update(&mut self, i: usize, mut inp: u32, dt: f64) {
        let f = &mut self.fighters[i];
        if f.dead { f.dead_t += dt; return; }
        for v in [&mut f.kb_t, &mut f.invuln, &mut f.pass_t, &mut f.dash_settle, &mut f.burst_t, &mut f.strike_cd] { *v = (*v - dt).max(0.0); }
        if f.stun > 0.0 { f.stun -= dt; inp = 0; }
        let guarding = inp & GUARD != 0 && f.strike.is_none();
        f.busy = if guarding { -1.0 } else { (f.busy.max(0.0) - dt).max(0.0) };
        let rooted = f.busy != 0.0;
        let mut mv = (if inp & RIGHT != 0 { 1.0 } else { 0.0 }) - (if inp & LEFT != 0 { 1.0 } else { 0.0 });
        let crouching = inp & DOWN != 0 && f.on_ground && !rooted;
        f.crouch = (f.crouch + if crouching { dt } else { -dt } * 9.0).clamp(0.0, 1.0);
        if rooted { mv = 0.0; }
        let dash = if inp & DASH_L != 0 { -1.0 } else if inp & DASH_R != 0 { 1.0 } else { 0.0 };
        if dash != 0.0 && !rooted && f.pass_t <= 0.0 { f.pass_t = PASS_TIME; f.pass_dir = dash; f.facing = dash; }
        let kick = mv != 0.0 && mv != f.last_move && f.pass_t <= 0.0 && f.on_ground;
        if kick { f.burst_t = BURST_TIME; }
        f.last_move = mv;
        let speed = 5.5 * (1.0 - CROUCH_SLOW * f.crouch) * (1.0 + BURST_K * f.burst_t / BURST_TIME);
        if f.pass_t > 0.0 {
            let k = smooth((f.pass_t / (PASS_TIME * PASS_EASE)).min(1.0));
            let after = if mv == f.pass_dir { speed } else { 0.0 };
            f.vx = f.pass_dir * (after + (PASS_SPEED - after) * k);
            f.dash_settle = DASH_SETTLE;
        } else if kick { f.vx = mv * speed; }
        else {
            let rate = if !f.on_ground { 12.0 } else if f.kb_t > 0.0 { 30.0 } else if f.dash_settle > 0.0 { 24.0 } else { f64::INFINITY };
            f.vx += (mv * speed - f.vx).clamp(-rate * dt, rate * dt);
        }
        if mv != 0.0 && f.pass_t <= 0.0 { f.facing = mv; }
        if inp & JUMP != 0 && !rooted && f.jumps_left > 0 { f.jumps_left -= 1; f.vy = 9.6; f.on_ground = false; }
        let was_y = f.y;
        f.vy += GRAV * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
        let over_stage = f.x.abs() <= STAGE_HALF;
        if f.y <= 0.0 && was_y >= -0.05 && over_stage { f.y = 0.0; f.vy = f.vy.max(0.0); f.on_ground = true; f.jumps_left = f.jumps; }
        else { f.on_ground = f.y == 0.0 && over_stage; }
        if f.y < -0.05 && f.x.abs() < STAGE_HALF + BOX_W * 0.6 { f.x = (if f.x < 0.0 { -1.0 } else { 1.0 }) * (STAGE_HALF + BOX_W * 0.6); f.vx = 0.0; }
        if f.y < RING_OUT_Y { f.hp = 0.0; self.die(i, true); return; }
        if inp & STRIKE != 0 && f.strike.is_none() && f.strike_cd <= 0.0 && !rooted {
            let low = f.on_ground && f.crouch > 0.5;
            f.strike = Some(Strike { t: 0.0, low, hit: [false; 8] });
            f.strike_cd = if low { KICK.cd } else { PUNCH.cd };
        }
        self.update_strike(i, dt);
    }
    fn update_strike(&mut self, i: usize, dt: f64) {
        let (x, y, facing) = { let f = &self.fighters[i]; (f.x, f.y, f.facing) };
        let Some(st) = self.fighters[i].strike.as_mut() else { return };
        let m = if st.low { &KICK } else { &PUNCH };
        st.t += dt;
        if st.t >= m.dur { self.fighters[i].strike = None; return; }
        if st.t < m.from || st.t > m.to { return; }
        let (x0, x1) = (x + facing * 0.2, x + facing * m.reach);
        let (ax0, ax1, y0, y1) = (x0.min(x1), x0.max(x1), y + m.y0, y + m.y1);
        for h in 0..self.fighters.len() {
            if h == i || self.fighters[i].strike.as_ref().unwrap().hit[h & 7] { continue; }
            let t = &self.fighters[h];
            if ax1 > t.x - BOX_W && ax0 < t.x + BOX_W && y1 > t.y && y0 < t.y + BOX_H {
                self.fighters[i].strike.as_mut().unwrap().hit[h & 7] = true;
                self.hurt(h, i, m);
            }
        }
    }
    fn separate(&mut self, dt: f64) {
        for i in 0..self.fighters.len() {
            for j in i + 1..self.fighters.len() {
                let (l, r) = self.fighters.split_at_mut(j);
                let (a, b) = (&mut l[i], &mut r[0]);
                if a.dead || b.dead || (a.y - b.y).abs() > BOX_H * 0.7 { continue; }
                let dx = b.x - a.x;
                if dx.abs() >= GAP { continue; }
                let dir = if dx != 0.0 { dx.signum() } else { 1.0 };
                let push = ((GAP - dx.abs()) / 2.0).min(6.0 * dt);
                a.x -= dir * push; b.x += dir * push;
            }
        }
    }
    fn check_result(&mut self) {
        let living = self.fighters.iter().filter(|f| !f.out).count();
        if living <= 1 { self.over = true; return; }
        for i in 0..self.fighters.len() {
            let f = &mut self.fighters[i];
            if f.dead && !f.out && f.dead_t > 1.8 {
                let (sx, jumps, stocks) = (f.spawn_x, f.jumps, f.stocks);
                *f = Fighter::new(sx, jumps, stocks);
                f.y = 4.0; f.on_ground = false; f.invuln = 2.0;
                self.event(format_args!("[\"respawn\",{i}]"));
            }
        }
    }
    pub fn step(&mut self, inputs: &[u32], dt: f64) {
        if self.versus > 0.0 { self.versus -= dt; }
        let waiting = self.versus > 0.0;
        for i in 0..self.fighters.len() { self.update(i, if waiting { 0 } else { inputs[i] }, dt); }
        self.separate(dt);
        self.check_result();
    }
    pub fn snapshot(&mut self, seqs: &[(&str, u32)]) -> String {
        let mut s = String::with_capacity(160 + self.ev.len());
        s.push_str("{\"t\":\"snap\",\"f\":[");
        for (i, f) in self.fighters.iter().enumerate() {
            if i > 0 { s.push(','); }
            let _ = write!(s, "[{},{},{},{},{},{},{},{},{},0,-1,-1]", r2(f.x), r2(f.y), r2(f.vx), r2(f.vy), f.facing, (f.hp * 10.0).round() / 10.0, f.stocks, f.dead as u8, f.out as u8);
        }
        s.push_str("],\"ev\":[");
        s.push_str(&self.ev);
        self.ev.clear();
        s.push_str("],\"a\":{");
        let mut first = true;
        for (id, seq) in seqs {
            if *seq == 0 { continue; }
            if !first { s.push(','); }
            first = false;
            let _ = write!(s, "\"{id}\":{seq}");
        }
        s.push_str("}}");
        s
    }
}
