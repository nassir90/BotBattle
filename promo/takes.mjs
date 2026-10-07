// The Bot Battle takes, recorded with TapaTab (~/projects/TapaTab, see its README):
//   node ~/projects/TapaTab/tapatab.mjs takes.mjs [brawl so gpt claude parry] [--to SECONDS]
// Each take stages one scene in training mode (or the CPU brawl) and plays it with real key presses for the player,
// plus `__app.fire(...)` for the dummies' moves so they land on cue. Times are seconds into the take.
// Output: clips/<take>.mp4, clips/<take>.h264 and clips/<take>/meta.json.

// The game's state lives inside one closure, so this is spliced in as the page is served (the shipped page is never
// changed). It exposes just enough to stage scenes: start a match, place fighters, fire a fighter's move, and read
// where things are on screen for the callouts.
const HOOK = `
  window.__app = {
    get fighters() { return fighters; }, startMatch, camera, keys: KEYS_FOR,
    get split() { return split; },
    get: kind => fighters.find(f => f.kind === kind),
    dummies: m => { dummyMode = m; },
    fire(kind, slot, face) {
      const f = fighters.find(q => q.kind === kind);
      if (!f || f.dead) return false;
      if (face) f.facing = face;
      f.cd[slot] = 0; f.busy = 0;
      return tryAbility(f, slot);
    },
    place(kind, x, facing) {
      const f = fighters.find(q => q.kind === kind);
      f.x = x; f.vx = 0; f.spawnX = x; if (facing) f.facing = facing;
      f.prevFacing = f.facing;
      f.feet.forEach(ft => { ft.x = x + f.facing * ft.s * FOOT_SPREAD; ft.y = 0; ft.stepping = false; });
      camSnap = true;
    },
    // a point in the scene, in frame pixels
    screen(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth * devicePixelRatio, (1 - p.y) / 2 * innerHeight * devicePixelRatio]; },
    mouth: kind => { const f = fighters.find(q => q.kind === kind); return f && f.rotor ? mouthOf(f) : null; },
    inhaling: kind => { const f = fighters.find(q => q.kind === kind); return !!(f && f.inhale); },
    // CPUs only: a duel or a free-for-all among the kinds given, with that many lives; when one is left standing
    // the real results table comes up (autoResult, called before every frame)
    cpuMatch(kinds, lives, maxDist) {
      ['menu', 'select', 'result'].forEach(id => { document.getElementById(id).hidden = true; });
      window.__maxDist = maxDist || 24;
      startMatch({ kind: 'watch', lives });
      for (const f of [...fighters]) if (!kinds.includes(f.kind)) {
        scene.remove(f.root); springs = springs.filter(sp => sp !== f.spring); fighters.splice(fighters.indexOf(f), 1);
      }
      const xs = kinds.length === 2 ? [-3.5, 3.5] : [-4.2, 0, 4.2];
      kinds.forEach((k, i) => window.__app.place(k, xs[i], xs[i] < 0 ? 1 : -1));
      buildHud();
      window.__app.resultShown = false;
      startVersus();          // the match opens on the versus screen, as a duel or free-for-all does in the game
    },
    autoResult() {
      const A = window.__app, left = fighters.filter(f => !f.out);
      if (A.resultShown || mode.kind !== 'watch' || fighters.length < 2 || left.length !== 1) return;
      A.resultShown = true;
      const w = left[0];
      endMatch(w.kit.name + ' wins', 'With ' + w.stocks + (w.stocks === 1 ? ' life' : ' lives') + ' left.');
    },
    // training with the player on the left and both dummies standing still, close enough for a phone-shaped frame
    stage(pick, places) {
      ['menu', 'select', 'result'].forEach(id => { document.getElementById(id).hidden = true; });
      window.__maxDist = 22;
      startMatch({ kind: 'training', pick });
      dummyMode = 'idle';
      for (const [kind, x, facing] of places) window.__app.place(kind, x, facing);
    },
  };
  // What happens, for the sound effects: the game is silent, so its moments are logged here and read back each
  // frame by annotate (state.ev). Wrapping the functions keeps the game itself unchanged.
  window.__ev = [];
  const __log = (...a) => window.__ev.push(a);
  cue = (name, kind) => __log(name, kind || '');
  { const f0 = hurt; hurt = function (h, dmg, ...rest) {
      const hp = h.hp, r = f0.call(this, h, dmg, ...rest);
      if (r === 'parry') __log('parry', h.kind); else if (h.hp < hp) __log('hit', h.kind, Math.round(hp - h.hp));
      return r; }; }
  { const f0 = die; die = function (h, ringOut) { const was = h.dead; f0.call(this, h, ringOut); if (!was && h.dead) __log(ringOut ? 'ringout' : 'ko', h.kind); }; }
  { const f0 = tryAbility; tryAbility = function (f, slot) { const ok = f0.call(this, f, slot); if (ok && !previewing) __log('move', f.kind, slot); return ok; }; }
  { const f0 = spawnProjectile; spawnProjectile = function (o) { const r = f0.call(this, o); if (!previewing && o.owner && o.dmg > 0) __log('shot', o.owner.kind, o.kind); return r; }; }
  { const f0 = respawn; respawn = function (f, drop) { f0.call(this, f, drop); if (drop) __log('drop', f.kind); }; }
`;

