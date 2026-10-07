# Checks measured on the real page (local dev server, ?dev= for the localhost-only probes):
#  - logo outlines: no ink blobs inside the OpenAI and Claude logos (dark pixels inside, not on the rim)
#  - versus gestures: no part of an arm goes into its own head, in any frame
#  - rounded phone corners: no control pokes outside a 55px-radius screen corner, upright or on its side
import asyncio
from playwright.async_api import async_playwright
from bb import BASE as B, check, summary, launch
R = 55
CORNERS = """R => {
  const W = innerWidth, H = innerHeight;
  const out = (x, y) => { const cx = Math.min(Math.max(x, R), W - R), cy = Math.min(Math.max(y, R), H - R);
    return cx === x || cy === y ? 0 : Math.max(0, Math.hypot(x - cx, y - cy) - R); };
  let worst = 0, what = '';
  document.querySelectorAll('.touch button, .hud .plate, #menuBtn, .trainbar, .moves, #emoteToggle').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || el.closest('[hidden]')) return;
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
      const d = out(r.left + r.width * i / 20, r.top + r.height * j / 20);
      if (d > worst) { worst = d; what = el.id || el.getAttribute('aria-label') || el.className; }
    }
  });
  return { worst: +worst.toFixed(1), what };
}"""
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        pg = await b.new_page()
        await pg.goto(B + "?dev=probe", wait_until="domcontentloaded", timeout=90000)
        await pg.wait_for_function("!!window.__bbLogoProbe", timeout=30000)
        for kind in ["gpt", "claude"]:
            r = await pg.evaluate(f"window.__bbLogoProbe('{kind}', 0, 0)")
            check(f"{kind} logo, face on: no ink inside the logo", r["inside"] <= 20, f"{r['inside']} dark px inside")
            r = await pg.evaluate(f"window.__bbLogoProbe('{kind}', 0.25, 0.35)")
            check(f"{kind} logo, turned: little ink inside (only the real edges)", r["inside"] <= 400, f"{r['inside']} dark px inside")
        for kind in ["so", "gpt", "claude"]:
            r = await pg.evaluate(f"window.__bbGestureProbe('{kind}')")
            check(f"{kind} versus gesture: arms stay out of the head", r["worst"] == 0, r)
        for name, w, h in [("upright", 390, 844), ("on its side", 844, 390)]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True, device_scale_factor=2)
            ph = await ctx.new_page()
            await ph.goto(B, wait_until="domcontentloaded", timeout=90000); await ph.wait_for_timeout(1500)
            await ph.click('.mode[data-mode="training"]'); await ph.wait_for_timeout(600)
            await ph.click('#pickBtn'); await ph.wait_for_timeout(1500)
            r = await ph.evaluate(CORNERS, R)
            check(f"phone {name}: no control cut by a {R}px rounded corner", r["worst"] == 0, r)
            await ctx.close()
        await b.close()
    summary()
asyncio.run(main())
