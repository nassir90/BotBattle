# A whole CPU match as one video, with no narration: the versus screen, the full fight, and the results table under
# the end card, with sound effects on everything that happens. The game is silent, so the takes log its moments
# (takes.mjs: state.ev in each frame's annotation); this synthesises a sound for each one, mixes them into one track
# (videos/<id>/sfx_fight.wav, which ShadowKit's mixer plays as a single cue) and writes the edit list.
#
#   ~/projects/ShadowKit/.venv/bin/python fightcut.py <take> <video id>      then: python3 ~/projects/ShadowKit/make.py <id>
import json, os, sys, wave
import numpy as np

SR = 48000
HOLD = 4.6            # the results table stays up this long, under the end card
take, vid = sys.argv[1], sys.argv[2]
meta = json.load(open(f"clips/{take}/meta.json"))
fps, frames = meta["fps"], meta["frames"]
rng = np.random.default_rng(7)


# ---- the sounds ----
def t_(d): return np.arange(int(d * SR)) / SR
def dec(t, k): return np.exp(-t * k)
def noise(n): return rng.uniform(-1, 1, n)
def sweep(f0, f1, d):                       # a sine gliding from f0 to f1 (exponentially) over d seconds
    t = t_(d); f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def lowpass(x, fc):                         # one pole; fc may be a number or one value per sample
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a[i]) * x[i] + a[i] * acc; y[i] = acc
    return y
def highpass(x, fc): return x - lowpass(x, fc)
def pad(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n)
    for p in parts: out[:len(p)] += p
    return out

def thump(k=1.0):                           # a hit: a dropping low sine and a short smack of noise
    t = t_(0.28)
    body = sweep(150 * k, 55 * k, 0.28) * dec(t, 14)
    smack = lowpass(noise(len(t)), 2200) * dec(t, 70) * 1.6
    return 0.9 * body + smack
def tok(k=1.0):                             # a block leaving the stack: a wooden knock
    t = t_(0.09)
    return (np.sin(2 * np.pi * 820 * k * t) * dec(t, 60) + 0.5 * np.sin(2 * np.pi * 1730 * k * t) * dec(t, 110)) * 0.7
def crack():                                # the whip: a rising swish, then a snap
    t = t_(0.16)
    sw = lowpass(noise(len(t)), np.linspace(600, 5000, len(t))) * np.sin(np.pi * t / 0.16) ** 2 * 0.8
    snap = highpass(noise(int(0.04 * SR)), 1500) * dec(t_(0.04), 90) * 1.4
    return np.concatenate([sw, snap])
