# Online against a dedicated game server (server/), real browsers over the real network: BOTBATTLE_URL is the server's
# page and BOTBATTLE_DEVKEY its test key. Two players meet in a room; the server runs the match: your own fighter answers
# your keys at once, without waiting for the network; both screens agree on where everyone is and on health; hits and
# grabs reach both; the host can leave without ending it. With BOTBATTLE_LAG_CMD set, the same checks run with that many
# milliseconds added each way: it's run as `<cmd> <ms>` to set the lag (0 clears it).
import asyncio, os, subprocess, time
from playwright.async_api import async_playwright
from bb import OUT, check, summary, launch, api, player

LAG_CMD = os.environ.get("BOTBATTLE_LAG_CMD", "")
def set_lag(ms):
    if LAG_CMD: subprocess.run(f"{LAG_CMD} {ms}", shell=True, check=True, capture_output=True, timeout=120)

RESPONSE = """(code) => new Promise(res => {
  const mine = () => window.__bb().find(f => f.mine), x0 = mine().x, t0 = performance.now();
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  const tick = () => { if (Math.abs(mine().x - x0) > 0.01) res(Math.round(performance.now() - t0)); else if (performance.now() - t0 > 3000) res(-1); else requestAnimationFrame(tick); };
  tick();
})"""
xs = lambda pg: pg.evaluate("window.__bb().map(f => f.x)")

async def match_round(a, b, lag, room):
    tag = f"lag {lag} ms each way" if lag else "no added lag"
    await a.wait_for_function("window.__bb && window.__bb().length === 2 && window.__bb()[0].id && !window.__bb()[0].versus", timeout=30000)
    await b.wait_for_function("window.__bb && window.__bb().length === 2 && window.__bb()[0].id && !window.__bb()[0].versus", timeout=30000)
    stats = await a.evaluate("window.__bbNetStats()")
    check(f"[{tag}] it's a dedicated server's match", stats["dedicated"], stats)
    await asyncio.sleep(1.0)
    rtt = (await a.evaluate("window.__bbNetStats()"))["rtt"]

    # your own fighter answers at once, whatever the network
    samples = []
    for code, back in (("KeyD", "KeyA"), ("KeyA", "KeyD"), ("KeyD", "KeyA")):
        samples.append(await a.evaluate(RESPONSE, code))
        await asyncio.sleep(0.35)
        await a.evaluate("c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))", code)
        await asyncio.sleep(0.5)
    best = min(s for s in samples if s >= 0)
    check(f"[{tag}] your fighter moves without waiting for the server (best {best} ms, round trip {rtt} ms)", best >= 0 and (best < rtt or best < 100), (samples, rtt))

    # walking: both screens agree, on both players' fighters
    await a.keyboard.down("KeyD"); await b.keyboard.down("KeyA"); await asyncio.sleep(1.2)
    await a.keyboard.up("KeyD"); await b.keyboard.up("KeyA"); await asyncio.sleep(0.5 + lag / 1000)
    pa, pb = await xs(a), await xs(b)
    check(f"[{tag}] both screens agree on positions after walking (within 0.5)", all(abs(p - q) < 0.5 for p, q in zip(pa, pb)), (pa, pb))

    # your own fighter's corrections stay small
    stats = await a.evaluate("window.__bbNetStats()")
    check(f"[{tag}] your own fighter needs little correcting (mean {stats['mean']}, worst {stats['max']}, {stats['snaps']} snaps)", stats["mean"] < 0.6 and stats["n"] > 20, stats)

    # hits: face to face, the server's outcome on both screens
    who = await a.evaluate("window.__bb().findIndex(f => f.mine)")
    them = 1 - who
    # (crouched and holding the key: slowly, so it stops in range, and a tap would be half a double tap, a dash)
    p = await xs(a)
    key = "KeyD" if p[them] > p[who] else "KeyA"
    await a.keyboard.down("KeyS"); await a.keyboard.down(key)
    for _ in range(300):
        p = await xs(a)
        if abs(p[them] - p[who]) < 1.2: break
        await asyncio.sleep(0.02)
    await a.keyboard.up(key); await a.keyboard.up("KeyS")
    await asyncio.sleep(0.3 + lag / 1000)
    hp0 = (await b.evaluate("window.__bb()"))[them]["hp"]
    for _ in range(5):
        await a.keyboard.press("KeyH"); await asyncio.sleep(0.45 + 2 * lag / 1000)
        if (await b.evaluate("window.__bb()"))[them]["hp"] < hp0: break
    ha = [f["hp"] for f in await a.evaluate("window.__bb()")]; hb = [f["hp"] for f in await b.evaluate("window.__bb()")]
    check(f"[{tag}] a punch lands, as the server says, and both screens show the same health", ha[them] < hp0 and all(abs(x - y) < 0.5 for x, y in zip(ha, hb)), (hp0, ha, hb))

    # a grab: the server catches, and both screens hold
    await asyncio.sleep(0.7)
    await a.keyboard.down("KeyN")
    held = False
    for _ in range(25):
        await asyncio.sleep(0.05)
        if (await b.evaluate("window.__bb()"))[them]["held"] and (await a.evaluate("window.__bb()"))[them]["held"]: held = True; break
    grabbing = (await a.evaluate("window.__bb()"))[who]["grab"]
    await a.keyboard.up("KeyN")
    check(f"[{tag}] a grab holds on both screens", held, grabbing)
    await a.screenshot(path=f"{OUT}/dedicated-{lag}-a.png"); await b.screenshot(path=f"{OUT}/dedicated-{lag}-b.png")
    await asyncio.sleep(1.5)

    # the end: knocked out (one life), the same result on both
    idx = them
    await a.evaluate("i => window.__bbKO(i)", idx)
    await a.wait_for_selector("#result:not([hidden])", timeout=15000); await b.wait_for_selector("#result:not([hidden])", timeout=15000)
    ta, tb = await a.text_content("#resultTitle"), await b.text_content("#resultTitle")
    check(f"[{tag}] the same result on both screens", ta == tb and "wins" in ta, (ta, tb))
    await a.click("#roomBtn"); await b.click("#roomBtn")
    await a.wait_for_selector("#lobby:not([hidden])", timeout=8000); await b.wait_for_selector("#lobby:not([hidden])", timeout=8000)

