import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Bot, IN, hold, holdUntil, sleep, underWay } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());
const room = async (name, user = 'host', password) => (await srv.api('rooms', { name, password }, user)).body;
async function seated(name, users, kinds = ['so', 'claude', 'gpt', 'so', 'claude', 'gpt', 'so', 'claude']) {
  const made = await room(name, users[0]);
  const bots = [];
  for (const [i, u] of users.entries()) {
    const b = new Bot(srv, u);
    await b.connect(made.key, { invite: made.invite });
    b.pick(kinds[i]);
    bots.push(b);
  }
  await bots[0].until(b => b.lobby?.players.length === users.length && b.lobby.players.every(p => p.kind), 5000, 'everyone seated');
  return { made, bots };
}
async function readyAll(bots) {
  for (const b of bots) b.ready();
  await bots[0].until(b => b.lobby.players.every(p => p.ready), 5000, 'everyone ready');
}

test('creating a room needs signing in, and a name that is allowed', async () => {
  assert.equal((await srv.api('rooms', { name: 'No Auth' })).status, 401);
  assert.equal((await srv.api('rooms', { name: 'x' }, 'a')).status, 400);
  const first = await srv.api('rooms', { name: 'Taken Room' }, 'a');
  assert.equal(first.status, 200);
  const b = new Bot(srv, 'a'); await b.connect(first.body.key);
  assert.equal((await srv.api('rooms', { name: 'taken room' }, 'b')).status, 409);
  b.close();
});

test('a password room refuses a wrong password and lets the invite in', async () => {
  const made = await room('Secret Room', 'pw', 'hunter2');
  const wrong = new Bot(srv, 'wrong'); await wrong.connect(made.key, { password: 'nope' });
  assert.equal(wrong.error, 'Wrong password.');
  const right = new Bot(srv, 'right'); await right.connect(made.key, { password: 'hunter2' });
  assert.equal(right.error, undefined);
  const inv = new Bot(srv, 'inv'); await inv.connect(made.key, { invite: made.invite });
  assert.equal(inv.error, undefined);
  right.close(); inv.close();
});

test('a match: the server hosts, moves fighters, lands hits, knocks out, ends and records it', async () => {
  const { bots: [a, b] } = await seated('Full Match', ['mana', 'mbob']);
  a.send({ t: 'lives', n: 1 });
  await a.until(x => x.lobby.lives === 1, 3000, 'lives');
  await readyAll([a, b]);
  a.send({ t: 'start' });
  await a.until(x => x.start, 5000, 'start'); await b.until(x => x.start, 5000, 'start');
  assert.equal(a.start.host, '@server');
  assert.equal(a.lobby.dedicated, true);
  await a.until(x => x.snaps.length > 10, 8000, 'snapshots');
  await underWay(a);

  // a walks right to b: the server's snapshots show it, and acknowledge a's controls
  const x0 = a.me()[0];
  await hold(a, IN.right, 1500);
  await sleep(200);
  assert.ok(a.me()[0] > x0 + 1.5, `a moved: ${x0} -> ${a.me()[0]}`);
  assert.ok(a.snaps.at(-1).a[a.id] > 10, 'its controls are acknowledged');
  assert.ok(b.msgs.some(m => m.t === 'in' && m.id === a.id), "b hears a's controls");
  const relayed = b.msgs.filter(m => m.t === 'in').length;
  assert.ok(relayed < 10, `only changes are relayed, not every send (${relayed})`);

  // close the distance, then punch: a hit, as the server reports it, on both screens
  await holdUntil(a, IN.right, () => b.snaps.at(-1).f[1][0] - b.snaps.at(-1).f[0][0] <= 1.1);
  a.input(0); await sleep(150);
  for (let i = 0; i < 4 && !b.events.some(e => e[0] === 'hit'); i++) { a.input(IN.strike); await sleep(40); a.input(0); await sleep(500); }
  const hit = b.events.find(e => e[0] === 'hit');
  assert.ok(hit, 'a hit event reaches the other player');
  assert.equal(hit[1], 1); assert.equal(hit[2], 'h'); assert.equal(hit[6], 0);
  assert.ok(b.snaps.at(-1).f[1][5] < 100, 'health falls');

  // knock b out: the match ends for both, and the leaderboard has it
  a.send({ t: 'devKO', i: 1 });
  await a.until(x => x.events.some(e => e[0] === 'end'), 6000, 'the end');
  await b.until(x => x.events.some(e => e[0] === 'end'), 6000, 'the end');
  assert.equal(a.events.find(e => e[0] === 'end')[1], 'mana wins');
  await a.until(x => x.lobby.playing === false, 3000, 'match over');
  const players = (await srv.api('leaderboard')).body.players, row = players.find(p => p.name === 'mana');
  assert.equal(row.wins, 1); assert.equal(row.matches, 1); assert.ok(row.kos >= 1);
  a.close(); b.close();
});

