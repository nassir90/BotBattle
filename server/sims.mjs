// The workers that run matches: one per match on, and one warm in reserve so a match needn't wait for one to load.
import { Worker } from 'node:worker_threads';

const WORKER = new URL('./sim-worker.mjs', import.meta.url);
const idle = [];
export const live = new Set();
export const last = { steps: 0, meanMs: 0, worstMs: 0 };

function spawn() {
  const w = new Worker(WORKER, { resourceLimits: { maxOldGenerationSizeMb: 128 } });
  w.handlers = null;
  w.on('message', msg => {
    if (typeof msg === 'string') { w.handlers?.out(msg); return; }
    if (msg.t === 'stats') Object.assign(last, msg);
    else if (msg.t === 'error') { console.error('match error:', msg.error); w.handlers?.crash(); }
  });
  w.on('error', err => { console.error('worker error:', err); idle.splice(idle.indexOf(w) >>> 0, 1); live.delete(w); w.handlers?.crash(); });
  return w;
}
// the reserve, kept topped up
export function warm() { if (!idle.length) idle.push(spawn()); }
export function acquire(handlers) {
  const w = idle.pop() || spawn();
  w.handlers = handlers;
  live.add(w);
  warm();
  return w;
}
export function release(w) {
  w.handlers = null;
  w.postMessage({ t: 'stop' });
  live.delete(w);
  if (idle.length) w.terminate(); else idle.push(w);
}
export function shutdown() { for (const w of [...idle, ...live]) w.terminate(); idle.length = 0; live.clear(); }
