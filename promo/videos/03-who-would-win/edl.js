// Stack Overflow vs ChatGPT: the whole CPU match, versus screen to results table (take duel_so_gpt).
// Narrated: each line is said at its moment in the take (narration.py writes this file from vo.json; edit there).
// Sound track: fightcut.py (the match's take) 03-who-would-win
(() => {
  const END = { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' };
  const L = from => [{ type: 'clip', clip: 'duel_so_gpt', from, ann: false }];
  return {
    style: 'ink',
    thumbnail: 26.3,
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 0.150, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: L(0) },
      { say: 0, lead: 0.35, dur: 5.745, layers: L('cont') },
      { say: 1, lead: 0.35, dur: 6.355, layers: L('cont') },
      { say: 2, lead: 0.35, dur: 8.800, layers: L('cont') },
      { say: 3, lead: 0.35, dur: 8.600, layers: L('cont') },
      { say: 4, lead: 0.35, dur: 7.400, layers: L('cont') },
      { say: 5, lead: 0.35, dur: 18.400, layers: L('cont') },
      { say: 6, lead: 0.35, dur: 5.821, layers: L('cont') },
      { say: 7, lead: 0.35, dur: 4.429, layers: L('cont') },
      { dur: 4.6, layers: [...L('cont').map(l => ({ ...l, ann: false })), END] },
    ],
  };
})()
