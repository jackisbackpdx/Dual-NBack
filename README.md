# Dual N-Back

A clone of the Dual N-Back mobile app from the supplied screen recording — same
voice, same clock, same animations. It runs as a plain web app: no build step,
no dependencies, no network.

## Running it

In the repo, on `main`:

```bash
git pull
npm start     # http://localhost:8000
npm test      # the engine tests
```

There is no `npm install` step — the app has no dependencies, so an absent
`node_modules` is not a mistake. `npm start` needs Node 18 or newer (`node -v`;
`brew install node` on macOS). Without Node, `python3 -m http.server 8000`
serves it just as well.

**Don't open `index.html` by double-clicking it.** Over `file://` the browser
blocks ES modules and the `fetch` of the sound files, so the app comes up silent
and empty. It has to be served.

A few things worth knowing once it is up:

- On a desktop or tablet the app draws itself as a centred window rather than
  stretching, so it keeps the proportions it was measured from. Turn a phone
  sideways and the answer buttons move to the flanks, either side of the board.
- With a keyboard, **A** answers the squares and **L** answers the sounds —
  they are separate keys, so holding one while striking the other answers both
  in the same trial. The letters are printed faintly on the buttons.
- Open it in Chrome or Safari rather than an editor's built-in preview pane —
  those run in a webview that can refuse to start the audio, and the voice is
  the point.
- The first press of play unlocks the sound; browsers hold the audio context
  shut until a real gesture.
- `Ctrl-C` stops the server.
- The app installs a service worker so it plays offline. Code is fetched from
  the network first and only falls back to the cache, so a `git pull` always
  shows up on the next reload; only the sounds are served from the cache
  permanently.

To play it on the phone it was cloned from, the server already listens on every
interface: `ipconfig getifaddr en0` gives your Mac's address on the network, and
`http://<that>:8000` opens on a phone on the same Wi-Fi. It runs there, but it
won't *install* — Add to Home Screen and the service worker need HTTPS or
`localhost`.

In VS Code, `Cmd-Shift-B` runs the server and `Tasks: Run Test Task` runs the
tests; both are wired up in `.vscode/tasks.json`.

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

Straight from the app's help text — which the clone now carries in full, so the
rules on screen and the rules in `js/engine.js` are the same sentences — and
verified against the recorded round:

- a round is **20 + N** trials, with **6 matches per sense**;
- a position and a sound can match on the same trial, and then both buttons
  are due before the next pair;
- N goes **up** when each sense collected fewer than three mistakes;
- N goes **down** when the round cost more than five mistakes in total;
- otherwise N stays, and it never drops below 1.

The last test in `test/engine.test.js` replays the recorded round — the 24
square positions read off the video, the letter groups off the audio, and the
button presses timed from the same frames — and reproduces the score sheet the
app showed: eye 6 / 0 / 2, ear 4 / 2 / 5, and N dropping from 4 to 3.

### Statistics

The teal average-N chart is the original's, down to the trend line. Everything
under it is this clone's, and answers what the original leaves out: how hard
you are playing, how consistently, and which sense is costing you the level.

- Four tiles — best N, the 7-day average N, the share of matches you caught,
  and the day streak. Single numbers stay numbers; they are not charts.
- **ROUNDS A DAY**, bars against the twenty the help text recommends, so a
  light week is visible at a glance.
- **MATCHES CAUGHT**, split eye against ear, each with its own icon so the two
  never rest on colour alone, plus how many presses a round land on nothing.
- A few sentences that read the numbers back: which way the trend is going,
  which sense is behind, and how the week compares with 20 rounds 4–5 days.

The chart card is a shade darker than the app's teal (`#0d8375`), which takes
white axis labels from 2.9:1 to 4.6:1 against it. The trend line is dashed as
well as red, so it still reads as the second series without depending on
red-against-teal.

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
corners; the answer pair is 2.25 % wider than the grid and 18.5 % of its width
tall; the progress ring is 51.6 % of the screen across with a 5.6 % stroke. All
of it came off the full-resolution frames, and every layout is driven from one
board width, so those ratios hold on a phone, a tablet and a desktop alike.

---

## What is not from the recording

- **The letter names**, as above — the sounds are real, the labels would be a
  guess, so there are none.
- **The two buttons at the top of the help screen.** The recording never shows
  what they do, so here they play a short worked example — a 2-back position
  match, and a 2-back sound match.
- **The help screen's second tab.** The original splits help into THE SCIENCE
  and FAQ. Every word of THE SCIENCE is here, transcribed from a recording of
  it; the FAQ tab was never shown, so there is no tab bar and nothing invented
  to fill it. The CUSTOMER SUPPORT link at the top is gone too — this clone has
  no inbox to send you to.
- **What the tutorial buttons do.** The original's DUAL 1-BACK TUTORIAL and
  DUAL 2-BACK TUTORIAL were never opened on camera. Here they walk a freshly
  generated sequence at the game's own three-second tempo, calling out each
  match as it lands. The second one is a level picker: its label opens a menu
  of Dual 1- through 5-Back and the button on its right runs the one selected,
  in the same panel.
- **The paywall.** The original sells cloud saving and ad removal from the
  results and settings screens. This clone is free and has nothing to sell, so
  those are gone entirely: no account, no cloud, no ads, no purchase surface.
  Everything lives in `localStorage` on the device.
- **The dropdowns.** Rendered by `js/select.js` rather than the browser's own
  `<select>` popup, so the menu is anchored under its trigger and styled to
  match on every platform. The native element stays in the DOM holding the
  value, so the page still works if the script does not.
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
js/store.js             settings, per-day history and the derived metrics
js/stats.js             average-N-per-day chart with its trend line
js/ui.js                screens, drawer, dialog, ring, ripple
js/select.js            the dropdown used in place of every native select
js/icons.js             the icon set, drawn inline
tools/extract_assets.py rebuilds the sound bank from the recording
test/engine.test.js     unit tests, including the recorded round
```
