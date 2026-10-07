# Two players on one phone: the screen split across the middle, User A's half the right way up at the bottom and
# User B's turned round at the top, each with their own pad that moves only their own fighter.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, OUT, check, summary, launch, frames
async def hold(pg, cdp, sel, key, n=15):
    # a real finger on the button (through the DevTools protocol), held for n game frames
    r = await pg.evaluate("s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }",
                          f'{sel} button[data-key="{key}"]')
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": r[0], "y": r[1], "id": 1}]})
    await frames(pg, n, 400)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
async def settle(pg, n=60): await frames(pg, n, 400)
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        for w, h in [(390, 844), (844, 390)]:          # held upright, then on its side
            print(f"-- {w}x{h}")
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
            await ctx.add_init_script("localStorage.setItem('botbattle.seats', JSON.stringify([{kind:'so',ctrl:'A'},{kind:'gpt',ctrl:'B'}]))")
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
            await pg.goto(B + "?dev=split", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
            await pg.click('.mode[data-mode="play"]')
            ctrls = await pg.eval_on_selector_all(".seat-ctrl", "els => els.map(e => e.textContent)")
            check("on a phone, a seat can be User B", ctrls == ["User A", "User B"], ctrls)
            await pg.click("#fightBtn")
            await pg.wait_for_function("window.__bb && window.__bb().length === 2", timeout=60000)
            check("no versus screen (it can't face both players)", not (await pg.evaluate("window.__bb()"))[0]["versus"])
            check("the screen is split", await pg.evaluate("document.body.classList.contains('split')"))
            check("User B's pad shows, turned round at the top", await pg.evaluate("""(() => { const t = document.getElementById('touchB');
              return !t.hidden && getComputedStyle(t).transform !== 'none' && t.getBoundingClientRect().top < innerHeight / 2; })()"""))
            await settle(pg)                         # the fighters land
            check("User B's plates show, turned round", await pg.evaluate("""(() => { const h = document.getElementById('hudB');
              return !h.hidden && h.children.length === 2 && getComputedStyle(h).transform !== 'none'; })()"""))
            # pads: no overlap between the two players' buttons
            boxes = await pg.evaluate("""['#touch', '#touchB'].map(s => [...document.querySelectorAll(s + ' button')].map(b => b.getBoundingClientRect())
              .filter(r => r.width).map(r => [r.left, r.top, r.right, r.bottom]))""")
            hit = sum(1 for a in boxes[0] for c in boxes[1] if a[0] < c[2] and c[0] < a[2] and a[1] < c[3] and c[1] < a[3])
            check("the two pads don't overlap", hit == 0 and boxes[0] and boxes[1], hit)
            top = max(r[3] for r in boxes[1]); bottom = min(r[1] for r in boxes[0])
            check("User B's pad stays in the top half, User A's in the bottom", top <= h / 2 and bottom >= h / 2, (round(top), round(bottom)))
            await pg.screenshot(path=f"{OUT}/split-{w}x{h}-1.png")
            # User A's → moves User A's fighter right; User B's ← (their left, the arena's right) moves only theirs
            cdp = await ctx.new_cdp_session(pg)
            f0 = await pg.evaluate("window.__bb()")
            await hold(pg, cdp, "#touch", "ArrowRight")
            await settle(pg)                         # the slide stops
            f1 = await pg.evaluate("window.__bb()")
            check("User A's → moves User A's fighter right, not User B's", f1[0]["x"] - f0[0]["x"] > 0.5 and abs(f1[1]["x"] - f0[1]["x"]) < 0.2,
                  (round(f1[0]["x"] - f0[0]["x"], 2), round(f1[1]["x"] - f0[1]["x"], 2)))
            await hold(pg, cdp, "#touchB", "ArrowLeft")       # away from User A, who'd otherwise be shoved
            await settle(pg)
            f2 = await pg.evaluate("window.__bb()")
            check("User B's ← moves User B's fighter to their left (the arena's right), not User A's",
                  f2[1]["x"] - f1[1]["x"] > 0.5 and abs(f2[0]["x"] - f1[0]["x"]) < 0.2, (round(f2[0]["x"] - f1[0]["x"], 2), round(f2[1]["x"] - f1[1]["x"], 2)))
            await pg.screenshot(path=f"{OUT}/split-{w}x{h}-2.png")
            # the menu button sits clear of every plate
            clash = await pg.evaluate("""(() => { const m = document.querySelector('.corner').getBoundingClientRect();
              return [...document.querySelectorAll('#hud > *, #hudB > *')].map(e => e.getBoundingClientRect())
                .filter(r => r.left < m.right && m.left < r.right && r.top < m.bottom && m.top < r.bottom).length; })()""")
            check("the menu button doesn't cover the plates", clash == 0, clash)
            pads = await pg.evaluate("""[...document.querySelectorAll('#hud > *, #hudB > *')].map(e => e.getBoundingClientRect()).map(r =>
              [...document.querySelectorAll('.touch:not([hidden]) button')].map(b => b.getBoundingClientRect())
                .filter(b => b.width && r.left < b.right && b.left < r.right && r.top < b.bottom && b.top < r.bottom).length).reduce((a, b) => a + b, 0)""")
            check("the plates don't cover the buttons", pads == 0, pads)
            check("no page errors", not errs, errs[:3])
            await ctx.close()

        await b.close()
    summary()
asyncio.run(main())
