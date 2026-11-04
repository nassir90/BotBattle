// Bot Battle's dedicated game server: the online API the Cloudflare worker (src/index.ts) has, at the same paths, with
// one difference that matters. A match isn't run by the host's browser: a worker here runs the game's own rules
// (sim-worker.mjs) and every browser takes its word.
//   POST /api/rooms                 create a room (signed in): { name, password? } -> { key, name, invite }
//   POST /api/casual                a casual match (signed in): a room with someone waiting in it, or a new one
//   GET  /api/rooms/<key>/ws        a room's WebSocket; the first message signs in and unlocks the room
//   GET  /api/leaderboard           the top players
//   GET  /api/health                how the server is doing
// It also serves the built page, so the whole game can be played from this one host. Rooms live in memory (a restart
// ends them); the leaderboard is kept in a file.
import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { readFileSync, rmSync, chmodSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { base64url, createLocalJWKSet, createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { makeBracket, advance, nextMatch, champion } from './bracket.mjs';
import * as sims from './sims.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const SOCKET = process.env.SOCKET || '';     // a Unix socket to listen on instead, for a web server outside a sandbox
const PAGE_DIR = process.env.PAGE_DIR || join(HERE, '../public/games/botbattle');
const DATA_DIR = process.env.DATA_DIR || join(HERE, 'data');
// test players without Clerk: tokens "dev:<key>:<name>". Unset, as it must be in production, there are none
const DEV_KEY = process.env.DEV_KEY || '';
const API = '/games/botbattle/api', GAME = '/games/botbattle';
const CLERK = 'https://merry-filly-2600.clerk.accounts.dev';
// Clerk's public signing keys: from Clerk, or in a sandbox with no network (deploy/sandbox.sh), from a file something
// outside it keeps fresh. A key the file doesn't have yet means reading the file again, at most every 30 seconds
const JWKS_FILE = process.env.JWKS_FILE || '';
function keysFromFile(path) {
  let keys = null, readAt = 0;
  const read = () => { keys = createLocalJWKSet(JSON.parse(readFileSync(path, 'utf8'))); readAt = Date.now(); };
  return async (...args) => {
    if (!keys) read();
    try {
      return await keys(...args);
    } catch (err) {
      if (!(err instanceof joseErrors.JWKSNoMatchingKey) || Date.now() - readAt < 30000) throw err;
      read();
      return keys(...args);
    }
  };
}
const JWKS = JWKS_FILE ? keysFromFile(JWKS_FILE) : createRemoteJWKSet(new URL(`${CLERK}/.well-known/jwks.json`));
const ORIGINS = new Set(['https://mpts.ie', ...(process.env.ORIGINS || '').split(',').filter(Boolean)]);
const KINDS = ['so', 'gpt', 'claude'];
const VARIANTS = { so: ['orange', 'blue'], gpt: ['green', 'white'], claude: ['orange', 'black'] };
const MAX_PLAYERS = 8, MAX_FFA = 4, CASUAL_PLAYERS = 2;
const GRACE_MS = Number(process.env.GRACE_MS) || 30 * 1000;    // a dropped player keeps their seat this long
const IDLE_MS = 10 * 60 * 1000;                                // an empty room goes this long after its last player leaves
const SILENT_MS = 70 * 1000;                                   // a socket that's said nothing for this long is dead (pages ping every 25 s)
const SERVER_ID = '@server';
const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const b64 = base64url.encode, randomToken = n => b64(randomBytes(n));

function roomName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z0-9 ]{3,16}$/.test(name)) return { error: 'Use 3 to 16 letters (A to Z), digits or spaces.' };
  if (profanity.hasMatch(name)) return { error: "That name isn't allowed. Try another." };
  return { name, key: name.toLowerCase() };
}
function displayName(raw) {
  const name = String(raw ?? '').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 16);
  return name.length >= 2 && !profanity.hasMatch(name) ? name : 'Player';
}
async function signedIn(token) {
  if (typeof token !== 'string' || !token) return null;
  if (DEV_KEY && token.startsWith(`dev:${DEV_KEY}:`)) return 'dev:' + token.slice(DEV_KEY.length + 5);
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: CLERK });
    if (payload.azp && !ORIGINS.has(String(payload.azp))) return null;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
const hashPassword = (password, salt) => pbkdf2Sync(password, salt, 100000, 32, 'sha256');
function passwordMatches(password, info) {
  if (typeof password !== 'string' || !info.hash) return false;
  const a = hashPassword(password, info.salt);
  return a.length === info.hash.length && timingSafeEqual(a, info.hash);
}

