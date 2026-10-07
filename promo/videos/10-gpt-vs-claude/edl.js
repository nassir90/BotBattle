// ChatGPT vs Claude: the whole CPU match, versus screen to results table, with no narration (take duel_gpt_claude).
// Written by fightcut.py, with the sound track sfx_fight.wav: run it again after re-recording the take.
({
  style: 'ink',
  lines: [],               // no narration
  thumbnail: 2.6,          // the versus screen, every panel's line showing
  segments: [
    { dur: 49.433, sfx: [{ type: 'fight', at: 0, vol: 1 }], layers: [{ type: 'clip', clip: 'duel_gpt_claude', from: 0, ann: false }] },
    { dur: 4.6, layers: [{ type: 'clip', clip: 'duel_gpt_claude', from: 49.433, ann: false }, { type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }] },
  ],
})
