#!/usr/bin/env python3
"""Synthesize the intro's music bed + SFX offline (stdlib only).

Writes assets/audio/mix-raw.wav (mono, 44.1 kHz). Run ffmpeg afterwards to
loudness-normalize it into assets/audio/mix.wav (see README note at the bottom).

Music: 120 BPM (0.5 s per beat) so every frame cut lands on a beat or half-beat.
SFX times are global seconds, taken from the frame timings in STORYBOARD.md and
the built compositions (frame starts: 0, 3, 7, 10, 13.5, 17, 20.5, 24, 27).
"""
import math
import random
import struct
import wave
from pathlib import Path

SR = 44100
DUR = 30.5
N = int(SR * DUR)
buf = [0.0] * N
rng = random.Random(7)  # fixed seed: the baked file is identical on every run

BEAT = 0.5


def idx(t):
    return max(0, min(N, int(t * SR)))


def add(start, samples, gain=1.0):
    i0 = idx(start)
    for k, s in enumerate(samples):
        i = i0 + k
        if i >= N:
            break
        buf[i] += s * gain


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------

def kick(amp=0.9):
    n = int(0.32 * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = 45 + 110 * math.exp(-t * 28)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 11) * amp)
    return out


def noise_burst(dur, decay, amp, hp=0.0, lp=1.0):
    """Noise with one-pole high-pass (hp 0..1) and low-pass (lp 0..1) shaping."""
    n = int(dur * SR)
    out, prev_in, hp_state, lp_state = [], 0.0, 0.0, 0.0
    for k in range(n):
        t = k / SR
        x = rng.uniform(-1, 1)
        hp_state = hp * (hp_state + x - prev_in) if hp else x
        prev_in = x
        lp_state += lp * (hp_state - lp_state)
        out.append(lp_state * math.exp(-t * decay) * amp)
    return out


def hat(amp=0.12):
    return noise_burst(0.05, 90, amp, hp=0.92)


def clap(amp=0.35):
    return noise_burst(0.18, 22, amp, hp=0.7, lp=0.5)


def tone(freq, dur, amp, attack=0.005, decay=6.0, harmonics=((1, 1.0),)):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / attack) * math.exp(-t * decay)
        s = sum(a * math.sin(2 * math.pi * freq * h * t) for h, a in harmonics)
        out.append(s * env * amp)
    return out


def bass_note(freq, dur, amp=0.32):
    # saw-ish: a few harmonics, plucky envelope
    return tone(freq, dur, amp, attack=0.004, decay=7.0,
                harmonics=((1, 1.0), (2, 0.45), (3, 0.22), (4, 0.1)))


def pad_chord(notes, dur, amp=0.05):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1.0, t / 0.6) * min(1.0, (dur - t) / 0.5)
        s = 0.0
        for m in notes:
            f = midi(m)
            s += math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2.003 * t)
        out.append(s * env * amp)
    return out


# ---------- SFX ----------

def whoosh(dur=0.45, amp=0.5, rising=True):
    n = int(dur * SR)
    out, lp_state = [], 0.0
    for k in range(n):
        p = k / n
        x = rng.uniform(-1, 1)
        cut = 0.02 + 0.5 * (p if rising else 1 - p)
        lp_state += cut * (x - lp_state)
        env = math.sin(math.pi * p) ** 2
        out.append(lp_state * env * amp)
    return out


def impact(amp=0.8):
    body = kick(amp)
    tail = noise_burst(0.5, 9, amp * 0.35, lp=0.15)
    return [a + (tail[i] if i < len(tail) else 0) for i, a in enumerate(body)]


def tick(amp=0.16):
    return noise_burst(0.012, 400, amp, hp=0.85)


def ding(freq=1568.0, amp=0.16):
    return tone(freq, 0.45, amp, attack=0.002, decay=9.0, harmonics=((1, 1.0), (2.0, 0.25), (3.0, 0.08)))


def pop(amp=0.22):
    n = int(0.06 * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = 950 - 4500 * t
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 55) * amp)
    return out


def riser(dur, amp=0.25):
    n = int(dur * SR)
    out, ph, lp_state = [], 0.0, 0.0
    for k in range(n):
        p = k / n
        f = 220 + 660 * p * p
        ph += 2 * math.pi * f / SR
        x = rng.uniform(-1, 1)
        lp_state += (0.02 + 0.4 * p) * (x - lp_state)
        out.append((0.5 * math.sin(ph) + lp_state) * p * p * amp)
    return out


def typing(start, end, rate=24):
    t, step = start, 1.0 / rate
    while t < end:
        add(t + rng.uniform(-0.006, 0.006), tick(0.12 + rng.uniform(0, 0.06)))
        t += step


# ---------- music arrangement ----------
# Am - F - C - G, one chord per bar (2 s). Bass roots in octave 2.
PROG = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]

def bar_chord(bar):
    return PROG[bar % 4]

