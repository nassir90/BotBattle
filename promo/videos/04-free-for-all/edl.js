// Free-for-all: all three CPUs, two lives each (take ffa).
// Events: Claude rings out 9.47; the beam catches both, ChatGPT KO 24.5; Claude out 39.73; compactions on Stack
// Overflow ~44.6-45.5 and ~48, then a tornado that
// fails (~49-50.5, held by the longer tail); Stack Overflow's blocks take ChatGPT's last life 60.43; results table 61.57.
({
  style: 'ink',
  thumbnail: 1.2,
  titleCard: { kicker: 'Bot Battle · Free-for-all', title: 'Three bots, two lives each', hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { say: 0, lead: 1.4, layers: [{ type: 'clip', clip: 'ffa', from: 0.0, ann: false }] },
    { say: 1, layers: [{ type: 'clip', clip: 'ffa', from: 7.61, ann: false }] },
    { say: 2, layers: [{ type: 'clip', clip: 'ffa', from: 20.6, ann: false }] },
    { say: 3, layers: [{ type: 'clip', clip: 'ffa', from: 37.5, ann: false }] },
    { say: 4, tail: 2.2, layers: [{ type: 'clip', clip: 'ffa', from: 42.6, ann: false }] },
    { say: 5, layers: [{ type: 'clip', clip: 'ffa', from: 56.4, ann: false }] },
    { dur: 2.5, layers: [{ type: 'clip', clip: 'ffa', from: 63.68, ann: false }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'ffa', from: 66.18, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
