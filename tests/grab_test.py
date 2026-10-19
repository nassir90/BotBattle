# Grabbing and throwing, two players on one keyboard (User A grabs with E, User B with N): a grab goes through a held
# shield; holding it and pressing forward swings the other fighter back and hurls it across (8 damage), pressing back
# heaves it over the head to land behind (10); letting go of the key drops it unhurt; a grab that misses leaves the
# grabber stuck for a moment. Waits are counted in game frames.
import asyncio, os
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, frames, bb

async def walk_up(pg, me, them, right, left, down=None):
    # crouch-walks fighter `me` up to `them`, facing it (slowly, so it doesn't shove them away, and holding the key:
    # tapping it would be a double tap, a dash past them), then stands up
    down = down or ("KeyS" if right == "KeyD" else "ArrowDown")
    f = await bb(pg); key = right if f[them]["x"] > f[me]["x"] else left
    await pg.keyboard.down(down); await pg.keyboard.down(key)
    try:
        for _ in range(120):
            f = await bb(pg)
            if abs(f[them]["x"] - f[me]["x"]) < 1.5: return True
            await frames(pg, 1)
        return False
    finally:
        await pg.keyboard.up(key); await pg.keyboard.up(down); await frames(pg, 20)

async def main():
    async with async_playwright() as p:
        b = await launch(p)
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("localStorage.setItem('botbattle.seats', JSON.stringify([{kind:'so',ctrl:'A'},{kind:'claude',ctrl:'B'}]))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
        await pg.goto(B + "?dev=grab", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="play"]'); await pg.click("#fightBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length === 2"); await pg.keyboard.press("Enter")
        await pg.wait_for_function("!window.__bb()[0].versus"); await frames(pg, 40)
        kb = pg.keyboard

        # a miss: stuck for a moment. Step back a little, then grab at nothing with forward held all along: without the
        # grab it would walk at once; with it, it stays put through the reach and the 0.45 s after a miss
        f = await bb(pg)
        away = "KeyA" if f[1]["x"] > f[0]["x"] else "KeyD"
        await kb.down(away); await frames(pg, 12); await kb.up(away); await frames(pg, 30)
        f = await bb(pg)
        toward = "KeyD" if f[1]["x"] > f[0]["x"] else "KeyA"
        if abs(f[1]["x"] - f[0]["x"]) > 2.5:
            await pg.evaluate("window.__bbTrack(0, true)")
            before = (await bb(pg))[0]
            await kb.press("KeyE"); await kb.down(toward)
            just = (await bb(pg))[0]
            await frames(pg, 50); await kb.up(toward)
            rows = await pg.evaluate("window.__bbTrack(0, false)")
            # the press lands after that frame's step, so: still before the keys arrive, one step, then the stuck
            # stretch, timed until it walks off
            i = 0
            while i < len(rows) and abs(rows[i]["vx"]) < 0.3: i += 1      # before the keys arrive
            while i < len(rows) and abs(rows[i]["vx"]) >= 0.3: i += 1     # the step taken as the grab starts
            t, stuck = 0, None
            for r in rows[i:]:
                if abs(r["vx"]) > 0.3: stuck = t; break
                t += r["dt"]
            check("a grab that misses leaves the grabber stuck for about 0.6 s (reach and recovery) before it can walk", stuck is not None and 0.5 < stuck < 0.75,
                  (stuck and round(stuck, 3), {k: before[k] for k in ("x", "y", "vx", "busy", "grab", "stumble", "facing")}, just["grab"]))
        else:
            check("a grab that misses leaves the grabber stuck (setup: far enough apart to miss)", False, round(abs(f[1]["x"] - f[0]["x"]), 2))
        await frames(pg, 30)

        # through a shield, then thrown forward
        await walk_up(pg, 0, 1, "KeyD", "KeyA"); await frames(pg, 20)
        await kb.down("ShiftRight"); await frames(pg, 30)                 # User B holds its shield up
        f0 = await bb(pg)
        check("User B is behind a held shield", f0[1]["guard"], f0[1])
        await kb.down("KeyE"); await frames(pg, 12)
        f1 = await bb(pg)
        check("User A's grab (E) goes through the shield and holds User B", f1[0]["grab"] == "hold" and f1[1]["held"] and not f1[1]["guard"], (f1[0]["grab"], f1[1]["held"], f1[1]["guard"]))
        await kb.up("ShiftRight")
        face = f1[0]["facing"]
        await kb.press("KeyD" if face > 0 else "KeyA"); await frames(pg, 40); await kb.up("KeyE")
        f2 = await bb(pg)
        check("forward throw: 8 damage, through the shield, and it lands well away in front", round(f1[1]["hp"] - f2[1]["hp"], 1) == 8 and (f2[1]["x"] - f2[0]["x"]) * face > 2.5,
              (f1[1]["hp"], f2[1]["hp"], round((f2[1]["x"] - f2[0]["x"]) * face, 2)))
        await frames(pg, 120)   # (a thrown fighter lies a moment, then takes about half a second to get up)

        # thrown backward, over the head
        await walk_up(pg, 0, 1, "KeyD", "KeyA"); await frames(pg, 30)
        f3 = await bb(pg); face = f3[0]["facing"]
        await kb.down("KeyE"); await frames(pg, 12)
        await kb.press("KeyA" if face > 0 else "KeyD"); await frames(pg, 40); await kb.up("KeyE")
        f4 = await bb(pg)
        check("backward throw: 10 damage, and it lands behind the thrower", round(f3[1]["hp"] - f4[1]["hp"], 1) == 10 and (f4[1]["x"] - f4[0]["x"]) * face < 0,
              (f3[1]["hp"], f4[1]["hp"], round((f4[1]["x"] - f4[0]["x"]) * face, 2)))
        await frames(pg, 120)   # (a thrown fighter lies a moment, then takes about half a second to get up)

        # let go: dropped, unhurt
        await walk_up(pg, 0, 1, "KeyD", "KeyA"); await frames(pg, 30)
        f5 = await bb(pg)
        await kb.down("KeyE"); await frames(pg, 12); await kb.up("KeyE"); await frames(pg, 6)
        f6 = await bb(pg)
        check("letting go of the grab drops User B unhurt", not f6[1]["held"] and f6[0]["grab"] is None and f6[1]["hp"] == f5[1]["hp"], (f6[1]["held"], f6[0]["grab"], f5[1]["hp"], f6[1]["hp"]))

        # grabbed at the very edge: held in the hands the whole time, never snapped onto the ledge (it used to be)
        await pg.evaluate("window.__bbPlace(0, 9.2, 1); window.__bbPlace(1, 10.35, -1)"); await frames(pg, 20)
        await kb.down("KeyE"); seen = []
        for _ in range(8):                                   # while it's held (the grip lasts 1.3 s)
            await frames(pg, 4); f = await bb(pg)
            if not f[1]["held"]: break
            seen.append((f[1]["held"], f[1]["ledge"], round(f[1]["x"] - f[0]["x"], 2)))
        await kb.up("KeyE"); await frames(pg, 120)   # (a thrown fighter lies a moment, then takes about half a second to get up)
        check("grabbed at the edge, it stays in the grabber's hands (never on the ledge)",
              seen and all(h and not l and 0.3 < d < 2.2 for h, l, d in seen), seen)
        await pg.evaluate("window.__bbPlace(0, -2, 1); window.__bbPlace(1, -0.75, -1)"); await frames(pg, 120)   # (a thrown fighter lies a moment, then takes about half a second to get up)

        # the backward throw lets go overhead: it goes over the top of the thrower's head and comes down behind in an
        # arc (it used to be carried round and let go low down behind)
        await pg.evaluate("window.__bbPlace(0, -2, 1); window.__bbPlace(1, -0.75, -1)"); await frames(pg, 20)
        await kb.down("KeyE"); await frames(pg, 12)
        ax = (await bb(pg))[0]["x"]
        await pg.evaluate("window.__bbTrack(1, true)")
        await kb.press("KeyA"); await frames(pg, 45); await kb.up("KeyE")
        rows = await pg.evaluate("window.__bbTrack(1, false)")
        if os.environ.get("TRACE"): print("   ax", ax, [(round(r["x"], 2), round(r["y"], 2)) for r in rows[::3]])
        over = next((r for r in rows if r["x"] < ax + 0.3), None)                 # where it crosses above the thrower
        behind = next((r for r in rows if r["x"] < ax - 0.8), None)              # and once it's behind
        # (y is where its feet would be: its hips are a unit above, over the thrower's cup at about 2.6 as it crosses)
        check("backward throw: over the top of the head (hips above the thrower's cup as it crosses), then down behind in an arc",
              over and over["y"] + 1 > 2.4 and behind and behind["y"] > 0.5, (over and round(over["y"], 2), behind and round(behind["y"], 2)))
        await frames(pg, 120)   # (a thrown fighter lies a moment, then takes about half a second to get up)

        # grabbed in the middle of Claude's double jump (its rotor lifts it for a moment), then dropped: it falls and
        # gets up, rather than the leftover lift floating the limp body up, head down, for seconds
        await pg.evaluate("window.__bbPlace(0, -2, 1); window.__bbPlace(1, -0.85, -1)"); await frames(pg, 20)
        await kb.press("ArrowUp"); await frames(pg, 8); await kb.press("ArrowUp"); await frames(pg, 2)
        await kb.down("KeyE"); await frames(pg, 10); held = (await bb(pg))[1]["held"]
        await pg.evaluate("window.__bbTrack(1, true)"); await kb.up("KeyE"); await frames(pg, 150)
        rows = await pg.evaluate("window.__bbTrack(1, false)")
        rise = max(r["y"] for r in rows) - rows[0]["y"]
        after = await bb(pg)
        check("grabbed mid double jump and dropped: it falls (no float up) and is back on its feet",
              held and rise < 0.3 and after[1]["limp"] is None and after[1]["y"] == 0, (held, round(rise, 2), after[1]["limp"], after[1]["y"]))
        await frames(pg, 30)

        # User B grabs with N
        await pg.evaluate("window.__bbPlace(0, 0, -1); window.__bbPlace(1, -1.25, 1)"); await frames(pg, 20)
        await kb.down("KeyN"); await frames(pg, 12)
        f9 = await bb(pg); await kb.up("KeyN"); await frames(pg, 10)
        check("N is User B's grab", f9[1]["grab"] == "hold" and f9[0]["held"], (f9[1]["grab"], f9[0]["held"]))
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
