# Turns a wincap recording of the Roblox Studio viewport (a folder of c*.jpg and times.txt, as wincap writes them) into
# a take ShadowKit can composite: clips/<take>.mp4, clips/<take>.h264 and clips/<take>/meta.json with the stream's
# per-frame index, the same as TapaTab writes. The game runs in real time while it's filmed, so the captures are
# resampled to 30 frames a second by their timestamps (each output frame shows the latest capture at its time).
#   python3 roblox/totake.py <capture dir> <take> [start s] [end s]      (run from promo/)
# BOX is the viewport inside the Studio window as captured (window pixels): a 16:10 box, scaled to OUT.
import json, os, subprocess, sys, bisect

BOX = (572, 324, 1974, 1234)          # x, y, w, h: the viewport (572..2545 x 312..1569), cut to 16:10
OUT = (1728, 1080)
FPS = 30

src, take = sys.argv[1], sys.argv[2]
times = [float(t) for t in open(f"{src}/times.txt").read().split()]
t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0
t1 = float(sys.argv[4]) if len(sys.argv) > 4 else times[-1]
n = int((t1 - t0) * FPS)
pick = [max(0, bisect.bisect_right(times, t0 + i / FPS) - 1) for i in range(n)]

# the chosen captures in order, as a concat list ffmpeg reads (one image per output frame)
lst = f"{src}/frames.txt"
with open(lst, "w") as f:
    for k in pick: f.write(f"file 'c{k:05d}.jpg'\nduration {1 / FPS:.6f}\n")
x, y, w, h = BOX
vf = f"crop={w}:{h}:{x}:{y},scale={OUT[0]}:{OUT[1]}:flags=lanczos,format=yuv420p"
os.makedirs(f"clips/{take}", exist_ok=True)
h264 = f"clips/{take}.h264"
# no B-frames (frames decode in order), a keyframe every 2 s with its headers repeated: what take.js decodes
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-vf", vf, "-r", str(FPS), "-frames:v", str(n),
                "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-profile:v", "high", "-level", "5.2", "-bf", "0",
                "-g", str(2 * FPS), "-keyint_min", str(2 * FPS), "-sc_threshold", "0", "-x264-params", "repeat-headers=1",
                "-bsf:v", "h264_mp4toannexb", "-f", "h264", h264], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-r", str(FPS), "-i", h264, "-c", "copy", f"clips/{take}.mp4"], check=True)
pk = subprocess.run(["ffprobe", "-v", "error", "-f", "h264", "-show_entries", "packet=pos,size,flags", "-of", "csv=p=0", h264],
                    capture_output=True, text=True, check=True).stdout.split()
idx = [[int(p), int(s), 1 if "K" in fl else 0] for s, p, fl in (r.split(",") for r in pk)]
assert len(idx) == n, (len(idx), n)
meta = {"take": take, "fps": FPS, "w": OUT[0], "h": OUT[1], "dpr": 1, "seconds": n / FPS,
        "h264": {"file": f"../{take}.h264", "codec": "avc1.640034", "frames": idx}, "mp4": f"../{take}.mp4",
        "frames": [{"t": round(i / FPS, 4)} for i in range(n)]}
json.dump(meta, open(f"clips/{take}/meta.json", "w"))
gaps = max(b - a for a, b in zip(times, times[1:])) if len(times) > 1 else 0
print(f"{take}: {n} frames ({n / FPS:.1f} s) from {len(set(pick))} captures, longest gap between captures {gaps * 1000:.0f} ms")
