// Play it anywhere: the game on a phone held upright, on a laptop, and on a phone on its side. Each recording sits in
// a drawn device on the game's own paper colour, so it's clear what you're looking at. show_phone: menu, Free-for-all
// 1.5, carousel 3.2/4.4, Play 6.7, versus screen to ~10.3, buttons from 11.5. show_desktop: Duel 2.2, carousel keys
// 3.6/4.6, Enter 5.8, random opponent 7.2, versus ~8-11.5, match from ~12. show_landscape: Training 1.2, match ~4.4,
// inhale 7, takeover cursor 12.
(() => {
  const BODY = '#1d1d21', RIM = '#4a4a52', METAL = '#d9d6cf', METAL_EDGE = '#a7a399';
  // a device body: its outline with a soft shadow under the screen, and over it the bezel (outer shape minus the
  // screen's rounded opening, so the footage's corners are rounded too) with its details
  const under = o => g => {
    g.save(); g.shadowColor = 'rgba(30, 26, 20, 0.22)'; g.shadowBlur = 54; g.shadowOffsetY = 24;
    g.beginPath(); g.roundRect(...o); g.fillStyle = BODY; g.fill(); g.restore();
  };
  const bezel = (g, o, s, r) => {
    g.beginPath(); g.roundRect(...o); g.roundRect(s[0], s[1], s[2], s[3], r); g.fillStyle = BODY; g.fill('evenodd');
    g.beginPath(); g.roundRect(o[0] + 1.5, o[1] + 1.5, o[2] - 3, o[3] - 3, o[4] - 1.5); g.strokeStyle = RIM; g.lineWidth = 3; g.stroke();
  };
  const pill = (g, x, y, w, h, c) => { g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2); g.fillStyle = c; g.fill(); };
  const dot = (g, x, y, r, c) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = c; g.fill(); };

  // the phone held upright: speaker and camera in the top bezel, buttons down the sides
  const PS = [272, 540, 536, 953], PO = [PS[0] - 22, PS[1] - 34, PS[2] + 44, PS[3] + 68, 66];
  const phoneOver = g => {
    bezel(g, PO, PS, 40);
    pill(g, 540 - 46, PO[1] + 14, 92, 7, '#3a3a42'); dot(g, 540 + 70, PO[1] + 17, 5, '#2c3440');
    pill(g, PO[0] + PO[2] - 1, PO[1] + 250, 6, 110, BODY);
    pill(g, PO[0] - 5, PO[1] + 210, 6, 70, BODY); pill(g, PO[0] - 5, PO[1] + 300, 6, 70, BODY);
  };
  // the laptop: a black lid round the screen with its camera, on a silver deck
  const LS = [100, 700, 880, 495], LO = [LS[0] - 24, LS[1] - 30, LS[2] + 48, LS[3] + 54, 22];
  const laptopOver = g => {
    bezel(g, LO, LS, 6);
    dot(g, 540, LO[1] + 15, 5, '#2c3440');
    const y = LO[1] + LO[3], x0 = LO[0] - 44, x1 = LO[0] + LO[2] + 44;
    g.beginPath(); g.moveTo(LO[0] - 6, y); g.lineTo(LO[0] + LO[2] + 6, y); g.lineTo(x1, y + 18); g.quadraticCurveTo(x1, y + 28, x1 - 14, y + 28);
    g.lineTo(x0 + 14, y + 28); g.quadraticCurveTo(x0, y + 28, x0, y + 18); g.closePath();
    g.fillStyle = METAL; g.fill(); g.strokeStyle = METAL_EDGE; g.lineWidth = 2; g.stroke();
    pill(g, 540 - 70, y + 1, 140, 9, '#c4c0b7');
  };
  const laptopUnder = g => { under(LO)(g); g.save(); g.shadowColor = 'rgba(30, 26, 20, 0.22)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
    g.fillStyle = METAL; g.fillRect(LO[0] - 30, LO[1] + LO[3] + 10, LO[2] + 60, 16); g.restore(); };
  // the phone on its side: speaker and camera in the left bezel, buttons along the top
  const SS = [100, 756, 880, 428], SO = [SS[0] - 34, SS[1] - 22, SS[2] + 68, SS[3] + 44, 60];
  const sideOver = g => {
    bezel(g, SO, SS, 38);
    pill(g, SO[0] + 14, 970 - 46, 7, 92, '#3a3a42'); dot(g, SO[0] + 17, 970 + 70, 5, '#2c3440');
    pill(g, SO[0] + 250, SO[1] - 5, 110, 6, BODY);
  };

  const paper = { type: 'solid', color: '#fbfaf7' };
  const phone = from => [paper, { type: 'draw', fn: under(PO) }, { type: 'clip', clip: 'show_phone', from, rect: PS, ann: false }, { type: 'draw', fn: phoneOver }];
  const laptop = from => [paper, { type: 'draw', fn: laptopUnder }, { type: 'clip', clip: 'show_desktop', from, rect: LS, ann: false }, { type: 'draw', fn: laptopOver }];
  const side = from => [paper, { type: 'draw', fn: under(SO) }, { type: 'clip', clip: 'show_landscape', from, rect: SS, ann: false }, { type: 'draw', fn: sideOver }];
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
      { say: 1, layers: phone(7.17) },          // carries straight on: the versus screen, then the buttons
      { say: 2, layers: laptop(1.0) },
      { say: 3, layers: laptop(12.7) },
      { say: 4, layers: side(4.6) },
      { say: 5, layers: side(11.6) },
      // back to the phone held upright, carrying on from where it left off
      { dur: 4.6, layers: [...phone(14.29), { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
    ],
  };
})()