// ---------- the leaderboard: a file, rewritten shortly after a match adds to it ----------
const boardFile = join(DATA_DIR, 'leaderboard.json');
let board = {};
try { board = JSON.parse(readFileSync(boardFile, 'utf8')); } catch { /* none yet */ }
let boardTimer = null;
function boardChanged() {
  boardTimer ??= setTimeout(async () => {
    boardTimer = null;
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(boardFile + '.tmp', JSON.stringify(board));
      await rename(boardFile + '.tmp', boardFile);
    } catch (err) { console.error('leaderboard not saved:', err); }
  }, 2000);
  boardTimer.unref?.();
}
const topPlayers = () => Object.values(board)
  .sort((a, b) => b.wins - a.wins || a.matches - b.matches || b.kos - a.kos).slice(0, 25)
  .map(({ name, wins, matches, kos, parries }) => ({ name, wins, matches, kos, parries }));

// ---------- rooms ----------
const rooms = new Map();
const leaving = code => code === 1001 || code >= 4000;     // the page went away, they left, or the room refused them
// a worker stays warm while anyone sits in a room with no match on. They're there a good while before one can start:
// everyone has to join, pick a fighter and get ready
function reserve() {
  try {
    for (const room of rooms.values()) if (room.seats.length && !room.match) { sims.warm(); return; }
    sims.cool();
  } catch (err) { console.error('no worker in reserve:', err); }   // a match that starts will load its own
}

