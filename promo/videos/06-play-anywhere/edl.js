// Play it anywhere: the game on a phone held upright, on a desktop, and on a phone on its side. Each sits on the
// game's own paper colour, at its own shape: the phone inset between the title and the subtitles, the wide screens as bands.
// show_phone: menu, Free-for-all 1.5, carousel 3.2/4.4, Play 5.8, buttons from 9. show_desktop: Duel 2.2, carousel
// keys 3.6/4.6, Enter 5.8, random opponent 7.2, match from ~8.3. show_landscape: Training 1.2, match ~4.4, inhale 7,
// takeover cursor 12.
({
  style: 'ink',
  thumbnail: 1.2,
  titleCard: { kicker: 'Bot Battle · Showcase', title: 'Play it anywhere', hold: 3.0 },
  music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
  segments: [
    { say: 0, lead: 1.4, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_phone', from: 0.3, rect: [235, 498, 610, 1084], ann: false }] },
    { say: 1, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_phone', from: 6.358, rect: [235, 498, 610, 1084], ann: false }] },
    { say: 2, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_desktop', from: 1.0, rect: [0, 656, 1080, 608], ann: false }] },
    { say: 3, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_desktop', from: 9.0, rect: [0, 656, 1080, 608], ann: false }] },
    { say: 4, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_landscape', from: 4.6, rect: [0, 698, 1080, 525], ann: false }] },
    { say: 5, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_landscape', from: 11.6, rect: [0, 698, 1080, 525], ann: false }] },
    // back to the phone held upright, carrying on from where it left off
    { dur: 4.6, layers: [{ type: 'solid', color: '#fbfaf7' }, { type: 'clip', clip: 'show_phone', from: 12.187, rect: [235, 498, 610, 1084], ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
