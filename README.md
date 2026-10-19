# Bot Battle

**Live:** [mpts.ie/games/botbattle](https://mpts.ie/games/botbattle/) · **On Roblox:** [Bot Battle](https://www.roblox.com/games/110903526036358/Bot-Battle) (the port: [BotBattleBlox](https://github.com/nassir90/BotBattleBlox))

Stack Overflow, ChatGPT and Claude settle it on a sheet of paper. It's a 3D stick-figure fighting game in the browser, built from a meme: the angry Stack Overflow guy pointing at the two chatbots giving a thumbs up.

![Three stick figures brawling on the paper stage](docs/screenshots/brawl.jpg)

## Videos

| Showcase: three bots, one sheet of paper | Devlog: what the inhale eats |
|---|---|
| ![Showcase video](docs/screenshots/video-showcase.jpg) | ![Inhale devlog video](docs/screenshots/video-inhale.jpg) |

| Showcase: play it anywhere | Free-for-all: three bots, two lives each |
|---|---|
| ![Phone, laptop and landscape video](docs/screenshots/video-play-anywhere.jpg) | ![Free-for-all video](docs/screenshots/video-free-for-all.jpg) |

| Who would win? Stack Overflow vs ChatGPT | Stack Overflow vs Claude | ChatGPT vs Claude |
|---|---|---|
| ![Stack Overflow vs ChatGPT](docs/screenshots/video-who-would-win.jpg) | ![Stack Overflow vs Claude](docs/screenshots/video-so-vs-claude.jpg) | ![ChatGPT vs Claude](docs/screenshots/video-gpt-vs-claude.jpg) |

| Practice: Stack Overflow's moves | Practice: ChatGPT's moves | Practice: Claude's moves |
|---|---|---|
| ![Stack Overflow practice](docs/screenshots/video-practice-so.jpg) | ![ChatGPT practice](docs/screenshots/video-practice-gpt.jpg) | ![Claude practice](docs/screenshots/video-practice-claude.jpg) |

| Two players, one keyboard | Two players, one phone | Online, phone to phone |
|---|---|---|
| ![Same keyboard on a laptop](docs/screenshots/video-same-keyboard.jpg) | ![Split screen on a phone](docs/screenshots/video-same-screen.jpg) | ![Two phones online](docs/screenshots/video-online.jpg) |

| Bot Battle is now on Roblox |
|---|
| ![The Roblox version on a laptop](docs/screenshots/video-on-roblox.jpg) |

The videos themselves aren't kept in git (they're build output, ignored in `.gitignore`); `make.py` writes them to `promo/out/`.

All fourteen are made in [`promo/`](promo/) with TapaTab (recording) and ShadowKit (compositing, narration, music): `takes.mjs` stages each scene, and `videos/<id>/edl.js` is each video's edit list. They were all re-recorded on the current game.

