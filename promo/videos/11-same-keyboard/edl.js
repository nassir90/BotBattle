// Two players, one keyboard: User A (the left of the keyboard) as Stack Overflow and User B (the right) as Claude,
// from the Play screen through the match, on a 3D laptop. Each player's moves are named beside the laptop with their
// own keys in the game's move lists along the bottom, and the players named beside it (take same_keyboard, ann 'moves'). Sound: fightcut.py same_keyboard 11-same-keyboard --sound-only 39.9
(() => {
  const paper = { type: 'solid', color: '#fbfaf7' };
  const laptop = (from, ann) => [paper, { type: 'device', kind: 'laptop', clip: 'same_keyboard', from, rect: [230, 660, 620, 540], yaw: 0, pitch: 14, sway: 2, ann }];
  return {
    style: 'ink',
    lines: [],
    thumbnail: 1.2,
    titleCard: { kicker: 'Bot Battle · Multiplayer', title: 'Two players, one keyboard', hold: 3.0 },
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 35.3, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: laptop(0, 'moves') },
      { dur: 4.6, layers: [...laptop(35.3, false), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
    ],
  };
})()
