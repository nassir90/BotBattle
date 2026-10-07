# Casual matches on the local dev server: two players asking for one land in the same room, a third gets a room of
# their own, and the match starts by itself once both are ready (no host button). Also checks that the newer
# controls (the punch, a held guard) reach the other player: the server used to pass on only the first 13 bits.
import asyncio, json
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, player
async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        # each player's incoming controls (the bits), to check the newer ones get through
        page = lambda user: player(browser, user, ins=[], on_frame=lambda pg, m: pg.ins.append(json.loads(m)["b"]) if '"t":"in"' in m else None)
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
    summary()
asyncio.run(main())
