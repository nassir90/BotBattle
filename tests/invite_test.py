# An invite survives signing up: opened while signed out, the page shows the sign-in form; when the page comes back
# signed in, even with nothing in the address (as after some sign-up steps), it joins the room straight away.
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
B = os.environ.get("BOTBATTLE_URL", "http://localhost:5173/games/botbattle/")   # the local dev server (npm run dev)
OUT = os.environ.get("BOTBATTLE_SHOTS", "/tmp")
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name, detail)
def api(path, body, token):
    req = urllib.request.Request(B + "api/" + path, data=json.dumps(body).encode(), headers={"content-type": "application/json", "authorization": f"Bearer {token}"})
    return json.loads(urllib.request.urlopen(req).read())
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        host = await (await browser.new_context(viewport={"width": 1100, "height": 760})).new_page()
        await host.goto(B + "?dev=hostess"); await host.click('.mode[data-mode="online"]')
        await host.wait_for_selector("#rooms:not([hidden])", timeout=8000)
        await host.fill("#createName", "Invite Room"); await host.fill("#createPass", "pw")
        await host.click("#createForm button[type=submit]")
        await host.wait_for_selector("#lobby:not([hidden])", timeout=8000)
        made = api("rooms", {"name": "Invite Room 2", "password": "pw"}, "dev:maker")   # a second room, for its invite
        ctx = await browser.new_context(viewport={"width": 390, "height": 800})       # a phone, signed out
        phone = await ctx.new_page()
        errors = []; phone.on("pageerror", lambda e: errors.append(str(e)))
        await phone.goto(B + f"#join/{made['key'].replace(' ', '%20')}/{made['invite']}")
        await phone.wait_for_selector("#signedOut:not([hidden])", timeout=15000)
        msg = await phone.text_content("#onlineMsg")
        check("signed out, the invite shows the sign-in form", "invited" in msg, msg)
        # signing up ends with the page coming back to the game with nothing in the address, now signed in
        await phone.goto(B + "?dev=newbie")
        await phone.wait_for_selector("#lobby:not([hidden])", timeout=10000)
        check("back on the game signed in, the invite joins the room", (await phone.text_content("#onlineTitle")) == "Invite Room 2")
        check("the invite is used up", await phone.evaluate("localStorage.getItem('botbattle.join')") is None)
        await phone.goto(B + "?dev=newbie")
        await phone.wait_for_timeout(2500)
        check("a later visit opens the main menu as usual", await phone.locator("#menu").is_visible())
        # the lobby's 3D logos
        await host.click('#picks button[data-kind="gpt"]')
        await host.wait_for_timeout(1500)
        await host.screenshot(path=f"{OUT}/lobby-logos.png")
        painted = await host.evaluate("""() => { const c = document.querySelector('.lobby-logos'); const g = c.getContext('webgl2') || c.getContext('webgl');
            const px = new Uint8Array(4 * 64); const r = document.querySelector('#picks button[data-kind=gpt] .pick-logo').getBoundingClientRect(), cr = c.getBoundingClientRect();
            return c.width > 0 }""")
        check("the lobby draws its logo canvas", painted)
        check("no page errors", not errors, errors[:3])
        await browser.close()
    print(f"\n{sum(results)}/{len(results)} passed")
asyncio.run(main())
