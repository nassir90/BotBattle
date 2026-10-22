# An online bracket: three players in a room (joined by its invite link), the host switches the room to a bracket and
# starts it; three entrants make a bracket of four, so one waits on a bye and watches the first match; the host starts
# each match from the lobby, the winner goes through, the final is best of three, and the room ends with a champion.
# Matches are ended with the host's knockout hook (only the host's browser knocks anyone out).
import asyncio
from playwright.async_api import async_playwright
from bb import OUT, check, summary, launch, api, player

async def main():
    async with async_playwright() as p:
        browser = await launch(p)
        made = api("rooms", {"name": "Bracket Room"}, "dev:ann")
        link = f"#join/{made['key'].replace(' ', '%20')}/{made['invite']}"
        pages = {}
        for user, kind in (("ann", "so"), ("ben", "gpt"), ("cal", "claude")):
            pg = await player(browser, user, link, online=False)
            await pg.wait_for_selector("#lobby:not([hidden])", timeout=15000)
            await pg.click(f'#picks button[data-kind="{kind}"]')
            pages[user] = pg
        ann = pages["ann"]
        await ann.wait_for_function("document.querySelectorAll('#roster li').length === 3", timeout=10000)
        await ann.click('#lobbyFormat button[data-format="bracket"]')
        await ann.click('#lobbyLives button[data-lives="1"]')
        for pg in pages.values(): await pg.click("#readyBtn")
        await ann.wait_for_function("!document.getElementById('startBtn').disabled && document.getElementById('startBtn').textContent === 'Start bracket'", timeout=10000)
        check("the host switches the room to a bracket; Start bracket unlocks with three ready", True)
        await ann.click("#startBtn")

        # the first match: two of the three play, the third (on a bye) watches it
        await ann.wait_for_function("window.__bb && window.__bb().length === 2 && window.__bb()[0].id", timeout=15000)
        ids = [f["id"] for f in await ann.evaluate("window.__bb()")]
        bye = next(u for u in pages if f"dev:{u}" not in ids)
        watcher = pages[bye]
        await watcher.wait_for_function("document.getElementById('online').hidden && window.__bb().length === 2", timeout=15000)
        check(f"the first match is two of the three ({', '.join(ids)}); {bye}, on a bye, watches it", len(ids) == 2, ids)
        await watcher.screenshot(path=f"{OUT}/obracket-1-watching.png")

        async def play_out(note):
            # the host knocks out the second fighter once the match is under way; everyone sees the result
            await ann.wait_for_function("!window.__bb()[0].versus", timeout=30000)
            await asyncio.sleep(1.0)
            await ann.evaluate("window.__bbKO(1)")
            await ann.wait_for_selector("#result:not([hidden])", timeout=15000)
            winner = await ann.text_content("#resultTitle")
            for pg in pages.values():
                if await pg.locator("#result:not([hidden])").count(): await pg.click("#roomBtn")
            await ann.wait_for_selector("#lobby:not([hidden])", timeout=10000)
            await ann.wait_for_function("!document.getElementById('lobbyBracket').hidden", timeout=10000)
            return winner

        w1 = await play_out("semifinal")
        title = await ann.text_content("#lobbyBracketTitle")
        check("after the semifinal the lobby shows the bracket, with the final up next", "up next" in title, (w1, title))
        await ann.screenshot(path=f"{OUT}/obracket-2-lobby.png")
        check("the host's button starts the next match", await ann.text_content("#startBtn") == "Start next match")

        games = 0
        for _ in range(4):
            if "wins the bracket" in (await ann.text_content("#lobbyBracketTitle")): break
            await ann.wait_for_function("!document.getElementById('startBtn').disabled", timeout=10000)
            await ann.click("#startBtn"); games += 1
            await ann.wait_for_function("document.getElementById('online').hidden", timeout=15000)
            await play_out(f"final game {games}")
        title = await ann.text_content("#lobbyBracketTitle")
        check("the final is best of three (two games to win it) and the room has a champion", games == 2 and "wins the bracket" in title, (games, title))
        for u, pg in pages.items():
            if await pg.locator("#lobby:not([hidden])").count() == 0 and await pg.locator("#roomBtn").is_visible(): await pg.click("#roomBtn")
        await watcher.wait_for_function("document.getElementById('lobbyBracketTitle').textContent.includes('wins the bracket')", timeout=10000)
        check("everyone in the room sees the champion", True)
        await ann.screenshot(path=f"{OUT}/obracket-3-champion.png")
        errs = [e for pg in pages.values() for e in pg.errors]
        check("no page errors", not errs, errs[:3])
        await browser.close()
    summary()
asyncio.run(main())
