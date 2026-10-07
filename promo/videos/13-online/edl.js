// Online: two phones, each its own player, matched in a casual match through the real server (the local dev server),
// from the Online screen through the lobby, the versus screen and the match (takes online_a and online_b, recorded
// together). Sound from the host's take: fightcut.py online_a 13-online --sound-only 47.9
(() => {
  const paper = { type: 'solid', color: '#fbfaf7' };
  const phones = from => [paper,
    { type: 'device', kind: 'phone', clip: 'online_a', from, rect: [20, 560, 520, 1130], yaw: 10, pitch: 4, sway: 2.5 },
    { type: 'device', kind: 'phone', clip: 'online_b', from, rect: [540, 560, 520, 1130], yaw: -10, pitch: 4, sway: 2.5 }];
  return {
    style: 'ink',
    lines: [],
    thumbnail: 1.2,
    titleCard: { kicker: 'Bot Battle · Multiplayer', title: 'Online, phone to phone', hold: 3.0 },
    music: { level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] },
    segments: [
      { dur: 43.3, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: phones(0) },
      { dur: 4.6, layers: [...phones(43.3), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
    ],
  };
})()
