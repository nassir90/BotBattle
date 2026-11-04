// The server leaves out what only drawing needs: the vertices of shapes (three-headless.mjs), and the parts of the game
// behind its DRAWN constant. If the game's rules ever come to depend on any of that, the same matches stop coming out
// the same with and without.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const run = async (sim, seed) => JSON.parse((await promisify(execFile)(process.execPath, [here('./fixed-match.mjs'), sim, seed])).stdout);

test('matches come out the same with and without what only drawing needs', async () => {
  const code = readFileSync(here('../generated/sim.mjs'), 'utf8');
  assert.ok(code.includes("'../three-headless.mjs'") && code.includes('const DRAWN = !HEADLESS;'));
  writeFileSync(here('../generated/sim-drawn.mjs'), code.replace("'../three-headless.mjs'", "'../test/three-with-vertices.mjs'").replace('const DRAWN = !HEADLESS;', 'const DRAWN = true;'));
  for (const seed of ['1', '2']) {
    const [left, drawn] = await Promise.all([run(here('../generated/sim.mjs'), seed), run(here('../generated/sim-drawn.mjs'), seed)]);
    assert.deepEqual(left, drawn);
    assert.ok(left.events.hit > 50 && left.events.die > 5 && left.events.grab > 0, JSON.stringify(left.events));
  }
});
