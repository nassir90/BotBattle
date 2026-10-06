// Stack Overflow vs ChatGPT vs Claude: the whole CPU match, versus screen to results table, with no narration (take ffa).
// Written by fightcut.py, with the sound track sfx_fight.wav: run it again after re-recording the take.
({
  style: 'ink',
  lines: [],               // no narration
  thumbnail: 2.6,          // the versus screen, every panel's line showing
  segments: [
    { dur: 56.067, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: [{ type: 'clip', clip: 'ffa', from: 0, ann: false }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'ffa', from: 56.067, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
