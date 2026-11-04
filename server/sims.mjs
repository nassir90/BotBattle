// The workers that run matches: one per match on, and one warm in reserve while a match could start, so it needn't wait
// for one to load. With nobody around there are none at all.
import { Worker } from 'node:worker_threads';

const WORKER = new URL('./sim-worker.mjs', import.meta.url);
const COOL_MS = Number(process.env.COOL_MS) || 60 * 1000;      // the reserve outlasts the last lobby by this long: comings and goings don't each load a worker
const STEP_LOG = !!process.env.STEP_LOG;                       // every worker's figures on stdout, for bench.mjs
const idle = [];
let coolTimer = null;
export const live = new Set();
export const last = { steps: 0, meanMs: 0, worstMs: 0 };

function spawn() {
  // left alone, a worker's young generation grows to 32 MB of pages it holds on to, and a match makes about 5 MB of
  // short-lived garbage a second. At 6 MB it's collected twice a second, and each time takes well under a millisecond
  const w = new Worker(WORKER, { resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 6 } });
  w.handlers = null;
  w.on('message', msg => {
    if (typeof msg === 'string') { w.handlers?.out(msg); return; }
    if (msg.t === 'stats') { Object.assign(last, msg); if (STEP_LOG) console.log('step', JSON.stringify(msg)); }
    else if (msg.t === 'error') { console.error('match error:', msg.error); w.handlers?.crash(); }
  });
  w.on('error', err => { console.error('worker error:', err); idle.splice(idle.indexOf(w) >>> 0, 1); live.delete(w); w.handlers?.crash(); });
  return w;
}
// the reserve, kept topped up
export function warm() {
  clearTimeout(coolTimer); coolTimer = null;
  if (!idle.length) idle.push(spawn());
}
export function cool() {
  coolTimer ??= setTimeout(() => { coolTimer = null; for (const w of idle.splice(0)) w.terminate(); }, COOL_MS);
  coolTimer.unref?.();
}
export const warmCount = () => idle.length;
export function acquire(handlers) {
  const w = idle.pop() || spawn();
  w.handlers = handlers;
  live.add(w);
  return w;
}
export function release(w) {
  w.handlers = null;
  w.postMessage({ t: 'stop' });
  live.delete(w);
  if (idle.length) w.terminate(); else idle.push(w);
}
export function shutdown() { for (const w of [...idle, ...live]) w.terminate(); idle.length = 0; live.clear(); }
