# Coming back from signing in: Clerk can end a sign-in by loading the game afresh at its plain address (back from
# Google, or a sign-up finished from its email), with nothing in the address to say so. The page should come back to
# the Online screen then, and not after the player has gone back to the menu. Uses the real Clerk form (signed out,
# no ?dev), so it needs the network; nobody signs in.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        pg = await (await b.new_context(viewport={"width": 1100, "height": 760})).new_page(); pg.set_default_timeout(120000)
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(B, wait_until="domcontentloaded", timeout=300000)
        await pg.click('.mode[data-mode="online"]')
        await pg.wait_for_selector("#signedOut:not([hidden])")
        check("signed out, Online shows the sign-in form", await pg.locator("#signedOut").is_visible())
        await pg.goto(B, wait_until="domcontentloaded")          # the page loaded afresh at its plain address
        await pg.wait_for_timeout(2000)
        check("loaded afresh mid-sign-in, the page comes back to Online", await pg.locator("#online").is_visible() and await pg.locator("#menu").is_hidden())
        await pg.click("#onlineBack"); await pg.wait_for_selector("#menu:not([hidden])")
        await pg.goto(B, wait_until="domcontentloaded"); await pg.wait_for_timeout(2000)
        check("after going back to the menu, a fresh load opens on the menu", await pg.locator("#menu").is_visible() and await pg.locator("#online").is_hidden())
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
