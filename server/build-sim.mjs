// The server runs the game's own rules: this takes the module script out of the game (game/stick-standoff.html), which
// is the only copy of them, and writes it where a worker can import it, with its browser-only imports swapped.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const page = readFileSync(new URL('../game/stick-standoff.html', import.meta.url), 'utf8');
const open = '<script type="module">', from = page.indexOf(open);
if (from < 0) throw new Error('no module script in the game');
let code = page.slice(from + open.length, page.indexOf('</script>', from));
const swap = (a, b) => { if (!code.includes(a)) throw new Error(`the game no longer has: ${a}`); code = code.replace(a, b); };
swap("import * as THREE from 'three';", "import * as THREE from '../three-headless.mjs';");
swap("import ReconnectingWebSocket from 'partysocket/ws';", 'const ReconnectingWebSocket = null;');
mkdirSync(new URL('./generated/', import.meta.url), { recursive: true });
writeFileSync(new URL('./generated/sim.mjs', import.meta.url), code);
