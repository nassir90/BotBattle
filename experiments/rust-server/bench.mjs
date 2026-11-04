// The same bots against any of the servers: real rules on Node (server/), the slice on Node (slice.mjs), the slice in
// Rust. BASE is the page's address; bots can be on the box (no real network) or anywhere else.
//   node bench.mjs load <matches> <seconds>   N matches of two bots walking and attacking, as server/bench.mjs
//   node bench.mjs press <samples>            one quiet match: a bot presses a direction, the other times the first snapshot where it moved
// Environment: BASE, DEV_KEY, WS_FROM (a folder with ws installed), STATS_CMD (run with the seconds added, prints the
// server's costs as JSON).
import { createRequire } from 'node:module';
import { exec } from 'node:child_process';
import { monitorEventLoopDelay } from 'node:perf_hooks';
const require = createRequire(process.env.WS_FROM || new URL('../../server/', import.meta.url).pathname);
const { WebSocket } = require('ws');
const [MODE = 'load', A = '4', B = '30'] = process.argv.slice(2);
const BASE = process.env.BASE.replace(/\/$/, ''), KEY = process.env.DEV_KEY || 'x', API = `${BASE}/api`, WS = API.replace(/^http/, 'ws');
const tag = Date.now() % 100000, sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))] * 10) / 10; };
const spread = a => ({ n: a.length, p50: pct(a, .5), p90: pct(a, .9), p99: pct(a, .99), max: pct(a, 1) });
const gaps = [], acks = [], pings = [];
let bytes = 0, frames = 0, measuring = false;
const clientLag = monitorEventLoopDelay({ resolution: 5 });       // the bots' own machine running behind would look like the server's fault

