// The page's feature tiles: short square loops cut from the square takes (promo/takes.mjs, the sq_ ones), and a
// still of each. Record the takes, then cut:
//   cd promo && node ~/projects/TapaTab/tapatab.mjs takes.mjs sq_so sq_gpt sq_claude sq_parry sq_practice_gpt \
//     sq_practice_so sq_duel_so_gpt sq_same_keyboard sq_online_a sq_online_b sq_training   # online: npm run dev
//   node scripts/features.mjs
// It writes public/games/botbattle/features/<id>.mp4 and <id>.jpg (build output, not in git); build-page.mjs lays
// the tiles out from WAYS and MOVES.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// clip: the take; parts: [from, to] seconds into it, joined; poster: the still's moment. who: the fighter whose move
// it is (its 3D logo marks the tile; scripts/logos.py draws them), or "all" for the moves every fighter has.
export const MOVES = [
  { id: "blockshot", who: "so", title: "Block shot", text: "A burst of blocks off the top of the stack.",
    clip: "sq_so", parts: [[0.4, 2.6]], poster: 1.0 },
  { id: "whip", who: "so", title: "Block whip", text: "A lash of blocks. Off the edge, it catches the ledge and climbs back.",
    clip: "sq_practice_so", parts: [[36.45, 40.7]], poster: 37.0 },
  { id: "beam", who: "so", title: "Unified beam", text: "The whole stack at once, as one beam.",
    clip: "sq_so", parts: [[4.3, 6.6]], poster: 5.6 },
  { id: "inhale", who: "gpt", title: "Inhale", text: "Breathes in whatever's thrown at it, and gains context.",
    clip: "sq_gpt", parts: [[11.6, 17.6]], poster: 12.8 },
  { id: "takeover", who: "gpt", title: "Computer use", text: "Its cursor takes over another fighter and steers it.",
    clip: "sq_practice_gpt", parts: [[15.2, 18.4]], poster: 16.2 },
  { id: "compaction", who: "gpt", title: "Compaction", text: "Spends its context to squash everyone in front of it.",
    clip: "sq_gpt", parts: [[44.85, 48.4]], poster: 45.8 },
  { id: "combobulating", who: "claude", title: "Combobulating", text: "Three dots in a line, or four in a square, punched out one at a time.",
    clip: "sq_claude", parts: [[0.5, 5.9]], poster: 3.8 },
  { id: "shoot", who: "claude", title: "Shoot", text: "Rods, one after another, for as long as it's held.",
    clip: "sq_claude", parts: [[6.1, 8.9]], poster: 7.0 },
  { id: "fling", who: "claude", title: "Fling", text: "One rod pokes forward, here knocking a fighter off the end of the paper.",
    clip: "sq_parry", parts: [[5.1, 8.4]], poster: 6.4 },
  { id: "parry", who: "all", title: "Parry", text: "Guard at the right moment, from the side or overhead, and the attack glances off.",
    clip: "sq_parry", parts: [[0.9, 4.4]], poster: 2.75 },
  { id: "shield", who: "all", title: "Shield", text: "Hold the guard up and shots bounce off. Double-tap and guard to bash.",
    clip: "sq_practice_so", parts: [[47.5, 50.8], [51.95, 53.8]], poster: 49.0 },
  { id: "strike", who: "all", title: "Punch and kick", text: "A punch, and a low kick from a crouch.",
    clip: "sq_practice_so", parts: [[42.15, 46.0]], poster: 42.6 },
];
// the first way to play is Roblox, a link with a still from it (build-page.mjs); these follow it
export const WAYS = [
  { id: "versus", title: "Versus", text: "Two to four fighters, each played by you, a friend or the computer. Every match ends on a results table.",
    clip: "sq_duel_so_gpt", parts: [[0.2, 3.5], [58.3, 64.8]], poster: 2.0 },
  { id: "keyboard", title: "One keyboard", text: "Two players, each with their own keys.",
    clip: "sq_same_keyboard", parts: [[8.2, 14.4]], poster: 9.8 },
  { id: "online", title: "Online", text: "Make a room for your friends, or find a casual match.",
    clip: "sq_online_a", parts: [[3.4, 9.6]], poster: 8.0 },
  { id: "training", title: "Training", text: "One fighter against dummies that stand still, move about or fight back.",
    clip: "sq_training", parts: [[4.2, 9.2]], poster: 6.4 },
];

const SIZE = 720;    // the tiles show at up to 360 CSS px, so 720 covers a 2x screen

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const clips = new URL("../promo/clips/", import.meta.url), out = new URL("../public/games/botbattle/features/", import.meta.url);
  mkdirSync(out, { recursive: true });
  const ff = args => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  for (const f of [...WAYS, ...MOVES]) {
    const src = fileURLToPath(new URL(f.clip + ".mp4", clips));
    const scale = `scale=${SIZE}:${SIZE}:flags=lanczos,setsar=1`;
    const cuts = f.parts.map(([a, b], i) => `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[p${i}]`).join(";");
    const join = f.parts.map((_, i) => `[p${i}]`).join("") + `concat=n=${f.parts.length}:v=1:a=0,${scale}[v]`;
    // H.264 for every browser; a keyframe a second so the loop restarts cleanly; no sound (the game is silent)
    ff(["-i", src, "-filter_complex", `${cuts};${join}`, "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-g", "30", "-movflags", "+faststart", fileURLToPath(new URL(f.id + ".mp4", out))]);
    ff(["-ss", String(f.poster), "-i", src, "-frames:v", "1", "-vf", scale, "-q:v", "4", fileURLToPath(new URL(f.id + ".jpg", out))]);
    console.log("features/" + f.id);
  }
}
