# Bot Battle

**Live:** [mpts.ie/games/botbattle](https://mpts.ie/games/botbattle/)

Stack Overflow, ChatGPT and Claude settle it on a sheet of paper. It's a 3D stick-figure fighting game in the browser, built from a meme: the angry Stack Overflow guy pointing at the two chatbots giving a thumbs up.

![Three stick figures brawling on the paper stage](docs/screenshots/brawl.jpg)

## Videos

| [Showcase: three bots, one sheet of paper](promo/out/01-showcase.mp4) | [Devlog: what the inhale eats](promo/out/02-inhale.mp4) |
|---|---|
| [![Showcase video](docs/screenshots/video-showcase.jpg)](promo/out/01-showcase.mp4) | [![Inhale devlog video](docs/screenshots/video-inhale.jpg)](promo/out/02-inhale.mp4) |

Both are made in [`promo/`](promo/) with TapaTab (recording) and ShadowKit (compositing, narration, music): `takes.mjs` stages each scene in training mode, and `videos/<id>/edl.js` is each video's edit list. They were recorded before the directional parry and lives existed, so they still show the old shield bubble.

## Modes

![Main menu: four modes in rows, with links to the three real sites at the bottom](docs/screenshots/menu.jpg)

| Mode | What it is |
|---|---|
| Free-for-all | You against both CPUs at once. Last one with lives left wins. |
| Duel | One on one. Pick yourself, then pick your opponent. |
| Training | Play-test one fighter against two dummies. Dummies refill their health, knockouts respawn, and you can make the dummies stand still, move around or fight back. |
| Watch | Three CPUs fight while you watch. |

Fighters are picked from a carousel: click a card, or rotate with the arrow buttons, the arrow keys, a drag or the mouse wheel, then press `Enter` (or Play). Clicking a card only selects it. Each card has its fighter standing in its own little window, and the one in the middle works through its moves in turn, using the real game code, with the move it's showing highlighted in the card's list.

Every match starts with **3 lives** each by default; the picker next to Play sets 1, 2, 3 or 5.

![Fighter select: Stack Overflow's card firing blocks out of its bent stack, with Block shot highlighted](docs/screenshots/fighter-select.jpg)

## Controls

| Key | Action |
|---|---|
| `A` `D` or `←` `→` | Move |
| `W`, `↑` or `Space` | Jump (ChatGPT and Claude can double jump) |
| `J` (or `1`) | Shot: Block shot, Computer use, Shoot |
| `K` (or `2`) | Melee: Block whip, Inhale, Fling |
| `L` (or `3`) | Power: Unified beam, Computer use (advanced), Combobulating |
| `I` (or `4`) | Special: Correction, Compaction |
| `Backspace` | Parry toward the way you face, or the way you're pressing |
| `W` + `Backspace` | Overhead parry |
| `Esc` | Back to the menu |

On phones, the same controls appear as on-screen buttons, with separate Parry and ↑ Parry buttons.

![Phone layout with the touch pad](docs/screenshots/phone.jpg)

The stage has edges. Walk off, or get knocked off, and you lose a life.

![A fighter falling off the end of the stage](docs/screenshots/ringout.jpg)

Lives show as squares beside each name. A fighter with lives left drops back in from above a moment later, blinking, and can't be hurt for 2 seconds.

![Mid-match, with Stack Overflow down to 2 of its 3 lives](docs/screenshots/lives.jpg)

## The fighters

### Stack Overflow

Carries five orange blocks on a spring above its head. The spring is invisible and bends as one piece, left or right only.

| Key | Move | |
|---|---|---|
| `J` | **Block shot** | Rapid fire. The stack bends at the enemy exactly like the beam's barrel; the blocks rest at the bottom, thread up the bent stack, and leave from the tip along its direction, still lying across it the way they sat on the stack. New ones drop in on top. 3 damage each. Hold `J` to keep firing. |
| `K` | **Block whip** | The spring stretches out to the length of Claude's fling and lashes the blocks forward, bending at the base first. |
| `L` | **Unified beam** | The stack bends toward the enemy like a barrel, and all five blocks feed up it into one glowing beam. |
| `I` | **Correction** | A condescending remark ("Please provide a minimal reproducible example.") that stuns everyone nearby. |

![Block shot: the stack bent at ChatGPT, blocks leaving the tip](docs/screenshots/blocks.jpg)
![The unified beam firing from the bent stack](docs/screenshots/beam.jpg)
![The block whip at full stretch](docs/screenshots/whip.jpg)

### ChatGPT

Its logo spins on top of its head like rotor blades. On a double jump the blades spin up and pull it upward.

| Key | Move | |
|---|---|---|
| `J` | **Computer use** | A homing mouse cursor: off-white, with a green outline and glow. |
| `K` | **Inhale** | ChatGPT tilts its head forward, the logo grows and spins up a tornado that sucks in enemies and their attacks. The funnel wriggles: a wave runs down it, still at the mouth and swinging wider toward the open end. Builds **context**. |
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

`Backspace` snaps a fighter into a guard in one direction. The guard forms (4 frames), **shines** for 14 frames, then loosens (16 frames), and the fighter can't move or attack until it has loosened.

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
