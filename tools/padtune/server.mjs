// Tuning the touch pad: a local page with the real game in four phone-sized frames (upright, on its side, and each
// shared across a table between two players) next to sliders for every size on the pad. Submit writes the sizes
// to tools/padtune/submitted.json, to be put into PAD_SIZES in game/stick-standoff.html.
//
//   npm run build:page && node tools/padtune/server.mjs     (then open http://localhost:5181)
//
// The game is the built page (public/games/botbattle/index.html), served as a phone would see it: its touch-screen
// styles and checks turned on whatever the pointer (a laptop's mouse presses its buttons).
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const GAME = join(HERE, '../../public/games/botbattle');
const SUBMITTED = join(HERE, 'submitted.json');
const PORT = +process.env.PORT || 5181;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json' };

// the page as a phone sees it: "(pointer: coarse)" holds, in its CSS and in matchMedia
const asPhone = html => html
  .replaceAll('@media (pointer: coarse) and ', '@media ')
  .replaceAll('@media (pointer: coarse)', '@media all')
  .replace('<head>', `<head><script>{ const mm = matchMedia.bind(window); window.matchMedia = q => mm(q.replaceAll('(pointer: coarse)', 'all')); }</script>`);

const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && url.pathname === '/submit') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const sizes = JSON.parse(body);
      await writeFile(SUBMITTED, JSON.stringify(sizes, null, 2) + '\n');
      console.log(`submitted ${new Date().toISOString()}\n${JSON.stringify(sizes)}`);
      return send(res, 200, 'ok');
    }
    if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, await readFile(join(HERE, 'index.html')), TYPES['.html']);
    if (url.pathname === '/submitted.json') return send(res, 200, await readFile(SUBMITTED).catch(() => 'null'), TYPES['.json']);
    if (url.pathname.startsWith('/games/botbattle/')) {
      const rel = normalize(decodeURIComponent(url.pathname.slice('/games/botbattle/'.length)) || 'index.html');
      if (rel.startsWith('..')) return send(res, 404, 'not found');
      const file = join(GAME, rel);
      if (rel === 'index.html') return send(res, 200, asPhone(await readFile(file, 'utf8')), TYPES['.html']);
      return send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
    }
    send(res, 404, 'not found');
  } catch (e) {
    send(res, e.code === 'ENOENT' ? 404 : 500, String(e.message || e));
  }
}).listen(PORT, () => console.log(`pad tuner: http://localhost:${PORT}`));