async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        made = api("rooms", {"name": f"Ded {int(time.time()) % 100000}"}, "dev:dana")
        link = f"#join/{made['key'].replace(' ', '%20')}/{made['invite']}"
        a = await player(browser, "dana", link, online=False)
        b = await player(browser, "evan", link, online=False)
        await a.wait_for_selector("#lobby:not([hidden])", timeout=20000); await b.wait_for_selector("#lobby:not([hidden])", timeout=20000)
        await a.click('#picks button[data-kind="so"]'); await b.click('#picks button[data-kind="claude"]')
        await a.wait_for_function("document.querySelectorAll('#roster li').length === 2", timeout=10000)
        await a.click('#lobbyLives button[data-lives="1"]')
        for lag in ([0, 40, 100] if LAG_CMD else [0]):
            set_lag(lag)
            try:
                await a.click("#readyBtn"); await b.click("#readyBtn")
                await a.wait_for_function("!document.getElementById('startBtn').disabled", timeout=15000)
                await a.click("#startBtn")
                await a.wait_for_function("document.getElementById('online').hidden", timeout=15000)
                await match_round(a, b, lag, made)
            finally:
                set_lag(0)
        # the host leaves mid-match: it carries on for the other player
        await a.click("#readyBtn"); await b.click("#readyBtn")
        await a.wait_for_function("!document.getElementById('startBtn').disabled", timeout=15000)
        await a.click("#startBtn")
        await b.wait_for_function("window.__bb && window.__bb().length === 2 && window.__bb()[0].id && !window.__bb()[0].versus", timeout=30000)
        await a.close()
        await b.wait_for_selector("#result:not([hidden])", timeout=15000)
        title = await b.text_content("#resultTitle")
        check("the host leaving ends nothing: the other player wins the match", title == "evan wins", title)
        check("no page errors", not b.errors, b.errors[:3])
        await browser.close()
    summary()
asyncio.run(main())
