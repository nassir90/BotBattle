# Movement and guarding, frame by frame (window.__bbTrack): setting off with a burst, walking backwards when you
# turn round (and jumping backwards still facing forward), the dash easing out and straightening gently, and
# holding the parry button to keep the shield up. Waits are counted in game frames.
import asyncio, os
from playwright.async_api import async_playwright
B = os.environ.get("BOTBATTLE_URL", "http://localhost:5173/games/botbattle/")
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name, detail)
async def frames(pg, n):
    seen = 0
    while seen < n:
        await pg.evaluate("window.__bbCam(true)"); await pg.wait_for_timeout(200)
        seen += len(await pg.evaluate("window.__bbCam(false)"))
async def track(pg, on): return await pg.evaluate(f"window.__bbTrack(0, {'true' if on else 'false'})")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1280, "height": 720}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.set_default_timeout(180000)
        await pg.goto(B + "?dev=moves", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="training"]'); await pg.click("#pickBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length > 1"); await frames(pg, 40)
        kb = pg.keyboard
        async def home():                       # back near x = -3, standing still, facing right
            x = (await pg.evaluate("window.__bb()"))[0]["x"]
            if abs(x + 3) > 0.8:
                key = "KeyD" if x < -3 else "KeyA"
                await kb.down(key)
                for _ in range(80):
                    await frames(pg, 1)
                    if abs((await pg.evaluate("window.__bb()"))[0]["x"] + 3) < 0.8: break
                await kb.up(key)
            await frames(pg, 25); await pg.wait_for_timeout(400)     # long enough that the next press isn't a double tap
            if (await pg.evaluate("window.__bb()"))[0]["facing"] != 1:
                await kb.press("KeyD"); await frames(pg, 25); await pg.wait_for_timeout(400)

        # setting off: a burst, easing to walking pace
        await home(); await track(pg, True)
        await kb.down("KeyA"); await frames(pg, 40); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        walk = [-r["vx"] for r in rows]
        start = next(i for i, v in enumerate(walk) if v > 0.1)
        peak = max(walk[start:start + 15]); t = 0; settle = None
        for r, v in zip(rows[start:], walk[start:]):
            t += r["dt"]
            if t > 0.45: settle = v; break
        check("setting off bursts faster, then settles to walking pace", peak > 1.3 * settle and abs(settle - 5.5) < 0.4, (round(peak, 2), round(settle, 2)))
        acc = max(abs(rows[i + 1]["vx"] - rows[i]["vx"]) / rows[i + 1]["dt"] for i in range(len(rows) - 1))
        check("less ground inertia: the speed changes at up to 60+ units/s² (was 30)", acc > 55, round(acc, 1))

        # turning round: walk backwards a moment, still facing forward, then turn
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 25)
        await kb.down("KeyA"); await kb.up("KeyD"); await frames(pg, 40); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        flip = next(i for i, r in enumerate(rows) if r["vx"] < -0.3)
        backT = sum(r["dt"] for r in rows[flip:] if r["vx"] < -0.3 and r["facing"] == 1)
        turned = any(r["facing"] == -1 for r in rows[flip:])
        check("turning round walks backwards first, still facing forward (0.15 to 0.5 s), then turns", 0.15 < backT < 0.5 and turned, round(backT, 3))

        # turning round and jumping at once: a jump backwards, facing forward until landing
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 25)
        await kb.down("KeyA"); await kb.up("KeyD"); await kb.press("KeyW"); await frames(pg, 60); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        air = [r for r in rows if not r["ground"]]
        check("a jump while walking backwards keeps facing forward until it lands", air and all(r["facing"] == 1 for r in air) and sum(r["vx"] < -0.3 for r in air) > len(air) / 2,
              (len(air), sum(r["facing"] == 1 for r in air)))

        # a parry in that jump guards forward, and the jump keeps its momentum
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 25)
        await kb.down("KeyA"); await kb.up("KeyD"); await kb.press("KeyW"); await frames(pg, 4); await kb.press("Backspace")
        await frames(pg, 50); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        g = [r for r in rows if r["guard"] and not r["ground"]]
        check("parrying in a backwards jump guards forward and keeps drifting back", g and all(r["facing"] == 1 for r in g) and all(r["vx"] < -0.3 for r in g),
              (len(g), [round(r["vx"], 1) for r in g[:4]]))

        # holding the parry button keeps the shield up, and letting go drops it
        await home(); await track(pg, True)
        await kb.down("Backspace"); await frames(pg, 120)
        mid = await track(pg, False); await track(pg, True)
        await kb.up("Backspace"); await frames(pg, 40)
        after = await track(pg, False)
        held_for = sum(r["dt"] for r in mid if r["guard"])
        check("holding Backspace keeps the shield up (well past the 0.93 s a tap lasts)", held_for > 1.5 and mid[-1]["guard"] and mid[-1]["guard"]["held"], round(held_for, 2))
        check("letting go lowers it", after[-1]["guard"] is None)

        # the dash: eases out, and the body straightens gently (measured until just after it, before it reaches the dummies)
        await home(); await track(pg, True)
        await kb.press("KeyD"); await frames(pg, 2); await kb.down("KeyD"); await frames(pg, 18); await kb.up("KeyD"); await frames(pg, 10)
        rows = await track(pg, False)
        d0 = next(i for i, r in enumerate(rows) if r["dash"])
        d1 = next(i for i in range(d0, len(rows)) if not rows[i]["dash"])
        lean_in = max(abs(rows[i + 1]["lean"] - rows[i]["lean"]) / rows[i + 1]["dt"] for i in range(d0, d0 + 4))
        lean_out = max(abs(rows[i + 1]["lean"] - rows[i]["lean"]) / rows[i + 1]["dt"] for i in range(d0 + 4, min(len(rows) - 1, d1 + 8)))
        drop = max(abs(rows[i + 1]["vx"] - rows[i]["vx"]) / rows[i + 1]["dt"] for i in range(d0 + 1, min(len(rows) - 1, d1 + 8)))
        if os.environ.get("TRACE"): print("   lean", [(i - d0, round(r["lean"], 3), round(r["vx"], 2), r["dash"], round(r["dt"], 3)) for i, r in enumerate(rows) if d0 - 3 <= i <= d1 + 8])
        check("the dash straightens gently (under 1.6 rad/s; it was up to 3.9)", lean_out < 1.6, (round(lean_in, 2), round(lean_out, 2)))
        check("the dash slows smoothly into the walk (under 40 units/s²)", drop < 40, round(drop, 1))
        check("no page errors", not errs, errs[:3])
        await b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
asyncio.run(main())
