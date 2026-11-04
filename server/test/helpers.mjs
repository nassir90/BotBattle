// A real server on a free port, and players as plain WebSocket bots: no browser needed, so this runs anywhere, the
// server's eventual host included.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const SERVER = fileURLToPath(new URL('../index.mjs', import.meta.url));
export const DEV_KEY = 'testkey';
export const IN = { left: 1, right: 2, down: 4, up: 8, fire: 16, jump: 32, parry: 64, a1: 512, strike: 8192, guard: 16384, grab: 32768 };
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function startServer(env = {}) {
  const PORT = String(20000 + Math.floor(Math.random() * 20000));
  const child = spawn(process.execPath, ['--optimize-for-size', ...(process.env.SERVER_NODE_ARGS || '').split(' ').filter(Boolean), SERVER], { env: { ...process.env, PORT, DEV_KEY, GRACE_MS: '800', DATA_DIR: mkdtempSync(join(tmpdir(), 'bb-')), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${PORT}/games/botbattle/api`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not yet */ }
    await sleep(100);
  }
  const api = async (path, body, user) => {
    const res = await fetch(`${base}/${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer dev:${DEV_KEY}:${user}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { port: PORT, api, base, stop: () => child.kill(), log: () => log, child };
}

export class Bot {
  constructor(srv, user) { this.srv = srv; this.user = user; this.id = `dev:${user}`; this.msgs = []; this.snaps = []; this.events = []; this.lobby = null; this.start = null; this.waiters = []; this.seq = 0; }
  connect(key, auth = {}) {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`ws://127.0.0.1:${this.srv.port}/games/botbattle/api/rooms/${encodeURIComponent(key)}/ws`);
      ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: `dev:${DEV_KEY}:${this.user}`, name: this.user, ...auth })));
      ws.on('message', raw => {
        const m = JSON.parse(raw);
        this.msgs.push(m);
        if (m.t === 'welcome') resolve(this);
        if (m.t === 'error') { this.error = m.error; resolve(this); }
        if (m.t === 'lobby') this.lobby = m;
        if (m.t === 'start') { this.start = m; this.snaps = []; this.events = []; }
        if (m.t === 'snap') { this.snaps.push(m); this.events.push(...m.ev); }
        for (const w of [...this.waiters]) if (w.test(this)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(); }
      });
      ws.on('error', reject);
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  input(b) { this.send({ t: 'in', b, s: ++this.seq }); }
  pick(kind, variant) { this.send({ t: 'pick', kind, variant }); }
  ready(on = true) { this.send({ t: 'ready', on }); }
  until(test, ms = 15000, what = 'a condition') {
    if (test(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${this.user} timed out waiting for ${what}`)), ms);
      this.waiters.push({ test, resolve: () => { clearTimeout(t); resolve(); } });
    });
  }
  me() { const i = this.start.players.findIndex(p => p.id === this.id); return this.snaps.at(-1)?.f[i]; }
  close(code = 4100) { this.ws.close(code); }
}
// holds a control for a while, sending it steadily as a page does
export async function hold(bot, bits, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { bot.input(bits); await sleep(33); }
  bot.input(0);
}
// holds a control until something's true. It gives up in the end: a socket the server has dropped takes controls without
// complaint, so a fighter that will never get there would otherwise keep a test, and the whole run, going for ever
export async function holdUntil(bot, bits, done, ms = 15000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error(`${bot.user} never got there`);
    bot.input(bits); await sleep(33);
  }
}
export const VERSUS_MS = 4000;
export const underWay = (bot, ms = 20000) => sleep(0).then(() => new Promise(r => setTimeout(r, Math.min(ms, VERSUS_MS))));
