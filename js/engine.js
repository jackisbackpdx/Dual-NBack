/* Pure game logic: round generation, scoring and the N ladder.
   No DOM, no audio — so it can be unit tested with `npm test`. */

/* Every number below was measured frame by frame / sample by sample off the
   source screen recording; see README "Timing" for the measurements. */
export const TIMING = {
  trial:      3000,   // stimulus onset to stimulus onset
  flashIn:     500,   // square ramps teal -> flash colour
  flashHold:   425,   // stays at the flash colour
  flashOut:   1075,   // ramps back to teal (ends 2000 ms into the trial)
  leadIn:     1800,   // game screen shown -> first stimulus
  endPause:   1500,   // last response window closes -> screen starts fading
  screenOut:   550,   // that fade
};
/* The answer button's 90 ms white -> grey is in css/app.css, where it belongs. */

export const VISUAL_POSITIONS = 8;   // 3x3 grid minus the middle
export const LETTER_COUNT     = 7;   // distinct letter sounds in the bank
export const MATCHES_PER_SENSE = 6;  // per round, per sense
export const ROUND_SCORED_TRIALS = 20;
export const DAILY_GOAL = 20;        // rounds per day, the classic protocol

export const trialsFor = (n) => ROUND_SCORED_TRIALS + n;

/* A sequence of `trials` symbols out of `alphabet` containing exactly
   `matches` positions where symbol[i] === symbol[i - n]. */
export function makeSequence(n, trials, alphabet, matches, rand = Math.random) {
  const candidates = [];
  for (let i = n; i < trials; i++) candidates.push(i);
  // Fisher-Yates over the candidate indices, then take the first `matches`.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const isMatch = new Set(candidates.slice(0, Math.min(matches, candidates.length)));

  const seq = [];
  for (let i = 0; i < trials; i++) {
    if (isMatch.has(i)) {
      seq.push(seq[i - n]);
    } else if (i >= n) {
      // anything but a repeat, so the match count stays exact
      let v = Math.floor(rand() * (alphabet - 1));
      if (v >= seq[i - n]) v++;
      seq.push(v);
    } else {
      seq.push(Math.floor(rand() * alphabet));
    }
  }
  return seq;
}

export function makeRound(n, rand = Math.random) {
  const trials = trialsFor(n);
  return {
    n,
    trials,
    positions: makeSequence(n, trials, VISUAL_POSITIONS, MATCHES_PER_SENSE, rand),
    letters:   makeSequence(n, trials, LETTER_COUNT,     MATCHES_PER_SENSE, rand),
  };
}

export const isMatchAt = (seq, i, n) => i >= n && seq[i] === seq[i - n];

/* `pressed` is an array of booleans, one per trial. */
function tally(seq, n, pressed) {
  const r = { hits: 0, misses: 0, false: 0 };
  for (let i = 0; i < seq.length; i++) {
    const match = isMatchAt(seq, i, n);
    const press = !!pressed[i];
    if (match && press) r.hits++;
    else if (match) r.misses++;
    else if (press) r.false++;
  }
  r.mistakes = r.misses + r.false;
  return r;
}

export function scoreRound(round, responses) {
  return {
    n: round.n,
    visual: tally(round.positions, round.n, responses.visual),
    audio:  tally(round.letters,   round.n, responses.audio),
  };
}

/* The ladder, straight out of the app's help text: up when each sense stayed
   under three mistakes, down when the round cost more than five in total. */
export function nextN(n, score) {
  const total = score.visual.mistakes + score.audio.mistakes;
  if (score.visual.mistakes < 3 && score.audio.mistakes < 3) return n + 1;
  if (total > 5) return Math.max(1, n - 1);
  return n;
}

/* Where the square should sit on the teal -> flash -> teal ramp,
   `ms` into its trial. Linear in sRGB, like the original. */
export function flashAlpha(ms) {
  const { flashIn, flashHold, flashOut } = TIMING;
  if (ms < 0) return 0;
  if (ms < flashIn) return ms / flashIn;
  if (ms < flashIn + flashHold) return 1;
  if (ms < flashIn + flashHold + flashOut) return 1 - (ms - flashIn - flashHold) / flashOut;
  return 0;
}
