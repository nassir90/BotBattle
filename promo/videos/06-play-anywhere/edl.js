// Play it anywhere: the game on a phone held upright, on a laptop, and on a phone on its side, each a 3D device
// (ShadowKit's device layer: rounded aluminium, a black bezel, the recording on its screen) on the game's paper.
// The phones are 19.5:9 (390 x 844 CSS px) with 55px rounded screen corners. show_phone: menu, Free-for-all 1.5,
// carousel 3.2/4.4, Play 6.7, versus screen to ~10.3, buttons from 11.5. show_desktop: Duel 2.2, carousel keys
// 3.6/4.6, Enter 5.8, random opponent (R) 7.2, versus ~8-11.5, match from ~12. show_landscape: Training 1.2,
// match ~4.4, inhale 7, takeover cursor 12.
(() => {
  const paper = { type: 'solid', color: '#fbfaf7' };
  const phone = from => [paper, { type: 'device', kind: 'phone', clip: 'show_phone', from, rect: [190, 470, 700, 1130], yaw: -14, pitch: 4, sway: 3 }];
  const laptop = from => [paper, { type: 'device', kind: 'laptop', clip: 'show_desktop', from, rect: [20, 600, 1040, 900], yaw: 12, pitch: 14, sway: 2 }];
  const side = from => [paper, { type: 'device', kind: 'phone', clip: 'show_landscape', from, rect: [20, 760, 1040, 640], yaw: 10, pitch: 6, sway: 2.5 }];
  return {
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
      { say: 0, lead: 1.4, layers: phone(0.3) },
      { say: 1, layers: phone('cont') },          // carries straight on: the versus screen, then the buttons
      { say: 2, layers: laptop(1.0) },
      { say: 3, layers: laptop('cont') },         // the random pick and the versus screen, straight on
      { say: 4, layers: side(4.6) },
      { say: 5, layers: side(11.6) },
      // back to the phone held upright, carrying on from where it left off
      { dur: 4.6, layers: [...phone('cont'), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
    ],
  };
})()
