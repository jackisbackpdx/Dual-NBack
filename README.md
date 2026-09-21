# Dual N-Back

A clone of the Dual N-Back mobile app from the supplied screen recording — same
voice, same clock, same animations. It runs as a plain web app: no build step,
no dependencies, no network.

```bash
npm start     # serves on http://localhost:8000
npm test      # unit tests for the game logic
```

Open it on a phone (or a phone-sized window) and press play. Add it to the home
screen and it installs as a standalone app; a service worker keeps it playable
offline.

---

## What was matched, and how

Everything below was measured off the recording rather than guessed at — the
video was decoded frame by frame and the audio track sample by sample.

### The voice

The letter sounds **are** the original's. `tools/extract_assets.py` demuxes the
recording's audio, finds the 24 utterances of the recorded round, groups them
into distinct letters by comparing log-mel spectrograms, trims one exemplar of
each and writes `assets/sounds/letter-*.wav`.

The grouping is unambiguous — two clips of the same letter score a spectral
distance under 0.12, two different letters never below 0.45 — and it comes out
at **seven distinct letters** across the 24 trials. The button tap
(`tap.wav`) and the chime that plays when N changes (`level.wav`) were pulled
out of the same track.

All seven letters are written with one shared gain, so their relative loudness
is exactly what the recording had. The files are 32 kHz mono WAV: the source
is band-limited to ~12.7 kHz, and uncompressed audio avoids the leading
silence an MP3 decoder would add — the letter has to land on the same
millisecond as the square.

The letters are referenced by index, not by name. Which seven letters of the
alphabet they are is not something the recording can settle, and the app never
shows them, so nothing pretends to know.

### The clock

| | measured | in `js/engine.js` |
|---|---|---|
| stimulus onset → next onset | 3.0003 s mean over 23 gaps | `trial: 3000` |
| square ramps teal → purple | 492 ms | `flashIn: 500` |
| holds at full colour | 435 ms | `flashHold: 425` |
| ramps back to teal | 1067 ms | `flashOut: 1075` |
| game screen shown → first stimulus | ~1.8 s | `leadIn: 1800` |
| last response window closes → fade | ~1.5 s | `endPause: 1500` |
| that fade | ~500 ms | `screenOut: 550` |

The ramp is linear in sRGB between `#18a998` and `#7e4bb0`, which is what the
frame-by-frame colour samples show (alpha rises 0.05 → 1.00 dead straight over
fifteen frames). The whole flash is over 2.0 s into a 3.0 s trial.

Timing is driven off the Web Audio clock, not `setTimeout`: the 21 letters of
a round are scheduled up front at `t0 + k × 3.000 s`, and the flash is painted
from that same clock each frame. A round measured in a browser reproduces
3.0000 s between letters with no drift.

### Pressing

- One answer per sense per trial. The button greys to `#c1c1c1` over ~90 ms,
  takes a ripple from the touch point, and stays disabled until the next
  stimulus — all measured off the button pixels in the recording.
- The window is the **whole 3 s trial**. The recording has presses landing
  2.7 s after a stimulus that still counted for it.
- A press during the lead-in counts for trial 0 (where nothing can match, so it
  is a false alarm — the same as pressing during trial 0 itself).
- The tap sound fires on pointer-down. In the recording it trails the button's
  own highlight by ~200 ms, which is a finger's down-to-up time plus the
  recorder's audio lag, not a deliberate delay.

### Scoring and the N ladder

Straight from the app's help text, and verified against the recorded round:

- a round is **20 + N** trials, with **6 matches per sense**;
- N goes **up** when each sense collected fewer than three mistakes;
- N goes **down** when the round cost more than five mistakes in total;
- otherwise N stays, and it never drops below 1.

The last test in `test/engine.test.js` replays the recorded round — the 24
square positions read off the video, the letter groups off the audio, and the
button presses timed from the same frames — and reproduces the score sheet the
app showed: eye 6 / 0 / 2, ear 4 / 2 / 5, and N dropping from 4 to 3.

### The end-of-round sequence

The game screen dissolves, the old N drifts into the middle of an empty screen,
ticks over to the new N with the chime, flies up into the app bar, and the
score card, ring, play button, footer and bar arrive behind it in that order.
The beats in `js/results.js` are the ones timed off the recording.

### Colours and layout

| | |
|---|---|
| teal | `#18a998` |
| flash | `#7e4bb0` |
| background | `#faf5f8` |
| pressed button | `#c1c1c1` |
| mistake red | `#e5282a` |
| ring track | `#cac9cb` |

The grid is 93.1 % of the screen wide with 0.3 % gaps and rounded outer
corners; the answer buttons are 46 % wide and 9.3 % of the body tall; the
progress ring is 51.6 % of the screen across with a 5.6 % stroke. All of it
came off the full-resolution frames.

---

## What is not from the recording

- **The letter names**, as above — the sounds are real, the labels would be a
  guess, so there are none.
- **The two buttons at the top of the help screen.** The recording never shows
  what they do, so here they play a short worked example — a 2-back position
  match, and a 2-back sound match.
- **The `DAILY FIRST N` options.** The setting exists in the original with
  `ALWAYS 1` selected; the other two choices here (carry the last level over,
  or start from the last day's average) are a reasonable reading of the name.
- **`BUY PREMIUM`.** Kept for the layout, but it sells nothing — it opens a
  dialog saying so. There is no account, no cloud, no ads; everything lives in
  `localStorage` on the device.
- **Dark mode.** The original has an appearance setting; the recording is all
  light, so the dark palette is this clone's own.

## Layout of the repo

```
index.html              every screen, toggled by class
css/app.css             the whole design, colours as custom properties
js/engine.js            round generation, scoring, the N ladder, timings  (pure)
js/game.js              the round: audio-clock scheduling and the flash
js/results.js           end-of-round choreography and the score card
js/audio.js             sound bank + Web Audio scheduler
js/store.js             settings and per-day history in localStorage
js/stats.js             average-N-per-day chart with its trend line
js/ui.js                screens, drawer, dialog, ring, ripple
js/icons.js             the icon set, drawn inline
tools/extract_assets.py rebuilds the sound bank from the recording
test/engine.test.js     unit tests, including the recorded round
```
