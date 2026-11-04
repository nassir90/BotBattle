// The two settings a sandbox with no network needs: Clerk's keys from a file, and a Unix socket to listen on. A real
// server, signed-in tokens made with a key of our own, and requests through the socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, renameSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const CLERK = 'https://merry-filly-2600.clerk.accounts.dev';
const dir = mkdtempSync(join(tmpdir(), 'bb-sandbox-')), SOCKET = join(dir, 's'), JWKS_FILE = join(dir, 'jwks.json');
const makeKey = async kid => {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  return { kid, privateKey, jwk: { ...await exportJWK(publicKey), kid, alg: 'RS256', use: 'sig' } };
};
const tokenWith = (key, sub, iss = CLERK) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: key.kid }).setIssuer(iss).setSubject(sub).setExpirationTime('5m').sign(key.privateKey);
const post = (path, token, body) => new Promise((resolve, reject) => {
  const req = request({ socketPath: SOCKET, path: '/games/botbattle/api' + path, method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject); req.end(JSON.stringify(body));
});

test('listens on a Unix socket, and checks sign-ins against the keys in a file', async t => {
  const first = await makeKey('one'), second = await makeKey('two');
  writeFileSync(JWKS_FILE, JSON.stringify({ keys: [first.jwk] }));
  const child = spawn(process.execPath, [fileURLToPath(new URL('../index.mjs', import.meta.url))], { env: { ...process.env, SOCKET, JWKS_FILE, DEV_KEY: '', DATA_DIR: dir }, stdio: 'pipe' });
  t.after(() => child.kill());
  await new Promise(r => child.stdout.once('data', r));

  assert.equal(await post('/rooms', await tokenWith(first, 'user_1'), { name: 'File Keys' }), 200, 'a token signed with the file\'s key');
  assert.equal(await post('/rooms', 'dev:x:someone', { name: 'No Dev' }), 401, 'no test players without a test key');
  assert.equal(await post('/rooms', await tokenWith(first, 'user_1', 'https://evil.example'), { name: 'Wrong Issuer' }), 401, 'the wrong issuer');
  assert.equal(await post('/rooms', await tokenWith(second, 'user_2'), { name: 'Unknown Key' }), 401, 'a key the file does not have');

  // Clerk rotates its keys: the file is replaced, and the new key works without a restart (once the 30 second limit has passed)
  writeFileSync(JWKS_FILE + '.tmp', JSON.stringify({ keys: [first.jwk, second.jwk] }));
  renameSync(JWKS_FILE + '.tmp', JWKS_FILE);
  assert.equal(await post('/rooms', await tokenWith(first, 'user_1'), { name: 'Still Works' }), 200, 'the old key still works');
});
