// Who would win: Stack Overflow against ChatGPT, CPU against CPU, two lives each (take duel_so_gpt).
// Events (take seconds): beam opening ~1-3, Stack Overflow parries ~12, whip KO 22.77, ChatGPT back 24.57,
// ChatGPT's tornado swallows the beam ~54.2-54.6, whip KO (out) 55.3, results table 56.4.
({
  style: 'ink',
  thumbnail: 1.2,
  titleCard: { kicker: 'Bot Battle · Stack Overflow vs ChatGPT', title: 'Who would win?', hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { say: 0, lead: 1.4, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 0.0, ann: false }] },
    { say: 1, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 8.095, ann: false }] },
    { say: 2, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 19.3, ann: false }] },
    { say: 3, tail: 2.3, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 24.741, ann: false }] },
    { say: 4, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 49.4, ann: false }] },
    // carries straight on: the beam is swallowed, then the whip takes the last life while the line is spoken
    { say: 5, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 54.59, ann: false }] },
    { dur: 3.0, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 59.934, ann: false }] },
    // the results table stays up under the card; the fighters behind it keep moving
    { dur: 4.6, layers: [{ type: 'clip', clip: 'duel_so_gpt', from: 62.94, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
