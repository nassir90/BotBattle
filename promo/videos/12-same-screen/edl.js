// Two players, one phone: the screen split across the middle, User B's half turned round for the player across the
// table, each tapping their own buttons (take same_screen, ann 'moves': the players named beside the phone; the buttons name the moves).
// Sound: fightcut.py same_screen 12-same-screen --sound-only 39.9
(() => {
  const paper = { type: 'solid', color: '#fbfaf7' };
  const phone = (from, ann) => [paper, { type: 'device', kind: 'phone', clip: 'same_screen', from, rect: [210, 480, 660, 1100], yaw: -12, pitch: 4, sway: 3, ann }];
  return {
    style: 'ink',
    lines: [],
    thumbnail: 1.2,
    titleCard: { kicker: 'Bot Battle · Multiplayer', title: 'Two players, one phone', hold: 3.0 },
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 35.3, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: phone(0, 'moves') },
      { dur: 4.6, layers: [...phone(35.3, false), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
    ],
  };
})()
