// Wraps the game (an HTML fragment, the same file published as the Claude artifact)
// into a full page served at mpts.ie/games/botbattle/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const fragment = readFileSync(new URL("../game/stick-standoff.html", import.meta.url), "utf8");
// the fragment opens with its <title>, font links and <style>; those belong in <head>
const split = fragment.indexOf('<div id="stage">');
const head = fragment.slice(0, split).trim(), body = fragment.slice(split);
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Bot Battle: Stack Overflow, ChatGPT and Claude fight it out on a sheet of paper.">
${head}
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(new URL("../public/games/botbattle/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/games/botbattle/index.html", import.meta.url), page);
console.log("built public/games/botbattle/index.html");
