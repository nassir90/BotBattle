// Load on the server: N matches of two bots each, walking and attacking as players would, for a while. Prints the
// server's memory and CPU use (of the whole process, workers included), how long each game step takes, and how late
// snapshots reach the bots.   node bench.mjs [matches=4] [seconds=30]
// Each memory figure comes twice. rss counts the pages of the node binary and its libraries, which other processes
// share and which barely change here. private is what this process alone holds, and is the one to compare: RssAnon on
// Linux, the physical footprint on a Mac.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { startServer, Bot, sleep } from './test/helpers.mjs';

const MATCHES = Number(process.argv[2]) || 4, SECONDS = Number(process.argv[3]) || 30;
const srv = await startServer({ GRACE_MS: '30000' });
function privateMb(pid) {
  if (process.platform === 'linux') return Math.round(readFileSync(`/proc/${pid}/status`, 'utf8').match(/RssAnon:\s+(\d+)/)[1] / 1024);
  const m = execSync(`vmmap -summary ${pid}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(/Physical footprint:\s+([\d.]+)([KMG])/);
  return Math.round(m[1] * { K: 1 / 1024, M: 1, G: 1024 }[m[2]]);
}
const sample = () => {
  const [rss, cpu] = execSync(`ps -o rss=,cputime= -p ${srv.child.pid}`).toString().trim().split(/\s+/);
  const parts = cpu.split(':').map(Number);
  return { rssMb: Math.round(rss / 1024), privateMb: privateMb(srv.child.pid), cpuS: parts.reduce((t, v) => t * 60 + v, 0) };
};
await sleep(5000);           // whatever the server loads at start has finished loading
const idle = sample();
const bots = [];
for (let i = 0; i < MATCHES; i++) {
  const made = (await srv.api('rooms', { name: `Bench ${i}` }, `h${i}`)).body;
  const a = new Bot(srv, `a${i}`), b = new Bot(srv, `b${i}`);
  await a.connect(made.key, { invite: made.invite }); await b.connect(made.key, { invite: made.invite });
  a.pick(['so', 'gpt', 'claude'][i % 3]); b.pick(['claude', 'so', 'gpt'][i % 3]);
  await a.until(x => x.lobby?.players.length === 2 && x.lobby.players.every(p => p.kind), 5000, 'picks');
  a.ready(); b.ready();
  await a.until(x => x.lobby.players.every(p => p.ready), 5000, 'ready');
  a.send({ t: 'start' });
  bots.push(a, b);
}
const gaps = [];
for (const b of bots) { let last = 0; b.ws.on('message', raw => { if (raw.toString().startsWith('{"t":"snap"')) { const now = performance.now(); if (last) gaps.push(now - last); last = now; } }); }
// play: walk back and forth, jump and press the moves, as a steady 30 sends a second
const BITS = [2, 1, 2, 1, 32, 512, 1024, 2048, 4096, 8192, 32768, 16384];
let t = 0;
const play = setInterval(() => { t++; for (const [i, b] of bots.entries()) { const phase = Math.floor((t + i * 7) / 20) % BITS.length; b.input(t % 2 ? BITS[phase] : BITS[phase] & (31 | 16384)); } }, 33);
await sleep(10000);          // past the versus wait
const c0 = sample(), t0 = performance.now(); gaps.length = 0;
await sleep(SECONDS * 1000);
const wall = (performance.now() - t0) / 1000, c1 = sample();
clearInterval(play);
const health = (await srv.api('health')).body;
// everyone leaves: what the server keeps once the matches have stopped (the rooms stay until they time out)
for (const b of bots) b.close();
await sleep(5000);
const done = sample();
gaps.sort((x, y) => x - y);
console.log(JSON.stringify({
  matches: MATCHES, matchesStillOn: health.matches,
  idleRssMb: idle.rssMb, loadedRssMb: c1.rssMb, afterRssMb: done.rssMb, perMatchRssMb: Math.round((c1.rssMb - idle.rssMb) / MATCHES),
  idlePrivateMb: idle.privateMb, loadedPrivateMb: c1.privateMb, afterPrivateMb: done.privateMb, perMatchPrivateMb: Math.round((c1.privateMb - idle.privateMb) / MATCHES),
  cpuPercentOfOneCore: Math.round((c1.cpuS - c0.cpuS) / wall * 100), serverHealth: health,
  snapGapMs: { p50: Math.round(gaps[gaps.length >> 1]), p99: Math.round(gaps[Math.floor(gaps.length * 0.99)]), max: Math.round(gaps.at(-1) || 0) },
}, null, 1));
srv.stop();
process.exit(0);
