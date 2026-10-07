# Camera smoothness: a duel (User A against the CPU), User A jumping from the start, the camera recorded frame by
# frame. Jitter shows as the camera reversing direction from one frame to the next, or jumping in one frame.
#   counts: reversals of the camera's movement (back and forth within a few frames), and single-frame jumps
import asyncio, json
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch
def jitter(log):
    # per axis: zig-zags (the movement changes direction and back again within 3 frames, while moving more than a
    # hair: what reads as jitter) and snaps (a frame much faster than the frames either side of it: a jump cut)
    out = {}
    for axis, name in [(0, "x"), (1, "y"), (2, "z"), (3, "look")]:
        d = [log[i + 1][axis] - log[i][axis] for i in range(len(log) - 1)]
        dt = [max(1e-3, (log[i + 1][4] - log[i][4]) / 1000) for i in range(len(log) - 1)]
        v = [x / t for x, t in zip(d, dt)]
        flips = [i for i in range(1, len(d)) if d[i] * d[i - 1] < 0 and min(abs(d[i]), abs(d[i - 1])) > 0.01]
        zig = sum(1 for a, b in zip(flips, flips[1:]) if b - a <= 3)
        snaps = sum(1 for i in range(1, len(v) - 1) if abs(v[i]) > 6 and abs(v[i]) > 3 * max(abs(v[i - 1]), abs(v[i + 1])))
        out[name] = (zig, snaps, round(max((abs(x) for x in v), default=0), 2))
    return out
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        ctx = await b.new_context(viewport={"width": 1280, "height": 720})
        await ctx.add_init_script("localStorage.setItem('botbattle.seats', JSON.stringify([{kind:'so',ctrl:'A'},{kind:'gpt',ctrl:'cpu'}]))")
        pg = await ctx.new_page()
        await pg.goto(B + "?dev=cam", wait_until="domcontentloaded", timeout=90000); await pg.wait_for_timeout(1500)
        await pg.click('.mode[data-mode="play"]'); await pg.click("#fightBtn")
        await pg.wait_for_function("window.__bb && window.__bb().length", timeout=60000)
        await pg.keyboard.press("Enter")         # skip the versus screen
        await pg.wait_for_function("!window.__bb()[0].versus", timeout=120000)
        await pg.evaluate("window.__bbCam(true)")
        for i in range(10):                      # jump, double jump, land, again; walking a little
            await pg.keyboard.press("KeyW"); await pg.wait_for_timeout(180); await pg.keyboard.press("KeyW")
            if i % 3 == 0: await pg.keyboard.down("KeyD")
            await pg.wait_for_timeout(450)
            await pg.keyboard.up("KeyD")
        log = await pg.evaluate("window.__bbCam(false)")
        j = jitter(log)
        print("   frames", len(log), " per axis (zig-zags, snaps, fastest units/s):", json.dumps(j))
        zig = sum(v[0] for v in j.values()); snaps = sum(v[1] for v in j.values())
        check("the camera doesn't jitter (no zig-zags)", zig == 0, zig)
        check("the camera doesn't snap (no frame much faster than its neighbours)", snaps == 0, snaps)
        await b.close()
    summary()
asyncio.run(main())
