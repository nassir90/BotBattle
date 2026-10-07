# Dropped connections in an online match: a guest's and the host's connection drop and come back (the match carries
# on, and controls and the host's state flow again), and a player who doesn't come back counts as gone only after the
# room's 30-second grace. Uses the page's dev hook __bbNet: drop() closes the socket and reconnects (code 3000, a
# drop, not a leave); cut() closes it for good.
import asyncio, json, time
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch
async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        async def page(user):
            ctx = await browser.new_context(viewport={"width": 1100, "height": 760})
            pg = await ctx.new_page(); pg.set_default_timeout(120000)
            pg.errors = []; pg.snaps = []
            pg.on("pageerror", lambda e: pg.errors.append(str(e)))
            pg.on("websocket", lambda ws: ws.on("framereceived", lambda m: pg.snaps.append(time.time()) if '"t":"snap"' in m else None))
            await pg.goto(B + f"?dev={user}", wait_until="domcontentloaded", timeout=300000)
            await pg.click('.mode[data-mode="online"]'); await pg.wait_for_selector("#rooms:not([hidden])")
            return pg
        alice = await page("rcalice")
        await alice.fill("#createName", "Reconnect Room"); await alice.click("#createForm button[type=submit]")
        await alice.wait_for_selector("#lobby:not([hidden])")
        bob = await page("rcbob")
        await bob.fill("#joinName", "reconnect room"); await bob.click("#joinForm button[type=submit]")
        await bob.wait_for_selector("#lobby:not([hidden])")
        await alice.click('#picks button[data-kind="so"]'); await bob.click('#picks button[data-kind="gpt"]')
        for pg in (alice, bob): await pg.wait_for_function("!document.getElementById('readyBtn').disabled")
        await alice.click("#readyBtn"); await bob.click("#readyBtn")
        await alice.wait_for_function("!document.getElementById('startBtn').disabled"); await alice.click("#startBtn")
        for pg in (alice, bob): await pg.wait_for_function("window.__bb && window.__bb().length === 2 && !window.__bb()[0].versus", timeout=180000)
        await asyncio.sleep(1)

        # the guest drops and comes back
        await bob.evaluate("window.__bbNet.drop()")
        await bob.wait_for_function("document.getElementById('netBanner').hidden", timeout=30000)
        check("a guest's dropped connection comes back by itself", True)
        check("and the guest is still in the match", await bob.evaluate("document.getElementById('online').hidden && window.__bb().length === 2"))
        before = (await alice.evaluate("window.__bb()"))[1]["x"]
        await bob.keyboard.down("KeyA"); await asyncio.sleep(1.5); await bob.keyboard.up("KeyA"); await asyncio.sleep(1)
        after = (await alice.evaluate("window.__bb()"))[1]["x"]
        check("the guest's controls reach the host again", after < before - 0.5, (round(before, 2), round(after, 2)))

        # the host drops and comes back
        await alice.evaluate("window.__bbNet.drop()")
        await alice.wait_for_function("document.getElementById('netBanner').hidden", timeout=30000)
        t = time.time(); await asyncio.sleep(2)
        check("the host's dropped connection comes back, and its state reaches the guest again", sum(1 for s in bob.snaps if s > t) > 5, sum(1 for s in bob.snaps if s > t))
        check("the host is still in the match", await alice.evaluate("document.getElementById('online').hidden && window.__bb().length === 2"))

        # the guest's connection goes for good: still in for the grace, out after it
        await bob.evaluate("window.__bbNet.cut()")
        await asyncio.sleep(10)
        check("a player who's gone for 10 s still has their fighter (30 s grace)", not (await alice.evaluate("window.__bb()"))[1]["out"])
        await alice.wait_for_function("window.__bb()[1].out", timeout=60000)
        check("after the grace, they count as gone", True)
        check("no page errors", not (alice.errors or bob.errors), (alice.errors + bob.errors)[:3])
        await browser.close()
    summary()
asyncio.run(main())