def zap():                                  # the beam: a buzzing, wobbling hum that swells and dies
    t = t_(1.0)
    f = 110 * (1 + 0.04 * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = (ph / np.pi % 2 - 1) * 0.6 + np.sign(np.sin(ph * 1.5)) * 0.25
    amp = np.minimum(1, t / 0.04) * np.clip((1.0 - t) / 0.4, 0, 1)
    return lowpass(saw + 0.3 * noise(len(t)), 2600) * amp * 1.2
def buzz():                                 # a correction: the wrong-answer buzzer
    t = t_(0.42)
    sq = np.sign(np.sin(2 * np.pi * 140 * t)) + 0.5 * np.sign(np.sin(2 * np.pi * 147 * t))
    return lowpass(sq, 1800) * np.minimum(1, t / 0.01) * np.clip((0.42 - t) / 0.06, 0, 1) * 0.45
def click():                                # a cursor: a mouse click, pressed and let go
    c = lambda: highpass(noise(int(0.012 * SR)), 2500) * dec(t_(0.012), 400) * 0.9
    return np.concatenate([c(), np.zeros(int(0.05 * SR)), c() * 0.7])
def inhale():                               # the inhale: rushing air, rising and filling
    t = t_(1.4)
    return lowpass(noise(len(t)), 300 + 2600 * (t / 1.4) ** 1.5) * np.sin(np.pi * np.minimum(1, t / 1.4)) ** 0.7 * 1.6
def glitch():                               # a takeover: a run of digital blips
    out = []
    for f in rng.choice([420, 640, 880, 1180, 1560], 7):
        tt = t_(0.035); out.append(np.sign(np.sin(2 * np.pi * f * tt)) * 0.3)
    return np.concatenate(out)
def crunch():                               # a compaction: a heavy press and crushed noise
    t = t_(0.45)
    low = sweep(90, 40, 0.45) * dec(t, 7)
    grit = np.round(lowpass(noise(len(t)), 1400) * 6) / 6 * dec(t, 12)
    return low + 0.8 * grit
def pew(k=1.0):                             # a ray: a light pew
    return sweep(1500 * k, 520 * k, 0.09) * dec(t_(0.09), 25) * 0.5
def swish():                                # a fling
    t = t_(0.22)
    return lowpass(noise(len(t)), np.linspace(900, 3800, len(t))) * np.sin(np.pi * t / 0.22) ** 2 * 0.9
def pop(k=1.0):                             # a dot
    return sweep(760 * k, 330 * k, 0.06) * dec(t_(0.06), 30) * 0.6
def ting():                                 # a parry: a bright metal ring
    t = t_(0.9)
    return sum(a * np.sin(2 * np.pi * f * t) * dec(t, d) for f, a, d in [(2093, 0.5, 5), (3340, 0.3, 7), (5230, 0.2, 10), (7410, 0.12, 14)])
def boom():                                 # a knockout
    t = t_(1.3)
    return sweep(85, 38, 1.3) * dec(t, 3.2) * 1.1 + lowpass(noise(len(t)), 500) * dec(t, 6) * 1.2
def fall():                                 # off the edge: a falling whistle, then a distant boom
    w = sweep(1700, 380, 0.7) * np.minimum(1, t_(0.7) / 0.05) * 0.25
    return np.concatenate([w, boom() * 0.7])
def drop():                                 # back for another life
    return sweep(480, 1150, 0.16) * dec(t_(0.16), 8) * 0.5
def hop(): return lowpass(noise(int(0.12 * SR)), 1600) * np.sin(np.pi * t_(0.12) / 0.12) ** 2 * 0.35
def land(k=1.0):
    t = t_(0.14)
    return sweep(110, 60, 0.14) * dec(t, 30) * 0.5 * k + lowpass(noise(len(t)), 900) * dec(t, 60) * 0.3 * k
def whoosh():
    t = t_(0.5)
    return lowpass(noise(len(t)), np.linspace(400, 2400, len(t))) * np.sin(np.pi * t / 0.5) ** 2 * 0.9
def bell(notes, d=1.6, step=0.0):           # struck bell partials, each note optionally later than the last
    out = np.zeros(int((d + step * len(notes)) * SR))
    for i, n in enumerate(notes):
        f = 440 * 2 ** ((n - 69) / 12); t = t_(d)
        s = sum(a * np.sin(2 * np.pi * f * m * t) * dec(t, k) for m, a, k in [(1, 0.6, 2.5), (2.01, 0.25, 4), (3.02, 0.12, 6)])
        at = int(i * step * SR); out[at:at + len(s)] += s
    return out * 0.5
def gong():                                 # "Fight!"
    t = t_(2.2)
    g = sum(a * np.sin(2 * np.pi * f * t) * dec(t, k) for f, a, k in [(98, 0.6, 1.4), (147.5, 0.35, 1.8), (196.6, 0.3, 2.2), (262, 0.2, 2.8), (311, 0.12, 3.5)])
    return g * np.minimum(1, t / 0.006) + np.concatenate([land(1.6), np.zeros(len(t) - len(land()))])
GESTURE = {
    'so': lambda: buzz() * 0.8,                                  # unimpressed
    'gpt': lambda: bell([76, 83], 1.0, 0.09) * 0.8,              # a bright two-note ding
    'claude': lambda: bell([67, 71, 74], 1.2, 0.06) * 0.7,       # a warm chord, rolled
}
MOVE = {   # moves that make a sound when used (block shots, rays, dots and cursors sound as each one flies)
    ('so', 'a2'): crack, ('so', 'a3'): zap, ('so', 'a4'): buzz,
    ('gpt', 'a2'): inhale, ('gpt', 'a3'): glitch, ('gpt', 'a4'): crunch,
    ('claude', 'a2'): swish,
}
SHOT = {'block': tok, 'rod': pew, 'dot': pop, 'cursor': lambda k=1: click()}

# ---- the match ----
result = next((i for i, f in enumerate(frames) if f.get("state", {}).get("result")), None)
if result is None: sys.exit(f"{take}: the match never reached its results table; record a longer take")
fight_end = result / fps + 1.4          # the table has slid in by then
total = fight_end + HOLD
if total * fps > len(frames): sys.exit(f"{take}: {len(frames) / fps:.1f} s recorded, needs {total:.1f} s")

track = np.zeros(int((total + 3) * SR))
def put(at, s, vol=1.0):
    i = int(at * SR); s = s[:len(track) - i]; track[i:i + len(s)] += s * vol
counts = {}
for i, fr in enumerate(frames[:int(total * fps)]):
    at = i / fps
    for ev in fr.get("state", {}).get("ev", []):
        name, kind = ev[0], ev[1] if len(ev) > 1 else ''
        k = float(rng.uniform(0.94, 1.06))          # a little pitch variety, so repeats don't sound stamped out
        counts[name] = counts.get(name, 0) + 1
        if name == 'vs-in': put(at, whoosh(), 0.7)
        elif name == 'gesture': put(at, GESTURE[kind](), 0.8)
        elif name == 'land': put(at, land(min(1.4, (ev[2] if len(ev) > 2 else 8) / 9)), 0.6)
        elif name == 'fight': put(at, gong(), 0.9)
        elif name == 'hit': put(at, thump(k), min(1.2, 0.35 + (ev[2] if len(ev) > 2 else 5) / 25))
        elif name == 'parry': put(at, ting(), 0.8)
        elif name == 'ko': put(at, boom(), 1.0)
        elif name == 'ringout': put(at, fall(), 0.9)
        elif name == 'drop': put(at, drop(), 0.8)
        elif name == 'jump': put(at, hop(), 0.5)
        elif name == 'shot' and ev[2] in SHOT: put(at, SHOT[ev[2]](k), 0.55)
        elif name == 'move' and (kind, ev[2]) in MOVE: put(at, MOVE[(kind, ev[2])](), 0.8)
    st, prev = fr.get("state", {}), frames[i - 1].get("state", {}) if i else {}
    if st.get("result") and not prev.get("result"): put(at, bell([72, 76, 79, 84], 2.0, 0.12), 0.8)
track = np.tanh(track[:int(total * SR)] * 0.9)        # gentle limiting where sounds pile up
D = f"videos/{vid}"; os.makedirs(D, exist_ok=True)
with wave.open(f"{D}/sfx_fight.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((track * 0.95 * 32767).astype(np.int16).tobytes())

who = sorted({f[0] for fr in frames[:10] for f in fr.get("state", {}).get("f", [])}, key=['so', 'gpt', 'claude'].index)
names = {'so': 'Stack Overflow', 'gpt': 'ChatGPT', 'claude': 'Claude'}
edl = f"""// {' vs '.join(names[k] for k in who)}: the whole CPU match, versus screen to results table, with no narration (take {take}).
// Written by fightcut.py, with the sound track sfx_fight.wav: run it again after re-recording the take.
({{
  style: 'ink',
  lines: [],               // no narration
  thumbnail: 2.6,          // the versus screen, every panel's line showing
  segments: [
    {{ dur: {fight_end:.3f}, sfx: [{{ type: 'fight', at: 0, vol: 1 }}], layers: [{{ type: 'clip', clip: '{take}', from: 0, ann: false }}] }},
    {{ dur: {HOLD}, layers: [{{ type: 'clip', clip: '{take}', from: {fight_end:.3f}, ann: false }}, {{ type: 'end', title: 'Bot Battle', credits: ['After a meme by NovaXCode'], link: 'mpts.ie/games/botbattle' }}] }},
  ],
}})
"""
open(f"{D}/edl.js", "w").write(edl)
print(f"{vid}: {total:.1f} s ({fight_end:.1f} s of match, then the table), sounds:", json.dumps(counts))
