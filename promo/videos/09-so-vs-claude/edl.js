// Stack Overflow vs Claude: the whole CPU match, versus screen to results table, with no narration (take duel_so_claude).
// Written by fightcut.py, with the sound track sfx_fight.wav: run it again after re-recording the take.
({
  style: 'ink',
  lines: [],               // no narration
  thumbnail: 2.6,          // the versus screen, every panel's line showing
  segments: [
    { dur: 52.567, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: [{ type: 'clip', clip: 'duel_so_claude', from: 0, ann: false }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'duel_so_claude', from: 52.567, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
