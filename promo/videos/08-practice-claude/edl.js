// Practice: Claude's moves in training: its rays held down, fling, combobulating (a line, then a square), double jump,
// punch, low kick, side and overhead parries, the shield held up, the shield bash, and a crouch-walk. Each move is named above its head as it's used (take practice_claude, ann 'moves'); no
// narration. The sound track (sfx_fight.wav) is made from the take's events: fightcut.py practice_claude 08-practice-claude --sound-only 49.4
({
  style: 'ink',
  lines: [],
  thumbnail: 1.2,
  titleCard: { kicker: 'Bot Battle · Practice', title: "Claude's moves", hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { dur: 44.8, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: [{ type: 'clip', clip: 'practice_claude', from: 0, ann: 'moves' }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'practice_claude', from: 44.8, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
