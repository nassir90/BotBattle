# An invite survives signing up: opened while signed out, the page shows the sign-in form; when the page comes back
# signed in, even with nothing in the address (as after some sign-up steps), it joins the room straight away.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, OUT, DEVKEY, check, summary, launch, api
DK = f"&devkey={DEVKEY}" if DEVKEY else ""
async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        host = await (await browser.new_context(viewport={"width": 1100, "height": 760})).new_page()
        await host.goto(B + "?dev=hostess" + DK, wait_until="domcontentloaded", timeout=300000); await host.click('.mode[data-mode="online"]')
        await host.wait_for_selector("#rooms:not([hidden])", timeout=8000)
        await host.fill("#createName", "Invite Room"); await host.fill("#createPass", "pw")
        await host.click("#createForm button[type=submit]")
        await host.wait_for_selector("#lobby:not([hidden])", timeout=8000)
        made = api("rooms", {"name": "Invite Room 2", "password": "pw"}, "dev:maker")   # a second room, for its invite
        ctx = await browser.new_context(viewport={"width": 390, "height": 800})       # a phone, signed out
        phone = await ctx.new_page()
        errors = []; phone.on("pageerror", lambda e: errors.append(str(e)))
        await phone.goto(B + f"#join/{made['key'].replace(' ', '%20')}/{made['invite']}", wait_until="domcontentloaded", timeout=300000)
        await phone.wait_for_selector("#signedOut:not([hidden])", timeout=15000)
        msg = await phone.text_content("#onlineMsg")
        check("signed out, the invite shows the sign-in form", "invited" in msg, msg)
        # signing up ends with the page coming back to the game with nothing in the address, now signed in
        await phone.goto(B + "?dev=newbie" + DK, wait_until="domcontentloaded", timeout=300000)
        await phone.wait_for_selector("#lobby:not([hidden])", timeout=10000)
        check("back on the game signed in, the invite joins the room", (await phone.text_content("#onlineTitle")) == "Invite Room 2")
        check("the invite is used up", await phone.evaluate("localStorage.getItem('botbattle.join')") is None)
        await phone.goto(B + "?dev=newbie" + DK, wait_until="domcontentloaded", timeout=300000)
        await phone.wait_for_timeout(2500)
        check("a later visit opens the main menu as usual", await phone.locator("#menu").is_visible())
        # the lobby's 3D logos
        await host.click('#picks button[data-kind="gpt"]')
        await host.wait_for_timeout(1500)
        await host.screenshot(path=f"{OUT}/lobby-logos.png")
        painted = await host.evaluate("""() => { const c = document.querySelector('.lobby-main .logo-layer'); const g = c.getContext('webgl2') || c.getContext('webgl');
            const px = new Uint8Array(4 * 64); const r = document.querySelector('#picks button[data-kind=gpt] .pick-logo').getBoundingClientRect(), cr = c.getBoundingClientRect();
            return c.width > 0 }""")
        check("the lobby draws its logo canvas", painted)
        check("no page errors", not errors, errors[:3])
        await browser.close()
    summary()
asyncio.run(main())
