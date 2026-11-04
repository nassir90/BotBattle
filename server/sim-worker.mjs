// One match at a time, in a worker of its own: the game's own rules (generated/sim.mjs), the dedicated server as its
// host, stepped 60 times a second. Everything it would send a host's room goes to the main thread as a string.
import { parentPort } from 'node:worker_threads';
import './dom-shim.mjs';

let game = null;
globalThis.__bbHeadless = api => { game = api; };
await import('./generated/sim.mjs');
if (!game) throw new Error('the game did not start headless');
game.net.ws = { readyState: 1, send: data => { parentPort.postMessage(data); } };

const STEP = 1 / 60, STEP_MS = 1000 / 60, MOST_STEPS = 5;
let running = false, next = 0, timer = null, busyMs = 0, worstMs = 0, steps = 0;
function loop() {
  if (!running) return;
  const now = performance.now();
  let n = 0;
  while (now >= next && n < MOST_STEPS) {
    const t0 = performance.now();
    try { game.frame(STEP); } catch (err) { parentPort.postMessage({ t: 'error', error: String(err && err.stack || err) }); running = false; return; }
    const ms = performance.now() - t0;
    busyMs += ms; worstMs = Math.max(worstMs, ms); steps++;
    next += STEP_MS; n++;
  }
  if (now - next > 250) next = now;                 // fell far behind (a stall): carry on from here, not at speed
  timer = setTimeout(loop, Math.max(0, next - performance.now()));
}
setInterval(() => {
  if (!steps) return;
  parentPort.postMessage({ t: 'stats', steps, meanMs: +(busyMs / steps).toFixed(3), worstMs: +worstMs.toFixed(3) });
  busyMs = 0; worstMs = 0; steps = 0;
}, 5000).unref();

parentPort.on('message', msg => {
  switch (msg.t) {
    case 'begin':
      game.beginOnline(msg.match);
      running = true; next = performance.now(); clearTimeout(timer); loop();
      return;
    case 'net': game.onNet(msg.m); return;
    case 'ko': game.ko(msg.i); return;
    case 'stop': running = false; clearTimeout(timer); game.net.match = null; return;
  }
});
parentPort.postMessage({ t: 'ready' });
