// The server runs the game's own rules: this takes the module script out of the game (game/stick-standoff.html), which
// is the only copy of them, and writes it where a worker can import it, with its browser-only imports swapped. Next to
// it go the parts of three.js the rules use: its core, without the renderer and shaders, and the SVG loader.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const page = readFileSync(new URL('../game/stick-standoff.html', import.meta.url), 'utf8');
const open = '<script type="module">', from = page.indexOf(open);
if (from < 0) throw new Error('no module script in the game');
let code = page.slice(from + open.length, page.indexOf('</script>', from));
const swap = (a, b) => { if (!code.includes(a)) throw new Error(`the game no longer has: ${a}`); code = code.replace(a, b); };
swap("import * as THREE from 'three';", "import * as THREE from '../three-headless.mjs';");
swap("import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';", "import { SVGLoader } from './SVGLoader.mjs';");
swap("import ReconnectingWebSocket from 'partysocket/ws';", 'const ReconnectingWebSocket = null;');
// A worker keeps the text of what it imports for as long as it runs, once per worker, and a single character outside
// Latin-1 (three's core has a few, in its comments) doubles what the whole file takes. So comments that fill their lines
// go, a game line keeping its number for the stack traces, and any other such character is written as an escape.
const slim = text => text.replace(/^[ \t]*\/\*\*[\s\S]*?\*\/[ \t]*\n/gm, '').replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/[^\x00-\xff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const three = path => readFileSync(new URL(`./node_modules/three/${path}`, import.meta.url), 'utf8');
const loader = three('examples/jsm/loaders/SVGLoader.js');
if (!loader.includes("from 'three';")) throw new Error('the SVG loader no longer imports three as expected');
mkdirSync(new URL('./generated/', import.meta.url), { recursive: true });
writeFileSync(new URL('./generated/sim.mjs', import.meta.url), slim(code));
writeFileSync(new URL('./generated/three.core.mjs', import.meta.url), slim(three('build/three.core.js')));
writeFileSync(new URL('./generated/SVGLoader.mjs', import.meta.url), slim(loader.replace("from 'three';", "from '../three-headless.mjs';")));