total_beats = int(DUR / BEAT)
for b in range(total_beats):
    t = b * BEAT
    bar = b // 4
    root, chord = bar_chord(bar)
    if t >= 29.0:
        break
    # section intensities
    intro = t < 3.0
    build = 3.0 <= t < 7.0
    peak = 24.0 <= t < 27.0
    # kick: every beat (half-time in the intro)
    if not intro or b % 2 == 0:
        add(t, kick(0.75 if intro else 0.85))
    # hats on the off-beat 8th
    if not intro:
        add(t + BEAT / 2, hat(0.10))
    if peak:
        add(t + BEAT / 4, hat(0.06))
        add(t + 3 * BEAT / 4, hat(0.06))
    # clap on beats 2 and 4 (every beat in the peak)
    if (b % 4 in (1, 3) and t >= 7.0) or peak:
        add(t, clap(0.30))
    # bass: 8th-note pulses from the build onward
    if not intro:
        f = midi(root)
        add(t, bass_note(f, 0.24))
        add(t + BEAT / 2, bass_note(f * (2 if b % 2 else 1), 0.22, 0.26))
    # pad: one per bar
    if b % 4 == 0:
        add(t, pad_chord(chord, 2.0, 0.035 if intro else 0.05))

# Outro: final A minor chord rings out over the hold.
add(29.0, impact(0.7))
add(29.0, pad_chord([57, 60, 64, 69], 1.5, 0.07))
add(29.0, bass_note(midi(45), 1.4, 0.3))

# Riser into the drop at 7.0 (frame 3, the product intro).
add(5.6, riser(1.4, 0.28))

# ---------- SFX, synced to frames ----------
# Frame 1 — hook (0–3)
for i, w in enumerate([0.05, 0.13, 0.21, 0.29, 0.37]):
    add(w, pop(0.12))
typing(0.40, 0.70)
add(0.72, ding(1568, 0.14))
add(1.30, impact(0.7))
for d in (1.78, 1.93, 2.08):
    add(d, tick(0.2))

# Frame 2 — pain (3–7)
add(3.0, impact(0.45))
for k in range(14):
    add(3.4 + k * 0.155, pop(0.16 + 0.01 * k))
add(5.55, whoosh(0.6, 0.45, rising=False))
add(6.15, impact(0.9))

# Frame 3 — product intro (7–10)
add(6.8, whoosh(0.4, 0.55))
add(7.0, impact(0.95))
add(7.5, impact(0.5))
typing(7.9, 8.5, rate=26)
for w in (8.7, 8.82, 8.94, 9.06, 9.18):
    add(w, pop(0.08))

# Frame 4 — appship init (10–13.5)
add(9.8, whoosh(0.45, 0.45))
typing(10.62, 11.12)
for d in (11.3, 11.55, 11.8, 12.05):
    add(d, ding(1760, 0.11))
for d in (12.55, 12.67, 12.79, 12.91):
    add(d, tick(0.18))

# Frame 5 — questionnaire (13.5–17)
add(13.5, impact(0.5))
add(14.15, whoosh(0.4, 0.4))
for k in range(6):
    add(14.9 + k * 0.16, ding(1568 if k % 2 == 0 else 1319, 0.08))
add(16.0, pop(0.22))
add(16.12, pop(0.22))

# Frame 6 — appship doctor (17–20.5)
add(16.75, whoosh(0.45, 0.45))
typing(17.0, 17.55)
for k in range(5):
    add(17.6 + k * 0.25, tick(0.22))
add(18.1, tone(220, 0.25, 0.12, decay=10, harmonics=((1, 1.0), (1.5, 0.5))))  # the ✗ row
add(19.0, ding(2093, 0.16))
add(19.83, ding(1568, 0.14))
add(19.95, ding(2349, 0.1))

# Frame 7 — upload + submit (20.5–24)
add(20.5, impact(0.5))
typing(21.0, 21.5)
add(21.68, ding(1760, 0.11))
add(21.96, ding(1760, 0.11))
add(22.0, riser(0.5, 0.16))
typing(22.5, 23.0)
add(23.2, ding(1976, 0.12))
add(23.45, ding(2349, 0.12))

# Frame 8 — benefits staccato (24–27)
for k in range(5):
    add(24.0 + k * 0.6, impact(0.55))

# Frame 9 — CTA (27–30.5)
add(26.8, whoosh(0.4, 0.55))
add(27.0, impact(0.8))
typing(27.85, 28.9, rate=20)
add(28.95, ding(1568, 0.14))

# ---------- master: fade-out + soft clip ----------
fade_start = 29.6
for i in range(idx(fade_start), N):
    p = (i - idx(fade_start)) / (N - idx(fade_start))
    buf[i] *= (1 - p) ** 1.5

peak = max(abs(s) for s in buf) or 1.0
out = Path(__file__).resolve().parent.parent / "assets" / "audio" / "mix-raw.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for s in buf:
        v = math.tanh(1.2 * s / peak)  # gentle saturation keeps transients from clipping
        frames += struct.pack("<h", int(v * 30000))
    w.writeframes(bytes(frames))
print(f"wrote {out} ({DUR}s)")

# Normalize afterwards:
#   ffmpeg -y -i assets/audio/mix-raw.wav -af loudnorm=I=-14:TP=-1:LRA=11 -ar 44100 -ac 2 assets/audio/mix.wav
