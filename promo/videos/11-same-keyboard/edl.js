// Two players, one keyboard: User A (the left of the keyboard) as Stack Overflow and User B (the right) as Claude, on a 3D laptop; the game's move lists show each player's keys, and the players are named beside the laptop (take same_keyboard, ann 'moves').
// Narrated: each line is said at its moment in the take (narration.py writes this file from vo.json; edit there).
// Sound track: fightcut.py same_keyboard 11-same-keyboard --sound-only 39.9
(() => {
  const END = { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' };
  const paper = { type: 'solid', color: '#fbfaf7' };
  const L = (from, ann = 'moves') => [paper, { type: 'device', kind: 'laptop', clip: 'same_keyboard', from, rect: [230, 660, 620, 540], yaw: 0, pitch: 14, sway: 2, ann }];
  return {
    style: 'ink',
    thumbnail: 1.2,
    titleCard: { kicker: 'Bot Battle · Multiplayer', title: "Two players, one keyboard", hold: 3.0 },
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 1.050, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: L(0) },
      { say: 0, lead: 0.35, dur: 3.831, layers: L('cont') },
      { say: 1, lead: 0.35, dur: 5.328, layers: L('cont') },
      { say: 2, lead: 0.35, dur: 6.466, layers: L('cont') },
      { say: 3, lead: 0.35, dur: 3.477, layers: L('cont') },
      { say: 4, lead: 0.35, dur: 4.664, layers: L('cont') },
      { say: 5, lead: 0.35, dur: 5.434, layers: L('cont') },
      { say: 6, lead: 0.35, dur: 5.050, layers: L('cont') },
      { dur: 4.6, layers: [...L('cont', false), END] },
    ],
  };
})()