class Room {
  constructor(name, key, password, casual = false) {
    const salt = randomBytes(16);
    this.info = { name, key, salt, hash: password ? hashPassword(password, salt) : null, invite: randomToken(18), casual };
    this.seats = []; this.host = null; this.lives = 3; this.match = null; this.format = 'ffa'; this.bracket = null;
    this.sockets = new Map();      // a seat's id -> its socket
    this.emoteAt = new Map(); this.lastIn = new Map();
    this.idle();
  }
  seat(id) { return this.seats.find(s => s.id === id); }
  idle() { clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (!this.seats.length) { this.stopSim(); rooms.delete(this.info.key); } }, IDLE_MS); this.idleTimer.unref?.(); }

  async hello(ws, msg) {
    const fail = error => { ws.send(JSON.stringify({ t: 'error', error })); ws.close(4000, 'refused'); };
    const id = await signedIn(msg.token);
    if (!id) return fail('Sign in again to join.');
    if (rooms.get(this.info.key) !== this) return fail("There's no room with that name.");
    const info = this.info, again = this.seat(id);
    const invited = typeof msg.invite === 'string' && msg.invite === info.invite;
    if (info.hash && !invited && !again && !passwordMatches(msg.password, info)) return fail('Wrong password.');
    const old = this.sockets.get(id);
    if (old && old !== ws) { old.ownerGone = true; try { old.close(4002, 'joined elsewhere'); } catch { /* gone */ } }
    if (!again) {
      const most = info.casual ? CASUAL_PLAYERS : MAX_PLAYERS;
      if (this.seats.length >= most) return fail(info.casual ? 'Someone else got that match first. Try again.' : 'That room is full (eight players).');
      if (this.match) return fail('A match is on in that room. Try again when it ends.');
      this.seats.push({ id, name: displayName(msg.name), kind: null, variant: null, ready: false, away: null, graceTimer: null });
    } else {
      again.away = null; clearTimeout(again.graceTimer);
      if (this.match?.players.includes(id)) { this.send(id, { t: 'back', id }); this.toSim({ t: 'back', id }); }
    }
    ws.seatId = id;
    this.sockets.set(id, ws);
    this.host ??= id;
    clearTimeout(this.idleTimer);
    reserve();
    ws.send(JSON.stringify({ t: 'welcome', id, room: info.name, key: info.key, invite: info.invite, casual: !!info.casual, again: !!again }));
    this.lobby();
  }

  closed(ws, code) {
    const id = ws.seatId;
    if (!id || this.sockets.get(id) !== ws) return;           // already replaced by a newer socket
    this.sockets.delete(id);
    const me = this.seat(id);
    if (!me) return;
    if (leaving(code)) { this.leave(me); return; }
    me.away = Date.now();
    me.graceTimer = setTimeout(() => this.leave(me), GRACE_MS);
    me.graceTimer.unref?.();
    if (this.match?.players.includes(id)) { this.send(id, { t: 'away', id }); this.toSim({ t: 'away', id }); }
    this.lobby();
  }

  handle(ws, msg, raw) {
    const me = this.seat(ws.seatId);
    if (!me) return;
    const isHost = me.id === this.host;
    switch (msg.t) {
      case 'in': {       // a player's controls: for the match, and for everyone else's screens when they've changed
        if (!this.match?.players.includes(me.id) || !Number.isInteger(msg.b)) return;
        const b = msg.b & 0xffff, HELD = 31 | 16384 | 32768;
        this.toSim({ t: 'in', id: me.id, b, s: Number.isInteger(msg.s) ? msg.s : 0 });
        if (b !== this.lastIn.get(me.id) || b & ~HELD) { this.lastIn.set(me.id, b); this.send(me.id, { t: 'in', id: me.id, b }); }
        return;
      }
      case 'pick':
        if (this.match || !KINDS.includes(msg.kind)) return;
        me.kind = msg.kind;
        me.variant = VARIANTS[msg.kind].includes(msg.variant) ? msg.variant : VARIANTS[msg.kind][0];
        me.ready = false; this.lobby(); return;
      case 'ready':
        if (this.match || !me.kind) return;
        me.ready = !!msg.on;
        if (this.info.casual && this.allReady()) { this.begin(); return; }
        this.lobby(); return;
      case 'lives':
        if (!isHost || this.match || ![1, 2, 3, 5].includes(msg.n)) return;
        this.lives = msg.n; this.lobby(); return;
      case 'format':
        if (!isHost || this.match || this.info.casual || (this.bracket && champion(this.bracket) === null) || !['ffa', 'bracket'].includes(msg.f)) return;
        this.format = msg.f; this.bracket = null; this.lobby(); return;
      case 'start':
        if (!isHost || this.match) return;
        if (this.format !== 'bracket') { if (this.allReady()) this.begin(); return; }
        if (!this.bracket || champion(this.bracket) !== null) {
          if (!this.allReady() || this.seats.length < 3) return;
          const list = this.seats.map(p => ({ id: p.id, name: p.name, gone: false }));
          for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
          this.bracket = makeBracket(list);
        }
        this.beginBracketMatch();
        return;
      case 'endBracket':
        if (!isHost || this.match || !this.bracket) return;
        this.bracket = null; for (const p of this.seats) p.ready = false;
        this.lobby(); return;
      case 'emote': {
        const now = Date.now();
        if (!Number.isInteger(msg.e) || msg.e < 0 || msg.e > 5 || now - (this.emoteAt.get(me.id) ?? 0) < 700) return;
        this.emoteAt.set(me.id, now);
        this.send(null, { t: 'emote', id: me.id, e: msg.e }); return;
      }
      case 'devKO':
        if (DEV_KEY && this.match?.sim && Number.isInteger(msg.i)) this.match.sim.postMessage({ t: 'ko', i: msg.i });
        return;
    }
  }

  allReady() {
    return !this.match && this.seats.length >= 2 && (this.format === 'bracket' || this.seats.length <= MAX_FFA)
      && this.seats.every(p => p.kind && p.ready && p.away === null);
  }
  begin() { this.play(this.seats); }
  beginBracketMatch() {
    const B = this.bracket;
    advance(B);
    const nx = nextMatch(B);
    if (!nx) { this.lobby(); return; }
    const pair = [B.entrants[nx.m.a], B.entrants[nx.m.b]].map(e => this.seat(e.id));
    if (pair.some(p => !p || !p.kind || p.away !== null)) return;
    this.play(pair, [nx.r, nx.i]);
  }
  // a match: its players fight, everyone else in the room watches, and a worker runs it
  play(players, at) {
    const list = players.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant }));
    const mid = randomToken(9);
    const match = { mid, lives: this.lives, host: SERVER_ID, players: list };
    this.match = { id: mid, players: players.map(p => p.id), names: new Map(players.map(p => [p.id, p.name])), at };
    this.lastIn.clear();
    this.match.sim = sims.acquire({
      out: data => {
        if (data.startsWith('{"t":"snap"')) this.send(null, data);
        else if (data.startsWith('{"t":"result"')) this.finish(JSON.parse(data));
      },
      crash: () => this.abort('The match stopped on the server. Sorry.'),
    });
    this.match.sim.postMessage({ t: 'begin', match });
    this.send(null, { t: 'start', ...match, bracket: !!at });
    this.lobby();
    reserve();
  }
  toSim(m) { this.match?.sim?.postMessage({ t: 'net', m }); }
  stopSim() { if (this.match?.sim) { sims.release(this.match.sim); this.match.sim = null; } }
  abort(reason) {
    this.stopSim();
    this.match = null;
    this.send(null, { t: 'abort', reason });
    this.lobby();
    reserve();
  }

  finish(msg) {
    const m = this.match, B = this.bracket;
    if (!m || msg.mid !== m.id) return;
    this.stopSim();
    this.match = null;
    reserve();
    if (B && m.at) {        // a bracket match: its winner goes through (a draw is played again)
      const k = m.players.indexOf(msg.winner), slot = B.rounds[m.at[0]][m.at[1]];
      if (k >= 0 && slot.bo && slot.s) slot.s[k]++;
      if (k >= 0 && (!slot.bo || slot.s[k] >= Math.ceil(slot.bo / 2))) { slot.w = k === 0 ? slot.a : slot.b; advance(B); }
      if (champion(B) !== null) for (const p of this.seats) p.ready = false;
    } else for (const p of this.seats) p.ready = false;
    this.lobby();
    if (!Array.isArray(msg.stats)) return;
    const seen = new Set();
    const stats = msg.stats.filter(s => s && m.players.includes(s.id) && !seen.has(s.id) && seen.add(s.id));
    if (stats.length < 2) return;
    const n = v => Math.max(0, Math.min(99, Math.floor(Number(v) || 0)));
    for (const s of stats) {
      const row = board[s.id] ??= { name: 'Player', wins: 0, matches: 0, kos: 0, parries: 0 };
      row.name = m.names.get(s.id) ?? row.name;
      row.wins += s.id === msg.winner ? 1 : 0; row.matches++; row.kos += n(s.kos); row.parries += n(s.parries);
    }
    boardChanged();
  }

  leave(me) {
    if (!this.seats.includes(me)) return;
    clearTimeout(me.graceTimer);
    this.seats = this.seats.filter(p => p !== me);
    this.sockets.delete(me.id);
    const gone = this.bracket?.entrants.find(e => e.id === me.id);
    if (gone) { gone.gone = true; if (!this.match?.players.includes(me.id)) advance(this.bracket); }
    // the match carries on without them, whoever they were: nobody's browser is running it
    if (this.match?.players.includes(me.id)) { this.send(null, { t: 'left', id: me.id }); this.toSim({ t: 'left', id: me.id }); }
    if (this.host === me.id) this.host = this.seats.find(p => p.away === null)?.id ?? this.seats[0]?.id ?? null;
    if (!this.seats.length) { this.stopSim(); this.match = null; this.bracket = null; this.idle(); }
    reserve();
    this.lobby();
  }

  lobby() {
    const B = this.bracket, nx = B && nextMatch(B);
    this.send(null, { t: 'lobby', host: this.host, lives: this.lives, playing: !!this.match, format: this.format, dedicated: true,
      bracket: B ? { entrants: B.entrants, rounds: B.rounds, champion: champion(B), next: nx ? [nx.r, nx.i] : null } : null,
      players: this.seats.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant, ready: p.ready, away: p.away !== null })) });
  }
  // to everyone signed in, except one player
  send(except, msg) {
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const [id, ws] of this.sockets) {
      if (id !== except && ws.readyState === 1 && ws.bufferedAmount < 256 * 1024) ws.send(data);
    }
  }
}

