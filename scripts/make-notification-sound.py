"""Build MinNabo's notification sound: assets/sounds/minnabo.wav

    python scripts/make-notification-sound.py

A neighbour at the door: two soft knocks, then a bright, friendly «pling» that rises.
Short (under a second) so it never gets in the way, and well under iOS's 30-second
limit for notification sounds. Standard library only – change the notes below and run
it again to get a new sound (then make a new app build: the sound is bundled).
"""
import math
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'sounds' / 'minnabo.wav'

# (start seconds, frequency Hz, length seconds, loudness 0–1)
KNOCKS = [(0.00, 190, 0.09, 0.55), (0.12, 205, 0.09, 0.50)]
# the «pling»: E6 then B6, each with a soft octave on top for a bell-like ring
PLINGS = [(0.26, 1318.5, 0.55, 0.45), (0.36, 1975.5, 0.70, 0.38)]
LENGTH = 1.1  # seconds, including the ring-out
PEAK = 0.70   # of full scale – loud enough to hear, never harsh


def knock(t, freq, dur):
    """A wooden tap: a low tone that dies in a few milliseconds, with a little click on top."""
    if t < 0 or t > dur:
        return 0.0
    body = math.sin(2 * math.pi * freq * t) * math.exp(-t * 55)
    click = math.sin(2 * math.pi * freq * 6.3 * t) * math.exp(-t * 260) * 0.35
    return body + click


def pling(t, freq, dur):
    """A soft bell: the note, an octave and a slightly inharmonic overtone, fading out."""
    if t < 0 or t > dur:
        return 0.0
    attack = min(1.0, t / 0.004)  # 4 ms fade-in so it never clicks
    decay = math.exp(-t * 6.5)
    tone = (math.sin(2 * math.pi * freq * t)
            + 0.30 * math.sin(2 * math.pi * freq * 2 * t) * math.exp(-t * 10)
            + 0.08 * math.sin(2 * math.pi * freq * 2.76 * t) * math.exp(-t * 18))
    return tone * attack * decay


def main():
    n = int(RATE * LENGTH)
    samples = []
    for i in range(n):
        t = i / RATE
        v = sum(knock(t - s, f, d) * a for s, f, d, a in KNOCKS)
        v += sum(pling(t - s, f, d) * a for s, f, d, a in PLINGS)
        samples.append(v)

    top = max(abs(v) for v in samples) or 1.0
    fade = int(RATE * 0.03)  # last 30 ms fade to silence
    frames = bytearray()
    for i, v in enumerate(samples):
        if i > n - fade:
            v *= (n - i) / fade
        frames += struct.pack('<h', int(v / top * PEAK * 32767))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(frames))
    print(f'Wrote {OUT} ({LENGTH:.1f} s)')


if __name__ == '__main__':
    main()