test('a grab stays held between the controls a page sends, then a throw lands', async () => {
  const { bots: [a, b] } = await seated('Grab Room', ['ga', 'gb'], ['so', 'claude']);
  await readyAll([a, b]);
  a.send({ t: 'start' });
  await a.until(x => x.start, 5000, 'start');
  await underWay(a);
  await holdUntil(a, IN.right | IN.down, () => a.snaps.at(-1).f[1][0] - a.snaps.at(-1).f[0][0] <= 1.25);
  a.input(0); await sleep(200);
  const end = Date.now() + 700;
  while (Date.now() < end) { a.input(IN.grab); await sleep(33); }
  const grabbed = a.events.find(e => e[0] === 'grab');
  assert.ok(grabbed, 'the server catches');
  assert.equal(a.snaps.at(-1).f[0][10], 1, 'still holding, long after the catch');
  for (let i = 0; i < 25; i++) { a.input(IN.grab | IN.right); await sleep(33); }
  a.input(0);
  await a.until(x => x.events.some(e => e[0] === 'hit' && e[7] === 1), 3000, 'the throw');
  a.close(); b.close();
});

test('the host leaving does not end the match: nobody has to keep a tab open', async () => {
  const { bots: [host, guest] } = await seated('Host Leaves', ['lhost', 'lguest']);
  host.send({ t: 'lives', n: 1 }); await readyAll([host, guest]);
  host.send({ t: 'start' });
  await guest.until(x => x.snaps.length > 5, 8000, 'snapshots');
  host.close();
  await guest.until(x => x.events.some(e => e[0] === 'end'), 10000, 'the end');
  assert.equal(guest.events.find(e => e[0] === 'end')[1], 'lguest wins');
  assert.ok(!guest.msgs.some(m => m.t === 'abort'), 'no abort');
  await guest.until(x => x.lobby.host === guest.id, 3000, 'host passes on');
  guest.close();
});

test('a dropped connection keeps the seat for the grace period, then it is gone', async () => {
  const { bots: [a, b] } = await seated('Drop Room', ['da', 'db']);
  b.ws.terminate();
  await a.until(x => x.lobby.players.find(p => p.id === 'dev:db')?.away === true, 3000, 'away');
  const back = new Bot(srv, 'db'); await back.connect('drop room');
  await a.until(x => x.lobby.players.find(p => p.id === 'dev:db')?.away === false, 3000, 'back');
  back.ws.terminate();
  await a.until(x => x.lobby.players.length === 1, 4000, 'gone after the grace');
  a.close();
});

test('a free-for-all takes four at most; a room holds eight', async () => {
  const users = ['f1', 'f2', 'f3', 'f4', 'f5'], { made, bots } = await seated('Five Room', users);
  await readyAll(bots);
  bots[0].send({ t: 'start' }); await sleep(300);
  assert.equal(bots[0].lobby.playing, false, 'five cannot start a free-for-all');
  const more = [];
  for (const u of ['f6', 'f7', 'f8']) { const x = new Bot(srv, u); await x.connect(made.key, { invite: made.invite }); more.push(x); }
  const ninth = new Bot(srv, 'f9'); await ninth.connect(made.key, { invite: made.invite });
  assert.match(ninth.error, /full/);
  [...bots, ...more].forEach(b => b.close());
});

test('four fighters can play one free-for-all', async () => {
  const { bots } = await seated('Four Room', ['q1', 'q2', 'q3', 'q4']);
  await readyAll(bots); bots[0].send({ t: 'start' });
  await bots[3].until(x => x.snaps.length > 5, 8000, 'snapshots');
  assert.equal(bots[3].snaps.at(-1).f.length, 4);
  assert.deepEqual([...new Set(bots[3].snaps.at(-1).f.map(f => f[0]))].length, 4, 'four spawn points');
  bots.forEach(b => b.close());
});