function makeRoom(name, key, password, casual) {
  const had = rooms.get(key);
  if (had && had.seats.length) return null;
  if (had) { clearTimeout(had.idleTimer); had.stopSim(); }
  const room = new Room(name, key, password, casual);
  rooms.set(key, room);
  return room;
}

// ---------- casual matches: a room with one other player waiting in it, or a new one to wait in ----------
const PROMISE_MS = 20 * 1000, CASUAL_AGE_MS = 30 * 60 * 1000;
let openCasual = [];
function findCasual(user) {
  const now = Date.now();
  for (const r of [...openCasual]) {
    const room = rooms.get(r.key), players = room ? room.seats.map(p => p.id) : [];
    for (const [id, until] of Object.entries(r.promised)) if (until < now || players.includes(id)) delete r.promised[id];
    const coming = Object.keys(r.promised).length;
    if (!room || room.match || now - r.created > CASUAL_AGE_MS || (!players.length && !coming)) { openCasual = openCasual.filter(o => o !== r); continue; }
    if (players.includes(user) || r.promised[user] || players.length + coming < CASUAL_PLAYERS) {
      r.promised[user] = now + PROMISE_MS;
      return { key: r.key, name: r.name };
    }
  }
  const words = ['paper', 'ink', 'stack', 'token', 'prompt', 'cursor', 'rotor', 'beam'];
  for (;;) {
    const name = `Casual ${words[Math.floor(Math.random() * words.length)]} ${Math.floor(Math.random() * 90 + 10)}`, key = name.toLowerCase();
    if (rooms.get(key)?.seats.length || !makeRoom(name, key, '', true)) continue;
    openCasual.push({ key, name, created: now, promised: { [user]: now + PROMISE_MS } });
    return { key, name };
  }
}

