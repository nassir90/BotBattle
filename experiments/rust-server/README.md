# Would Rust make the server better?

An experiment, not part of the game. `src/` is the dedicated server's networking and rooms in Rust, with a slice of the
rules: walking, dashing, jumping, gravity, the stage's edge, punches and kicks, the guard, knockback, knockouts and lives.
`slice.mjs` is the same code in JavaScript, so a difference between those two is the language. `bench.mjs` runs the same
bots against either of them and against the real server, and `see_test.py` times what real browsers show.

**Verdict: don't rewrite.** Rust uses far less CPU and memory, but players wouldn't feel it, and the server has capacity
to spare at the size it's for. Almost all of the delay is elsewhere.

## Where the delay goes

A press on your own screen takes 6 to 8 ms, one frame: the server isn't involved. On the other player's screen your fighter
ran 173 to 183 ms behind your own (when it had gone half a unit, on real browsers at 60 frames a second, from Ireland):

| Part | ms | From |
|---|---|---|
| The delay the page adds on purpose (`NET_DELAY`) | 100 | the code |
| The network, there and back | about 35 | measured |
| Waiting to be sent, stepped and sent back (30 sends, 60 steps, 30 snapshots a second) | about 47 | about 30 measured, about 17 worked out from the send rate |
| The server's code, per step | 0.46 | measured |

These add up to about what was measured. The smoothing on the other player's screen wasn't measured apart.

## What each server costs

Four matches, bots on the box, two runs each. "Press to snapshot" is from elsewhere, over the real network: one bot presses,
the other receives the first snapshot where it moved.

| | Real rules, Node | Slice, Node | Slice, Rust |
|---|---|---|---|
| CPU, % of one core | 27 to 28 | 9 to 10 | 3 |
| Memory the process holds alone, MB | 80 to 83 | 22 | 1 |
| Mean step, ms | 0.46 to 0.49 | 0.08 to 0.09 | 0.008 |
| Snapshot gap, p99 ms | 36 | 35 | 35 |
| Snapshot gap, worst ms | 57 to 70 | 39 to 43 | 47 to 53 |
| Press to snapshot, median ms | 63 to 72 (54 after the fix below) | 53 to 54 | 55 |
| Most matches with snapshots still on time | 16 (108% of a core) | 64 (44%) | 128 (50%, by then gaps reach 160 ms) |

The web server takes 4% of a core at four matches, more than the Rust server does.

The real rules' step costs about 5.5 times the slice's in JavaScript. If Rust kept its 10 to 1 advantage across all of them, a
match would cost about 1% of a core against 7% now. That's an estimate: ragdolls, abilities and three.js's maths aren't ported.

## What did help, and what might

- **Snapshots after the step, not before** (in this branch): every snapshot was sent before the step that acted on the
  newest controls. Three runs each: 63 to 72 ms before, 54 to 55 after, level with Rust on the full rules.
- **60 snapshots a second:** 55 to 45 ms in Rust, 53 to 41.5 in the JavaScript slice, for 8.9 KB/s a player instead of 4.7.
- **A smaller `NET_DELAY`:** untested, and the largest part. It has to cover the gaps between snapshots, which reached 50 to
  80 ms at the p99 over the network at 30 a second, and 33 to 41 at 60 a second.

The rewrite's other cost: the page predicts your fighter with the same JavaScript rules the server runs, so a Rust server
means two copies of 5,500 lines to keep identical, or moving the game's rules out of JavaScript.

## Not measured

The Pi: every figure is from an e2-small, whose shared CPU can burst. None of these runs was in the sandbox, which cost
nothing measurable when tried on its own. The slices leave out abilities, grabs and ragdolls, so the bots' presses of those
do nothing there.

## Running it

```bash
cargo build --release
PORT=8090 ./target/release/botbattle-rust-experiment
BASE=http://127.0.0.1:8090/games/botbattle node bench.mjs load 4 30
```
