# The narrated videos that play one take (or two, side by side) straight through: each line is said at a moment in the
# take, just before what it describes. This writes each video's script.json, and once the voice exists (vo.json, from
# ShadowKit's voice.py) its edit list, with every line placed at its moment and the footage continuous underneath.
#
#   python3 narration.py scripts                 videos/<id>/script.json for every video here
#   GCP_PROJECT=<id> python3 ~/projects/ShadowKit/voice.py <key file> videos/<id>/vo.wav videos/<id>/script.json
#   python3 narration.py edls                    videos/<id>/edl.js, from each vo.json
#
# Times are seconds into the take, which is also the video's time (the footage starts at the take's start). The sound
# tracks come from fightcut.py (the matches) or fightcut.py --sound-only (the rest), as their own edit lists say.
import json, os, sys

END = "{ type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }"
END_LEN, LEAD, TAIL = 4.6, 0.35, 0.5
MUSIC = """{ level: 0.9, mix: 0.16, root: 45, drone: 0.1, pad: 0.08, piano: 0.14, boom: 0.25, beat: 0.2, air: 0.1,
    chords: [
      { at: 0, notes: [57, 64, 69, 76], level: 0.45 },
      { at: 12, notes: [53, 60, 65, 72], level: 0.45 },
      { at: 26, notes: [55, 62, 67, 74], level: 0.45 },
      { at: 38, notes: [57, 64, 69, 76], level: 0.4 },
    ] }"""
clip = lambda take, ann: f"from => [{{ type: 'clip', clip: '{take}', from, ann: {ann} }}]"
paper = "{ type: 'solid', color: '#fbfaf7' }"

