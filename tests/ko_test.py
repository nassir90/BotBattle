# Knockouts online: the host's knockouts reach the guest, the knocked-out fighter comes back on both screens,
# a guest can't knock anyone out on its own, and the last knockout ends the match the same way for both.
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
from bb import BASE as B, OUT, check, summary, launch, player
async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        page = lambda user: player(browser, user, viewport=(1000, 700))
        host, guest = await page("hana"), await page("gus")
        await host.fill("#createName", "KO Room"); await host.click("#createForm button[type=submit]")
        await host.wait_for_selector("#lobby:not([hidden])", timeout=8000)
        await guest.fill("#joinName", "ko room"); await guest.click("#joinForm button[type=submit]")
        await guest.wait_for_selector("#lobby:not([hidden])", timeout=8000)
        await host.click('#picks button[data-kind="claude"]'); await guest.wait_for_function("document.querySelector('#roster li .sw[data-logo=claude]')")
        await guest.click('#picks button[data-kind="so"]')
        await host.click("#readyBtn"); await guest.click("#readyBtn")
        await host.click('#lobbyLives button[data-lives="2"]')
        await host.wait_for_function("!document.getElementById('startBtn').disabled"); await host.click("#startBtn")
        for pg in (host, guest): await pg.wait_for_function("window.__bb && window.__bb().length === 2 && !window.__bb()[0].versus", timeout=30000)
        # a guest can't knock anyone out by itself (on a dedicated server the hook asks the server, under its test key:
        # there, server/test checks that only the server decides)
        if not (await guest.evaluate("window.__bbNetStats()"))["dedicated"]:
            await guest.evaluate("window.__bbKO(0)")
            await asyncio.sleep(1.0)
            g, h = await guest.evaluate("window.__bb()"), await host.evaluate("window.__bb()")
            check("a guest can't knock the host out on its own", not g[0]["dead"] and not h[0]["dead"], f"guest view {g[0]}")
        # the host knocks the guest out: both screens show it, then it comes back with one life
        await host.evaluate("window.__bbKO(1)")
        await guest.wait_for_function("window.__bb()[1].dead", timeout=5000)
        check("the host's knockout shows on the guest's screen", True)
        await guest.wait_for_function("!window.__bb()[1].dead", timeout=8000)
        g, h = await guest.evaluate("window.__bb()"), await host.evaluate("window.__bb()")
        check("the guest's fighter comes back on both screens with 1 life", g[1]["stocks"] == 1 and h[1]["stocks"] == 1 and not h[1]["dead"], f"{g[1]} / {h[1]}")
        await guest.screenshot(path=f"{OUT}/6-respawn-guest.png")
        await asyncio.sleep(2.5)
        await host.evaluate("window.__bbKO(1)")
        for pg in (host, guest): await pg.wait_for_selector("#result:not([hidden])", timeout=8000)
        th, tg = await host.text_content("#resultTitle"), await guest.text_content("#resultTitle")
        check("the match ends on both screens with the same winner", th == tg == "hana wins", f"{th!r} / {tg!r}")
        check("guests get 'Back to the room' and 'Leave room'", await guest.locator("#roomBtn").is_visible() and await guest.locator("#rematchBtn").is_hidden())
        await guest.screenshot(path=f"{OUT}/7-result-guest.png")
        await guest.click("#roomBtn")
        await guest.wait_for_selector("#lobby:not([hidden])", timeout=5000)
        note = await guest.text_content("#lobbyNote")
        check("back in the lobby, ready again resets", "Ready" in (await guest.text_content("#readyBtn")), note)
        board = json.loads(urllib.request.urlopen(B + "api/leaderboard").read())
        rows = {r["name"]: r for r in board["players"]}
        check("hana's win is on the leaderboard", rows.get("hana", {}).get("wins", 0) >= 1 and rows.get("gus", {}).get("matches", 0) >= 1, json.dumps(rows.get("hana")))
        check("no page errors", not host.errors and not guest.errors, (host.errors + guest.errors)[:3])
        await browser.close()
    summary()
asyncio.run(main())