- All fourteen are narrated (Gemini text-to-speech, voice Laomedeia, one take per video; ShadowKit's `voice.py`). The showcase, the inhale devlog and "play it anywhere" use the soft storyteller direction; the other ten use "clear, warm, friendly, unhurried". Those ten play one take straight through (two, side by side, for the online one), and [`promo/narration.py`](promo/narration.py) holds their scripts with the moment each line belongs to (from the takes' logged events: knockouts, beams, parries…); it writes each `script.json`, and from the voice's timings, the edit list that says each line just before what it describes.
- The three duels (every pairing) and the free-for-all are whole CPU-against-CPU matches (`cpuMatch` in `takes.mjs`), from the versus screen to the results table. The game is silent, so the takes log what happens in it (hits, parries, knockouts, every move, shot, punch, kick and bash) and `promo/fightcut.py` turns that log into a sound track and the edit list. Stack Overflow beat ChatGPT, Stack Overflow beat Claude, Claude beat ChatGPT, and Stack Overflow won the free-for-all; the narration follows each match as it goes.
- The practice videos go through each fighter's moves on the training dummies, each named above its head with its key as it's used, ending with the moves everyone has (punch, low kick, the shield held up, the shield bash). `fightcut.py <take> <id> --sound-only <seconds>` makes their sound tracks, and the multiplayer videos'.
- "Play it anywhere" shows the same build on a phone held upright (19.5:9, with 55px rounded screen corners), a laptop, and a phone on its side, each a 3D device (ShadowKit's `device` layer) with the recording on its screen.
- Multiplayer: User A and User B sharing a laptop's keyboard (each one's keys in the game's move lists), sharing a phone in split screen (User B's half turned round), and two phones matched in a casual match through the real server (the local dev server; two takes recorded together, each its own player).
- "Bot Battle is now on Roblox" shows the [Roblox port](https://github.com/nassir90/BotBattleBlox), filmed in Roblox Studio's play test as it runs: `promo/roblox/wincap.swift` records the Studio window, the port's Studio-only hook (`BotBattleDev`) starts the matches and fires the moves, and `promo/roblox/totake.py` cuts the viewport out and makes it a take ShadowKit can composite, shown on a 3D laptop. The leaderboard can't load inside Studio, so it's only mentioned.
- Every take logs, per frame, any fighter outside the picture; in the current recordings that's 0 frames.

## Modes

![Main menu: Play, Training and Online, with the three real sites' logos turning in a triangle beside them](docs/screenshots/menu.jpg)

The three logos beside the modes link to the real sites. They're 3D models turning in a slow triangle; hovering one swells it, and clicking one makes it hop.

| Mode | What it is |
|---|---|
| Play | Two to four seats. Each seat is a fighter (or `?`, picked at random when the match starts) and who plays it: User A (you), User B (a friend on the same keyboard) or the CPU. Two seats make a duel, three or four a free-for-all, and all CPUs a match to watch. Last one with lives left wins. |
| Training | Play-test one fighter against two dummies. Dummies refill their health, knockouts respawn, and you can make the dummies stand still, move around or fight back. |
| Online | Fight friends in a room: two or three players, each on their own device. See [Online](#online). |

![Play: three seats (white ChatGPT for User A, black Claude and Stack Overflow for the CPU), with remove buttons on their corners and + to add a fourth](docs/screenshots/play.jpg)

On the Play screen, click a seat's fighter to pick it on the cards, click who plays it to cycle between User A, User B and CPU (each user has one seat at most), `−` on a seat's corner removes it and `+` adds one. The seats are remembered on the device. On a phone the seats sit two to a row, all the same size. Two of the same fighter get different colours: picking a fighter another seat already shows in that colour gives the next free one, the seat cards show exactly the colours the match will use, and the match (local or online, on any device) resolves colours the same way.

Fighters are picked from a carousel: click a card, or rotate with the arrow buttons, the arrow keys, a drag or the mouse wheel, then press `Enter`. Clicking a card only selects it, and the card and its fighter give a little hop. The swatches next to the button pick the fighter's colour: Stack Overflow in orange or blue, ChatGPT in green or white, Claude in orange or black. The colour carries through the fighter's logo, its blocks, rods and dots, the cursor's glow (and the glow on anyone it takes over), the inhale and its rings, the beam and its explosion, Claude's Combobulating dots, the health plate and the versus panel. Online, each player picks their colour in the lobby. For a seat, Random (`R`) leaves it to chance. Each card has its fighter standing in its own little window, and the one in the middle works through its moves in turn, using the real game code, with the move it's showing highlighted in the card's list.

Every match starts with **3 lives** each by default; the picker on the Play screen sets 1, 2, 3 or 5.

Play matches open on a versus screen: a panel for each fighter in its colour, with VS between them and who plays it on the corner. The fighters face each other (a middle one looks out at you), drop into their panels and show off in turn. Stack Overflow wags a finger ("Closed as duplicate."), ChatGPT hops and gives a thumbs-up ("Great question!"), and Claude waves ("You're absolutely right!"). Then "Fight!" and the match starts. `Enter`, `Space`, a click or a tap skips it (except online, where everyone starts together); the screen doesn't say so.

![Versus screen for a free-for-all: white ChatGPT and Stack Overflow facing the black Claude in the middle, who looks out](docs/screenshots/versus.jpg)

![Fighter select: Stack Overflow's card firing blocks out of its bent stack, with Block shot highlighted](docs/screenshots/fighter-select.jpg)

## Online

![A room's lobby: two players ready, fighter picks, lives, emotes, and the QR code that joins the room](docs/screenshots/online-lobby.jpg)

On mpts.ie the menu has an **Online** mode and a **Leaderboard**. (The copy published as a Claude artifact stays offline.)

- **Signing in:** online play needs an account, through [Clerk](https://clerk.com) (email, username or Google), so your name and wins follow you between devices. Clerk's sign-in form sits right on the Online screen. Signing in with Google goes to Google's page in the same tab and comes back to the game, where the form carries on: a new account picks its username there. Signing out stays on the game too. The offline modes don't need one.
- **Casual matches:** **Find a match** (the third card, beside Make a room and Join a room) puts you in a room with someone who's waiting for one, or in a new room to wait in until someone else asks. Casual rooms are for two, have no host button (the match starts once you're both ready), and get names like "Casual rotor 42". A small Durable Object (`Casual`) hands out the rooms, counting players it has just sent to a room so two people asking at once don't both get the last place.
- **Rooms:** make one with a name and an optional password, or join one by name.
  - Names are 3 to 16 Latin letters, digits or spaces, checked on the server with the [obscenity](https://github.com/jo3-l/obscenity) profanity filter (it catches look-alike spellings such as "sh1t").
  - Passwords are stored only as a salted PBKDF2 hash. An empty room deletes itself after ten minutes.
- **Inviting:** every lobby shows a QR code and an invite link (`#join/<room>/<invite>`). Opening it joins straight away, without the password. The invite sits after the `#`, so it never reaches a server log. If you aren't signed in yet, the invite waits on the device (for half an hour) while you sign in or make an account, and you land in the room afterwards.
- **The lobby:** up to three players. Each picks a fighter (shown by its turning 3D logo, the same one as on the health plates; your pick bounces) and its colour, from the same swatches as on the fighter cards, and presses Ready. Two players can pick the same fighter: if they also pick the same colour, the later one gets the other colour, the same way on every screen; the host (whoever made the room) sets the lives and starts.
- **Emotes:** six of them, sent as a number from 0 to 5, so there's no free text to moderate. They pop next to your name in the lobby, and over your fighter in a match (the smiley button on the right).
- **Matches:** they open on the versus screen with everyone's names. The host's browser runs the match and decides knockouts, comebacks and the result. Every browser plays the match out with everyone's controls, and the host's positions, health and lives correct the others about 20 times a second. Keep the host's tab in front: a background tab pauses the match for everyone.
- **Dropped connections:** the page reconnects by itself ([partysocket](https://github.com/cloudflare/partykit/tree/main/packages/partysocket)), signing in again each time, and shows "Connection lost. Reconnecting…" meanwhile. The room keeps a dropped player's seat, and their place in a match, for 30 seconds; the others see "… is reconnecting" over their fighter (with their keys let go) and "… is back" when they return, and the lobby shows them as reconnecting. After 30 seconds they count as gone, as if they'd left. A deploy restarts the server: everyone reconnects and the match carries on. Leaving the room (or closing the page) still leaves at once.
- **Leaderboard:** wins, matches, knockouts and parries per player, across every room, recorded by the room when a match ends. It's laid out like the results table (and a model announcement's benchmarks): the top six players are the columns, the leader's outlined, and the best score in each row is tinted.

  ![The leaderboard as a benchmark table, with four test players from the local dev server](docs/screenshots/leaderboard.jpg)

The server is the same Worker that serves the page: each room is a Durable Object, and the leaderboard is a D1 database (both on Cloudflare's free plan). Rooms use WebSocket hibernation: Cloudflare holds the connections while a room sleeps (pings are answered without waking it), and the room keeps its seats, host, lives and match in storage, so it survives being unloaded or restarted. One alarm per room handles both the 30-second grace and deleting a room that's been empty for ten minutes.

## Controls

| Key | Action |
|---|---|
| `A` `D` or `←` `→` | Move. There's no inertia on the ground: you stop, start and turn at once, and setting off (from standing, from the other way, or after letting go) starts with a short burst that eases to walking pace. The one exception is **direction inertia**: each attack (a shot, a move, a punch) holds your facing for about a third of a second more, up to 1.2 s, so walking the other way just after attacking is walking backwards, still facing your target: shots, punches and parries keep going that way, and a jump taken then faces it until you land. |
| Hold `S` or `↓` | Crouch: you sink down and make a smaller target, so shots fired level at head height (like Claude's fling) go over you. You can still walk, at a little under half speed. |
| Double-tap `A` or `D` | Dash, slipping past anyone in the way. It slows over its last part into a walk (if you're still holding that way), and the body straightens up gently. |
| Walk into someone | Push them (see below) |
| `W`, `↑` or `Space` | Jump (ChatGPT and Claude can double jump) |
| `H` | Punch: a quick jab at head height (4 damage) on a stretched arm that reaches about two body-widths out. Every fighter has it (Stack Overflow pokes with its pointing hand), and you can keep walking while you throw it. |
| `S` + `H` (crouched) | Low kick along the floor (5 damage) that knocks the other fighter off balance for a moment |
| `J` (or `1`) | Shot: Block shot, Computer use, Shoot |
| `K` (or `2`) | Melee: Block whip, Inhale, Fling |
| `L` (or `3`) | Power: Unified beam, Computer use (advanced), Combobulating |
| `I` (or `4`) | Special: Correction, Compaction |
| `Backspace` | Parry toward the way you face, or the way you're pressing. Hold it to keep the shield up, and hold `S` as well to crouch behind it; crouched behind it, you can still shuffle either way at about a quarter of walking pace, facing the way you guard. |
| Double-tap `A` or `D` and `Backspace` (either order) | Shield bash: a dash with the shield up that knocks whoever it meets flying (9 damage, the hardest knockback in the game) and stops dead |
| `W` + `Backspace` | Overhead parry |
| On a ledge: toward the stage, `W`, or away / `S` | Climb up, leap off, or let go |
| `Esc` | Back to the menu |

With User B in a Play match, the keyboard is split between the two:

| | User A | User B |
|---|---|---|
| Move, jump, crouch | `A` `D`, `W` (or `Space`), `S` | `←` `→`, `↑`, `↓` |
| Dash | double-tap `A` or `D` | double-tap `←` or `→` |
| Punch (crouched: low kick) | `R` | `M` (or numpad `5`) |
| Shot, melee, power, special | `F` `G` `H` `T` | `,` `.` `/` `'` (or numpad `1`–`4`) |
| Parry (with up: overhead) | `Q` | right `Shift` (or numpad `0`) |

Each user's moves are listed along the bottom with their own keys: User A's on the left, User B's on the right, in smaller chips, with the Menu button between them at the bottom so nothing crowds the plates. Measured at 1024×768, 1280×720, 1440×900 and 1920×1080 with two and four seats, no two of them overlap or come within 6px (before, up to 17 pairs did).

On phones and tablets, the same controls appear as on-screen buttons (with ▼ to crouch, separate Parry and ↑ Parry buttons, and a Punch button that reads Kick while you're crouched), held upright or on its side. Each fighter shows as its logo square with a thin health bar under it and an `x3` lives badge on its corner; held upright, the camera uses a wider lens so the whole fight fits across the screen.

| Upright | On its side |
|---|---|
| ![A phone held upright: logo squares with health bars and lives badges along the top, the touch pad below](docs/screenshots/phone.jpg) | ![A phone on its side: the buttons in two short rows](docs/screenshots/phone-landscape.jpg) |

With User B in a Play match on a phone, the phone is shared across a table: the screen splits across the middle into two views of the same fight. User A's half is at the bottom, the right way up; User B's is at the top, turned round so it's the right way up for the person sitting opposite, with its own smaller pad and its own row of plates. Each pad moves only its own fighter, and User B's arrows follow their view (their → walks toward their right, which is the arena's left). The Menu button sits on the left edge between the halves. The versus screen is skipped, since it can't face both players at once.

![A phone split in two: User B's view and buttons turned round at the top, User A's the right way up at the bottom, the plates and Menu between them](docs/screenshots/phone-split.jpg)

The camera keeps every fighter on screen (and a knocked-out one's comeback spot), moving sideways and up with easing and zooming on a spring: it pulls back quickly when someone gets near an edge and closes in slowly, and doesn't close in at all for small changes, so jumps don't make it pump in and out. Measured in a duel with User A jumping from the start, the old camera snapped 13 to 14 times (up to 75 units a second in one frame); this one has no snaps and no back-and-forth jitter (`tests/camera_test.py`).

Fighters are solid to each other, and they push:

- **Running into someone** from open space: your hands come up as you close in and you shove them with both arms, knocking them into a stumble. They're shoved back about 2.8 units, arms flung up, and can't act until they catch themselves.
- **Leaning on someone you're already touching** walks them back slowly (1.6 units a second) while you shove with both hands; they rock back and strain.
- **Both pushing** is a power struggle: you lean in head to head and the pair sways one way, then the other.
- **Knocked into someone** by a hit (or stumbling into them): they're bowled over into a stumble too, and the one thrown in jolts back.
- **Walking or jumping into someone** without the speed for a shove: a bump. You put a hand out, they're jolted back a little and strain; keep going and it becomes a push.

Every contact gets one of these. Measured with a play-test harness that drives random scenarios and CPU brawls and checks each contact for a reaction within 0.2 s: all of them react (31/31 knocked into someone, all with the bystander stumbling; 225/225 run-ins; 178/178 walk-ins; 113/113 jump-ins; 94/94 contacts in five CPU brawls). Before this, only 4 of 34 knocked-into contacts and none of 40 jump-ins did.
- **Dashing through someone** (a double-tap) slips past them, brushing them aside in depth: they're pushed away from the camera and the dasher swerves toward it, both springing back into line.

Faces show it: when a fighter is hit, stumbling, stunned or being pushed, Stack Overflow screws its eyes shut and grits its teeth, and the chatbots' smiles go flat, with the face shaking while it lasts.

![Stack Overflow shoving ChatGPT back, and the two in a power struggle](docs/screenshots/push.jpg)

The stage has edges. Fall past one and you catch its lip, hanging by the hands with your head over the edge (jumps come back when you grab). From there, press toward the stage to climb up, jump to leap off it, or press away or down to let go; after 4 seconds you let go anyway, and a hit knocks you off. One fighter per ledge.

![Claude hanging from the end of the stage](docs/screenshots/ledge.jpg)

Fall off the stage altogether and you lose a life.

![A fighter falling off the end of the stage](docs/screenshots/ringout.jpg)

CPUs recover too: they jump back, grab ledges, and Stack Overflow whips for the ledge once it's out of jumps.

The plates along the top of the screen show each fighter's 3D logo (turning slowly, and shaking when that fighter is hit), lives as `x3`, `x2`, `x1`, and the health bar along the bottom of the plate (with ChatGPT's context meter above it). The training controls sit just under them, and the move list runs along the bottom. A fighter with lives left drops back in from above a moment later, blinking, and can't be hurt for 2 seconds.

![Training: the plates along the top with the training controls under them, the move list along the bottom](docs/screenshots/lives.jpg)

## The fighters

### Stack Overflow

Carries five orange blocks on a spring above its head. The spring is invisible and bends as one piece, left or right only.

| Key | Move | |
|---|---|---|
| `J` | **Block shot** | Rapid fire. The stack bends at the enemy exactly like the beam's barrel; the blocks rest at the bottom, thread up the bent stack, and leave from the tip along its direction, still lying across it the way they sat on the stack. New ones drop in on top. 3 damage each. Hold `J` to keep firing. |
| `K` | **Block whip** | The spring stretches out in one continuous arc: the first block stays just above the tray, and the rest curls over and down, bending more toward the tip, so the end comes down to waist height about 3.4 units out (it used to reach 2 units with its tip above everyone's heads). The stack's own points are the hitbox. Hold `W` (or jump) for an **upward lash**, straight up about 3.9 units, that knocks whoever is overhead up and away. Off the stage, if the tip catches a ledge's corner it **latches on** and reels Stack Overflow in to hang there, since it has no hover to recover with. |
| `L` | **Unified beam** | The stack bends toward the enemy like a barrel, and all five blocks feed up it into one glowing beam. |
| `I` | **Correction** | Makes a condescending remark ("Please provide a minimal reproducible example.") that stuns everyone nearby. |

![Block shot: the stack bent at ChatGPT, blocks leaving the tip](docs/screenshots/blocks.jpg)
![The unified beam firing from the bent stack](docs/screenshots/beam.jpg)
![The block whip arcing over and down into ChatGPT](docs/screenshots/whip.jpg)
![The upward whip latched onto the ledge, reeling Stack Overflow in](docs/screenshots/whip-latch.jpg)

### ChatGPT

Its logo spins on top of its head like rotor blades. On a double jump the blades spin up and pull it upward.

| Key | Move | |
|---|---|---|
| `J` | **Computer use** | Fires a homing mouse cursor: off-white, with a green outline and glow. |
| `K` | **Inhale** | ChatGPT tilts its head forward, the logo grows (its outline staying one line wide) and spins up a tornado that sucks in enemies and their attacks. The funnel wriggles: a wave runs down it, still at the mouth and swinging wider toward the open end. Builds **context**. |
| `L` | **Computer use (advanced)** | Fires a bigger cursor. Whoever it hits glows green and is yours to control for 2 seconds. |
| `I` | **Compaction** | Spends 50% context to slam a slab down on everyone in front of it, flattening them and dealing some damage. Flattened fighters grow back slowly, and faster as they land hits. |

![Taking control of Stack Overflow with the advanced cursor](docs/screenshots/takeover.jpg)
![Inhale: the wriggling funnel with Stack Overflow inside it](docs/screenshots/inhale.jpg)
![Compaction: both opponents flattened](docs/screenshots/compaction.jpg)

Inhale reacts differently to each attack it swallows:

| Swallowed | What happens | Context |
|---|---|---|
| Stack Overflow's blocks | Spin wildly, shrink, and shred into confetti at the mouth | +8 |
| Stack Overflow's beam | Ends at ChatGPT's mouth with a green flare instead of hitting it | +10 per block fed |
| Stack Overflow's whip | ChatGPT yanks a block off the end and eats it ("Yoink") | +8 |
| Stack Overflow's Correction | ChatGPT isn't stunned; the words come loose from the speech bubble one by one and fly into its mouth | +20 |
| Claude's rods | Turn to point at the mouth and stretch thin like spaghetti | +12 |
| Claude's fling | The rod gets ripped off mid-poke and slurped ("Slurp") | +12 |
| Claude's dots | Pulled out of formation; each one circles the mouth before it goes in | +6 |
| Fighters | Pulled toward the mouth and chomped while they're close | +7/s, +4 per chomp |

### Claude

Its logo is the real Claude mark, split into its 12 rays along their seams, with one outline around the outside so it still reads as a single mark.

| Key | Move | |
|---|---|---|
| `J` | **Shoot** | Rapid fire: the logo's rods fly off one after another, light damage with full knockback. Hold `J` to keep firing. Rods grow back one per second. |
| `K` | **Fling** | One rod leaves the logo and pokes forward. It's gone until it grows back. |
| `L` | **Combobulating** | Alternates between three dots in a line (the outer two smaller) and four in a square (one diagonal smaller). The dots bob and trail Claude on springs, and Claude punches them out one at a time, alternating hands. |

![Combobulating: three dots in a line](docs/screenshots/combo-line.jpg)
![Combobulating: four dots in a square](docs/screenshots/combo-square.jpg)
![Fling, with gaps in the logo where rods have been used](docs/screenshots/fling.jpg)

## Parry

`Backspace` snaps a fighter into a guard in one direction. The guard forms (4 frames), **shines** for up to 34 frames, then lowers (5 frames). Letting go of `Backspace` ends the shine early, once it has shone for 12 frames (so a quick tap still parries): a tapped shield is up for about a third of a second. Moving, jumping or attacking while it's being lowered drops it at once. CPUs keep the whole shine. **Holding** `Backspace` keeps the shield up after the shine for as long as you hold it: hits from the guarded side are blocked (no damage, a little push back, "Block"), though only the shine parries. In the air a guard keeps the jump's momentum, and while walking backwards it guards the way you face.

- **Side parry** (`Backspace`, toward the way you face or the way you're pressing): each fighter uses its own top piece as a shield.
  - Stack Overflow takes the grey tray off its head with its left hand, and its right hand drapes the blocks over it as slats.
  - ChatGPT grabs its logo through the hole in the middle.
  - Claude wraps its fingers round the spokes of its logo.
- **Overhead parry** (`W` + `Backspace`): the fighter holds its top piece up over its head, arms stretched up. Stack Overflow lifts the tray with the blocks laid flat in it as a roof; ChatGPT and Claude hold their logos flat like a lid. If the `W` already started a jump, the jump is taken back so the guard happens on the ground.

![The three side parries: the draped tray, the logo held by its hole, the logo held by its spokes](docs/screenshots/parry-side.jpg)
![The three overhead parries](docs/screenshots/parry-up.jpg)

Only a hit that arrives **from the guarded direction while the guard shines** is parried. Side guards stop attacks coming at their face; overhead guards stop attacks coming down (the whip's lash, a beam fired from above, the Compaction slab). The whip comes over and down, so either guard stops it; the slab only an overhead one. A parry takes no damage, freezes the action for a moment, turns away the rest of that attacker's hits for a short while (so a parried beam stays parried), cuts the guard's recovery short, and leaves a nearby attacker stuck for 0.6 seconds. A hit from any other direction, or outside the shine without the shield held up, lands as normal and breaks the guard. CPUs guard too, overhead against things dropping in and to the side otherwise.

## Knockouts

Knocked-out fighters go limp as a ragdoll: their joints are linked points under gravity, tumbling and settling on the paper. The head collides as its real shape (a cup with a flattened round bottom, with the tray and stack, or the logo, on top), feet and fists by their size, and parts that hit the side of the slab are pushed back out rather than up onto it. Measured over six knockouts, the lowest point of every body ends up exactly on the paper, with only the ink outline touching; before this, heads sank up to 0.24 units into it.

Living fighters are solid to each other too: they can't walk through one another.

![A knocked-out fighter tumbling](docs/screenshots/ragdoll.jpg)
![Stack Overflow knocked out, resting on its cup and its stack](docs/screenshots/ragdoll-landed.jpg)

## Results

Each match ends with a benchmark-style table, laid out like the ones in AI model announcements. The winner's column is outlined, and the best score in each row is highlighted. Lives left is the first row.

![Results table after a win (a real CPU-played match)](docs/screenshots/results.jpg)

## Training

![Training mode with the dummy controls](docs/screenshots/training.jpg)

## How it's built

- One HTML file, [`game/stick-standoff.html`](game/stick-standoff.html), using [three.js](https://threejs.org/) r186 (ES modules from jsDelivr through an import map, with the SVGLoader addon). It's the same file that's published as a Claude artifact.
  - The look was tuned on r128, so colour management is off and the outputs are linear (colours used as written), and light intensities are multiplied by π (r155 dropped the hidden factor). `makeRenderer` and `addLights` do this for every renderer and scene; side-by-side renders on r128 and r186 match (mean brightness within 0.1 of 255).
  - GPU resources: geometry made once is registered as shared, and the rest of an object's geometry is freed when it leaves for good (`disposeTree`): a finished effect, a spent shot, a respawn, a cleared match or card demo. Before, every match left its fighters' geometry behind (27 more objects per match, behind the menu's endless CPU matches too); now the count stays flat. Materials are left to the garbage collector rather than disposed: disposing the last material that uses a shader deletes the shader, so the next ring or burst like it compiled it again, about six stalls every 15 seconds of a CPU brawl.
- Logos are extruded from their SVG outlines and get the same ink outline as the heads: a back-facing copy pushed out along smoothed normals.
- Walking uses planted feet with two-bone IK. A foot that's carrying weight never slides.
- The block stack and the logo stalks are springs simulated as a single bending angle, so each one bends as a whole. The beam and the block shot share one barrel bend.
- Guards move the held piece between where it normally sits (on the spinning stalk, for the chatbots) and the guard pose by blending transforms after the springs are placed, so the piece lands exactly in the hands.
- The fighter-select cards each run a small world of their own (scene, fighter, projectiles, effects) through the same update code, drawn into the card's window with a scissor so nothing spills over the card. The versus screen's panels work the same way.

### Performance

[`tests/perf.py`](tests/perf.py) measures where a frame's time goes on the menu, in a four-CPU match and on a phone split between two players. It reports the page's own timer for each part of the frame, Chrome's count of style and layout work, the heap and the busiest functions.

- Each body's limbs are drawn in two batches (`InstancedMesh`), so all four limbs take two draw calls instead of twenty, in the shadow pass too. The menu's brawl went from 261 draw calls to 152.
  - The batches have their own copy of the ink material and their own shadow material. three.js looks a shader up again each time one material switches between batched and single meshes, which happened many times a frame.
  - For the same reason, the plates' logos have their own materials. They're drawn by the arena's renderer, but without its fog and lights.
- The ChatGPT logo on a fighter's head uses a third of the curve detail: 6,624 triangles instead of 25,208, and it looks the same at that size. The scene went from 120,588 triangles to 64,836.
- Every shader is compiled while the menu shows (`warmShaders`): the arena's, a sample of each effect, and those for the plates' logos, the cards and the versus screen.
  - Before, 60 compiles happened after loading, each a stall the first time its effect or screen appeared. Now none do.
  - This was checked by logging every shader link through each fighter's moves, a four-CPU match and a split phone.
- The page's panels (the health plates, the move list and the touch pads) are written only when a value changes. The cooldown bars are scaled rather than resized, and the menu's logos are measured before they move. Style recalculations on the menu went from 4.75 a frame to 1.55.
- The shader and page changes together were measured on the Linux test machine, which has no GPU, so the script's share of a frame is what they change:

  | Scenario | Script per frame, before | After |
  |---|---|---|
  | Menu | 4.6 ms | 2.8 ms |
  | Four-CPU match | 5.9 ms | 3.2 ms |
  | Split phone | 3.0 ms | 2.6 ms |

## Run and deploy

```bash
npm install
npm run dev      # build the page and serve it locally
npm run deploy   # build the page and deploy the worker to mpts.ie/games/botbattle
```

`npm run build:page` wraps `game/stick-standoff.html` into a full page at `public/games/botbattle/index.html`. The Cloudflare Worker ([`src/index.ts`](src/index.ts)) serves it at `mpts.ie/games/botbattle`, redirects the bare path to the trailing-slash URL, and runs the online API under `/games/botbattle/api`: rooms (the `Room` Durable Object), their WebSockets, and the leaderboard (D1). `npm run deploy` creates the database and the Durable Object class the first time.

mpts.ie itself is [BannerAndLogo](https://github.com/nassir90/BannerAndLogo) on `mpts.ie/*`; this route is more specific, so it wins. Bot Battle is listed on the games index, [mpts.ie/games](https://mpts.ie/games/) (BannerAndLogo's `site/games/index.html`), so a changed route needs updating there too.

Below the game, the page has two sections of square tiles: **Ways to play** (Roblox first, then versus, one keyboard, online and training) and **Moves** (a row for each fighter, then the moves every fighter has). Scrolling brings them up over the game on a sheet of paper; the game itself is unchanged. Each tile is a short loop of a scene recorded square (the `sq_` takes in [`promo/takes.mjs`](promo/takes.mjs): the videos' scenes at 1080 × 1080, the camera a little closer), cut by [`scripts/features.mjs`](scripts/features.mjs), and each move carries its fighter's 3D logo, drawn by the game's own code ([`scripts/logos.py`](scripts/logos.py)). Both write to `public/games/botbattle/features/`, which isn't in git, so make them before deploying:

```bash
cd promo && node ~/projects/TapaTab/tapatab.mjs takes.mjs sq_so sq_gpt sq_claude sq_parry sq_practice_gpt sq_practice_so sq_duel_so_gpt sq_same_keyboard sq_online_a sq_online_b sq_training && cd ..
node scripts/features.mjs
~/projects/ShadowKit/.venv/bin/python scripts/logos.py
```

The online takes and `logos.py` need `npm run dev` running.

Locally, `npm run dev` runs the same API against a local Durable Object and database. There, `?dev=<name>` signs you in as a test player without Clerk (the server accepts that only on localhost), which is how the end-to-end tests play two and three players at once:

```bash
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/online_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/ko_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/invite_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/visual_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/play_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/split_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/camera_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/strike_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/moves_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/casual_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/reconnect_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/colours_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/signin_return_test.py
BOTBATTLE_URL=http://localhost:5173/games/botbattle/ ~/projects/ShadowKit/.venv/bin/python tests/perf.py 10 --json perf.json
```

`online_test.py` makes a room, refuses a wrong password, joins by password and by invite link, picks, readies, plays (both screens agree on positions and health), emotes, has a player leave, and checks the leaderboard. `split_test.py` plays User A against User B on a phone: the split screen, User B's pad and plates turned round at the top, the pads apart and in their own halves, each pad moving only its own fighter (User B's arrows the other way round), and the Menu clear of the plates. The tests share [`tests/bb.py`](tests/bb.py): the page address, checks and their tally, a headless Chromium that draws WebGL (SwiftShader), waits counted in game frames, the page's dev hooks and API, and `player()`: a signed-in player in a browser of their own, for the online tests. `perf.py` isn't a pass/fail test: it prints where a frame's time goes (see Performance above). `colours_test.py` picks Claude for two seats through the real screens on a phone and a desktop, and checks the second gets the other colour on the seat and in the match. `moves_test.py` records a fighter frame by frame: the burst when setting off, walking backwards when turning round (and a backwards jump and parry that face forward), the dash easing out, holding the shield up, and walking crouched behind it. `reconnect_test.py` drops a guest's and the host's connection mid-match (both come back, and controls and the host's state flow again) and cuts one for good (the fighter stays for the 30-second grace, then counts as gone). Restarting the dev server mid-match was checked by hand: both players reconnect within seconds and the match carries on. `casual_test.py` matches two players into one casual room and a third into another, starts the match once both are ready, and checks the punch and held guard reach the other player. `strike_test.py` walks while crouched (slower than walking) and lands a punch and a low kick with `H` alone, `R` for User A and `M` for User B. `camera_test.py` records the camera through a duel while User A jumps and counts jitter and snaps. `play_test.py` goes through Play: the seats, a colour, User B, removing and adding seats, both users' keys moving only their own fighter, the result, and the leaderboard's benchmark table (or, on a fresh database with no online matches yet, its message saying so). `visual_test.py` measures three things on the real page: ink blobs inside the OpenAI and Claude logos, arms going into heads during the versus gestures, and controls cut off by a phone's rounded corners (55px, with no safe area reported). `invite_test.py` checks that an invite opened while signed out survives signing up and lands you in the room. `signin_return_test.py` checks that a page loaded afresh partway through signing in (back from Google, or a sign-up finished from its email) comes back to the Online screen, and that it doesn't once you've gone back to the menu. `ko_test.py` checks that only the host knocks anyone out, that comebacks and the result reach every screen, and that the win is recorded.
