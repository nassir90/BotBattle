// Practice: Stack Overflow's moves in training, each named by a callout at its stack (take practice_so, ann 'moves').
// Moves: block shot 1.0-2.3, whip 7.0, upward whip 10.37, beam 13.0, correction 16.5, parry 20.6, overhead parry 23.7,
// crouch 27.0, dash 29.6, upward whip latches 33.1, hangs 33.5, climbs 35.4. The whip comes after the first line, so
// the shots run on without showing anything twice.
({
  style: 'ink',
  thumbnail: 1.2,
  titleCard: { kicker: 'Bot Battle · Practice', title: "Stack Overflow's moves", hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { say: 0, lead: 1.4, layers: [{ type: 'clip', clip: 'practice_so', from: 0.0, ann: 'moves' }] },
    { say: 1, layers: [{ type: 'clip', clip: 'practice_so', from: 6.46, ann: 'moves' }] },
    { say: 2, layers: [{ type: 'clip', clip: 'practice_so', from: 12.6, ann: 'moves' }] },
    { say: 3, layers: [{ type: 'clip', clip: 'practice_so', from: 16.004, ann: 'moves' }] },
    { say: 4, layers: [{ type: 'clip', clip: 'practice_so', from: 19.9, ann: 'moves' }] },
    { say: 5, layers: [{ type: 'clip', clip: 'practice_so', from: 26.6, ann: 'moves' }] },
    { say: 6, layers: [{ type: 'clip', clip: 'practice_so', from: 32.7, ann: 'moves' }] },
    // back on the stage after the climb
    { dur: 4.6, layers: [{ type: 'clip', clip: 'practice_so', from: 38.71, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