const INJECT_BASE = [
  { before: "  startMatch({ kind: 'watch' });   // CPUs brawl behind the main menu", code: HOOK },
  // the game alone: no Roblox link and feature tiles below it (build-page.mjs), and so no scrolling
  { replace: '<html lang="en" class="site">', code: '<html lang="en">' },
  // recording only: the camera may come in closer than the game's own limit, so a narrow frame isn't all paper
  { replace: 'const MAX_DIST = 26;', code: 'const MAX_DIST = window.__maxDist || 26;' },
];
// the gameplay takes were framed with the landscape camera; keep it, rather than the wider portrait lens phones get
const INJECT = [
  ...INJECT_BASE,
  { replace: 'camera.fov = camera.aspect < 1 ? 48 : 34;', code: 'camera.fov = 34;' },
  { replace: 'const maxDist = camera.aspect < 1 ? MAX_DIST * 1.6 : MAX_DIST;', code: 'const maxDist = MAX_DIST;' },
];
const INJECT_PHONE = [
      ...INJECT_BASE,
      // a phone: the touch layout, as the game shows it on a touch screen
      { replace: '@media (pointer: coarse) {', code: '@media all {' },
      { replace: '@media (pointer: coarse) and (orientation: landscape) and (max-height: 540px) {', code: '@media (orientation: landscape) and (max-height: 540px) {' },
    ];
// a take's own seats (the Play screen reads them once, as the page loads)
const SEATS = seats => ({ replace: "const kept = JSON.parse(localStorage.getItem('botbattle.seats'));", code: `const kept = ${JSON.stringify(seats)};` });
// two players on one phone: split the screen as the game does on a touch screen (the recording browser has a mouse)
const SPLIT = { replace: "split = !!player2 && matchMedia('(pointer: coarse)').matches;", code: 'split = !!player2;' };
// online: TapaTab's proxy carries ordinary requests but not WebSockets, so the room's socket goes to the dev server itself
const ONLINE_WS = { replace: "`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${API_BASE}/rooms/", code: "`ws://localhost:5173${API_BASE}/rooms/" };
const CSS_PLAYERS = `.moves { display: none !important; }`;

// CPU matches show the health plates (they sit at the top, clear of the text)
const CSS_MATCH = `.moves, .touch, .corner, .trainbar, .status { display: none !important; }`;

