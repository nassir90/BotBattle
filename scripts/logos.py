# The fighters' 3D logos as small transparent pictures, for the page's move tiles: each one drawn by the game's own
# logoScene (the extruded mark with its ink outline), turned a little so it reads as 3D, on a clear background.
#   ~/projects/ShadowKit/.venv/bin/python scripts/logos.py      (with npm run dev serving the page)
# writes public/games/botbattle/features/logo-<kind>.png. The page is changed only as it's served here: one line
# hands logoScene and the renderer maker to this script.
import asyncio, base64, os, pathlib
from playwright.async_api import async_playwright

BASE = os.environ.get("BOTBATTLE_URL", "http://localhost:5173/games/botbattle/")
OUT = pathlib.Path(__file__).resolve().parent.parent / "public/games/botbattle/features"
ANCHOR = "  const HUD_LOGOS = new Map();"
HOOK = "  window.__logos = { logoScene, makeOverlayRenderer, THREE };\n"
SIZE = 192          # shown at up to 32 CSS px, so 2x screens get 64 px from it with room to spare

DRAW = """([kind, size]) => {
  const { logoScene, makeOverlayRenderer, THREE } = window.__logos;
  const canvas = document.createElement('canvas');
  const r = makeOverlayRenderer(canvas, true);
  r.setPixelRatio(1); r.setSize(size, size, false);
  const L = logoScene(kind, null);
  // a three-quarter turn, as the menu's logos drift; Stack Overflow's tray faces front a little more
  L.logo.rotation.set(0.28, kind === 'so' ? -0.38 : -0.5, 0);
  const cam = new THREE.OrthographicCamera(-0.58, 0.58, 0.54, -0.62, 0.1, 10); cam.position.z = 5;
  r.render(L.sc, cam);
  return canvas.toDataURL('image/png');
}"""

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page()
        async def hook(route):
            resp = await route.fetch(); html = await resp.text()
            assert html.count(ANCHOR) == 1, "anchor not found once"
            await route.fulfill(response=resp, body=html.replace(ANCHOR, HOOK + ANCHOR))
        await pg.route(BASE, hook)
        await pg.goto(BASE)
        await pg.wait_for_function("!!window.__logos")
        for kind in ("so", "gpt", "claude"):
            url = await pg.evaluate(DRAW, [kind, SIZE])
            (OUT / f"logo-{kind}.png").write_bytes(base64.b64decode(url.split(",", 1)[1]))
            print(f"features/logo-{kind}.png")
        await b.close()

asyncio.run(main())