VIDEOS = {
  # ---- the matches: fightcut.py <take> <id> makes sfx_fight.wav; the match runs to the results table ----
  '03-who-would-win': dict(about="Stack Overflow vs ChatGPT: the whole CPU match, versus screen to results table (take duel_so_gpt).",
    layers=clip('duel_so_gpt', 'false'), total=70.3, thumb=26.3, lines=[
    (0.5, "Stack Overflow against ChatGPT, with two lives each."),
    (4.4, "ChatGPT opens with its inhale, and Stack Overflow answers with a correction."),
    (12.6, "Stack Overflow parries, but the compaction slab still flattens it."),
    (21.4, "Its unified beam takes ChatGPT down to a third of its health."),
    (30.0, "One more push sends ChatGPT off the edge of the page, and it loses a life."),
    (37.4, "Back with full health, ChatGPT keeps inhaling and compacting."),
    (55.8, "Stack Overflow holds on until ChatGPT goes over the edge again."),
    (61.6, "Stack Overflow wins."),
  ]),
  '04-free-for-all': dict(about="Free-for-all: all three CPUs, two lives each, versus screen to results table (take ffa).",
    layers=clip('ffa', 'false'), total=72.7, thumb=27.0, lines=[
    (0.6, "All three bots fight at once, with two lives each."),
    (4.4, "Claude's dots, ChatGPT's inhale and Stack Overflow's beam all go off in the first few seconds."),
    (10.4, "Stack Overflow punches its way in, and its beam knocks ChatGPT out."),
    (15.8, "ChatGPT comes back, and its cursor takes control of Stack Overflow."),
    (23.8, "A low kick and the beam knock Claude out next."),
    (34.6, "Claude parries again and again."),
    (38.4, "Then Stack Overflow is knocked out too, so everyone is down to one life."),
    (45.0, "ChatGPT compacts Claude and takes it over, and Claude is out of the match."),
    (59.0, "It comes down to Stack Overflow against ChatGPT, and Stack Overflow wins."),
  ]),
  '09-so-vs-claude': dict(about="Stack Overflow vs Claude: the whole CPU match (take duel_so_claude).",
    layers=clip('duel_so_claude', 'false'), total=57.2, thumb=27.4, lines=[
    (0.6, "Stack Overflow faces Claude, with two lives each."),
    (4.4, "Stack Overflow fires its correction and its beam, and Claude answers with a line of dots."),
    (17.4, "Claude closes in and punches."),
    (22.6, "Claude parries twice, but the beam catches it and knocks it out."),
    (30.6, "Then Stack Overflow is thrown off the page, so both are down to one life."),
    (37.4, "A low kick and another beam wear Claude down."),
    (46.4, "Claude goes over the edge, and Stack Overflow wins."),
  ]),
  '10-gpt-vs-claude': dict(about="ChatGPT vs Claude: the whole CPU match (take duel_gpt_claude).",
    layers=clip('duel_gpt_claude', 'false'), total=54.0, thumb=25.3, lines=[
    (0.6, "ChatGPT takes on Claude, with two lives each."),
    (4.4, "Claude punches out its dots while ChatGPT inhales."),
    (8.8, "They trade punches and kicks up close, and both of them fall off the page."),
    (18.4, "Down to one life each, they parry each other's attacks."),
    (27.8, "Claude's dots keep finding ChatGPT, and its health drops by half."),
    (33.4, "Even ChatGPT's compaction can't turn it round."),
    (42.6, "ChatGPT goes over the edge, and Claude wins with most of its health left."),
  ]),
  # ---- practice: the moves start after the title card; fightcut.py <take> <id> --sound-only <total> ----
  '05-practice-so': dict(about="Practice: Stack Overflow's moves in training, each named above its head as it's used (take practice_so, ann 'moves').",
    layers=clip('practice_so', "'moves'"), total=59.9, title=('Bot Battle · Practice', "Stack Overflow's moves"), sound='practice_so', lines=[
    (4.2, "Stack Overflow fires blocks from the top of its stack."),
    (9.8, "Its whip lashes out low, or straight up."),
    (15.8, "The beam fires all five blocks at once."),
    (19.4, "Its correction stuns everyone nearby."),
    (23.4, "It parries from the side, and from above."),
    (29.6, "It crouches under a fling, then dashes past."),
    (35.6, "Below the stage, the whip grabs the ledge."),
    (41.8, "Everyone can punch, and kick low while crouching."),
    (47.0, "Holding parry keeps the shield up."),
    (51.6, "A dash with the shield up is a bash."),
  ]),
  '07-practice-gpt': dict(about="Practice: ChatGPT's moves in training (take practice_gpt, ann 'moves').",
    layers=clip('practice_gpt', "'moves'"), total=49.9, title=('Bot Battle · Practice', "ChatGPT's moves"), sound='practice_gpt', lines=[
    (3.9, "ChatGPT's cursor chases the nearest enemy."),
    (7.2, "Its inhale swallows Claude's rays."),
    (11.6, "It can jump twice."),
    (14.6, "The advanced cursor takes over Stack Overflow."),
    (19.6, "Compaction flattens everyone in front."),
    (24.0, "It punches, and kicks low while crouching."),
    (29.6, "It parries, then holds its shield up."),
    (37.6, "A dash with the shield up is a bash."),
    (41.6, "Crouching, it can still walk."),
  ]),
  '08-practice-claude': dict(about="Practice: Claude's moves in training (take practice_claude, ann 'moves').",
    layers=clip('practice_claude', "'moves'"), total=49.9, title=('Bot Battle · Practice', "Claude's moves"), sound='practice_claude', lines=[
    (4.0, "In training, Claude fires the rays of its own logo."),
    (7.6, "Fling jabs a single ray forward, and the ray grows back."),
    (10.4, "Combobulating punches out a line of three dots, then a square of four."),
    (16.8, "Claude can jump twice."),
    (20.0, "It punches, and kicks low while crouching."),
    (25.8, "It parries a block from the side, and the whip from above."),
    (31.8, "Holding the parry button keeps the shield up, and the blocks bounce off."),
    (37.0, "Dashing with the shield up knocks Stack Overflow flying."),
    (41.0, "Crouching, it can still walk, slowly."),
  ]),
  # ---- multiplayer, on 3D devices ----
  '11-same-keyboard': dict(about="Two players, one keyboard: User A (the left of the keyboard) as Stack Overflow and User B (the right) as Claude, on a 3D laptop; the game's move lists show each player's keys, and the players are named beside the laptop (take same_keyboard, ann 'moves').",
    prelude=f"const paper = {paper};\n  const L = (from, ann = 'moves') => [paper, {{ type: 'device', kind: 'laptop', clip: 'same_keyboard', from, rect: [230, 660, 620, 540], yaw: 0, pitch: 14, sway: 2, ann }}];",
    layers="L", end_layers="[...L('cont', false), END]", total=39.9, title=('Bot Battle · Multiplayer', 'Two players, one keyboard'), sound='same_keyboard', lines=[
    (1.4, "Two people can play on one keyboard."),
    (4.2, "User A takes Stack Overflow, and User B takes Claude."),
    (8.2, "User A plays on the left of the keyboard, with W, A, S and D to move."),
    (12.6, "User B plays on the right, with the arrow keys."),
    (16.8, "Each player's moves are listed along the bottom, with their own keys."),
    (23.4, "Everything works the same as playing alone, from punches to the beam."),
    (30.6, "Here, User A uses the shield bash."),
  ]),
  '12-same-screen': dict(about="Two players, one phone: the screen split across the middle, User B's half turned round, each tapping their own buttons; the players are named beside the phone (take same_screen, ann 'moves').",
    prelude=f"const paper = {paper};\n  const L = (from, ann = 'moves') => [paper, {{ type: 'device', kind: 'phone', clip: 'same_screen', from, rect: [210, 480, 660, 1100], yaw: -12, pitch: 4, sway: 3, ann }}];",
    layers="L", end_layers="[...L('cont', false), END]", total=39.9, title=('Bot Battle · Multiplayer', 'Two players, one phone'), sound='same_screen', lines=[
    (1.4, "Two people can also share one phone."),
    (4.0, "The screen splits across the middle, and User B's half is turned round for the player across the table."),
    (11.2, "Each player taps their own buttons, at their own end."),
    (16.8, "Here, User A's ChatGPT takes over User B's Stack Overflow."),
    (23.0, "Both halves show the same fight, each the right way up for its player."),
    (29.4, "The health plates sit in the middle, where both players can see them."),
  ]),
  '13-online': dict(about="Online: two phones, each its own player, matched in a casual match through the real server (the local dev server), recorded together (takes online_a and online_b).",
    prelude=f"const paper = {paper};\n  const L = from => [paper,\n    {{ type: 'device', kind: 'phone', clip: 'online_a', from, rect: [20, 560, 520, 1130], yaw: 10, pitch: 4, sway: 2.5 }},\n    {{ type: 'device', kind: 'phone', clip: 'online_b', from, rect: [540, 560, 520, 1130], yaw: -10, pitch: 4, sway: 2.5 }}];",
    layers="L", end_layers="[...L('cont'), END]", total=47.9, title=('Bot Battle · Multiplayer', 'Online, phone to phone'), sound='online_a', lines=[
    (1.4, "Online, each player has their own device."),
    (4.2, "Find a match puts you in a casual match with whoever else is looking for one."),
    (9.0, "Both pick a fighter and press Ready, and the match starts by itself."),
    (13.4, "Each phone shows the versus screen, with its own player marked as you."),
    (18.0, "One phone runs the match, and the other follows it as it happens."),
    (24.2, "Stack Overflow's beam and Claude's dots land on both screens at once."),
    (31.0, "Every move either player makes shows up on both phones."),
  ]),
}