class Bot {
  constructor(u) { this.u = u; this.id = `dev:${u}`; this.seq = 0; this.sent = new Map(); this.lobby = null; this.start = null; this.onSnap = null; this.pingAt = 0; }
  join(key, invite) {
    return new Promise((res, rej) => {
      const ws = this.ws = new WebSocket(`${WS}/rooms/${encodeURIComponent(key)}/ws`);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: `dev:${KEY}:${this.u}`, name: this.u.slice(0, 16), invite })));
      ws.on('error', rej);
      ws.on('pong', () => { if (measuring && this.pingAt) pings.push(performance.now() - this.pingAt); this.pingAt = 0; });
      ws.on('message', raw => {
        if (measuring) { bytes += raw.length; frames++; }
        const m = JSON.parse(raw);
        if (m.t === 'welcome') res();
        else if (m.t === 'error') rej(new Error(m.error));
        else if (m.t === 'lobby') this.lobby = m;
        else if (m.t === 'start') this.start = m;
        else if (m.t === 'snap') {
          const now = performance.now();
          if (this.last && measuring) gaps.push(now - this.last);
          this.last = now;
          const s = m.a?.[this.id], at = s && this.sent.get(s);
          if (at) { if (measuring) acks.push(now - at); this.sent.delete(s); }
          this.onSnap?.(m, now);
        }
      });
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  input(b) { const s = ++this.seq; this.sent.set(s, performance.now()); if (this.sent.size > 200) this.sent.delete(this.sent.keys().next().value); this.send({ t: 'in', b, s }); }
  ping() { if (!this.pingAt) { this.pingAt = performance.now(); this.ws.ping(); } }
}
async function until(test, ms, what) { const t0 = performance.now(); while (!test()) { if (performance.now() - t0 > ms) throw new Error(`no ${what}`); await sleep(20); } }
async function makeMatch(i) {
  const res = await fetch(`${API}/rooms`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer dev:${KEY}:h${i}x${tag}` }, body: JSON.stringify({ name: `Bx ${tag} ${i}` }) });
  const made = await res.json();
  const a = new Bot(`a${i}x${tag}`), b = new Bot(`b${i}x${tag}`);
  await a.join(made.key, made.invite); await b.join(made.key, made.invite);
  a.send({ t: 'pick', kind: ['so', 'gpt', 'claude'][i % 3] }); b.send({ t: 'pick', kind: ['claude', 'so', 'gpt'][i % 3] });
  await until(() => a.lobby?.players.length === 2 && a.lobby.players.every(p => p.kind), 8000, 'picks');
  a.send({ t: 'ready', on: true }); b.send({ t: 'ready', on: true });
  await until(() => a.lobby.players.every(p => p.ready), 8000, 'ready');
  a.send({ t: 'start' });
  await until(() => a.start && b.start, 8000, 'start');
  return [a, b];
}
const health = async () => (await fetch(`${API}/health`)).json();
const statsOver = seconds => new Promise(res => { if (!process.env.STATS_CMD) return res(null); exec(`${process.env.STATS_CMD} ${seconds}`, (err, out) => { try { res(JSON.parse(out.trim().split('\n').pop())); } catch { res({ error: String(err || out) }); } }); });

if (MODE === 'load') {
  const MATCHES = Number(A), SECONDS = Number(B), bots = [];
  for (let i = 0; i < MATCHES; i++) bots.push(...await makeMatch(i));
  const BITS = [2, 1, 2, 1, 32, 512, 1024, 2048, 4096, 8192, 32768, 16384];
  let t = 0;
  const play = setInterval(() => { t++; for (const [i, b] of bots.entries()) { const p = Math.floor((t + i * 7) / 20) % BITS.length; b.input(t % 2 ? BITS[p] : BITS[p] & (31 | 16384 | 32768)); } }, 33);
  const pinging = setInterval(() => { for (let i = 0; i < bots.length; i += 2) bots[i].ping(); }, 250);
  await sleep(8000);
  await health();
  gaps.length = acks.length = pings.length = 0; bytes = frames = 0; measuring = true; clientLag.enable();
  const t0 = performance.now(), stats = statsOver(Math.max(5, SECONDS - 4));
  await sleep(SECONDS * 1000);
  measuring = false;
  const wall = (performance.now() - t0) / 1000, h = await health(), box = await stats;
  clearInterval(play); clearInterval(pinging);
  console.log(JSON.stringify({ mode: MODE, matches: MATCHES, stillOn: h.matches, ...box, step: h.step, pingMs: spread(pings), ackMs: spread(acks), snapGapMs: spread(gaps), kbPerSecPerPlayer: +(bytes / wall / bots.length / 1024).toFixed(1), framesPerSecPerPlayer: +(frames / wall / bots.length).toFixed(1), botsLagP99Ms: +(clientLag.percentile(99) / 1e6).toFixed(1) }));
} else {
  const SAMPLES = Number(A), [a, b] = await makeMatch(0);
  const me = a.start.players.findIndex(p => p.id === a.id);
  await sleep(5000);
  a.input(0); measuring = true;
  const seen = [], local = [];
  for (let n = 0; n < SAMPLES; n++) {
    await sleep(350 + Math.random() * 67);          // comes to rest, and lands at any point in the server's ticks
    const bit = n % 2 ? 1 : 2;
    let x0 = null;
    const moved = new Promise(res => { b.onSnap = (m, now) => { const x = m.f[me][0]; if (x0 === null) x0 = x; else if (Math.abs(x - x0) > 0.02) { b.onSnap = null; res(now); } }; });
    await until(() => x0 !== null, 200, 'snapshot');
    const t0 = performance.now();
    a.input(bit);
    const done = await Promise.race([moved, sleep(1500).then(() => null)]);
    if (done) seen.push(done - t0);
    a.ping(); a.input(0);
    b.onSnap = null;
  }
  measuring = false;
  console.log(JSON.stringify({ mode: MODE, pressToOtherPlayerMs: spread(seen), pingMs: spread(pings), snapGapMs: spread(gaps) }));
}
process.exit(0);
