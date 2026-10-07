# Two of the same fighter through the real Play screens, on a phone and on a desktop: the second seat shows the
# other colour as soon as it's picked, and the match uses exactly the colours the seats show.
import asyncio

from playwright.async_api import async_playwright
from bb import BASE as B, OUT, check, summary, launch, frames

async def run(b, name, ctx_opts):
    ctx = await b.new_context(**ctx_opts)
    pg = await ctx.new_page(); pg.set_default_timeout(180000)
    await pg.goto(B + "?dev=c2", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.removeItem('botbattle.seats')"); await pg.reload(); await pg.wait_for_timeout(1500)
    await pg.click('.mode[data-mode="play"]'); await pg.wait_for_selector("#play:not([hidden])")
    # both seats: pick Claude on the cards, keeping whatever colour the card offers
    for i in range(2):
        await pg.click(f".seat >> nth={i} >> .seat-fighter"); await pg.wait_for_selector("#select:not([hidden])")
        for _ in range(3):
            if await pg.evaluate("document.getElementById('pickBtn').textContent.includes('Claude')"): break
            await pg.click("#carNext") if await pg.locator("#carNext").count() else await pg.keyboard.press("ArrowRight")
            await pg.wait_for_timeout(500)
        await pg.click("#pickBtn"); await pg.wait_for_selector("#play:not([hidden])")
    if await pg.locator(".seat").count() > 2:
        await pg.click(".seat >> nth=2 >> .seat-remove")
    seats = await pg.evaluate("localStorage.getItem('botbattle.seats')")
    await pg.screenshot(path=f"{OUT}/{name}-seats.png")
    await pg.click("#fightBtn"); await pg.wait_for_function("window.__bb && window.__bb().length === 2")
    await pg.wait_for_timeout(3000)
    await pg.screenshot(path=f"{OUT}/{name}-versus.png")
    await pg.keyboard.press("Enter"); await pg.wait_for_function("!window.__bb()[0].versus"); await frames(pg, 30)
    fs = await pg.evaluate("window.__bb().map(f => [f.kind, f.variant])")
    await pg.screenshot(path=f"{OUT}/{name}-match.png")
    import json as _j
    shown = [st.get("variant") for st in _j.loads(seats)]
    check(f"{name}: picking Claude twice gives the second seat the other colour", shown == ["orange", "black"], shown)
    check(f"{name}: the match has the colours the seats showed", [v for _, v in fs] == shown, fs)
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        await run(b, "phone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True))
        await run(b, "desktop", dict(viewport={"width": 1280, "height": 720}))
        await b.close()
    summary()
asyncio.run(main())