def scripts():
    for vid, v in VIDEOS.items():
        os.makedirs(f"videos/{vid}", exist_ok=True)
        json.dump([{"say": t} for _, t in v["lines"]], open(f"videos/{vid}/script.json", "w"), indent=1)
        print("script", vid, len(v["lines"]), "lines")


def edl(vid, v):
    vo = json.load(open(f"videos/{vid}/vo.json"))
    lens = [ln["end"] - ln["start"] for ln in vo["lines"]]
    body = v["total"] - END_LEN
    # segment boundaries: each line's segment starts LEAD before its moment; a line too long for its slot pushes the
    # next one a little later (the footage carries straight on underneath either way)
    segs, t = [], 0.0
    first = v["lines"][0][0] - LEAD
    if first > 0.05: segs.append((None, first)); t = first
    for i, (at, _) in enumerate(v["lines"]):
        start = max(t, at - LEAD)
        if start > t + 0.05: segs.append((None, start - t)); t = start
        nxt = v["lines"][i + 1][0] - LEAD if i + 1 < len(v["lines"]) else body
        need = LEAD + lens[i] + TAIL
        dur = max(nxt - t, need)
        segs.append((i, dur)); t += dur
    if t > body + 0.05: sys.exit(f"{vid}: the narration runs {t - body:.1f} s into the end card; move lines earlier or lengthen the take")
    if body - t > 0.05: segs.append((None, body - t))
    layers = v.get("layers")
    if layers.startswith("from =>"): prelude, Lname, end_layers = f"const L = {layers};", "L", f"[...L({body:.3f}), END]".replace(f"L({body:.3f})", "L('cont')")
    else: prelude, Lname, end_layers = v["prelude"], "L", v["end_layers"]
    rows = []
    for k, (say, dur) in enumerate(segs):
        frm = "0" if k == 0 else "'cont'"
        sfx = ", sfx: [{ type: 'fight', at: 0, vol: 1 }]" if k == 0 else ""
        sayp = f"say: {say}, lead: {LEAD}, " if say is not None else ""
        rows.append(f"      {{ {sayp}dur: {dur:.3f}{sfx}, layers: {Lname}({frm}) }},")
    if layers.startswith("from =>"):
        rows.append(f"      {{ dur: {END_LEN}, layers: [...L('cont').map(l => ({{ ...l, ann: false }})), END] }},")
    else:
        rows.append(f"      {{ dur: {END_LEN}, layers: {end_layers} }},")
    title = f"\n    titleCard: {{ kicker: '{v['title'][0]}', title: \"{v['title'][1]}\", hold: 3.0 }}," if v.get("title") else ""
    sound = f"fightcut.py {v['sound']} {vid} --sound-only {v['total']}" if v.get("sound") else f"fightcut.py (the match's take) {vid}"
    src = f"""// {v['about']}
// Narrated: each line is said at its moment in the take (narration.py writes this file from vo.json; edit there).
// Sound track: {sound}
(() => {{
  const END = {END};
  {prelude}
  return {{
    style: 'ink',
    thumbnail: {v.get('thumb', 1.2)},{title}
    music: {MUSIC},
    segments: [
{chr(10).join(rows)}
    ],
  }};
}})()
"""
    open(f"videos/{vid}/edl.js", "w").write(src)
    print(f"edl {vid}: {len(v['lines'])} lines, {t:.1f} s before the end card (of {body:.1f})")


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    if sys.argv[1:] == ["scripts"]: scripts()
    elif sys.argv[1:] == ["edls"]:
        for vid, v in VIDEOS.items(): edl(vid, v)
    else: sys.exit(__doc__ or "usage: narration.py scripts | edls")
