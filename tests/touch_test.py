# The touch pad on a phone held upright, with real fingers (DevTools touch events): nothing of it shows over the menu
# while the page loads; the icons are drawn (little 3D cutouts); the ▲ at the bottom right jumps; the joypad's bottom
# corners crouch and walk that way; a thumb sliding across it changes direction, keeps it when it slides off
# the box, and its middle is nothing; the shield parries to the side when tapped and overhead when swiped up from; the
# punch button shows a boot while crouched (it kicks); the hand grabs. Then the layout: everything on screen, nothing
# overlapping, the actions in two rows (the fighter's moves, then the shield, punch, grab and jump).
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch, frames, bb

async def centre(pg, key):
    # (a button's middle, or on the joypad the mark for that direction)
    return await pg.evaluate("k => { const r = document.querySelector('#touch [data-key=\"' + k + '\"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }", key)
async def touch(cdp, kind, x, y):
    await cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [] if kind == "touchEnd" else [{"x": x, "y": y, "id": 1}]})

async def main():
    async with async_playwright() as p:
        b = await launch(p)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(180000)
        cdp = await ctx.new_cdp_session(pg)
        await pg.goto(B + "?dev=touch", wait_until="commit", timeout=300000)
        await pg.wait_for_selector("#touch", state="attached")
        early = await pg.evaluate("getComputedStyle(document.getElementById('touch')).display")
        await pg.wait_for_load_state("domcontentloaded"); await pg.wait_for_timeout(1500)
        check("the pad doesn't show over the menu while the page loads", early == "none", early)
        await pg.click('.mode[data-mode="training"]'); await pg.click("#pickBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length > 1"); await frames(pg, 40)

        icons = await pg.evaluate("[...document.querySelectorAll('#touch img[data-icon]')].filter(i => !(i.src.startsWith('data:image/png') && i.naturalWidth > 0)).map(i => i.dataset.icon)")
        check("every icon is drawn", not icons, icons)
        # the jump: ▲, the last of the actions' bottom row
        jump = await pg.evaluate("(() => { const b = document.querySelector('#touch button[data-key=\"Space\"]'), r = b.getBoundingClientRect();"
                                 " const others = [...document.querySelectorAll('#touch .acts button:not([hidden])')].map(o => o.getBoundingClientRect());"
                                 " return [b.querySelector('img').dataset.icon, others.every(o => o.right <= r.right + 1 && o.bottom <= r.bottom + 1)]; })()")
        x, y = await centre(pg, "Space")
        await touch(cdp, "touchStart", x, y); await frames(pg, 3); await touch(cdp, "touchEnd", 0, 0)
        await frames(pg, 6); f = await bb(pg)
        check("the jump button (▲) is at the bottom right, and it jumps", jump == ["jump", True] and f[0]["y"] > 0.3, (jump, round(f[0]["y"], 2)))
        await frames(pg, 60)

        # the d-pad's bottom corners: crouch and walk that way
        for key, way in (("ArrowDown ArrowLeft", -1), ("ArrowDown ArrowRight", 1)):
            await pg.evaluate("window.__bbPlace(0, 0, 1)"); await frames(pg, 10)
            x0 = (await bb(pg))[0]["x"]; x, y = await centre(pg, key)
            await touch(cdp, "touchStart", x, y); await frames(pg, 30); f = await bb(pg); await touch(cdp, "touchEnd", 0, 0)
            side = 'left' if way < 0 else 'right'
            check(f"down and to the {side} on the joypad crouches and walks {side}", f[0]["crouch"] and (f[0]["x"] - x0) * way > 0.3, (f[0]["crouch"], round(f[0]["x"] - x0, 2)))
            await frames(pg, 20)

        # sliding: from ◀ across to ▶ walks left then right, then down onto the bottom right corner crouches
        await pg.evaluate("window.__bbPlace(0, 0, 1)"); await frames(pg, 10)
        lx, ly = await centre(pg, "ArrowLeft"); rx, ry = await centre(pg, "ArrowRight"); cx, cy = await centre(pg, "ArrowDown ArrowRight")
        x0 = (await bb(pg))[0]["x"]
        await touch(cdp, "touchStart", lx, ly); await frames(pg, 20); xl = (await bb(pg))[0]["x"]
        for k in range(1, 9): await touch(cdp, "touchMove", lx + (rx - lx) * k / 8, ly + (ry - ly) * k / 8)
        await frames(pg, 30); xr = (await bb(pg))[0]["x"]
        await touch(cdp, "touchMove", cx, cy); await frames(pg, 20); f = await bb(pg)
        on = await pg.evaluate("[...document.querySelectorAll('#touch .pad .on')].map(b => b.dataset.key)")
        # off the box (out to the right and below it, still on screen): still down and to the right
        pr = await pg.evaluate("(() => { const r = document.querySelector('#touch .pad').getBoundingClientRect(); return [r.right, r.bottom]; })()")
        await touch(cdp, "touchMove", pr[0] + 60, min(pr[1] + 60, 840)); await frames(pg, 6)
        off = await pg.evaluate("[...document.querySelectorAll('#touch .pad .on')].map(b => b.dataset.key)")
        # back to the middle: nothing
        mx, my = await pg.evaluate("(() => { const r = document.querySelector('#touch .pad').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        await touch(cdp, "touchMove", mx, my); await frames(pg, 6)
        mid = await pg.evaluate("[...document.querySelectorAll('#touch .pad .on')].length")
        await touch(cdp, "touchEnd", 0, 0); await frames(pg, 6)
        left = await pg.evaluate("document.querySelectorAll('#touch .pad .on').length")
        check("one thumb sliding across the joypad: walks left, then right, then crouch-walks, keeps it off the box, nothing in the middle, and lets go at the end",
              xl < x0 - 0.2 and xr > xl + 0.2 and f[0]["crouch"] and on == off == ["ArrowDown ArrowRight"] and mid == 0 and left == 0,
              (round(xl - x0, 2), round(xr - xl, 2), f[0]["crouch"], on, off, mid, left))
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
        dx, dy = await pg.evaluate("(() => { const r = document.querySelector('#touch .pad').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 8]; })()")    # straight down
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
          bs.push({ k: 'pad', r: document.querySelector('#touch .pad').getBoundingClientRect() });
          let over = 0;
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
            const a = bs[i].r, c = bs[j].r;
            if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) over++;
          }
          const off = bs.filter(b => b.r.left < 0 || b.r.right > innerWidth || b.r.bottom > innerHeight).length;
          const tops = s => [...new Set(bs.filter(b => b.k !== 'pad' && b.slot === s).map(b => Math.round(b.r.top)))];
          return { n: bs.length, over, off, moves: tops(true), basics: tops(false) };
        })()""")
        check("the joypad and every button on screen, none overlapping, the actions in two rows: the fighter's moves above the shield, punch, grab and jump",
              lay["over"] == 0 and lay["off"] == 0 and len(lay["moves"]) == 1 and len(lay["basics"]) == 1 and lay["moves"][0] < lay["basics"][0], lay)
        check("no page errors", not errs, errs[:3])
        await b.close()
    summary()
asyncio.run(main())
