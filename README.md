# Bot Battle

**Live:** [mpts.ie/games/botbattle](https://mpts.ie/games/botbattle/)

Stack Overflow, ChatGPT and Claude settle it on a sheet of paper. It's a 3D stick-figure fighting game in the browser, built from a meme: the angry Stack Overflow guy pointing at the two chatbots giving a thumbs up.

![Three stick figures brawling on the paper stage](docs/screenshots/brawl.jpg)

## Videos

| [Showcase: three bots, one sheet of paper](promo/out/01-showcase.mp4) | [Devlog: what the inhale eats](promo/out/02-inhale.mp4) |
|---|---|
| [![Showcase video](docs/screenshots/video-showcase.jpg)](promo/out/01-showcase.mp4) | [![Inhale devlog video](docs/screenshots/video-inhale.jpg)](promo/out/02-inhale.mp4) |

| [Who would win? Stack Overflow vs ChatGPT](promo/out/03-who-would-win.mp4) | [Free-for-all: three bots, two lives each](promo/out/04-free-for-all.mp4) |
|---|---|
| [![Duel video](docs/screenshots/video-who-would-win.jpg)](promo/out/03-who-would-win.mp4) | [![Free-for-all video](docs/screenshots/video-free-for-all.jpg)](promo/out/04-free-for-all.mp4) |

| [Practice: Stack Overflow's moves](promo/out/05-practice-so.mp4) | [Showcase: play it anywhere](promo/out/06-play-anywhere.mp4) |
|---|---|
| [![Practice video](docs/screenshots/video-practice-so.jpg)](promo/out/05-practice-so.mp4) | [![Phone, desktop and landscape video](docs/screenshots/video-play-anywhere.jpg)](promo/out/06-play-anywhere.mp4) |

All six are made in [`promo/`](promo/) with TapaTab (recording) and ShadowKit (compositing, narration, music): `takes.mjs` stages each scene, and `videos/<id>/edl.js` is each video's edit list.

- The first two were recorded before the directional parry and lives existed, so they still show the old shield bubble.
- The duel and the free-for-all are real CPU-against-CPU matches (`cpuMatch` in `takes.mjs`), cut down to their turning points. Stack Overflow won both.
- The practice video names each move with a callout as it's used.
- The last one shows the same build on a phone held upright, a desktop, and a phone on its side.

## Modes

![Main menu: four modes in rows, with links to the three real sites at the bottom](docs/screenshots/menu.jpg)

The links at the foot of the menu go to the three real sites. Their logos are 3D models that drift about; hovering one swells it, and clicking one makes it hop.

| Mode | What it is |
|---|---|
| Free-for-all | You against both CPUs at once. Last one with lives left wins. |
| Duel | One on one. Pick yourself, then pick your opponent, or press Random opponent (`R`) and let chance choose. |
| Training | Play-test one fighter against two dummies. Dummies refill their health, knockouts respawn, and you can make the dummies stand still, move around or fight back. |
| Watch | Three CPUs fight while you watch. |

Fighters are picked from a carousel: click a card, or rotate with the arrow buttons, the arrow keys, a drag or the mouse wheel, then press `Enter` (or Play). Clicking a card only selects it, and the card and its fighter give a little hop. The title says which mode you're picking for ("Pick your fighter · Free-for-all"). Each card has its fighter standing in its own little window, and the one in the middle works through its moves in turn, using the real game code, with the move it's showing highlighted in the card's list.

Every match starts with **3 lives** each by default; the picker next to Play sets 1, 2, 3 or 5.

![Fighter select: Stack Overflow's card firing blocks out of its bent stack, with Block shot highlighted](docs/screenshots/fighter-select.jpg)

## Controls

| Key | Action |
|---|---|
| `A` `D` or `←` `→` | Move |
| Hold `S` or `↓` | Crouch: you sink down and make a smaller target, so shots fired level at head height (like Claude's fling) go over you. You can still turn round. |
| Double-tap `A` or `D` | Dash, slipping past anyone in the way |
| Walk into someone | Push them (see below) |
| `W`, `↑` or `Space` | Jump (ChatGPT and Claude can double jump) |
| `J` (or `1`) | Shot: Block shot, Computer use, Shoot |
| `K` (or `2`) | Melee: Block whip, Inhale, Fling |
| `L` (or `3`) | Power: Unified beam, Computer use (advanced), Combobulating |
| `I` (or `4`) | Special: Correction, Compaction |
| `Backspace` | Parry toward the way you face, or the way you're pressing |
| `W` + `Backspace` | Overhead parry |
| On a ledge: toward the stage, `W`, or away / `S` | Climb up, leap off, or let go |
| `Esc` | Back to the menu |

On phones and tablets, the same controls appear as on-screen buttons (with ▼ to crouch and separate Parry and ↑ Parry buttons), held upright or on its side. Each fighter shows as its logo square with a thin health bar under it and an `x3` lives badge on its corner; held upright, the camera uses a wider lens so the whole fight fits across the screen.

| Upright | On its side |
|---|---|
| ![A phone held upright: logo squares with health bars and lives badges along the top, the touch pad below](docs/screenshots/phone.jpg) | ![A phone on its side: the buttons in two short rows](docs/screenshots/phone-landscape.jpg) |

Fighters are solid to each other, and they push:

- **Running into someone** from open space: your hands come up as you close in and you shove them with both arms, knocking them into a stumble. They're shoved back about 2.8 units, arms flung up, and can't act until they catch themselves.
- **Leaning on someone you're already touching** walks them back slowly (1.6 units a second) while you shove with both hands; they rock back and strain.
- **Both pushing** is a power struggle: you lean in head to head and the pair sways one way, then the other.
- **Knocked into someone** by a hit (or stumbling into them): they're bowled over into a stumble too, and the one thrown in jolts back.
- **Walking or jumping into someone** without the speed for a shove: a bump. You put a hand out, they're jolted back a little and strain; keep going and it becomes a push.

Every contact gets one of these. Measured with a play-test harness that drives random scenarios and CPU brawls and checks each contact for a reaction within 0.2 s: all of them react (31/31 knocked into someone, all with the bystander stumbling; 225/225 run-ins; 178/178 walk-ins; 113/113 jump-ins; 94/94 contacts in five CPU brawls). Before this, only 4 of 34 knocked-into contacts and none of 40 jump-ins did.
- A double-tap dash slips past instead.

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
| `I` | **Correction** | A condescending remark ("Please provide a minimal reproducible example.") that stuns everyone nearby. |

![Block shot: the stack bent at ChatGPT, blocks leaving the tip](docs/screenshots/blocks.jpg)
![The unified beam firing from the bent stack](docs/screenshots/beam.jpg)
![The block whip arcing over and down into ChatGPT](docs/screenshots/whip.jpg)
![The upward whip latched onto the ledge, reeling Stack Overflow in](docs/screenshots/whip-latch.jpg)

### ChatGPT

Its logo spins on top of its head like rotor blades. On a double jump the blades spin up and pull it upward.

| Key | Move | |
|---|---|---|
| `J` | **Computer use** | A homing mouse cursor: off-white, with a green outline and glow. |
| `K` | **Inhale** | ChatGPT tilts its head forward, the logo grows (its outline staying one line wide) and spins up a tornado that sucks in enemies and their attacks. The funnel wriggles: a wave runs down it, still at the mouth and swinging wider toward the open end. Builds **context**. |
| `L` | **Computer use (advanced)** | A bigger cursor. Whoever it hits glows green and is yours to control for 2 seconds. |
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

`Backspace` snaps a fighter into a guard in one direction. The guard forms (4 frames), **shines** for 26 frames, then loosens (18 frames), and the fighter can't move or attack until it has loosened.

- **Side parry** (`Backspace`, toward the way you face or the way you're pressing): each fighter uses its own top piece as a shield.
  - Stack Overflow takes the grey tray off its head with its left hand, and its right hand drapes the blocks over it as slats.
  - ChatGPT grabs its logo through the hole in the middle.
  - Claude wraps its fingers round the spokes of its logo.
- **Overhead parry** (`W` + `Backspace`): the fighter holds its top piece up over its head, arms stretched up. Stack Overflow lifts the tray with the blocks laid flat in it as a roof; ChatGPT and Claude hold their logos flat like a lid. If the `W` already started a jump, the jump is taken back so the guard happens on the ground.

![The three side parries: the draped tray, the logo held by its hole, the logo held by its spokes](docs/screenshots/parry-side.jpg)
![The three overhead parries](docs/screenshots/parry-up.jpg)

Only a hit that arrives **from the guarded direction while the guard shines** is parried. Side guards stop attacks coming at their face; overhead guards stop attacks coming down (the whip's lash, a beam fired from above, the Compaction slab). The whip comes over and down, so either guard stops it; the slab only an overhead one. A parry takes no damage, freezes the action for a moment, turns away the rest of that attacker's hits for a short while (so a parried beam stays parried), cuts the guard's recovery short, and leaves a nearby attacker stuck for 0.6 seconds. A hit from any other direction, or outside the shine, lands as normal and breaks the guard. CPUs guard too, overhead against things dropping in and to the side otherwise.

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

- One HTML file, [`game/stick-standoff.html`](game/stick-standoff.html), using [three.js](https://threejs.org/) r128 from a CDN. It's the same file that's published as a Claude artifact.
- Logos are extruded from their SVG outlines and get the same ink outline as the heads: a back-facing copy pushed out along smoothed normals.
- Walking uses planted feet with two-bone IK. A foot that's carrying weight never slides.
- The block stack and the logo stalks are springs simulated as a single bending angle, so each one bends as a whole. The beam and the block shot share one barrel bend.
- Guards move the held piece between where it normally sits (on the spinning stalk, for the chatbots) and the guard pose by blending transforms after the springs are placed, so the piece lands exactly in the hands.
- The fighter-select cards each run a small world of their own (scene, fighter, projectiles, effects) through the same update code, drawn into the card's window with a scissor so nothing spills over the card.

## Run and deploy

```bash
npm install
npm run dev      # build the page and serve it locally
npm run deploy   # build the page and deploy the worker to mpts.ie/games/botbattle
```

`npm run build:page` wraps `game/stick-standoff.html` into a full page at `public/games/botbattle/index.html`. A small Cloudflare Worker ([`src/index.ts`](src/index.ts)) serves it at `mpts.ie/games/botbattle` and redirects the bare path to the trailing-slash URL.
