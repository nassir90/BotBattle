# Walking while crouched, and the punch / low kick button: H alone (training), R for User A and M for User B with
# two on one keyboard. Waits are counted in game frames, so a busy machine doesn't cut them short.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, frames, bb
async def walk_up(pg, me, them, right, left, down):
    # crouch-walk fighter `me` up to `them`: slow enough not to ram them (running into someone shoves them away),
    # and holding the key down (tapping it would be a double tap: a dash past them). Then stand up.
    f = await bb(pg); key = right if f[them]["x"] > f[me]["x"] else left
    await pg.keyboard.down(down); await pg.keyboard.down(key)
    try:
        for _ in range(80):
            f = await bb(pg)
            if abs(f[them]["x"] - f[me]["x"]) < 1.5: return True
            await frames(pg, 1)
        return False
    finally:
        await pg.keyboard.up(key); await pg.keyboard.up(down); await frames(pg, 20)
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        # alone, in training: H
        pg = await b.new_page(viewport={"width": 1280, "height": 720}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.set_default_timeout(180000)
        await pg.goto(B + "?dev=strike", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="training"]'); await pg.click("#pickBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length > 1"); await frames(pg, 40)
        # walking toward open floor (away from the dummies), then crouching on the way
        fs = await bb(pg); away = "KeyA" if sum(f["x"] for f in fs[1:]) / (len(fs) - 1) > fs[0]["x"] else "KeyD"
        await pg.keyboard.down(away); await frames(pg, 8)
        walk = abs((await bb(pg))[0]["vx"])
        await pg.keyboard.down("KeyS"); await frames(pg, 10)
        f = (await bb(pg))[0]; await pg.keyboard.up(away)
        check("crouched, you can still walk, more slowly", f["crouch"] > 0.9 and 0.3 * walk < abs(f["vx"]) < 0.6 * walk, (round(walk, 2), round(f["vx"], 2), round(f["crouch"], 2)))
        check("crouched, the pad's button shows a boot (a kick)", await pg.evaluate("document.querySelector('#touch .strike').classList.contains('kick')"))
        await pg.keyboard.up("KeyS"); await frames(pg, 20)
        check("standing, it shows a fist (a punch)", await pg.evaluate("!document.querySelector('#touch .strike').classList.contains('kick')"))
        moves = await pg.eval_on_selector_all("#moves .move", "els => els.map(e => e.textContent)")
        check("the move list has Punch on H and Low kick on S+H", any("Punch" in m and "H" in m for m in moves) and any("Low kick" in m and "S+H" in m for m in moves), moves)
        fs = await bb(pg); near = min(range(1, len(fs)), key=lambda i: abs(fs[i]["x"] - fs[0]["x"]))
        check("walks up to a dummy", await walk_up(pg, 0, near, "KeyD", "KeyA", "KeyS"))
        await frames(pg, 30)
        fa = await bb(pg); h0 = fa[near]["hp"]
        await pg.keyboard.press("KeyH"); await frames(pg, 25)
        fb = await bb(pg); h1 = fb[near]["hp"]
        check("H punches: the dummy loses 4", round(h0 - h1, 1) == 4, (h0, h1))
        await walk_up(pg, 0, near, "KeyD", "KeyA", "KeyS"); await frames(pg, 30)
        await pg.keyboard.down("KeyS"); await frames(pg, 12)
        h1 = (await bb(pg))[near]["hp"]
        await pg.keyboard.press("KeyH"); await frames(pg, 6)
        f = await bb(pg)
        await frames(pg, 20); await pg.keyboard.up("KeyS")
        h2 = (await bb(pg))[near]["hp"]
        check("crouched, H is a low kick: the dummy loses 5 and stumbles", round(h1 - h2, 1) == 5 and f[near]["stumble"] > 0, (h1, h2, round(f[near]["stumble"], 2)))
        check("no page errors (training)", not errs, errs[:3])
        await pg.close()
        # two on one keyboard: R for User A, M for User B
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("localStorage.setItem('botbattle.seats', JSON.stringify([{kind:'claude',ctrl:'A'},{kind:'gpt',ctrl:'B'}]))")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
        await pg.goto(B + "?dev=strike2", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="play"]'); await pg.click("#fightBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length === 2"); await pg.keyboard.press("Enter")
        await pg.wait_for_function("!window.__bb()[0].versus"); await frames(pg, 40)
        await walk_up(pg, 0, 1, "KeyD", "KeyA", "KeyS"); await frames(pg, 30)
        f0 = await bb(pg)
        await pg.keyboard.press("KeyH"); await frames(pg, 25)
        f1 = await bb(pg)
        check("with User B playing, H stays User A's power move (Claude's dots: more than a punch)", f0[1]["hp"] - f1[1]["hp"] > 4, (f0[1]["hp"], f1[1]["hp"]))
        await walk_up(pg, 0, 1, "KeyD", "KeyA", "KeyS"); await frames(pg, 30)
        f1 = await bb(pg)
        await pg.keyboard.press("KeyR"); await frames(pg, 25)
        f2 = await bb(pg)
        check("R is User A's punch", round(f1[1]["hp"] - f2[1]["hp"], 1) == 4, (f1[1]["hp"], f2[1]["hp"]))
        await walk_up(pg, 1, 0, "ArrowRight", "ArrowLeft", "ArrowDown"); await frames(pg, 30)
        f2 = await bb(pg)
        await pg.keyboard.press("KeyM"); await frames(pg, 25)
        f3 = await bb(pg)
        check("M is User B's punch", round(f2[0]["hp"] - f3[0]["hp"], 1) == 4, (f2[0]["hp"], f3[0]["hp"]))
        check("no page errors (two players)", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
