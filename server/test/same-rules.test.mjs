// The server's three.js has no vertices in its shapes (three-headless.mjs), on the understanding that only drawing reads
// them. If the game's rules ever start to, the same matches stop coming out the same with and without.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const run = async (sim, seed) => JSON.parse((await promisify(execFile)(process.execPath, [here('./fixed-match.mjs'), sim, seed])).stdout);

test('matches come out the same whether or not shapes have vertices', async () => {
  const code = readFileSync(here('../generated/sim.mjs'), 'utf8');
  assert.ok(code.includes("'../three-headless.mjs'"));
  writeFileSync(here('../generated/sim-with-vertices.mjs'), code.replace("'../three-headless.mjs'", "'../test/three-with-vertices.mjs'"));
  for (const seed of ['1', '2']) {
    const [without, withThem] = await Promise.all([run(here('../generated/sim.mjs'), seed), run(here('../generated/sim-with-vertices.mjs'), seed)]);
    assert.deepEqual(without, withThem);
    assert.ok(without.events.hit > 50 && without.events.die > 5 && without.events.grab > 0, JSON.stringify(without.events));
  }
});