// ---------- HTTP: the API and the page ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.css': 'text/css' };
const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function bodyOf(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) break; }
  try { return JSON.parse(raw); } catch { return {}; }
}
const userFrom = req => signedIn(req.headers.authorization?.replace(/^Bearer /, ''));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === GAME) { res.writeHead(301, { location: GAME + '/' + url.search }); res.end(); return; }
    if (url.pathname.startsWith(API + '/')) {
      const path = url.pathname.slice(API.length);
      if (path === '/rooms' && req.method === 'POST') {
        if (!await userFrom(req)) return json(res, { error: 'Sign in to create a room.' }, 401);
        const body = await bodyOf(req), checked = roomName(body.name);
        if (checked.error) return json(res, checked, 400);
        const password = String(body.password ?? '');
        if (password.length > 64) return json(res, { error: 'Keep the password under 64 characters.' }, 400);
        const room = makeRoom(checked.name, checked.key, password);
        if (!room) return json(res, { error: 'That room is in use. Pick another name.' }, 409);
        return json(res, { name: checked.name, key: checked.key, invite: room.info.invite });
      }
      if (path === '/casual' && req.method === 'POST') {
        const user = await userFrom(req);
        if (!user) return json(res, { error: 'Sign in to play a casual match.' }, 401);
        return json(res, findCasual(user));
      }
      if (path === '/leaderboard' && req.method === 'GET') return json(res, { players: topPlayers() });
      if (path === '/health' && req.method === 'GET') {
        const mem = process.memoryUsage();
        return json(res, { ok: true, rooms: rooms.size, matches: sims.live.size, warm: sims.warmCount(), rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), step: sims.last });
      }
      res.writeHead(404); res.end('Not found'); return;
    }
    if (url.pathname.startsWith(GAME + '/')) {
      const rel = normalize(decodeURIComponent(url.pathname.slice(GAME.length + 1)) || 'index.html');
      if (rel.startsWith('..')) { res.writeHead(404); res.end(); return; }
      const file = join(PAGE_DIR, rel);
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      // the page's online features are on for known hosts: this is one, whatever it's called
      res.end(rel === 'index.html' ? data.toString().replace('<head>', '<head><script>window.__BB_ONLINE=true</script>') : data);
      return;
    }
    res.writeHead(302, { location: GAME + '/' }); res.end();
  } catch (err) {
    if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not found'); return; }
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

// ---------- WebSockets ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
server.on('upgrade', (req, socket, head) => {
  const m = new URL(req.url, 'http://x').pathname.match(/^\/games\/botbattle\/api\/rooms\/([^/]+)\/ws$/);
  const key = m && decodeURIComponent(m[1]).trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key || !/^[a-z0-9 ]{3,16}$/.test(key)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    ws.lastHeard = Date.now();
    const room = rooms.get(key);
    const signIn = setTimeout(() => { if (!ws.seatId) ws.close(4001, 'Too slow to sign in'); }, 10000);
    ws.on('message', (data, isBinary) => {
      ws.lastHeard = Date.now();
      if (isBinary) return;
      const raw = data.toString();
      if (raw === '{"t":"ping"}') { ws.send('{"t":"pong"}'); return; }
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!room) { ws.send(JSON.stringify({ t: 'error', error: "There's no room with that name." })); ws.close(4000, 'refused'); return; }
      if (!ws.seatId) { if (msg.t === 'hello' && !ws.saidHello) { ws.saidHello = true; room.hello(ws, msg).catch(err => console.error(err)); } return; }
      room.handle(ws, msg, raw);
    });
    ws.on('close', code => { clearTimeout(signIn); room?.closed(ws, code); });
    ws.on('error', () => {});
  });
});
const sweep = setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) if (now - ws.lastHeard > SILENT_MS) ws.terminate();
}, 15000);
sweep.unref();

if (SOCKET) {
  rmSync(SOCKET, { force: true });
  server.listen(SOCKET, () => { chmodSync(SOCKET, 0o660); console.log(`bot battle server on ${SOCKET}`); });
} else server.listen(PORT, HOST, () => console.log(`bot battle server on http://${HOST}:${PORT}${GAME}/`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { sims.shutdown(); server.close(); process.exit(0); });
