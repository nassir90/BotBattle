// Showcase: each fighter's signature moves, then shield, parry and a ring-out. Times are take seconds.
// so: blocks 0.8-1.7, beam 5.2, whip 11.5. gpt (timed for the inhale devlog): blocks and rods 11.7-17, compaction 45.6. claude: line 0.7, square 3.4, rods 6.4-7.9.
// parry: shield 0.8, parry 2.78, the fighters are moved to the edge at 5.0 (skipped as a cut), fling 5.9.
({
  style: 'ink',
  thumbnail: 1.2,   // the title over the brawl; the first line waits (lead 1.4)
  titleCard: { kicker: 'Showcase · Bot Battle', title: 'Three bots, one sheet of paper', hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { say: 0, lead: 1.4, layers: [{ type: 'clip', clip: 'brawl', from: 1.0, ann: false }] },
    { say: 1, lead: 0.3, layers: [{ type: 'clip', clip: 'so', from: 0.4, skip: [[2.1, 3.9]], ann: false }] },
    { say: 2, lead: 0.3, layers: [{ type: 'clip', clip: 'so', from: 10.95, ann: false }] },
    { say: 3, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 9.1, ann: false }] },
    { say: 4, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 45.0, ann: false }] },
    { say: 5, lead: 0.3, layers: [{ type: 'clip', clip: 'claude', from: 0.4, ann: false }] },
    { say: 6, lead: 0.3, layers: [{ type: 'clip', clip: 'claude', from: 6.1, ann: false }] },
    { say: 7, lead: 0.3, tail: 0.8, layers: [{ type: 'clip', clip: 'parry', from: 0.5, skip: [[4.9, 5.1]], ann: false }] },
    // the brawl carries on under the card
    { dur: 4.6, layers: [{ type: 'clip', clip: 'brawl', from: 24.0, ann: false },
      { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
