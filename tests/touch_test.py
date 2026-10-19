# The touch pad on a phone held upright, with real fingers (DevTools touch events): the black triangle on the d-pad
# jumps; the d-pad's bottom corners crouch and walk that way; the shield parries to the side when tapped and overhead when swiped up from; the punch button shows a boot
# while crouched (it kicks); the hand grabs. Then the layout: every button on screen, each piece of the d-pad taking the finger at its own centre,
# the rest not overlapping, in two rows of
# actions (the fighter's moves, then the shield, punch and grab).
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, frames, bb

async def centre(pg, key):
    # (where its glyph is, inside its shape for the d-pad's cut pieces)
    return await pg.evaluate("k => { const b = document.querySelector('#touch button[data-key=\"' + k + '\"]'), r = (b.querySelector('.g') || b).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", key)
async def touch(cdp, kind, x, y):
    await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [] if kind == "touchEnd" else [{"x": x, "y": y, "id": 1}]})

async def main():
    async with async_playwright() as p:
        b = await launch(p)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
        cdp = await ctx.new_cdp_session(pg)
        await pg.goto(B + "?dev=touch", wait_until="domcontentloaded", timeout=300000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="training"]'); await pg.click("#pickBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length > 1"); await frames(pg, 40)

        # the jump: a black triangle pointing up, on the d-pad
        jump = await pg.evaluate("(() => { const b = document.querySelector('#touch button[data-key=\"Space\"]'), pts = [...b.querySelector('.g polygon').points];"
                                 " return [pts.length === 3 && pts.filter(q => q.y < 0).length === 1 && getComputedStyle(b.querySelector('.g')).fill, !!b.closest('.pad')]; })()")
        x, y = await centre(pg, "Space")
        await touch(cdp, "touchStart", x, y); await frames(pg, 3); await touch(cdp, "touchEnd", 0, 0)
        await frames(pg, 6); f = await bb(pg)
        check("the jump button is a black triangle pointing up, on the d-pad, and it jumps", jump == ["rgb(20, 20, 20)", True] and f[0]["y"] > 0.3, (jump, round(f[0]["y"], 2)))
        await frames(pg, 60)

        # the d-pad's bottom corners: crouch and walk that way
        for key, way in (("ArrowDown ArrowLeft", -1), ("ArrowDown ArrowRight", 1)):
            await pg.evaluate("window.__bbPlace(0, 0, 1)"); await frames(pg, 10)
            x0 = (await bb(pg))[0]["x"]; x, y = await centre(pg, key)
            await touch(cdp, "touchStart", x, y); await frames(pg, 30); f = await bb(pg); await touch(cdp, "touchEnd", 0, 0)
            side = 'left' if way < 0 else 'right'
            check(f"the bottom {side} piece crouches and walks {side}", f[0]["crouch"] and (f[0]["x"] - x0) * way > 0.3, (f[0]["crouch"], round(f[0]["x"] - x0, 2)))
            await frames(pg, 20)

        # the shield: a tap parries to the side, a swipe up parries overhead
        x, y = await centre(pg, "Backspace")
        await touch(cdp, "touchStart", x, y); await frames(pg, 3); f = await bb(pg); await touch(cdp, "touchEnd", 0, 0)
        check("tapping the shield parries to the side", f[0]["guardDir"] == "side", f[0]["guardDir"])
        await frames(pg, 60)
        await touch(cdp, "touchStart", x, y)
        for k in range(1, 5): await touch(cdp, "touchMove", x, y - 10 * k)
        await frames(pg, 3); f = await bb(pg); await touch(cdp, "touchEnd", 0, 0)
        check("swiping up from the shield parries overhead", f[0]["guardDir"] == "up", f[0]["guardDir"])
        await frames(pg, 60)

        # crouched, the punch button shows a boot (a low kick)
        dx, dy = await centre(pg, "ArrowDown")
        await touch(cdp, "touchStart", dx, dy); await frames(pg, 12)
        kick = await pg.evaluate("document.querySelector('#touch .strike').classList.contains('kick') && getComputedStyle(document.querySelector('#touch .strike .boot')).display !== 'none'")
        await touch(cdp, "touchEnd", 0, 0); await frames(pg, 12)
        fist = await pg.evaluate("getComputedStyle(document.querySelector('#touch .strike .fist')).display !== 'none'")
        check("the punch button shows a boot while crouched, and a fist standing", kick and fist, (kick, fist))

        # the hand grabs: walk up to a dummy and hold it
        await pg.evaluate("window.__bbPlace(0, -2, 1); window.__bbPlace(1, -0.75, -1)"); await frames(pg, 20)
        x, y = await centre(pg, "KeyN")
        await touch(cdp, "touchStart", x, y); await frames(pg, 10); f = await bb(pg); await touch(cdp, "touchEnd", 0, 0)
        check("holding the hand button grabs", f[0]["grab"] == "hold" and f[1]["held"], (f[0]["grab"], f[1]["held"]))
        await frames(pg, 90)

        # the layout: all on screen, none overlapping; the fighter's moves in one row and the shield, punch and grab
        # in the row under it
        lay = await pg.evaluate("""(() => {
          const bs = [...document.querySelectorAll('#touch button')].filter(b => !b.hidden).map(b => ({ k: b.dataset.key, slot: !!b.dataset.slot, r: b.getBoundingClientRect() }));
          const pad = [...document.querySelectorAll('#touch .pad .dir')];
          const missed = pad.filter(b => { const r = b.querySelector('.g').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') !== b; }).map(b => b.dataset.key);
          bs.splice(0, bs.length, ...bs.filter(b => !pad.some(d => d.dataset.key === b.k)), { k: 'pad', r: document.querySelector('#touch .pad').getBoundingClientRect() });
          let over = 0;
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
            const a = bs[i].r, c = bs[j].r;
            if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) over++;
          }
          const off = bs.filter(b => b.r.left < 0 || b.r.right > innerWidth || b.r.bottom > innerHeight).length;
          const tops = s => [...new Set(bs.filter(b => b.k !== 'pad' && b.slot === s).map(b => Math.round(b.r.top)))];
          return { n: bs.length, over, off, missed, pieces: pad.length, moves: tops(true), basics: tops(false) };
        })()""")
        check("every button on screen, each d-pad piece taking its own centre, none overlapping, in two rows: the fighter's moves above the shield, punch and grab",
              lay["over"] == 0 and lay["off"] == 0 and not lay["missed"] and lay["pieces"] == 6 and len(lay["moves"]) == 1 and len(lay["basics"]) == 1 and lay["moves"][0] < lay["basics"][0], lay)
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
