// Plays the same matches every time: a clock that only moves when told, seeded dice and scripted players. Prints a hash
// of every message the game sends. node fixed-match.mjs <sim file> <seed>
import { createHash } from 'node:crypto';
const IN = { left: 1, right: 2, down: 4, up: 8, fire: 16, jump: 32, parry: 64, a1: 512, strike: 8192, guard: 16384, grab: 32768 };

const [simFile, seedArg] = process.argv.slice(2);
const seed = Number(seedArg) || 1;
const dice = s => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
// the ids three gives its objects have their own dice: how many objects get made isn't a rule. So do the inhale's
// particles, for the same reason: they're only drawn
let rules = dice(seed); const ids = dice(seed ^ 0x55aa55), drawing = dice(seed ^ 0x33cc33), player = dice(seed * 31 + 7);
Error.stackTraceLimit = 4;
Math.random = () => {
  const at = {}; Error.captureStackTrace(at);
  return at.stack.includes('generateUUID') ? ids() : /forEach.*\n.*updateInhale/.test(at.stack) ? drawing() : rules();
};
let now = 1000, nextTimer = 1;
const timers = new Map();
Object.defineProperty(performance, 'now', { value: () => now });
Date.now = () => 1700000000000 + Math.floor(now);
globalThis.setTimeout = (fn, ms = 0, ...args) => { const id = nextTimer++; timers.set(id, { at: now + ms, fn, args }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
function runTimers() {
  for (;;) {
    const due = [...timers].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!due) return;
    timers.delete(due[0]); due[1].fn(...due[1].args);
  }
}

await import('../dom-shim.mjs');
let game = null;
globalThis.__bbHeadless = api => { game = api; };
await import(simFile);
rules = dice(seed);                  // (what's rolled while it loads isn't a rule either: only the cards' fighters roll)
const sent = [], events = {};
game.net.ws = { readyState: 1, send: data => { sent.push(data); } };

const HOLDS = [IN.left, IN.right, IN.left | IN.jump, IN.right | IN.jump, IN.down, IN.up, IN.guard, IN.grab, IN.fire, 0];
const PRESSES = [IN.a1, IN.a1 * 2, IN.a1 * 4, IN.a1 * 8, IN.strike, IN.jump, IN.parry, IN.grab, IN.fire, 128, 256];
const pickOf = list => list[Math.floor(player() * list.length)];
// everyone walks at the nearest fighter most of the time, and presses things
function play(kit, lives, frames, script = {}) {
  const players = kit.map(([kind, variant], i) => ({ id: `p${i}`, name: `P${i}`, kind, variant }));
  game.beginOnline({ mid: `m${sent.length}`, lives, host: '@server', players });
  const held = players.map(() => 0);
  let last = null, seq = 0, over = false;
  for (let f = 0; f < frames && !over; f++) {
    now += 1000 / 60; runTimers();
    if (f % 2 === 0) for (const [i, p] of players.entries()) {
      if (player() < 0.05) held[i] = pickOf(HOLDS);
      let b = held[i];
      if (last && player() < 0.8) {
        const me = last.f[i], others = last.f.filter((o, j) => j !== i && !o[7]).sort((x, y) => Math.abs(x[0] - me[0]) - Math.abs(y[0] - me[0]));
        if (others.length) b = (b & ~3) | (others[0][0] > me[0] ? IN.right : IN.left);
      }
      if (player() < 0.15) b |= pickOf(PRESSES);
      game.onNet({ t: 'in', id: p.id, b: b & 0xffff, s: ++seq });
    }
    if (script[f]) game.onNet({ t: script[f], id: players.at(-1).id });
    const from = sent.length;
    game.frame(1 / 60);
    for (const data of sent.slice(from)) {
      if (data.startsWith('{"t":"result"')) over = true;
      if (data.startsWith('{"t":"snap"')) { last = JSON.parse(data); for (const e of last.ev) events[e.t ?? e[0]] = (events[e.t ?? e[0]] || 0) + 1; }
    }
  }
  game.net.match = null;
}
const so = ['so', 'orange'], so2 = ['so', 'blue'], gpt = ['gpt', 'green'], gpt2 = ['gpt', 'white'], claude = ['claude', 'orange'], claude2 = ['claude', 'black'];
play([so, gpt], 1, 7200); play([gpt, claude], 2, 7200); play([claude, so], 3, 7200);
play([so2, gpt2], 1, 7200); play([claude2, so2], 2, 7200); play([gpt2, claude2], 3, 7200);
play([so, so2], 1, 7200); play([gpt, gpt2], 1, 7200); play([claude, claude2], 1, 7200);
play([so, gpt, claude, so2], 3, 9000);
play([so, claude, gpt], 2, 3600, { 600: 'left' }); play([gpt, claude], 1, 3600, { 400: 'away', 700: 'back' });
console.log(JSON.stringify({ sha: createHash('sha256').update(sent.join('\n')).digest('hex'), messages: sent.length, events }));
process.exit(0);
