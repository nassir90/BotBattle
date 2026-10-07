# What every test here shares: the page's address, checks and their tally, a headless Chromium that can draw
# WebGL, waits counted in game frames (so a busy machine can't cut them short), and the page's dev hooks and API.
import json, os, urllib.request
BASE = os.environ.get("BOTBATTLE_URL", "http://localhost:5173/games/botbattle/")   # the local dev server (npm run dev)
OUT = os.environ.get("BOTBATTLE_SHOTS", "/tmp")
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name, detail)
def summary():
    print(f"\n{sum(results)}/{len(results)} passed")
async def launch(p):
    return await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
async def frames(pg, n, poll_ms=300):
    # waits until the game has drawn n more frames (window.__bbCam counts them)
    seen = 0
    while seen < n:
        await pg.evaluate("window.__bbCam(true)"); await pg.wait_for_timeout(poll_ms)
        seen += len(await pg.evaluate("window.__bbCam(false)"))
async def bb(pg):
    return await pg.evaluate("window.__bb()")
async def player(browser, user, extra="", online=True, on_frame=None, viewport=(1100, 760), **state):
    # a player in a browser of their own, signed in as `user` (?dev=, which stands in for Clerk on the dev server), on
    # the Online screen's room list unless online=False; `extra` is added to the address (an invite link's #join/...).
    # Page errors gather in pg.errors, `state` becomes attributes on pg, and on_frame(pg, message) sees each message
    # from the server
    pg = await (await browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})).new_page()
    pg.set_default_timeout(120000); pg.errors = []
    for k, v in state.items(): setattr(pg, k, v)
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    if on_frame: pg.on("websocket", lambda ws: ws.on("framereceived", lambda m: on_frame(pg, m)))
    await pg.goto(BASE + f"?dev={user}{extra}", wait_until="domcontentloaded", timeout=300000)
    if online:
        await pg.click('.mode[data-mode="online"]'); await pg.wait_for_selector("#rooms:not([hidden])")
    return pg
def api(path, body=None, token=None):
    req = urllib.request.Request(BASE + "api/" + path, data=json.dumps(body).encode() if body else None,
        headers={"content-type": "application/json", **({"authorization": f"Bearer {token}"} if token else {})})
    try: return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e: return json.loads(e.read())
