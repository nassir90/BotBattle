# A local bracket from the Play screen: five entrants (User A and four CPUs) seeded into a bracket of eight, the top
# three seeds through to round 2 on byes; CPU-only matches can be skipped; a match User A is in is played (and won
# with a knockout), the winner goes through, and the bracket ends with a champion. Waits are counted in game frames.
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, OUT, check, summary, launch, frames

TREE = """(() => [...document.querySelectorAll('#bracketTree .round')].map(r => [...r.querySelectorAll('.bm')].map(m =>
  [...m.querySelectorAll('.en')].map(e => e.classList.contains('won') ? 'W' : e.classList.contains('lost') ? 'L' : e.classList.contains('empty') ? '-' : 'o').join(''))))()"""

async def main():
    async with async_playwright() as p:
        b = await launch(p)
        ctx = await b.new_context(viewport={"width": 1280, "height": 800})
        await ctx.add_init_script("localStorage.setItem('botbattle.seats', JSON.stringify([{kind:'gpt',ctrl:'A'},{kind:null,ctrl:'cpu'},{kind:null,ctrl:'cpu'},{kind:null,ctrl:'cpu'},{kind:null,ctrl:'cpu'}])); localStorage.setItem('botbattle.format', 'bracket'); localStorage.setItem('botbattle.lives', '1')")
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
        await pg.goto(B + "?dev=bracket", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="play"]')
        check("the Play screen keeps the bracket format and five seats", await pg.locator("#seats .seat").count() == 5
              and await pg.text_content("#fightBtn") == "Start bracket", await pg.text_content("#fightBtn"))
        await pg.click("#fightBtn")
        await pg.wait_for_selector("#bracket:not([hidden])")
        tree = await pg.evaluate(TREE)
        check("five entrants make a bracket of eight: round 1 has three byes, then semifinals and a final",
              len(tree) == 3 and len(tree[0]) == 4 and sum(m.count('-') for m in tree[0]) == 3 and len(tree[1]) == 2 and len(tree[2]) == 1, tree)
        await pg.screenshot(path=f"{OUT}/bracket-1.png")

        # play it out: skip CPU-only matches, fight User A's (knocking the CPU out), until there's a champion; the final
        # is best of three, so its "Game 2" goes straight into the next game
        played = skipped = 0; labels = []; in_match = False
        for _ in range(12):
            if not in_match:
                if await pg.locator('#upNext button[data-act="again"]').count(): break
                if await pg.locator('#upNext button[data-act="skip"]').count():
                    await pg.click('#upNext button[data-act="skip"]'); skipped += 1; continue
                await pg.click('#upNext button[data-act="fight"]')
            await pg.wait_for_function("window.__bb && window.__bb().length === 2 && !window.__bb()[0].versus && document.getElementById('result').hidden")
            await frames(pg, 20)
            idx = await pg.evaluate("window.__bb().findIndex(f => !f.mine)")      # the CPU, not User A
            await pg.evaluate(f"window.__bbKO({idx})")
            await pg.wait_for_selector("#result:not([hidden])")
            label = await pg.text_content("#bracketBtn"); labels.append(label)
            check(f"game {played + 1}: the results offer the bracket ({label}), not a rematch",
                  await pg.locator("#bracketBtn").is_visible() and not await pg.locator("#rematchBtn").is_visible())
            await pg.click("#bracketBtn"); played += 1
            in_match = label.startswith("Game")
            if not in_match: await pg.wait_for_selector("#bracket:not([hidden])")
        check("the final is best of three: after winning game 1 it goes on to game 2", "Game 2" in labels, labels)
        tree = await pg.evaluate(TREE)
        title = await pg.text_content("#bracketTitle")
        check("User A wins every match they play and is the champion, with placings", played >= 3 and "1st" in await pg.text_content("#upNext") and "wins the bracket" in title and tree[2][0].count('W') == 1, (played, skipped, title, tree))
        await pg.screenshot(path=f"{OUT}/bracket-2.png")
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
