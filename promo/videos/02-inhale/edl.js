// Devlog: what ChatGPT's inhale does to each attack. All from the 'gpt' take (seconds into it):
// the take is timed to the cuts: tornado 1.4-11, blocks and rods 11.7-17, dots 21.5-26, beams 28.9 and 33.4,
// correction 37.9, compaction 45.6 (Claude and Stack Overflow are moved at the cuts, 28.3 and 44.78).
({
  style: 'ink',
  thumbnail: 1.2,   // the title over the first inhale, the mouth marked; the first line waits (lead 1.4)
  titleCard: { kicker: 'Devlog · Bot Battle', title: 'What the inhale eats', hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 43, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.2, beat: 0.18, air: 0.12,
    chords: [
      { at: 0, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 14, notes: [52, 59, 64, 71], level: 0.45 },
      { at: 28, notes: [53, 60, 65, 72], level: 0.45 },
    ] },
  segments: [
    // one continuous take, timed so each event starts just after its line does
    { say: 0, lead: 1.4, layers: [{ type: 'clip', clip: 'gpt', from: 0, ann: 'inhale' }] },
    { say: 1, lead: 0.2, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false }] },
    { say: 2, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false }] },
    { say: 3, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false }] },
    { say: 4, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false }] },
    { say: 5, lead: 0.3, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false }] },
    // the flattened two keep growing back under the card
    { dur: 4.6, layers: [{ type: 'clip', clip: 'gpt', from: 'cont', ann: false },
      { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
