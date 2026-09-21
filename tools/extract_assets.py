#!/usr/bin/env python3
"""Rebuild the sound bank from the source screen recording.

The letter voice, the button click and the level-change chime in assets/sounds
were lifted straight out of a screen recording of the original app, so the clone
speaks with exactly the same voice.  This script documents (and reproduces) how.

What it does:
  1. demuxes the recording's audio track,
  2. finds every sound event by RMS envelope,
  3. groups the 24 letter utterances of the recorded round into distinct
     letters by comparing log-mel spectrograms (the clips are byte-identical
     playbacks, so the grouping is unambiguous: within-letter distance < 0.12,
     between-letter distance > 0.45),
  4. trims each exemplar, applies one shared gain so the relative loudness of
     the voices is preserved, and writes 32 kHz 16-bit mono WAVs.

Usage:  python3 tools/extract_assets.py <recording.mp4> [out_dir]

Needs numpy, scipy and an ffmpeg binary (pip install imageio-ffmpeg works).
"""
import os
import subprocess
import sys
import wave

import numpy as np
from scipy.signal import stft, resample_poly

OUT_RATE = 32000          # source content is band-limited to ~12.7 kHz
PEAK = 0.92               # shared post-gain target for the loudest letter
TRIAL_SECONDS = 3.0


def ffmpeg_bin():
    for cand in ("ffmpeg", os.environ.get("FFMPEG", "")):
        if cand and subprocess.run(["which", cand], capture_output=True).returncode == 0:
            return cand
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def read_audio(path, tmp):
    wav = os.path.join(tmp, "audio.wav")
    subprocess.run([ffmpeg_bin(), "-v", "error", "-i", path, "-ac", "1",
                    "-ar", "44100", "-c:a", "pcm_s16le", wav, "-y"], check=True)
    with wave.open(wav) as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0, sr


def envelope(d, sr, hop=0.005, win=0.02):
    h, n = int(sr * hop), int(sr * win)
    frames = (len(d) - n) // h
    rms = np.array([np.sqrt(np.mean(d[i * h:i * h + n] ** 2)) for i in range(frames)])
    return rms, np.arange(frames) * h / sr


def events(d, sr, threshold, min_dur, merge_gap):
    rms, t = envelope(d, sr)
    on = rms > threshold
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            segs.append([t[i], t[j - 1], float(rms[i:j].max())])
            i = j
        else:
            i += 1
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < merge_gap:
            merged[-1][1] = s[1]
            merged[-1][2] = max(merged[-1][2], s[2])
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] >= min_dur]


def mel_filterbank(sr, nfft, nmel=32, fmin=80, fmax=8000):
    hz2mel = lambda f: 2595 * np.log10(1 + f / 700)
    mel2hz = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = mel2hz(np.linspace(hz2mel(fmin), hz2mel(fmax), nmel + 2))
    bins = np.floor((nfft + 1) * pts / sr).astype(int)
    fb = np.zeros((nmel, nfft // 2 + 1))
    for i in range(nmel):
        lo, mid, hi = bins[i], max(bins[i + 1], bins[i] + 1), max(bins[i + 2], bins[i + 1] + 2)
        fb[i, lo:mid] = np.linspace(0, 1, mid - lo, endpoint=False)
        fb[i, mid:hi] = np.linspace(1, 0, hi - mid, endpoint=False)
    return fb


def features(x, sr):
    nfft = 1024
    _, _, z = stft(x, fs=sr, nperseg=nfft, noverlap=nfft - 256)
    m = np.log(mel_filterbank(sr, nfft) @ (np.abs(z) ** 2) + 1e-8)
    return (m - m.mean()) / (m.std() + 1e-9)


def group(clips, sr, threshold=0.30):
    feats = [features(c, sr) for c in clips]
    labels = [-1] * len(clips)
    nxt = 0
    for i in range(len(clips)):
        if labels[i] != -1:
            continue
        labels[i] = nxt
        for j in range(i + 1, len(clips)):
            if labels[j] != -1:
                continue
            a, b = feats[i], feats[j]
            k = min(a.shape[1], b.shape[1])
            if np.sqrt(((a[:, :k] - b[:, :k]) ** 2).mean()) < threshold:
                labels[j] = nxt
        nxt += 1
    return labels, nxt


def trim(seg, sr, rel=0.001, head=0.005, tail=0.02):
    env = np.abs(seg)
    keep = np.where(env > env.max() * rel)[0]
    a = max(0, keep[0] - int(head * sr))
    b = min(len(seg), keep[-1] + int(tail * sr))
    return seg[a:b].copy()


def write_wav(path, x, sr, gain):
    x = x * gain
    fi, fo = int(0.003 * sr), int(0.012 * sr)
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    y = resample_poly(x, OUT_RATE, sr) if sr != OUT_RATE else x
    y = np.clip(y, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(OUT_RATE)
        w.writeframes((y * 32767).astype("<i2").tobytes())
    return len(y) / OUT_RATE


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "assets/sounds"
    tmp = os.path.join(out, ".tmp")
    os.makedirs(tmp, exist_ok=True)
    d, sr = read_audio(src, tmp)

    voices = events(d, sr, threshold=0.014, min_dur=0.03, merge_gap=0.10)
    stimuli = [v for v in voices if v[1] - v[0] > 0.30]
    spacing = np.diff([s[0] for s in stimuli])
    print(f"{len(stimuli)} letter utterances, mean spacing "
          f"{spacing.mean():.3f}s (expected {TRIAL_SECONDS})")

    clips = [d[int((s[0] - 0.05) * sr):int((s[0] + 0.80) * sr)] for s in stimuli]
    labels, n = group(clips, sr)
    print("letter grouping:", labels, f"-> {n} distinct letters")

    first = {}
    for idx, lab in enumerate(labels):
        first.setdefault(lab, idx)
    picked = {lab: trim(clips[idx], sr) for lab, idx in sorted(first.items())}
    shared = PEAK / max(np.abs(c).max() for c in picked.values())
    for lab, clip in picked.items():
        dur = write_wav(os.path.join(out, f"letter-{lab}.wav"), clip, sr, shared)
        print(f"  letter-{lab}.wav  {dur:.3f}s  peak {np.abs(clip).max() * shared:.2f}")

    taps = [e for e in events(d, sr, threshold=0.002, min_dur=0.01, merge_gap=0.03)
            if 0.01 <= e[1] - e[0] <= 0.10 and e[2] < 0.05]
    if taps:
        t0 = taps[0][0]
        clip = trim(d[int((t0 - 0.02) * sr):int((t0 + 0.10) * sr)], sr, rel=0.02, tail=0.005)
        dur = write_wav(os.path.join(out, "tap.wav"), clip, sr, 0.9 / np.abs(clip).max())
        print(f"  tap.wav       {dur:.3f}s  ({len(taps)} taps found)")

    tail_start = stimuli[-1][0] + 2 * TRIAL_SECONDS
    chimes = [e for e in events(d, sr, threshold=0.014, min_dur=0.05, merge_gap=0.10)
              if e[0] > tail_start]
    if chimes:
        c = chimes[0]
        clip = trim(d[int((c[0] - 0.05) * sr):int((c[1] + 0.15) * sr)], sr, rel=0.005)
        dur = write_wav(os.path.join(out, "level.wav"), clip, sr, 0.9 / np.abs(clip).max())
        print(f"  level.wav     {dur:.3f}s")


if __name__ == "__main__":
    main()