const config = {
  app: '../public/games/botbattle',
  size: [540, 960], dpr: 2,
  inject: INJECT,
  ready: () => !!window.__app,
  // the move list, touch pad, menu button, training bar and health plates would sit where the text goes
  // (a hidden plate also skips its 3D logo, which is drawn into the game canvas)
  css: `.moves, .touch, .corner, .trainbar, .status, .hud { display: none !important; }`,
  annotate: () => {
    const A = window.__app, out = { inhale: [], moves: [] };
    const m = A.mouth('gpt');
    if (m && A.inhaling('gpt')) {
      const [x, y] = A.screen(m);
      out.inhale.push({ k: 'call', id: 'mouth', x, y, text: 'the mouth', dx: -150, dy: -230 });
    }
    const g = A.get('gpt');
    // each fighter: kind, health, lives, knocked out, out of the match
    out.state = { ctx: g ? Math.round(g.context) : null, inhale: A.inhaling('gpt'),
      f: A.fighters.map(f => [f.kind, Math.round(f.hp), Number.isFinite(f.stocks) ? f.stocks : -1, f.dead ? 1 : 0, f.out ? 1 : 0]),
      result: !document.getElementById('result').hidden, ev: window.__ev.splice(0),
      offscreen: A.fighters.filter(f => !f.dead && !f.out && [[0, 0], [0, 3.2]].some(([ox, oy]) => {
        const p = new (A.camera.position.constructor)(f.x + ox, f.y + oy, 0).project(A.camera);
        return Math.abs(p.x) > 1 || Math.abs(p.y) > 1; })).map(f => f.kind) };
    // jumps and landings, from each fighter's state since the last frame
    const seen = window.__seen || (window.__seen = {});
    for (const f of A.fighters) {
      const was = seen[f.id];
      if (was && !f.dead) {
        if (f.jumpT < was.jumpT) out.state.ev.push(['jump', f.kind]);
        if (f.onGround && !was.onGround && was.vy < -6) out.state.ev.push(['land', f.kind, Math.round(-was.vy)]);
      }
      seen[f.id] = { jumpT: f.jumpT, onGround: f.onGround, vy: f.vy };
    }
    // practice: name what the practising fighter is doing (window.__labelKind), above its head. The keys are the
    // ones a player alone uses; in the multiplayer takes (window.__labelPlayers) each player's own keys, with their name.
    const V3 = A.camera.position.constructor;
    const ab = (f, sl) => f.kit.abilities[sl] ? f.kit.abilities[sl].name : '';
    const labelOf = (f, K) => {
      if (f.strike) return f.strike.low ? `${K.crouch} + ${K.strike}: low kick` : `${K.strike}: punch`;
      if (f.guard && f.guard.bash) return `double-tap + ${K.parry}: shield bash`;
      if (f.kind === 'so') {
        if (f.tether) return 'the whip latches on';
        if (f.ledge) return 'hanging on';
        if (f.whip) return f.whip.up ? `${K.jump} + ${K.a2}: upward whip` : `${K.a2}: block whip`;
        if (f.beam) return `${K.a3}: unified beam`;
        if (f.shot || f.launch.length) return `${K.a1}: block shot`;
      }
      if (f.possessing) return `${K.a3}: computer use (advanced)`;
      if (f.inhale) return `${K.a2}: inhale`;
      if (f.compaction) return `${K.a4}: compaction`;
      if (f.combo) return `${K.a3}: combobulating`;
      if (f.fling) return `${K.a2}: fling`;
      if (f.guard) return f.guard.held ? (f.crouch > 0.5 ? `${K.crouch} + hold ${K.parry}: crouching shield` : `hold ${K.parry}: shield up`)
        : f.guard.dir === 'up' ? `${K.jump} + ${K.parry}: overhead parry` : { minor: `${K.parry}: parry` };
      if (f.crouch > 0.5) return Math.abs(f.vx) > 0.5 ? `${K.crouch} + move: crouch-walk` : { minor: `${K.crouch}: crouch` };
      if (f.passT > 0) return 'double-tap: dash';
      if (!f.onGround && f.kit.jumps > 1 && f.jumpsLeft === 0 && !f.ledge) return `${K.jump}, ${K.jump}: double jump`;
      if (f.busy > 0.05 && f.kind === 'so' && document.querySelector('.bubble')) return `${K.a4}: correction`;
      return null;
    };
    // shots that leave nothing to look at on the shooter (ChatGPT's cursor, Claude's rays) come from the event log
    const fired = (f, ev) => { const e = ev.filter(x => x[0] === 'move' && x[1] === f.kind).pop(); return e ? e[2] : null; };
    // key names as words where the callout font has no symbol for them
    const nice = K => Object.fromEntries(Object.entries(K).map(([k, v]) => [k, String(v).replace('\u232B', 'Backspace').replace('R\u21E7', 'Right Shift')]));
    const label = (id, f, K0, prefix, where) => {
      const K = nice(K0);
      const now = performance.now(), mem = (window.__labels ||= {});
      let text = labelOf(f, K);
      if (text && text.minor) text = mem[id] && now < mem[id].until ? null : text.minor;
      if (!text) { const sl = fired(f, out.state.ev); if (sl) text = `${K[sl]}: ${ab(f, sl).replace(/^./, c => c.toLowerCase())}`; }
      // a label stays up at least 1.6 s, long enough to read
      if (text) mem[id] = { text, until: now + 1600 };
      const shown = text || (mem[id] && now < mem[id].until ? mem[id].text : null);
      const full = prefix || shown;          // the multiplayer takes: just the player's name
      if (full && !f.dead) {
        const [x, y] = where(new V3(f.x, f.y + 3.3, 0));
        const side = prefix ? (prefix === 'User B' ? 1 : -1) : f.x < 0 ? -1 : 1;
        out.moves.push({ k: 'call', id, x, y, text: full, dx: side * 170, dy: -240 });
      }
    };
    if (window.__labelKind) { const f = A.get(window.__labelKind); if (f) label('move', f, A.keys.all, null, A.screen); }
    if (window.__labelPlayers) {
      const W = innerWidth * devicePixelRatio, H = innerHeight * devicePixelRatio;
      for (const f of A.fighters) {
        if (!f.isPlayer && !f.isPlayer2) continue;
        const who = f.isPlayer2 ? 'B' : 'A';
        let where = A.screen;
        if (A.split) {     // each player in their own half: User A's at the bottom, User B's turned round at the top
          where = v => { const [x, y] = A.screen(v); return who === 'A' ? [x, H / 2 + y / 2] : [W - x, H / 2 - y / 2]; };
        }
        label('user' + who, f, A.keys[who], 'User ' + who, where);
      }
    }
    return out;
  },
  takes: {
    // "Who would win?": Stack Overflow against ChatGPT, CPU against CPU, two lives each, to the results table
    duel_so_gpt: { seconds: 110, css: CSS_MATCH,
      setup: () => window.__app.cpuMatch(['so', 'gpt'], 2, 22),
      each: () => window.__app && window.__app.autoResult(),
      script: [] },

    // all three CPUs, two lives each, to the results table
    ffa: { seconds: 130, css: CSS_MATCH,
      setup: () => window.__app.cpuMatch(['so', 'gpt', 'claude'], 2, 24),
      each: () => window.__app && window.__app.autoResult(),
      script: [] },

    // practice: Stack Overflow goes through its moves on the dummies, each one named as it happens
    practice_so: { seconds: 60,
      setup: () => { window.__labelKind = 'so'; window.__app.stage('so', [['so', -2.6, 1], ['gpt', 0.4, -1], ['claude', 3.4, -1]]); },
      script: [
        [4.5, page => page.down('KeyJ')],                                   // block shot
        [5.8, page => page.up('KeyJ')],
        [10.5, page => page.press('KeyK')],                                  // block whip
        [13.5, page => page.js(() => window.__app.place('gpt', 2.4, -1))],
        [13.7, page => page.down('ArrowUp')],                                // upward whip (from a jump)
        [13.85, page => page.press('KeyK')],
        [14.3, page => page.up('ArrowUp')],
        [16.5, page => page.press('KeyL')],                                 // unified beam
        [20.0, page => page.press('KeyI')],                                 // correction
        // a parry: Claude fires a rod, Stack Overflow guards toward it
        [23.5, page => page.js(() => { const A = window.__app; A.place('claude', 0.6, -1); A.place('gpt', 5, -1); })],
        [24.1, page => page.press('Backspace')],
        [24.14, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        // an overhead parry: ChatGPT slams a compaction down
        [26.5, page => page.js(() => { const A = window.__app; A.place('claude', 6, -1); A.place('gpt', -0.6, -1); A.get('gpt').context = 100; })],
        [27.1, page => page.js(() => window.__app.fire('gpt', 'a4', -1))],
        [27.12, page => page.down('KeyW')],
        [27.18, page => page.press('Backspace')],
        [27.5, page => page.up('KeyW')],
        // crouch under Claude's fling
        [30.0, page => page.js(() => { const A = window.__app; A.place('gpt', 6, -1); A.place('claude', 0.0, -1); })],
        [30.5, page => page.down('KeyS')],
        [30.9, page => page.js(() => window.__app.fire('claude', 'a2', -1))],
        [32.1, page => page.up('KeyS')],
        // dash past Claude
        [32.9, page => page.down('KeyD')],
        [33.0, page => page.up('KeyD')],
        [33.12, page => page.down('KeyD')],
        [33.9, page => page.up('KeyD')],
        // off the edge with no jumps left: the upward whip latches onto the ledge, then it climbs up
        [36.5, page => page.js(() => { const A = window.__app, f = A.get('so'); A.place('gpt', 7.5, -1); A.place('claude', 4, -1); f.x = 11.2; f.y = -5.2; f.vx = 0; f.vy = 0; f.onGround = false; f.jumpsLeft = 0; f.facing = -1; f.feet.forEach(ft => { ft.air = true; ft.y = -5.2; }); })],
        [36.53, page => page.down('ArrowUp')],
        [36.57, page => page.press('KeyK')],
        [37.0, page => page.up('ArrowUp')],
        [38.9, page => page.down('ArrowLeft')],
        [39.5, page => page.up('ArrowLeft')],
        // the moves every fighter has: a punch, a low kick, the shield held up, and the shield bash
        [42.1, page => page.js(() => { const A = window.__app; A.place('so', -2.6, 1); A.place('gpt', -1.2, -1); A.place('claude', 4, -1); })],
        [42.5, page => page.press('KeyH')],
        [44.5, page => page.down('KeyS')],
        [44.9, page => page.press('KeyH')],
        [45.7, page => page.up('KeyS')],
        [47.5, page => page.js(() => { const A = window.__app; A.place('claude', 0.6, -1); A.place('gpt', 5, -1); })],
        [47.9, page => page.down('Backspace')],
        [48.8, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [49.4, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [50.3, page => page.up('Backspace')],
        [51.9, page => page.js(() => { const A = window.__app; A.place('so', -3.4, 1); A.place('gpt', 0.0, -1); A.place('claude', 4.6, -1); })],
        [52.5, page => page.press('KeyD')],
        [52.59, page => page.press('KeyD')],
        [52.6, page => page.press('Backspace')],
      ] },

    // the other two pairings, as duel_so_gpt
    duel_so_claude: { seconds: 120, css: CSS_MATCH,
      setup: () => window.__app.cpuMatch(['so', 'claude'], 2, 22),
      each: () => window.__app && window.__app.autoResult(),
      script: [] },
    duel_gpt_claude: { seconds: 120, css: CSS_MATCH,
      setup: () => window.__app.cpuMatch(['gpt', 'claude'], 2, 22),
      each: () => window.__app && window.__app.autoResult(),
      script: [] },

    // practice: ChatGPT's moves on the dummies, each named above its head
    practice_gpt: { seconds: 50,
      setup: () => { window.__labelKind = 'gpt'; window.__app.stage('gpt', [['gpt', -2.6, 1], ['so', 0.6, -1], ['claude', 3.6, -1]]); },
      script: [
        [4.5, page => page.press('KeyJ')],                                   // computer use: a cursor that chases
        [7.7, page => page.press('KeyK')],                                   // inhale, against Claude's rays
        [7.9, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [8.05, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [8.2, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [12.1, page => page.press('KeyW')],                                   // double jump
        [12.4, page => page.press('KeyW')],
        [15.1, page => page.js(() => window.__app.place('so', 0.4, -1))],
        [15.5, page => page.press('KeyL')],                                  // computer use (advanced): it steers them
        [16.4, page => page.down('KeyD')],
        [17.8, page => page.up('KeyD')],
        [20.1, page => page.js(() => { const A = window.__app; A.place('gpt', -2.6, 1); A.place('so', -0.4, -1); A.place('claude', 1.0, -1); A.get('gpt').context = 100; })],
        [20.5, page => page.press('KeyI')],                                  // compaction
        [24.5, page => page.js(() => { const A = window.__app; A.place('so', -1.4, -1); A.place('claude', 4, -1); })],
        [24.9, page => page.press('KeyH')],                                  // punch
        [26.9, page => page.down('KeyS')],                                   // low kick
        [27.3, page => page.press('KeyH')],
        [28.1, page => page.up('KeyS')],
        [30.1, page => page.js(() => { const A = window.__app; A.place('claude', 0.4, -1); A.place('so', 4.4, -1); })],
        [30.5, page => page.press('Backspace')],                             // parry a ray
        [30.54, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [33.0, page => page.down('Backspace')],                              // hold the shield up; rays bounce off
        [33.9, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [34.5, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [34.7, page => page.down('KeyS')],                                   // and crouch behind it
        [36.1, page => page.up('KeyS')],
        [36.5, page => page.up('Backspace')],
        [37.9, page => page.js(() => { const A = window.__app; A.place('gpt', -3.4, 1); A.place('so', 0.0, -1); A.place('claude', 4.6, -1); })],
        [38.5, page => page.press('KeyD')],                                  // shield bash: double-tap and Backspace
        [38.59, page => page.press('KeyD')],
        [38.6, page => page.press('Backspace')],
        [41.9, page => page.js(() => { const A = window.__app; A.place('gpt', -1.0, 1); A.place('so', 2.2, -1); A.place('claude', 4.6, -1); })],
        [42.5, page => page.down('KeyS')],                                   // crouch-walk
        [42.5, page => page.down('KeyA')],
        [44.1, page => page.up('KeyA')],
        [44.1, page => page.up('KeyS')],
      ] },

    // practice: Claude's moves
    practice_claude: { seconds: 50,
      setup: () => { window.__labelKind = 'claude'; window.__app.stage('claude', [['claude', -2.6, 1], ['so', 0.8, -1], ['gpt', 3.6, -1]]); },
      script: [
        [4.5, page => page.down('KeyJ')],                                    // shoot: its rays, held down
        [5.9, page => page.up('KeyJ')],
        [8.1, page => page.press('KeyK')],                                   // fling
        [10.9, page => page.press('KeyL')],                                   // combobulating: a line of three
        [14.1, page => page.press('KeyL')],                                  // then a square of four
        [17.5, page => page.press('KeyW')],                                  // double jump
        [17.8, page => page.press('KeyW')],
        [20.3, page => page.js(() => window.__app.place('so', -1.4, -1))],
        [20.7, page => page.press('KeyH')],                                  // punch
        [22.7, page => page.down('KeyS')],                                   // low kick
        [23.1, page => page.press('KeyH')],
        [23.9, page => page.up('KeyS')],
        [25.9, page => page.js(() => { const A = window.__app; A.place('claude', -1.2, 1); A.place('so', 2.6, -1); A.place('gpt', -4.5, 1); })],
        [26.5, page => page.js(() => window.__app.fire('so', 'a1', -1))],    // parry a block from the side
        [26.66, page => page.press('Backspace')],
        [29.44, page => page.down('KeyW')],                                  // and the whip from above
        [29.5, page => page.js(() => { window.__app.place('so', 0.9, -1); window.__app.fire('so', 'a2', -1); })],
        [29.5, page => page.press('Backspace')],
        [29.8, page => page.up('KeyW')],
        [32.1, page => page.js(() => window.__app.place('so', 2.6, -1))],
        [32.5, page => page.down('Backspace')],                              // the shield held up; blocks bounce off
        [33.2, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [33.9, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [35.1, page => page.up('Backspace')],
        [36.9, page => page.js(() => { const A = window.__app; A.place('claude', -3.4, 1); A.place('so', 0.0, -1); A.place('gpt', 4.6, -1); })],
        [37.5, page => page.press('KeyD')],                                  // shield bash
        [37.59, page => page.press('KeyD')],
        [37.6, page => page.press('Backspace')],
        [40.9, page => page.js(() => { const A = window.__app; A.place('claude', -1.0, 1); A.place('so', 2.2, -1); A.place('gpt', 4.6, -1); })],
        [41.5, page => page.down('KeyS')],                                   // crouch-walk
        [41.5, page => page.down('KeyA')],
        [43.1, page => page.up('KeyA')],
        [43.1, page => page.up('KeyS')],
      ] },

    // two players on one keyboard: User A (left of the keyboard) as Stack Overflow, User B (right) as Claude
    same_keyboard: { seconds: 40, size: [1280, 720], dpr: 1, css: '',     // the move lists show each player's keys
      inject: [...INJECT_BASE, SEATS([{ kind: 'so', variant: 'orange', ctrl: 'A' }, { kind: 'claude', variant: 'orange', ctrl: 'B' }])],
      setup: () => { window.__labelPlayers = true; },
      script: [
        [1.2, page => page.click('.mode[data-mode="play"]')],
        [3.6, page => page.click('#fightBtn')],
        // the match, from about 7.5 s
        [8.0, page => page.down('KeyD')], [8.0, page => page.down('ArrowLeft')],
        [9.0, page => page.up('KeyD')], [9.0, page => page.up('ArrowLeft')],
        [9.4, page => page.down('KeyF')], [10.4, page => page.up('KeyF')],           // A: block shot
        [11.6, page => page.press(',')], [11.75, page => page.press(',')], [11.9, page => page.press(',')],   // B: shoot
        [12.0, page => page.press('KeyQ')],                                         // A: parry
        [13.6, page => page.press('/')],                                        // B: combobulating
        [14.0, page => page.press('KeyW')],                                         // A: jump
        [16.0, page => page.down('KeyD')], [16.6, page => page.up('KeyD')],
        [16.8, page => page.press('KeyG')],                                         // A: block whip
        [18.0, page => page.press('.')],                                       // B: fling
        [19.6, page => page.down('ArrowLeft')], [20.4, page => page.up('ArrowLeft')],
        [20.6, page => page.press('KeyM')],                                         // B: punch
        [21.2, page => page.press('KeyR')],                                         // A: punch
        [22.4, page => page.down('ArrowDown')], [22.8, page => page.press('KeyM')], [23.4, page => page.up('ArrowDown')],   // B: low kick
        [24.4, page => page.press('KeyA')], [24.5, page => page.press('KeyA')],     // A: dash
        [26.0, page => page.press('KeyH')],                                         // A: unified beam
        [26.2, page => page.press('ArrowUp')], [26.45, page => page.press('ArrowUp')],   // B: double jump
        [28.6, page => page.press('/')],                                        // B: combobulating
        [29.0, page => page.press('KeyQ')],
        [31.0, page => page.press('KeyT')],                                         // A: correction
        [32.6, page => page.press('KeyD')], [32.7, page => page.press('KeyD')], [32.72, page => page.press('KeyQ')],   // A: shield bash
        [34.4, page => page.down('KeyF')], [35.4, page => page.up('KeyF')],
        [35.0, page => page.down(',')], [36.2, page => page.up(',')],
      ] },

    // two players on one phone: the screen split across the middle, User B's half turned round at the top
    same_screen: { seconds: 40, size: [390, 844], dpr: 2, css: CSS_PLAYERS,
      inject: [...INJECT_PHONE, SPLIT, SEATS([{ kind: 'gpt', variant: 'green', ctrl: 'A' }, { kind: 'so', variant: 'orange', ctrl: 'B' }])],
      setup: () => { window.__labelPlayers = true; },
      script: [
        [1.2, page => page.click('.mode[data-mode="play"]')],
        [3.4, page => page.click('#fightBtn')],
        // the match starts at once (no versus screen when the phone is shared); taps on each player's own buttons
        [5.0, page => page.down('KeyD')], [5.0, page => page.down('ArrowLeft')],
        [6.0, page => page.up('KeyD')], [6.0, page => page.up('ArrowLeft')],
        [6.6, page => page.click('#touch [data-key="KeyJ"]')],                     // A: computer use
        [7.4, page => page.click('#touchB [data-key="KeyJ"]')],                    // B: block shot
        [7.9, page => page.click('#touchB [data-key="KeyJ"]')],
        [9.2, page => page.click('#touch [data-key="KeyK"]')],                     // A: inhale
        [9.4, page => page.click('#touchB [data-key="KeyJ"]')],
        [12.0, page => page.click('#touchB [data-key="KeyK"]')],                   // B: whip
        [12.6, page => page.click('#touch [data-key="Space"]')],                   // A: jump
        [12.9, page => page.click('#touch [data-key="Space"]')],
        [15.0, page => page.click('#touch [data-key="Backspace"]')],               // A: parry
        [15.1, page => page.click('#touchB [data-key="KeyL"]')],                   // B: beam
        [18.0, page => page.click('#touch [data-key="KeyL"]')],                    // A: take over
        [20.5, page => page.down('KeyA')], [21.4, page => page.up('KeyA')],
        [22.0, page => page.click('#touchB [data-key="KeyH"]')],                   // B: punch
        [22.6, page => page.click('#touch [data-key="KeyH"]')],                    // A: punch
        [24.0, page => page.click('#touchB [data-key="KeyI"]')],                   // B: correction
        [26.0, page => page.click('#touch [data-key="KeyJ"]')],
        [27.5, page => page.click('#touchB [data-key="Backspace"]')],
        [28.0, page => page.click('#touchB [data-key="KeyJ"]')],
        [30.0, page => page.click('#touch [data-key="KeyK"]')],
        [30.2, page => page.click('#touchB [data-key="KeyJ"]')],
        [33.0, page => page.click('#touch [data-key="KeyJ"]')],
        [34.5, page => page.click('#touchB [data-key="KeyK"]')],
      ] },

    // online: two phones in a casual match through the local dev server (npm run dev), each its own player
    online_a: { seconds: 48, size: [390, 844], dpr: 2, app: 'http://localhost:5173/', page: 'games/botbattle/?dev=nova', css: CSS_PLAYERS,
      inject: [...INJECT_PHONE, ONLINE_WS],
      script: [
        [1.0, page => page.click('.mode[data-mode="online"]')],
        [3.0, page => page.click('#casualBtn')],
        [7.0, page => page.click('#picks button[data-kind="so"]')],
        [8.2, page => page.click('#readyBtn')],
        // the match, from about 13 s (both ready, the versus screen)
        [16.0, page => page.down('KeyD')], [17.0, page => page.up('KeyD')],
        [17.4, page => page.click('[data-key="KeyJ"]')], [17.7, page => page.click('[data-key="KeyJ"]')],
        [20.0, page => page.click('[data-key="KeyK"]')],
        [22.5, page => page.click('[data-key="Backspace"]')],
        [24.0, page => page.click('[data-key="KeyL"]')],
        [27.0, page => page.click('[data-key="Space"]')],
        [29.0, page => page.click('[data-key="KeyH"]')],
        [31.0, page => page.click('[data-key="KeyI"]')],
        [34.0, page => page.click('[data-key="KeyJ"]')], [34.3, page => page.click('[data-key="KeyJ"]')],
        [37.0, page => page.click('[data-key="KeyK"]')],
        [40.0, page => page.click('[data-key="KeyL"]')],
      ] },
    online_b: { seconds: 48, size: [390, 844], dpr: 2, app: 'http://localhost:5173/', page: 'games/botbattle/?dev=orbit', css: CSS_PLAYERS,
      inject: [...INJECT_PHONE, ONLINE_WS],
      script: [
        [1.0, page => page.click('.mode[data-mode="online"]')],
        [5.0, page => page.click('#casualBtn')],
        [7.4, page => page.click('#picks button[data-kind="claude"]')],
        [8.6, page => page.click('#readyBtn')],
        [16.0, page => page.down('ArrowLeft')], [17.0, page => page.up('ArrowLeft')],
        [18.0, page => page.click('[data-key="KeyL"]')],
        [21.0, page => page.click('[data-key="KeyJ"]')], [21.2, page => page.click('[data-key="KeyJ"]')], [21.4, page => page.click('[data-key="KeyJ"]')],
        [23.0, page => page.click('[data-key="Backspace"]')],
        [25.0, page => page.click('[data-key="KeyK"]')],
        [27.5, page => page.click('[data-key="Space"]')], [27.8, page => page.click('[data-key="Space"]')],
        [30.0, page => page.click('[data-key="KeyL"]')],
        [33.0, page => page.click('[data-key="KeyH"]')],
        [35.0, page => page.click('[data-key="KeyJ"]')], [35.2, page => page.click('[data-key="KeyJ"]')],
        [38.0, page => page.click('[data-key="KeyK"]')],
        [41.0, page => page.click('[data-key="Backspace"]')],
      ] },

    // the showcase: the game being played on a phone held upright, on a desktop, and on a phone on its side
    show_phone: { seconds: 30, size: [390, 844], dpr: 2, inject: INJECT_PHONE, css: '',     // a 19.5:9 phone (iPhone-sized)
      script: [
        [1.5, page => page.click('.mode[data-mode="play"]')],               // Play: three seats, you and two CPUs
        [2.6, page => page.click({ selector: '.seat-fighter', nth: 0 })],   // your seat's fighter, on the cards
        [3.6, page => page.click('#nextBtn')],
        [4.6, page => page.click('#pickBtn')],
        [6.7, page => page.click('#fightBtn')],
        [11.5, page => page.down('ArrowRight')],
        [13.1, page => page.up('ArrowRight')],
        [13.5, page => page.click('[data-key="KeyJ"]')], [13.75, page => page.click('[data-key="KeyJ"]')], [14.0, page => page.click('[data-key="KeyJ"]')],
        [15.5, page => page.click('[data-key="KeyK"]')],
        [17.5, page => page.click('[data-key="Space"]')],
        [19.0, page => page.click('[data-key="KeyL"]')],
        [22.0, page => page.click('[data-key="Backspace"]')],
        [23.5, page => page.click('[data-key="KeyI"]')],
        [25.5, page => page.click('[data-key="KeyK"]')],
        [27.5, page => page.click('[data-key="KeyJ"]')], [27.75, page => page.click('[data-key="KeyJ"]')],
      ] },
    show_desktop: { seconds: 31, size: [1280, 720], dpr: 1, inject: INJECT_BASE, css: '',
      script: [
        [1.2, page => page.glide([260, 160], '.mode[data-mode="play"]', 0.8)],
        [2.2, page => page.click('.mode[data-mode="play"]')],
        [3.0, page => page.click({ selector: '.seat-remove', nth: 2 })],    // two seats: a duel against a random CPU
        [3.8, page => page.click({ selector: '.seat-fighter', nth: 0 })],
        [4.6, page => page.press('ArrowRight')],
        [5.6, page => page.press('Enter')],
        [6.4, page => page.click({ selector: '.seat-fighter', nth: 1 })],   // the opponent's seat: R leaves it to chance
        [7.3, page => page.press('KeyR')],
        [8.2, page => page.click('#fightBtn')],
        [14.1, page => page.down('KeyD')],
        [15.2, page => page.up('KeyD')],
        [15.6, page => page.down('KeyJ')],
        [16.8, page => page.up('KeyJ')],
        [18.1, page => page.press('KeyK')],
        [19.6, page => page.press('KeyL')],
        [22.1, page => page.press('KeyW')],
        [22.4, page => page.press('KeyW')],
        [23.6, page => page.press('Backspace')],
        [25.1, page => page.down('KeyJ')],
        [26.2, page => page.up('KeyJ')],
        [27.6, page => page.press('KeyK')],
      ] },
    show_landscape: { seconds: 24, size: [844, 390], inject: INJECT_PHONE, css: '',
      script: [
        [1.2, page => page.click('.mode[data-mode="training"]')],
        [2.6, page => page.click('#nextBtn')],
        [4.0, page => page.press('Enter')],
        [5.2, page => page.down('ArrowRight')],
        [6.4, page => page.up('ArrowRight')],
        [7.0, page => page.click('[data-key="KeyK"]')],
        [10.0, page => page.click('[data-key="KeyJ"]')],
        [12.0, page => page.click('[data-key="KeyL"]')],
        [15.0, page => page.click('[data-key="Space"]')],
        [15.3, page => page.click('[data-key="Space"]')],
        [17.5, page => page.click('[data-key="Backspace"]')],
        [19.5, page => page.click('[data-key="KeyJ"]')],
        [21.0, page => page.click('[data-key="KeyK"]')],
      ] },

    // the three CPUs fighting on their own
    brawl: { seconds: 40,
      setup: () => {
        ['menu', 'select', 'result'].forEach(id => { document.getElementById(id).hidden = true; });
        window.__maxDist = 24;
        window.__app.startMatch({ kind: 'watch' });
      },
      script: [] },

    // Stack Overflow: a burst of blocks out of the bent stack, the beam once the stack refills, then the whip
    so: { seconds: 20,
      setup: () => window.__app.stage('so', [['so', -3, 1], ['gpt', 0.2, -1], ['claude', 2.6, -1]]),
      script: [
        [0.8, page => page.down('KeyJ')],
        [1.7, page => page.up('KeyJ')],
        [5.2, page => page.press('KeyL')],
        [10.9, page => page.js(() => window.__app.place('gpt', -0.9, -1))],
        [11.5, page => page.press('KeyK')],
      ] },

    // ChatGPT: inhale against blocks and rods, against dots, against the beam, against a correction; then compaction
    gpt: { seconds: 60,
      setup: () => window.__app.stage('gpt', [['gpt', -2.2, 1], ['claude', 0.9, -1], ['so', 3, -1]]),
      script: [
        // the tornado on its own, under the title and the first line
        [1.4, page => page.press('KeyK')],
        [5.6, page => page.press('KeyK')],
        [8.6, page => page.press('KeyK')],
        // blocks and rods
        [11.7, page => page.press('KeyK')],
        [12.0, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [12.15, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [12.3, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [12.45, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [12.6, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [16.2, page => page.press('KeyK')],
        [16.5, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [16.65, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [16.8, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [16.95, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        // dots
        [21.5, page => page.press('KeyK')],
        [21.65, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [25.2, page => page.press('KeyK')],
        [25.35, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        // the beam: Claude steps out of the line of fire right at the cut
        [28.3, page => page.js(() => window.__app.place('claude', -4.6, 1))],
        [28.9, page => page.press('KeyK')],
        [29.1, page => page.js(() => window.__app.fire('so', 'a3', -1))],
        [33.4, page => page.press('KeyK')],
        [33.6, page => page.js(() => window.__app.fire('so', 'a3', -1))],
        // a correction
        [37.9, page => page.press('KeyK')],
        [38.2, page => page.js(() => window.__app.fire('so', 'a4', -1))],
        // compaction, with both of them in front again right at the cut
        [44.78, page => page.js(() => { window.__app.place('claude', 0.6, -1); window.__app.place('so', 2.4, -1); })],
        [45.6, page => page.press('KeyI')],
      ] },

    // Claude: a line of three, a square of four, then the rods in rapid fire
    claude: { seconds: 14,
      setup: () => window.__app.stage('claude', [['claude', -2.4, 1], ['so', 1.2, -1], ['gpt', 3.4, -1]]),
      script: [
        [0.7, page => page.press('KeyL')],
        [3.4, page => page.press('KeyL')],
        [6.4, page => page.down('KeyJ')],
        [7.9, page => page.up('KeyJ')],
      ] },

    // a side parry against a block (Claude's fingers round the spokes), an overhead parry against the whip,
    // then a fling that knocks Stack Overflow off the end of the stage. A block leaves the stack about 0.4 s
    // after it is fired (the barrel bends first), the whip connects 0.12 s after it starts, and the guard shines from
    // 0.07 s to 0.5 s after Backspace.
    parry: { seconds: 10,
      setup: () => window.__app.stage('claude', [['claude', -1.2, 1], ['so', 2.6, -1], ['gpt', -4.5, 1]]),
      script: [
        [1.2, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [1.36, page => page.press('Backspace')],
        [2.54, page => page.down('KeyW')],
        [2.6, page => page.js(() => { window.__app.place('so', 0.9, -1); window.__app.fire('so', 'a2', -1); })],
        [2.6, page => page.press('Backspace')],
        [2.9, page => page.up('KeyW')],
        [5.0, page => page.js(() => { const A = window.__app; A.place('claude', 7.7, 1); A.place('so', 9.95, -1); A.place('gpt', 4.5, 1); })],
        [5.9, page => page.press('KeyK')],
      ] },
  },
};

// The site's feature tiles (scripts/features.mjs cuts them into short loops): scenes recorded square, 1080 x 1080,
// each only as long as the moments the tiles use. A square frame is as tall as it is wide, so the camera's margin
// either side of the fighters comes in from 3 to 1.6 and they fill it as they fill a phone-shaped one.
// sq_<name>: [the take it copies, seconds, CSS px across (540 at 2x; 720 at 1x, the tiles' own size, for screens
// with more on them), anything else to change]
const SQUARE = {
  so: ['so', 15], gpt: ['gpt', 50], claude: ['claude', 10], parry: ['parry', 10],
  practice_gpt: ['practice_gpt', 21], practice_so: ['practice_so', 54], duel_so_gpt: ['duel_so_gpt', 110],
  same_keyboard: ['same_keyboard', 36, 720], same_screen: ['same_screen', 30],
  online_a: ['online_a', 30, 720], online_b: ['online_b', 30, 720],
  training: ['practice_claude', 16, 720, { css: '' }],      // with the training bar, plates and move list showing
};
const SQUARE_CAM = { replace: 'const halfW = (maxX - minX) / 2 + 3;', code: 'const halfW = (maxX - minX) / 2 + 1.6;' };
for (const [name, [base, seconds, css = 540, extra = {}]] of Object.entries(SQUARE)) {
  const t = config.takes[base];
  config.takes['sq_' + name] = { ...t, size: [css, css], dpr: css === 540 ? 2 : 1, seconds,
    inject: [...(t.inject || config.inject), SQUARE_CAM], ...extra };
}

export default config;