test('a bracket: a bye watches, the winner goes through, the final takes two games, and leaving forfeits', async () => {
  const { bots } = await seated('Bracket Room', ['b1', 'b2', 'b3']), [h] = bots;
  h.send({ t: 'format', f: 'bracket' }); h.send({ t: 'lives', n: 1 });
  await h.until(x => x.lobby.format === 'bracket', 3000, 'format');
  await readyAll(bots);
  h.send({ t: 'start' });
  await h.until(x => x.start, 5000, 'start');
  assert.equal(h.start.players.length, 2);
  const inMatch = h.start.players.map(p => p.id), watcher = bots.find(b => !inMatch.includes(b.id));
  await watcher.until(x => x.snaps.length > 5, 8000, 'the watcher sees the match');
  // the watcher's controls do nothing
  const f0 = JSON.stringify(watcher.snaps.at(-1).f.map(f => f[5])); watcher.input(IN.strike); await sleep(100);
  assert.equal(JSON.stringify(watcher.snaps.at(-1).f.map(f => f[5])), f0);

  const finishOne = async () => {
    await h.until(x => x.start && x.snaps.length > 2, 8000, 'match snapshots');
    h.send({ t: 'devKO', i: 1 });
    await h.until(x => x.lobby.playing === false, 8000, 'the match to end');
  };
  await finishOne();
  assert.equal(h.lobby.bracket.rounds[0].flatMap(m => [m.w]).filter(w => w !== null).length, 2);
  const final = () => h.lobby.bracket.rounds.at(-1)[0];
  assert.ok(final().a !== null && final().b !== null, 'the final has both players');

  h.start = null; h.send({ t: 'start' }); await h.until(x => x.start, 5000, 'game 1');
  await finishOne();
  assert.equal(final().w, null, 'one game does not end the final');
  assert.deepEqual([...final().s].sort(), [0, 1]);
  h.start = null; h.send({ t: 'start' }); await h.until(x => x.start, 5000, 'game 2');
  await finishOne();
  assert.ok(h.lobby.bracket.champion !== null, 'there is a champion');
  bots.forEach(b => b.close());
});

test('a bracket entrant who leaves before their match forfeits it', async () => {
  const { bots } = await seated('Forfeit Room', ['g1', 'g2', 'g3', 'g4']), [h] = bots;
  h.send({ t: 'format', f: 'bracket' }); await h.until(x => x.lobby.format === 'bracket', 3000, 'format');
  await readyAll(bots);
  h.send({ t: 'start' });
  await h.until(x => x.start && x.lobby.bracket, 5000, 'start');
  const playing = h.start.players.map(p => p.id), out = bots.find(b => !playing.includes(b.id) && b !== h);    // (of the two not playing, one isn't the host)
  out.close();
  await h.until(x => x.lobby.bracket.entrants.find(e => e.id === out.id)?.gone, 3000, 'gone');
  const r0 = h.lobby.bracket.rounds[0], idx = h.lobby.bracket.entrants.findIndex(e => e.id === out.id);
  const theirs = r0.find(m => m.a === idx || m.b === idx);
  assert.equal(theirs.w, theirs.a === idx ? theirs.b : theirs.a, 'the other side goes through');
  bots.forEach(b => { try { b.close(); } catch { /* gone */ } });
});

test('casual: two players are matched and it starts when both are ready', async () => {
  const one = (await srv.api('casual', {}, 'c1')).body, two = (await srv.api('casual', {}, 'c2')).body;
  assert.equal(one.key, two.key);
  const a = new Bot(srv, 'c1'), b = new Bot(srv, 'c2');
  await a.connect(one.key); await b.connect(two.key);
  a.pick('so'); b.pick('gpt');
  await a.until(x => x.lobby?.players.length === 2 && x.lobby.players.every(p => p.kind), 3000, 'picks');
  a.ready(); b.ready();
  await b.until(x => x.start, 5000, 'casual start');
  a.close(); b.close();
});

test('the server is still healthy, with no match left running', async () => {
  await sleep(1200);
  const h = (await srv.api('health')).body;
  assert.equal(h.ok, true);
  assert.equal(srv.log().match(/error/i), null, srv.log());
});

test('a worker is warm only while a match could start, and a server nobody is on has none', async () => {
  const quiet = await startServer({ COOL_MS: '200' });
  const warm = async () => (await quiet.api('health')).body.warm;
  try {
    assert.equal(await warm(), 0);
    const made = (await quiet.api('rooms', { name: 'Reserve' }, 'r1')).body;
    assert.equal(await warm(), 0);
    const a = new Bot(quiet, 'r1'), b = new Bot(quiet, 'r2');
    await a.connect(made.key, { invite: made.invite }); await b.connect(made.key, { invite: made.invite });
    assert.equal(await warm(), 1);
    a.pick('so'); b.pick('claude');
    await a.until(x => x.lobby?.players.length === 2 && x.lobby.players.every(p => p.kind), 5000, 'picks');
    a.ready(); b.ready();
    await a.until(x => x.lobby.players.every(p => p.ready), 5000, 'ready');
    a.send({ t: 'start' });
    await a.until(x => x.snaps.length > 3, 8000, 'snapshots');
    assert.deepEqual([(await quiet.api('health')).body.matches, await warm()], [1, 0]);
    a.close(); b.close();
    await sleep(600);
    assert.deepEqual([(await quiet.api('health')).body.matches, await warm()], [0, 0]);
  } finally { quiet.stop(); }
});
