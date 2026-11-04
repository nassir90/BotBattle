# What players actually see, on the real server in real browsers: one presses a key, and we time how long their own fighter
# takes to move on their screen and how long it takes to move on the other player's. Both pages are on this machine, so
# they share a clock. BOTBATTLE_URL, BOTBATTLE_DEVKEY as for tests/dedicated_test.py. Run with PYTHONPATH=tests.
import asyncio, statistics, time
from playwright.async_api import async_playwright
from bb import api, player

# the other player's screen, and the player's own: when the fighter first moves, and when it has gone half a unit
WATCH = """(i) => { window.__see = {}; const tick = () => { const s = window.__see, x = window.__bb()[i].x;
  if (s.x0 !== undefined) { const d = Math.abs(x - s.x0); if (d > 0.02 && !s.first) s.first = performance.timeOrigin + performance.now(); if (d > 0.5 && !s.half) s.half = performance.timeOrigin + performance.now(); }
  requestAnimationFrame(tick); }; tick(); }"""
ARM = "(i) => { window.__see = { x0: window.__bb()[i].x }; }"
PRESS = """(code) => new Promise(res => { const mine = () => window.__bb().find(f => f.mine), x0 = mine().x, t0 = performance.timeOrigin + performance.now(); let first = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  const tick = () => { const d = Math.abs(mine().x - x0), now = performance.timeOrigin + performance.now(); if (d > 0.02 && !first) first = now; if (d > 0.5) res([t0, first, now]); else requestAnimationFrame(tick); }; tick(); })"""

async def main():
    async with async_playwright() as p:
        # the machine's own GPU and small windows: at software rendering's 12 frames a second, the frames are all you'd measure
        browser = await p.chromium.launch(headless=True, args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"])
        made = api("rooms", {"name": f"See {int(time.time()) % 100000}"}, "dev:sa")
        link = f"#join/{made['key'].replace(' ', '%20')}/{made['invite']}"
        a = await player(browser, "sa", link, online=False, viewport=(480, 320)); b = await player(browser, "sb", link, online=False, viewport=(480, 320))
        for pg, kind in ((a, "gpt"), (b, "claude")):
            await pg.wait_for_selector("#lobby:not([hidden])", timeout=20000)
            await pg.click(f'#picks button[data-kind="{kind}"]')
        await a.wait_for_function("document.querySelectorAll('#roster li').length === 2", timeout=10000)
        for pg in (a, b): await pg.click("#readyBtn")
        await a.wait_for_function("!document.getElementById('startBtn').disabled", timeout=10000)
        await a.click("#startBtn")
        for pg in (a, b): await pg.wait_for_function("window.__bb && window.__bb().length === 2 && window.__bb()[0].id && !window.__bb()[0].versus", timeout=30000)
        await asyncio.sleep(1)
        idx = await a.evaluate("window.__bb().findIndex(f => f.mine)")
        await b.evaluate(WATCH, idx)
        own, other, own_half, other_half = [], [], [], []
        for n in range(30):
            code = "KeyD" if n % 2 == 0 else "KeyA"
            await b.evaluate(ARM, idx)
            t0, t1, t2 = await a.evaluate(PRESS, code)
            await asyncio.sleep(0.4)
            await a.evaluate("c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))", code)
            seen = await b.evaluate("window.__see")
            own.append(t1 - t0); own_half.append(t2 - t0)
            if seen.get("first"): other.append(seen["first"] - t0)
            if seen.get("half"): other_half.append(seen["half"] - t0)
            await asyncio.sleep(0.9)
        fps = await b.evaluate("new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; performance.now() - t > 2000 ? r(n / 2) : requestAnimationFrame(f); }; f(); })")
        spread = lambda v: {"n": len(v), "median": round(statistics.median(v)), "min": round(min(v)), "max": round(max(v))}
        print({"own_first": spread(own), "other_first": spread(other), "own_half_unit": spread(own_half), "other_half_unit": spread(other_half), "fps": fps})
        await browser.close()
asyncio.run(main())
