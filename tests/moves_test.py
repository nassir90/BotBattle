# Movement and guarding, frame by frame (window.__bbTrack): setting off with a burst, walking backwards when you
# turn round (and jumping backwards still facing forward), the dash easing out and straightening gently, and
# holding the parry button to keep the shield up. Waits are counted in game frames.
import asyncio, os
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, frames
async def track(pg, on): return await pg.evaluate(f"window.__bbTrack(0, {'true' if on else 'false'})")
async def main():
    async with async_playwright() as p:
        b = await launch(p)
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
        check("no ground inertia: full speed from the first frame (it used to build up at 30 units/s²)", walk[start] >= 5.5, round(walk[start], 2))

        # turning round without having attacked: straight round, no walking backwards
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 25)
        await kb.down("KeyA"); await kb.up("KeyD"); await frames(pg, 20); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        flip = next(i for i, r in enumerate(rows) if r["vx"] < -0.3)
        check("without attacking, turning round is immediate (no walking backwards)", rows[flip]["facing"] == -1 and not any(r["back"] for r in rows), rows[flip]["facing"])

        # direction inertia: shoot right, then walk left: backwards, still facing right, until it wears off
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 10); await kb.press("KeyJ"); await frames(pg, 3)
        await kb.down("KeyA"); await kb.up("KeyD"); await frames(pg, 50); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        flip = next(i for i, r in enumerate(rows) if r["vx"] < -0.3)
        backT = sum(r["dt"] for r in rows[flip:] if r["vx"] < -0.3 and r["facing"] == 1)
        turned = any(r["facing"] == -1 for r in rows[flip:])
        check("after a shot, walking the other way is walking backwards (direction inertia), then it turns", 0.15 < backT < 0.6 and turned, round(backT, 3))

        # a shot, then turning and jumping at once: a jump backwards, facing forward until landing
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 10); await kb.press("KeyJ"); await frames(pg, 3)
        await kb.down("KeyA"); await kb.up("KeyD"); await kb.press("KeyW"); await frames(pg, 30); await kb.up("KeyA"); await frames(pg, 10)
        rows = await track(pg, False)
        up = next(i for i, r in enumerate(rows) if not r["ground"])
        air = []                                  # the jump: the first stretch in the air
        for r in rows[up:]:
            if r["ground"]: break
            air.append(r)
        check("a jump while walking backwards keeps facing forward until it lands", air and all(r["facing"] == 1 for r in air) and sum(r["vx"] < -0.3 for r in air) > len(air) / 2,
              (len(air), sum(r["facing"] == 1 for r in air)))

        # a parry in that jump guards forward, and the jump keeps its momentum
        await home(); await track(pg, True)
        await kb.down("KeyD"); await frames(pg, 10); await kb.press("KeyJ"); await frames(pg, 3)
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
        # a tap: up for its first 16 frames (so a quick tap still parries), then lowered in 5 (was 4 + 34 + 8)
        await home(); await track(pg, True)
        await kb.press("Backspace"); await frames(pg, 70)
        rows = await track(pg, False)
        up = sum(r["dt"] for r in rows if r["guard"])
        check("a tapped shield comes down quickly once it's let go (about 0.35 s; was 0.77)", 0.28 < up < 0.45, round(up, 3))
        # moving while it's being lowered drops it at once
        await home(); await track(pg, True)
        await kb.press("Backspace"); await kb.down("KeyD"); await frames(pg, 60); await kb.up("KeyD")   # held all along: it counts once lowering starts
        rows = await track(pg, False)
        up = sum(r["dt"] for r in rows if r["guard"])
        check("moving while it's being lowered drops it at once (before the 46 frames are up)", up < 44 / 60, round(up * 60, 1))
        await home(); await track(pg, True)
        await kb.down("Backspace"); await frames(pg, 10); await kb.down("KeyS"); await frames(pg, 30)
        rows = await track(pg, False); await kb.up("KeyS"); await kb.up("Backspace"); await frames(pg, 30)
        check("you can crouch behind a shield", rows[-1]["guard"] and rows[-1]["crouch"] > 0.9, (bool(rows[-1]["guard"]), round(rows[-1]["crouch"], 2)))

        # the shield bash: dash at a dummy with the shield up; it flies (after a reset, so the dummies stand apart)
        await pg.click("#resetBtn"); await frames(pg, 40)
        fs = await pg.evaluate("window.__bb()"); near = min(range(1, len(fs)), key=lambda i: abs(fs[i]["x"] - fs[0]["x"]))
        await kb.down("KeyS"); await kb.down("KeyD")         # crouch-walk up to about 3 units away (not ramming it)
        for _ in range(80):
            f = await pg.evaluate("window.__bb()")
            if f[near]["x"] - f[0]["x"] < 3.2: break
            await frames(pg, 1)
        await kb.up("KeyD"); await kb.up("KeyS"); await frames(pg, 20); await pg.wait_for_timeout(400)
        h0 = (await pg.evaluate("window.__bb()"))[near]["hp"]
        await pg.evaluate(f"window.__bbTrack({near}, true)")
        await kb.press("KeyD"); await pg.wait_for_timeout(90); await kb.press("KeyD"); await kb.press("Backspace")   # a double tap, and the shield
        await frames(pg, 20)
        them = await pg.evaluate(f"window.__bbTrack({near}, false)")
        h1 = (await pg.evaluate("window.__bb()"))[near]["hp"]
        fly = max(r["vx"] for r in them)
        check("dash + shield is a shield bash: 9 damage and a big knockback", round(h0 - h1, 1) == 9 and fly > 6, (h0, h1, round(fly, 1)))

        # the dash: eases out, and the body straightens gently (measured until just after it, before it reaches the dummies)
        await home(); await track(pg, True)
        await kb.press("KeyD"); await pg.wait_for_timeout(90); await kb.down("KeyD"); await frames(pg, 18); await kb.up("KeyD"); await frames(pg, 10)
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
    summary()
asyncio.run(main())
