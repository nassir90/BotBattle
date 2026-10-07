// Bot Battle is now on Roblox: the Roblox port (BotBattleBlox), filmed in Roblox Studio's play test as it runs, on a
// 3D laptop on the game's paper, after the web version above the Roblox one. The rb_ takes come from
// roblox/totake.py (a window recording of Studio's viewport, made a take): rb_menu the main menu, rb_fight a
// three-CPU match from the menu (versus screen ~8-13, the fight from ~14, the beam ~24), rb_moves training as Stack
// Overflow (the inhale ~8.5, the compaction slab ~16.5), rb_screens the Play screen (~2.5) and Online (~7.5).
(() => {
  const paper = { type: 'solid', color: '#fbfaf7' };
  const laptop = (clip, from, speed = 1) => [paper, { type: 'device', kind: 'laptop', clip, from, speed, rect: [20, 600, 1040, 900], yaw: 12, pitch: 14, sway: 2 }];
  return {
    style: 'ink',
    thumbnail: 1.5,     // the title, fully up, over the Roblox fight on the laptop
    titleCard: { kicker: 'Bot Battle · Roblox', title: 'Bot Battle is now on Roblox', hold: 3.0 },
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
      chords: [
        { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
        { at: 14, notes: [53, 60, 65, 72], level: 0.45 },
        { at: 28, notes: [55, 62, 67, 74], level: 0.45 },
        { at: 42, notes: [57, 64, 69, 76], level: 0.4 },
      ] },
    segments: [
      { dur: 4.6, layers: laptop('rb_fight', 16) },   // the title over the Roblox fight alone: the thumbnail
      { say: 0, layers: [{ type: 'split', top: 0, h: 960, a: { clip: 'brawl', from: 4, label: 'web', labelY: 540, ann: false }, b: { clip: 'rb_fight', from: 20.6, label: 'roblox', ann: false } }], sfx: [{ at: 0.1, type: 'whoosh', vol: 0.3 }] },
      { say: 1, layers: laptop('rb_menu', 0.5) },
      { say: 2, layers: laptop('rb_fight', 7.2) },
      { say: 3, layers: laptop('rb_moves', 7.6) },
      { say: 4, layers: laptop('rb_screens', 2.4, 0.55) },   // slowed: the Play screen is still, and lasts until Online opens
      { say: 5, layers: laptop('rb_screens', 7.4, 0.6) },    // likewise Online, until the leaderboard (which can't load in Studio)
      { say: 6, tail: 1, layers: laptop('rb_fight', 17.6) },   // the beam lands near the end of the line
      // the menu again, its CPUs still brawling, under the end card
      { dur: 4.5, layers: [...laptop('rb_menu', 5.5), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'roblox.com/games/110903526036358' }] },
    ],
  };
})()
