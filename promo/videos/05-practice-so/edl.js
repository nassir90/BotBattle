// Practice: Stack Overflow's moves in training: block shot, the whip (and upward), the beam, correction, parries, crouch,
// dash, the whip latching onto the ledge, then the moves everyone has: punch, low kick, the shield held up and the bash. Each move is named above its head as it's used (take practice_so, ann 'moves'); no
// narration. The sound track (sfx_fight.wav) is made from the take's events: fightcut.py practice_so 05-practice-so --sound-only 58.5
({
  style: 'ink',
  lines: [],
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
    { dur: 53.9, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: [{ type: 'clip', clip: 'practice_so', from: 0, ann: 'moves' }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'practice_so', from: 53.9, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
