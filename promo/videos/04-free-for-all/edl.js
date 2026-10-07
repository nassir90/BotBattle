// Free-for-all: all three CPUs, two lives each, versus screen to results table (take ffa).
// Narrated: each line is said at its moment in the take (narration.py writes this file from vo.json; edit there).
// Sound track: fightcut.py (the match's take) 04-free-for-all
(() => {
  const END = { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' };
  const L = from => [{ type: 'clip', clip: 'ffa', from, ann: false }];
  return {
    style: 'ink',
    thumbnail: 27.0,
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 0.250, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: L(0) },
      { say: 0, lead: 0.35, dur: 4.553, layers: L('cont') },
      { say: 1, lead: 0.35, dur: 7.709, layers: L('cont') },
      { say: 2, lead: 0.35, dur: 4.899, layers: L('cont') },
      { say: 3, lead: 0.35, dur: 6.039, layers: L('cont') },
      { say: 4, lead: 0.35, dur: 10.800, layers: L('cont') },
      { say: 5, lead: 0.35, dur: 3.800, layers: L('cont') },
      { say: 6, lead: 0.35, dur: 6.600, layers: L('cont') },
      { say: 7, lead: 0.35, dur: 14.000, layers: L('cont') },
      { say: 8, lead: 0.35, dur: 9.450, layers: L('cont') },
      { dur: 4.6, layers: [...L('cont').map(l => ({ ...l, ann: false })), END] },
    ],
  };
})()
