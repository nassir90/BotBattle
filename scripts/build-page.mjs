// Wraps the game (an HTML fragment, the same file published as the Claude artifact)
// into a full page served at mpts.ie/games/botbattle/.
// The game fills the first screen (all its layers are fixed); scrolling brings a sheet of paper up over it with two
// sections of square tiles: ways to play (Roblox first) and the moves. scripts/features.mjs cuts the tiles' loops
// and scripts/logos.py draws the fighters' logos that mark the moves.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { WAYS, MOVES } from "./features.mjs";

const ROBLOX = "https://www.roblox.com/games/110903526036358/Bot-Battle";
const FIGHTERS = { so: "Stack Overflow", gpt: "ChatGPT", claude: "Claude" };

const fragment = readFileSync(new URL("../game/stick-standoff.html", import.meta.url), "utf8");
// the fragment opens with its <title>, font links and <style>; those belong in <head>
const split = fragment.indexOf('<div id="stage">');
const head = fragment.slice(0, split).trim(), body = fragment.slice(split);

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const logo = k => `<img src="features/logo-${k}.png" alt="" width="28" height="28" loading="lazy">`;
// whose move: that fighter's 3D logo and name, or all three logos
const who = w => !w ? "" : `<span class="tile-who">${w === "all" ? Object.keys(FIGHTERS).map(logo).join("") + "Every fighter" : logo(w) + FIGHTERS[w]}</span>`;
const tile = f => `      <figure class="tile">
        <video data-src="features/${f.id}.mp4" data-poster="features/${f.id}.jpg" muted loop playsinline preload="none" disablepictureinpicture aria-label="${esc(f.title)}"></video>
        <figcaption>${who(f.who)}<h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></figcaption>
      </figure>`;
const section = (id, title, tiles) => `    <section class="sec" aria-labelledby="${id}">
      <h2 id="${id}">${title}</h2>
      <div class="tiles-box"><div class="tiles">
${tiles}
      </div></div>
    </section>`;

const roblox = `      <a class="tile wide roblox" href="${ROBLOX}" target="_blank" rel="noopener">
        <img class="media" src="roblox.jpg" alt="Bot Battle on Roblox" width="1280" height="720" loading="lazy">
        <div class="cap"><h3>Roblox</h3><p>The same fight on Roblox. Play the CPU, a friend on the same keyboard, or anyone in your server.</p><span class="go">Open on Roblox</span></div>
      </a>`;

const site = `
<div class="site-spacer" aria-hidden="true"></div>
<button type="button" class="site-cue" id="siteCue" hidden>Also on Roblox &darr;</button>
<main id="site">
  <div class="site-in">
${section("waysTitle", "Ways to play", [roblox, ...WAYS.map(tile)].join("\n"))}
${section("movesTitle", "Moves", MOVES.map(tile).join("\n"))}
    <footer class="site-foot">
      <button type="button" id="toTop">&uarr; Back to the game</button>
      <span>After a meme by NovaXCode</span>
    </footer>
  </div>
</main>
<style>
html:not(.site) .site-spacer, html:not(.site) #site, html:not(.site) .site-cue { display: none !important; }
html.site, html.site body { height: auto; min-height: 100%; }
html.site body { overflow: hidden auto; }
.site-spacer { height: 100vh; height: 100lvh; }
.site-cue { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); transform: translateX(-50%); z-index: 45; font-size: 12px; padding: 8px 12px; }
.site-cue:hover { transform: translate(calc(-50% - 1px), -1px); }
.site-cue:active { transform: translate(calc(-50% + 2px), 2px); }
#site { position: relative; z-index: 100; background: var(--paper); border-top: 2px solid var(--ink); user-select: text; -webkit-user-select: text;
  padding: 56px max(16px, env(safe-area-inset-right)) calc(36px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.site-in { width: min(1080px, 100%); margin: 0 auto; display: grid; gap: 64px; }
.sec { display: grid; gap: 22px; }
#site h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(22px, 4vw, 32px); line-height: 1.1; }
/* one column on a phone, two, then three; Roblox spans two of them, its still as tall as a square tile beside it */
.tiles-box { container-type: inline-size; }
.tiles { --gap: 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gap); }
@container (min-width: 560px) {
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tile.wide { grid-column: span 2; }
}
@container (min-width: 880px) {
  .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tile.wide .media { aspect-ratio: auto; height: calc((100cqw - 2 * var(--gap)) / 3); }
}
.tile { margin: 0; border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); background: var(--paper); display: grid; grid-template-rows: auto 1fr; color: inherit; text-decoration: none; }
.tile video, .tile .media { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; background: var(--paper-2); border-bottom: 2px solid var(--ink); }
.tile video { cursor: pointer; }
.tile.wide .media { aspect-ratio: 16 / 9; object-position: 50% 45%; }
.tile figcaption, .tile .cap { padding: 12px 14px 16px; display: grid; align-content: start; justify-items: start; gap: 6px; }
.tile-who { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--ink-soft); min-height: 28px; }
.tile-who img { width: 28px; height: 28px; display: block; }
.tile-who img + img { margin-left: -8px; }
.tile-who img:last-of-type { margin-right: 2px; }
.tile h3 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 17px; line-height: 1.15; }
.tile p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.roblox:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
.roblox:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }
.roblox:focus-visible { outline: 3px solid var(--so); outline-offset: 3px; }
.roblox .go { margin-top: 6px; border: 2px solid var(--ink); padding: 9px 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 12px; box-shadow: 3px 3px 0 var(--ink); }
.site-foot { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; justify-content: space-between; font-size: 12px; color: var(--ink-soft); }
@media (max-width: 720px) {
  #site { padding-top: 36px; }
  .site-in { gap: 48px; }
}
</style>
<script>
(() => {
  // a reload opens on the game, not wherever the page was left
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const menu = document.getElementById('menu'), cue = document.getElementById('siteCue'), site = document.getElementById('site');
  // the cue shows on the main menu only, until the page is scrolled, and only where it clears the menu's last button
  const panel = menu.querySelector('.panel');
  const update = () => { cue.hidden = menu.hidden || scrollY > 24 || panel.getBoundingClientRect().bottom > innerHeight - 70; };
  new MutationObserver(update).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  new ResizeObserver(update).observe(panel);      // the Leaderboard button comes and goes
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  cue.addEventListener('click', () => site.scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  // the tiles load as they come near and play while they're on screen (or on a tap, for reduced motion)
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = [...site.querySelectorAll('video')];
  const load = v => { if (!v.src) { v.poster = v.dataset.poster; v.src = v.dataset.src; } };
  const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { load(e.target); near.unobserve(e.target); } }), { rootMargin: '600px 0px' });
  const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.4 });
  for (const v of videos) {
    near.observe(v);
    if (!still) seen.observe(v);
    v.addEventListener('click', () => { load(v); v.paused ? v.play().catch(() => {}) : v.pause(); });
  }
})();
</script>
`;

const page = `<!doctype html>
<html lang="en" class="site">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Bot Battle: Stack Overflow, ChatGPT and Claude fight it out on a sheet of paper.">
${head}
</head>
<body>
${body}
${site}
</body>
</html>
`;
mkdirSync(new URL("../public/games/botbattle/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/games/botbattle/index.html", import.meta.url), page);
console.log("built public/games/botbattle/index.html");
