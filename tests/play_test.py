# Play mode on the real page: the seats (fighter, colour, who plays it), adding and removing seats, two players on
# one keyboard, the versus screen, the result, and the leaderboard's benchmark table.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, OUT, check, summary, launch
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        pg = await b.new_page(viewport={"width": 1280, "height": 800}); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(120000)
        await pg.goto(B + "?dev=tester", wait_until="domcontentloaded", timeout=90000); await pg.wait_for_timeout(1500)
        modes = await pg.eval_on_selector_all(".mode:not([hidden]) h2", "els => els.map(e => e.textContent)")
        check("the menu has Play and Training (Free-for-all, Duel and Watch are gone)", modes[:2] == ["Play", "Training"] and not {"Free-for-all", "Duel", "Watch"} & set(modes), modes)
        await pg.click('.mode[data-mode="play"]')
        await pg.wait_for_selector("#play:not([hidden])")
        check("Play opens with three seats: User A and two CPUs", await pg.eval_on_selector_all(".seat-ctrl", "els => els.map(e => e.textContent)") == ["User A", "CPU", "CPU"])
        await pg.wait_for_timeout(500); await pg.screenshot(path=f"{OUT}/play-1-seats.png")
        # seat 1: Stack Overflow, in blue
        await pg.click(".seat >> nth=0 >> .seat-fighter")
        await pg.wait_for_selector("#select:not([hidden])")
        check("the picker says which seat it's for", "User A" in await pg.text_content("#selectTitle"), await pg.text_content("#selectTitle"))
        await pg.click('#variants button[data-v="blue"]'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/play-2-picker-blue.png")
        await pg.click("#pickBtn")
        await pg.wait_for_selector("#play:not([hidden])")
        name = await pg.text_content(".seat >> nth=0 >> .seat-name")
        variant = await pg.evaluate("JSON.parse(localStorage.getItem('botbattle.seats'))[0].variant")
        check("seat 1 is Stack Overflow, blue (the colour isn't written under the name)", name.strip() == "Stack Overflow" and variant == "blue", (name, variant))
        # seat 2: User B; seat 3 removed, then a seat added and removed again
        await pg.click(".seat >> nth=1 >> .seat-ctrl")
        check("seat 2's controller moves on to User B (User A is taken)", await pg.text_content(".seat >> nth=1 >> .seat-ctrl") == "User B")
        check("with User B, the two key sets show", await pg.locator("#playKeys").is_visible())
        await pg.click(".seat >> nth=2 >> .seat-remove")
        check("a seat can be removed", await pg.locator(".seat").count() == 2)
        check("with two seats left, there's no remove button", await pg.locator(".seat-remove").count() == 0)
        await pg.click(".seat-add"); await pg.click(".seat-add")
        check("seats can be added up to four", await pg.locator(".seat").count() == 4 and await pg.locator(".seat-add").count() == 0)
        await pg.click(".seat >> nth=3 >> .seat-remove"); await pg.click(".seat >> nth=2 >> .seat-remove")
        await pg.click('#playLives button[data-lives="1"]')
        await pg.screenshot(path=f"{OUT}/play-3-two-players.png")
        await pg.click("#fightBtn")
        await pg.wait_for_selector("#versus:not([hidden])"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/play-4-versus.png")
        tags = await pg.eval_on_selector_all(".vs-tag", "els => els.map(e => e.textContent)")
        check("the versus screen names User A and User B", tags == ["User A", "User B"], tags)
        await pg.wait_for_function("window.__bb && !window.__bb()[0].versus", timeout=180000)
        before = await pg.evaluate("window.__bb()")
        check("User A's fighter is blue Stack Overflow", before[0]["kind"] == "so")
        # User A walks right with D, User B left with the left arrow
        await pg.keyboard.down("KeyD"); await pg.keyboard.down("ArrowLeft"); await pg.wait_for_timeout(2500)
        await pg.keyboard.up("KeyD"); await pg.keyboard.up("ArrowLeft"); await pg.wait_for_timeout(1500)
        after = await pg.evaluate("window.__bb()")
        check("D moves only User A, the left arrow only User B", after[0]["x"] > before[0]["x"] + 0.25 and after[1]["x"] < before[1]["x"] - 0.25,
              [(round(f["x"], 2)) for f in before] + [(round(f["x"], 2)) for f in after])
        plates = await pg.eval_on_selector_all(".plate-tag", "els => els.map(e => e.textContent.trim().split(' ')[0] + ' ' + e.textContent.trim().split(' ')[1])")
        check("the health plates say USER A and USER B", plates[0].startswith("USER A") and plates[1].startswith("USER B"), plates)
        check("User B's moves are listed too", await pg.locator("#movesB").is_visible())
        await pg.screenshot(path=f"{OUT}/play-5-match.png")
        await pg.evaluate("window.__bbKO(1)")
        await pg.wait_for_selector("#result:not([hidden])", timeout=10000)
        title, sub = await pg.text_content("#resultTitle"), await pg.text_content("#resultSub")
        check("the last one standing wins, named with who played it", title == "Stack Overflow wins" and sub.startswith("User A"), f"{title} / {sub}")
        await pg.click("#changeBtn")
        check("Change fighter goes back to the seats", await pg.locator("#play").is_visible())
        await pg.click("#playBack"); await pg.click("#boardBtn")
        # on a fresh database there are no finished online matches yet (online_test makes some): then the board says so
        await pg.wait_for_function("document.querySelector('#boardTable table.bench') || /Nobody/.test(document.getElementById('boardMsg').textContent)", timeout=10000)
        await pg.wait_for_timeout(500); await pg.screenshot(path=f"{OUT}/play-6-leaderboard.png")
        if await pg.locator("#boardTable table.bench").count():
            check("the leaderboard is a table with a row per player (the leader's outlined) and a column per score",
                  await pg.locator("#boardTable tbody tr.lead").count() == 1 and await pg.locator("#boardTable thead th").count() == 6)
        else:
            check("an empty leaderboard says nobody has finished an online match yet", "Nobody" in await pg.text_content("#boardMsg"))
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
