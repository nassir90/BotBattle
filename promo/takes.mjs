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
    // training with the player on the left and both dummies standing still, close enough for a phone-shaped frame
    stage(pick, places) {
      ['menu', 'select', 'result'].forEach(id => { document.getElementById(id).hidden = true; });
      window.__maxDist = 22;
      startMatch({ kind: 'training', pick });
      dummyMode = 'idle';
      for (const [kind, x, facing] of places) window.__app.place(kind, x, facing);
    },
  };
`;

export default {
  app: '../public/games/botbattle',
  size: [540, 960], dpr: 2,
  inject: [
    { before: "  startMatch({ kind: 'watch' });   // CPUs brawl behind the main menu", code: HOOK },
    // recording only: the camera may come in closer than the game's own limit, so a narrow frame isn't all paper
    { replace: 'const MAX_DIST = 26;', code: 'const MAX_DIST = window.__maxDist || 26;' },
  ],
  ready: () => !!window.__app,
  // the move list, touch pad, menu button and training bar would sit where the subtitles go
  css: `.moves, .touch, .corner, .trainbar, .status { display: none !important; }`,
  annotate: () => {
    const A = window.__app, out = { inhale: [] };
    const m = A.mouth('gpt');
    if (m && A.inhaling('gpt')) {
      const [x, y] = A.screen(m);
      out.inhale.push({ k: 'call', id: 'mouth', x, y, text: 'the mouth', dx: -150, dy: -230 });
    }
    const g = A.get('gpt');
    out.state = { ctx: g ? Math.round(g.context) : null, inhale: A.inhaling('gpt') };
    return out;
  },
  takes: {
    // the three CPUs fighting on their own
    brawl: { seconds: 40,
      setup: () => {
        ['menu', 'select', 'result'].forEach(id => { document.getElementById(id).hidden = true; });
        window.__maxDist = 24;
        window.__app.startMatch({ kind: 'watch' });
      },
      script: [] },

    // Stack Overflow: a burst of blocks off the top of the stack, the beam once the stack refills, then the whip
    so: { seconds: 20,
      setup: () => window.__app.stage('so', [['so', -3, 1], ['gpt', 0.2, -1], ['claude', 2.6, -1]]),
      script: [
        [0.8, page => page.down('KeyJ')],
        [1.7, page => page.up('KeyJ')],
        [5.2, page => page.press('KeyK')],
        [10.9, page => page.js(() => window.__app.place('gpt', -0.9, -1))],
        [11.5, page => page.press('KeyL')],
      ] },

    // ChatGPT: inhale against blocks and rods, against dots, against the beam, against a correction; then compaction
    gpt: { seconds: 60,
      setup: () => window.__app.stage('gpt', [['gpt', -2.2, 1], ['claude', 0.9, -1], ['so', 3, -1]]),
      script: [
        // the tornado on its own, under the title and the first line
        [1.4, page => page.press('KeyL')],
        [5.6, page => page.press('KeyL')],
        [8.6, page => page.press('KeyL')],
        // blocks and rods
        [11.7, page => page.press('KeyL')],
        [12.0, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [12.15, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [12.3, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [12.45, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [12.6, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [16.2, page => page.press('KeyL')],
        [16.5, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [16.65, page => page.js(() => window.__app.fire('claude', 'a3', -1))],
        [16.8, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [16.95, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        // dots
        [21.5, page => page.press('KeyL')],
        [21.65, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        [25.2, page => page.press('KeyL')],
        [25.35, page => page.js(() => window.__app.fire('claude', 'a1', -1))],
        // the beam: Claude steps out of the line of fire right at the cut
        [28.3, page => page.js(() => window.__app.place('claude', -4.6, 1))],
        [28.9, page => page.press('KeyL')],
        [29.1, page => page.js(() => window.__app.fire('so', 'a2', -1))],
        [33.4, page => page.press('KeyL')],
        [33.6, page => page.js(() => window.__app.fire('so', 'a2', -1))],
        // a correction
        [37.9, page => page.press('KeyL')],
        [38.2, page => page.js(() => window.__app.fire('so', 'a4', -1))],
        // compaction, with both of them in front again right at the cut
        [44.78, page => page.js(() => { window.__app.place('claude', 0.6, -1); window.__app.place('so', 2.4, -1); })],
        [45.6, page => page.press('KeyI')],
      ] },

    // Claude: a line of three, a square of four, then the rods in rapid fire
    claude: { seconds: 14,
      setup: () => window.__app.stage('claude', [['claude', -2.4, 1], ['so', 1.2, -1], ['gpt', 3.4, -1]]),
      script: [
        [0.7, page => page.press('KeyJ')],
        [3.4, page => page.press('KeyJ')],
        [6.4, page => page.down('KeyL')],
        [7.9, page => page.up('KeyL')],
      ] },

    // shield, a parried block, then a fling that knocks Stack Overflow off the end of the stage
    parry: { seconds: 10,
      setup: () => window.__app.stage('claude', [['claude', -1.2, 1], ['so', 2.6, -1], ['gpt', -4.5, 1]]),
      script: [
        [0.8, page => page.down('Backspace')],
        [1.2, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [1.45, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [2.6, page => page.js(() => window.__app.fire('so', 'a1', -1))],
        [2.78, page => page.up('Backspace')],
        [5.0, page => page.js(() => { const A = window.__app; A.place('claude', 7.7, 1); A.place('so', 9.95, -1); A.place('gpt', 4.5, 1); })],
        [5.9, page => page.press('KeyK')],
      ] },
  },
};
