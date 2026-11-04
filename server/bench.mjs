// Load on the server: N matches of two bots each, walking and attacking as players would, for a while. Prints the
// server's memory and CPU use (of the whole process, workers included), how long each game step takes, and how late
// snapshots reach the bots.   node bench.mjs [matches=4] [seconds=30]
// SERVER_NODE_ARGS in the environment adds flags to the server's node, to try one or to profile it.
// Each memory figure comes twice. rss counts the pages of the node binary and its libraries, which other processes
// share and which barely change here. private is what this process alone holds, and is the one to compare: RssAnon on
// Linux, the physical footprint on a Mac.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { startServer, Bot, sleep } from './test/helpers.mjs';

const MATCHES = Number(process.argv[2]) || 4, SECONDS = Number(process.argv[3]) || 30;
const srv = await startServer({ GRACE_MS: '30000', STEP_LOG: '1' });
function privateMb(pid) {
  if (process.platform === 'linux') return Math.round(readFileSync(`/proc/${pid}/status`, 'utf8').match(/RssAnon:\s+(\d+)/)[1] / 1024);
  const m = execSync(`vmmap -summary ${pid}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().match(/Physical footprint:\s+([\d.]+)([KMG])/);
  return Math.round(m[1] * { K: 1 / 1024, M: 1, G: 1024 }[m[2]]);
}
// CPU and memory are read apart: on a Mac, reading memory stops the server for most of a second, so none of it may
// happen inside a timed window
const cpuS = () => {
  const cpu = execSync(`ps -o cputime= -p ${srv.child.pid}`).toString().trim();
  return cpu.split(':').map(Number).reduce((t, v) => t * 60 + v, 0);
};
// the main thread's alone, the one every match's sockets share
function mainCpuS() {
  if (process.platform === 'linux') {
    const f = readFileSync(`/proc/${srv.child.pid}/task/${srv.child.pid}/stat`, 'utf8').split(') ')[1].split(' ');
    return (Number(f[11]) + Number(f[12])) / 100;
  }
  const row = execSync(`ps -M -p ${srv.child.pid}`).toString().split('\n')[1];
  return [...row.matchAll(/\b(\d+):(\d+\.\d+)\b/g)].reduce((t, m) => t + Number(m[1]) * 60 + Number(m[2]), 0);
}
// a stretch of time and the CPU spent in it, as percentages of one core
async function cpuOver(seconds) {
  const c0 = cpuS(), m0 = mainCpuS(), t0 = performance.now();
  await sleep(seconds * 1000);
  const wall = (performance.now() - t0) / 1000;
  return { all: (cpuS() - c0) / wall * 100, main: (mainCpuS() - m0) / wall * 100 };
}
const memory = () => ({ rssMb: Math.round(execSync(`ps -o rss= -p ${srv.child.pid}`).toString().trim() / 1024), privateMb: privateMb(srv.child.pid) });
// each worker's figures every 5 seconds, when they arrive
const stepReports = [];
srv.child.stdout.on('data', d => { for (const m of String(d).matchAll(/^step (.*)$/gm)) stepReports.push({ at: performance.now(), ...JSON.parse(m[1]) }); });
await sleep(5000);           // whatever the server loads at start has finished loading
const idleCpu = await cpuOver(10);
const idle = memory();
const cpuBeforeMatches = cpuS();
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
let windowFrom = Infinity;
for (const b of bots) { let last = 0; b.ws.on('message', raw => { if (raw.toString().startsWith('{"t":"snap"')) { const now = performance.now(); if (last && last >= windowFrom) gaps.push(now - last); last = now; } }); }
// play: walk back and forth, jump and press the moves, as a steady 30 sends a second
const BITS = [2, 1, 2, 1, 32, 512, 1024, 2048, 4096, 8192, 32768, 16384];
let t = 0;
const play = setInterval(() => { t++; for (const [i, b] of bots.entries()) { const phase = Math.floor((t + i * 7) / 20) % BITS.length; b.input(t % 2 ? BITS[phase] : BITS[phase] & (31 | 16384)); } }, 33);
await sleep(10000);          // past the versus wait
// what getting the matches going cost: their workers loading, and the code warming up
const startCpuS = cpuS() - cpuBeforeMatches;
windowFrom = performance.now();
const loadedCpu = await cpuOver(SECONDS);
const windowTo = performance.now(), seen = [...gaps].sort((x, y) => x - y);
await sleep(100);            // (a report from inside the window may still be on its way)
const steps = stepReports.filter(r => r.at > windowFrom + 5000 && r.at < windowTo + 100);
const stepCount = steps.reduce((n, r) => n + r.steps, 0);
const loaded = memory();
clearInterval(play);
const health = (await srv.api('health')).body;
// everyone leaves: what the server keeps once the matches have stopped (the rooms stay until they time out)
for (const b of bots) b.close();
await sleep(5000);
const afterCpu = await cpuOver(10);
const done = memory();
console.log(JSON.stringify({
  matches: MATCHES, matchesStillOn: health.matches,
  idleRssMb: idle.rssMb, loadedRssMb: loaded.rssMb, afterRssMb: done.rssMb, perMatchRssMb: Math.round((loaded.rssMb - idle.rssMb) / MATCHES),
  idlePrivateMb: idle.privateMb, loadedPrivateMb: loaded.privateMb, afterPrivateMb: done.privateMb, perMatchPrivateMb: Math.round((loaded.privateMb - idle.privateMb) / MATCHES),
  // as percentages of one core: with nobody on, with the matches on, and once they've gone. startCpuS is seconds, over
  // the matches' first 10 seconds
  idleCpu: +idleCpu.all.toFixed(2), cpuPercentOfOneCore: +loadedCpu.all.toFixed(1), perMatchCpu: +((loadedCpu.all - idleCpu.all) / MATCHES).toFixed(2), mainThreadCpu: +loadedCpu.main.toFixed(2), afterCpu: +afterCpu.all.toFixed(2), startCpuS: +startCpuS.toFixed(2),
  step: { steps: stepCount, meanMs: +(steps.reduce((t, r) => t + r.steps * r.meanMs, 0) / stepCount).toFixed(3), worstMs: Math.max(...steps.map(r => r.worstMs)), overMs: steps.reduce((t, r) => t + (r.over || 0), 0) },
  serverHealth: health,
  snapGapMs: { p50: Math.round(seen[seen.length >> 1]), p99: Math.round(seen[Math.floor(seen.length * 0.99)]), max: Math.round(seen.at(-1) || 0) },
}, null, 1));
srv.stop();
process.exit(0);
