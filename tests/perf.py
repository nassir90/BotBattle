# Where a frame's time goes, measured on the real page (not a pass/fail test): the menu with the CPUs brawling behind
# it, a four-CPU match, and two players sharing a phone (the scene drawn twice). For each: the frame's parts from the
# page's own timer (window.__bbPerf: simulation, springs and poses, camera, the page's panels, the scene, HUD logos),
# Chrome's counts of style and layout work per frame (layout forced from script shows up here), the JS heap, and the
# functions that took the most time (a CPU profile).
#   BOTBATTLE_URL=... python tests/perf.py [seconds per scenario] [--json out.json]
import asyncio, json, statistics, sys
from collections import defaultdict
from playwright.async_api import async_playwright
from bb import BASE as B, launch

SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else 10
WARM = 6            # seconds each scenario runs before it's measured: shaders compile as each effect first appears
OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
PARTS = ["sim", "springs", "camera", "page", "scene", "hud"]
FOUR_CPUS = [{"kind": "so", "ctrl": "cpu"}, {"kind": "gpt", "ctrl": "cpu"}, {"kind": "claude", "ctrl": "cpu"}, {"kind": "claude", "ctrl": "cpu"}]
SPLIT = [{"kind": "gpt", "ctrl": "A"}, {"kind": "so", "ctrl": "B"}]


def pct(xs, p):
    xs = sorted(xs); return xs[min(len(xs) - 1, int(p * len(xs)))] if xs else 0


async def measure(pg, name):
    await pg.wait_for_timeout(WARM * 1000)
    cdp = await pg.context.new_cdp_session(pg)
    await cdp.send("Performance.enable")
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 200})
    m0 = {m["name"]: m["value"] for m in (await cdp.send("Performance.getMetrics"))["metrics"]}
    await pg.evaluate("window.__bbPerf(true)"); await cdp.send("Profiler.start")
    await pg.wait_for_timeout(SECONDS * 1000)
    prof = (await cdp.send("Profiler.stop"))["profile"]
    rows = await pg.evaluate("window.__bbPerf(false)")
    m1 = {m["name"]: m["value"] for m in (await cdp.send("Performance.getMetrics"))["metrics"]}
    n = max(1, len(rows))
    # self time per function, from the profile's samples
    by_id = {nd["id"]: nd for nd in prof["nodes"]}
    dts = prof.get("timeDeltas", [])
    self_ms = defaultdict(float)
    for sid, dt in zip(prof.get("samples", []), dts):
        cf = by_id[sid]["callFrame"]
        key = f"{cf['functionName'] or '(anonymous)'} @{cf['url'].split('/')[-1] or cf['url'] or '-'}:{cf['lineNumber'] + 1}"
        self_ms[key] += dt / 1000
    total_ms = sum(self_ms.values()) or 1
    top = sorted(self_ms.items(), key=lambda kv: -kv[1])[:22]
    per = lambda k: (m1.get(k, 0) - m0.get(k, 0)) / n
    res = {
        "frames": len(rows), "fps": round(len(rows) / SECONDS, 1),
        "parts_mean_ms": {p: round(statistics.mean(r[i] for r in rows), 3) for i, p in enumerate(PARTS)} if rows else {},
        "total_mean_ms": round(statistics.mean(sum(r) for r in rows), 3) if rows else 0,
        "total_p95_ms": round(pct([sum(r) for r in rows], 0.95), 3),
        "layouts_per_frame": round(per("LayoutCount"), 2), "style_recalcs_per_frame": round(per("RecalcStyleCount"), 2),
        "layout_ms_per_frame": round(per("LayoutDuration") * 1000, 3), "style_ms_per_frame": round(per("RecalcStyleDuration") * 1000, 3),
        "script_ms_per_frame": round(per("ScriptDuration") * 1000, 3),
        "heap_mb": round(m1.get("JSHeapUsedSize", 0) / 1e6, 1),
        "top_self_ms_per_frame": [(k, round(v / n, 3), f"{100 * v / total_ms:.1f}%") for k, v in top],
    }
    print(f"\n== {name}: {res['frames']} frames ({res['fps']}/s), JS frame {res['total_mean_ms']} ms mean, {res['total_p95_ms']} ms p95")
    print("   parts (ms):", res["parts_mean_ms"])
    print(f"   per frame: {res['layouts_per_frame']} layouts ({res['layout_ms_per_frame']} ms), {res['style_recalcs_per_frame']} style recalcs "
          f"({res['style_ms_per_frame']} ms), script {res['script_ms_per_frame']} ms; heap {res['heap_mb']} MB")
    for k, v, share in res["top_self_ms_per_frame"]:
        print(f"   {v:7.3f} ms  {share:>6}  {k}")
    return res


async def page(b, seats=None, **ctx):
    c = await b.new_context(**({"viewport": {"width": 1280, "height": 720}} | ctx))
    if seats: await c.add_init_script(f"localStorage.setItem('botbattle.seats', JSON.stringify({json.dumps(seats)}))")
    pg = await c.new_page(); pg.set_default_timeout(180000)
    await pg.goto(B + "?dev=perf", wait_until="domcontentloaded", timeout=300000)
    await pg.wait_for_function("window.__bbPerf && window.__bb && window.__bb().length > 0")
    await pg.wait_for_timeout(2500)
    return pg


async def main():
    out = {}
    async with async_playwright() as p:
        b = await launch(p)
        pg = await page(b)
        out["menu"] = await measure(pg, "menu, CPUs brawling behind it")
        await pg.context.close()

        pg = await page(b, FOUR_CPUS)
        await pg.click('.mode[data-mode="play"]'); await pg.click("#fightBtn")
        await pg.wait_for_function("window.__bb().length === 4"); await pg.keyboard.press("Enter")
        await pg.wait_for_function("!window.__bb()[0].versus"); await pg.wait_for_timeout(1500)
        out["match4"] = await measure(pg, "a four-CPU match")
        await pg.context.close()

        pg = await page(b, SPLIT, viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        await pg.click('.mode[data-mode="play"]'); await pg.click("#fightBtn")
        await pg.wait_for_function("window.__bb().length === 2 && document.body.classList.contains('split')")
        await pg.wait_for_timeout(1500)
        out["split"] = await measure(pg, "two players on one phone (split screen)")
        await pg.context.close()
        await b.close()
    if OUT: json.dump(out, open(OUT, "w"), indent=1)

asyncio.run(main())
