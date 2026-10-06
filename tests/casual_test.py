# Casual matches on the local dev server: two players asking for one land in the same room, a third gets a room of
# their own, and the match starts by itself once both are ready (no host button). Also checks that the newer
# controls (the punch, a held guard) reach the other player: the server used to pass on only the first 13 bits.
import asyncio, json, os
from playwright.async_api import async_playwright
B = os.environ.get("BOTBATTLE_URL", "http://localhost:5173/games/botbattle/")
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name, detail)
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        async def page(user):
            ctx = await browser.new_context(viewport={"width": 1100, "height": 760})
            pg = await ctx.new_page(); pg.set_default_timeout(120000)
            pg.errors = []; pg.ins = []
            pg.on("pageerror", lambda e: pg.errors.append(str(e)))
            pg.on("websocket", lambda ws: ws.on("framereceived", lambda m: pg.ins.append(json.loads(m)["b"]) if '"t":"in"' in m else None))
            await pg.goto(B + f"?dev={user}", wait_until="domcontentloaded", timeout=300000)
            await pg.click('.mode[data-mode="online"]')
            await pg.wait_for_selector("#rooms:not([hidden])")
            return pg
        async def casual(pg):
            await pg.click("#casualBtn")
            await pg.wait_for_selector("#lobby:not([hidden])")
            return await pg.text_content("#onlineTitle")
        ann = await page("ann"); room_a = await casual(ann)
        check("a casual match puts you in a room to wait", room_a.startswith("Casual"), room_a)
        check("waiting, it says it's looking for a player", "Looking for another player" in await ann.text_content("#lobbyNote"))
        check("a casual room has no invite code or start button", not await ann.locator(".invite").is_visible() and not await ann.locator("#startBtn").is_visible())
        ben = await page("ben"); room_b = await casual(ben)
        check("the next player is matched into the same room", room_b == room_a, (room_a, room_b))
        await ann.wait_for_function("document.querySelectorAll('#roster li').length === 2")
        check("matched: both see two players", "Matched" in await ann.text_content("#lobbyNote"))
        cal = await page("cal"); room_c = await casual(cal)
        check("a third player gets a room of their own (casual rooms are for two)", room_c != room_a, room_c)
        await ann.click('#picks button[data-kind="so"]'); await ben.click('#picks button[data-kind="gpt"]')
        await ann.wait_for_function("!document.getElementById('readyBtn').disabled"); await ben.wait_for_function("!document.getElementById('readyBtn').disabled")
        await ann.click("#readyBtn"); await ben.click("#readyBtn")
        await ann.wait_for_function("window.__bb && window.__bb().length === 2", timeout=180000)
        await ben.wait_for_function("window.__bb && window.__bb().length === 2", timeout=180000)
        check("the match starts by itself once both are ready", True)
        await ann.wait_for_function("window.__bb && !window.__bb()[0].versus", timeout=180000)
        await ann.wait_for_timeout(1500)
        await ann.keyboard.press("KeyH"); await ann.keyboard.down("Backspace"); await ann.wait_for_timeout(1500); await ann.keyboard.up("Backspace")
        await ben.wait_for_timeout(1500)
        check("the punch reaches the other player (bit 8192)", any(b & 8192 for b in ben.ins), len(ben.ins))
        check("a held guard reaches the other player (bit 16384)", any(b & 16384 for b in ben.ins))
        check("no page errors", not (ann.errors or ben.errors or cal.errors), (ann.errors + ben.errors + cal.errors)[:3])
        await browser.close()
    print(f"\n{sum(results)}/{len(results)} passed")
asyncio.run(main())
