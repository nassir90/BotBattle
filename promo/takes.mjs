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
    get fighters() { return fighters; }, startMatch, camera,
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
// CPU matches show the health plates (they sit at the top, clear of the text)
const CSS_MATCH = `.moves, .touch, .corner, .trainbar, .status, .vs-skip { display: none !important; }`;

export default {
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
    // practice: name what Stack Overflow is doing, at its stack
    const so = A.get('so');
    if (window.__labelMoves && so && !so.dead) {
      const label = so.tether ? 'the whip latches on' : so.ledge ? 'hanging on' : so.whip ? (so.whip.up ? 'W + K: upward whip' : 'K: block whip')
        : so.beam ? 'L: unified beam' : (so.shot || so.launch.length) ? 'J: block shot' : so.guard ? (so.guard.dir === 'up' ? 'W + Backspace: overhead parry' : 'Backspace: parry')
        : so.crouch > 0.5 ? 'S: crouch' : so.passT > 0 ? 'double-tap: dash' : so.busy > 0.05 && document.querySelector('.bubble') ? 'I: correction' : null;
      // a label stays up at least 1.6 s, long enough to read
      const now = performance.now();
      if (label) window.__lastLabel = { text: label, until: now + 1600 };
      const shown = label || (window.__lastLabel && now < window.__lastLabel.until ? window.__lastLabel.text : null);
      if (shown) {
        so.crown.updateMatrixWorld(true);
        const [x, y] = A.screen(so.crown.localToWorld(new (so.crown.position.constructor)(0, 0.3, 0)));
        out.moves.push({ k: 'call', id: 'move', x, y, text: shown, dx: 160, dy: -230 });
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
    practice_so: { seconds: 46,
      setup: () => { window.__labelMoves = true; window.__app.stage('so', [['so', -2.6, 1], ['gpt', 0.4, -1], ['claude', 3.4, -1]]); },
      script: [
        [1.0, page => page.down('KeyJ')],                                   // block shot
        [2.3, page => page.up('KeyJ')],
        [7, page => page.press('KeyK')],                                  // block whip
        [10, page => page.js(() => window.__app.place('gpt', 2.4, -1))],
        [10.2, page => page.down('ArrowUp')],                                // upward whip (from a jump)
        [10.35, page => page.press('KeyK')],
        [10.8, page => page.up('ArrowUp')],
        [13, page => page.press('KeyL')],                                 // unified beam
        [16.5, page => page.press('KeyI')],                                 // correction
        // a parry: Claude fires a rod, Stack Overflow guards toward it
        [20, page => page.js(() => { const A = window.__app; A.place('claude', 0.6, -1); A.place('gpt', 5, -1); })],
        [20.6, page => page.press('Backspace')],
        [20.64, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        // an overhead parry: ChatGPT slams a compaction down
        [23, page => page.js(() => { const A = window.__app; A.place('claude', 6, -1); A.place('gpt', -0.6, -1); A.get('gpt').context = 100; })],
        [23.6, page => page.js(() => window.__app.fire('gpt', 'a4', -1))],
        [23.62, page => page.down('KeyW')],
        [23.68, page => page.press('Backspace')],
        [24, page => page.up('KeyW')],
        // crouch under Claude's fling
        [26.5, page => page.js(() => { const A = window.__app; A.place('gpt', 6, -1); A.place('claude', 0.0, -1); })],
        [27, page => page.down('KeyS')],
        [27.4, page => page.js(() => window.__app.fire('claude', 'a2', -1))],
        [28.6, page => page.up('KeyS')],
        // dash past Claude
        [29.4, page => page.down('KeyD')],
        [29.5, page => page.up('KeyD')],
        [29.62, page => page.down('KeyD')],
        [30.4, page => page.up('KeyD')],
        // off the edge with no jumps left: the upward whip latches onto the ledge, then it climbs up
        [33, page => page.js(() => { const A = window.__app, f = A.get('so'); A.place('gpt', 7.5, -1); A.place('claude', 4, -1); f.x = 11.2; f.y = -5.2; f.vx = 0; f.vy = 0; f.onGround = false; f.jumpsLeft = 0; f.facing = -1; f.feet.forEach(ft => { ft.air = true; ft.y = -5.2; }); })],
        [33.03, page => page.down('ArrowUp')],
        [33.07, page => page.press('KeyK')],
        [33.5, page => page.up('ArrowUp')],
        [35.4, page => page.down('ArrowLeft')],
        [36, page => page.up('ArrowLeft')],
      ] },

    // the showcase: the game being played on a phone held upright, on a desktop, and on a phone on its side
    show_phone: { seconds: 30, size: [390, 844], dpr: 2, inject: INJECT_PHONE, css: '',     // a 19.5:9 phone (iPhone-sized)
      script: [
        [1.5, page => page.click({ text: 'Free-for-all' })],
        [3.2, page => page.click('#nextBtn')],
        [4.4, page => page.click('#prevBtn')],
        [6.7, page => page.click('#pickBtn')],
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
    show_desktop: { seconds: 30, size: [1280, 720], dpr: 1, inject: INJECT_BASE, css: '',
      script: [
        [1.2, page => page.glide([260, 160], { text: 'Duel' }, 0.8)],
        [2.2, page => page.click({ text: 'Duel' })],
        [3.6, page => page.press('ArrowRight')],
        [4.6, page => page.press('ArrowRight')],
        [5.8, page => page.press('Enter')],
        [7.2, page => page.press('KeyR')],                                  // random opponent
        [13.1, page => page.down('KeyD')],
        [14.2, page => page.up('KeyD')],
        [14.6, page => page.down('KeyJ')],
        [15.8, page => page.up('KeyJ')],
        [17.1, page => page.press('KeyK')],
        [18.6, page => page.press('KeyL')],
        [21.1, page => page.press('KeyW')],
        [21.4, page => page.press('KeyW')],
        [22.6, page => page.press('Backspace')],
        [24.1, page => page.down('KeyJ')],
        [25.2, page => page.up('KeyJ')],
        [26.6, page => page.press('KeyK')],
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
