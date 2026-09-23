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

/* ── signal detection ─────────────────────────────────────────
   d′ (d-prime) separates how well matches are told apart from non-matches
   from how readily the button gets pressed at all: z(hit rate) − z(false
   alarm rate). Rates of exactly 0 or 1 would put z at infinity, so both are
   log-linear corrected (Hautus 1995): add 0.5 to each count, 1 to each total. */

/** Inverse of the standard normal CDF (Acklam's rational approximation). */
export function invNorm(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
    138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -invNorm(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** d′ from raw counts. `trials` is every trial the sense was shown. */
export function dPrime(hits, misses, falseAlarms, trials) {
  const signal = hits + misses;
  const noise = Math.max(0, trials - signal);
  const hitRate = (hits + 0.5) / (signal + 1);
  const faRate = (falseAlarms + 0.5) / (noise + 1);
  return invNorm(hitRate) - invNorm(faRate);
}

/** One round's d′ per sense and combined (both senses pooled). */
export function roundDPrime(score, trials) {
  const v = score.visual;
  const a = score.audio;
  return {
    visual: dPrime(v.hits, v.misses, v.false, trials),
    audio: dPrime(a.hits, a.misses, a.false, trials),
    both: dPrime(v.hits + a.hits, v.misses + a.misses, v.false + a.false, trials * 2),
  };
}

/** Share of the round's decisions that were right answers to a match:
    hits over hits + misses + false presses, both senses together. */
export function roundAccuracy(score) {
  const hits = score.visual.hits + score.audio.hits;
  const wrong = score.visual.mistakes + score.audio.mistakes;
  return hits + wrong ? hits / (hits + wrong) : 0;
}

/* ── fatigue ──────────────────────────────────────────────────
   Post-stroke fatigue lands abruptly. Given the session's round accuracies in
   order, flag a break when the last two rounds both fall at least `drop`
   below the session's own level before them. The level before is the mean of
   the earlier rounds, so one good round can't set an impossible bar and one
   bad round alone never trips it. */
export const FATIGUE_DROP = 0.3;

export function fatigueCheck(accuracies, drop = FATIGUE_DROP) {
  if (accuracies.length < 3) return null;
  const earlier = accuracies.slice(0, -2);
  const baseline = earlier.reduce((s, v) => s + v, 0) / earlier.length;
  const recent = accuracies.slice(-2);
  if (recent.every((v) => baseline - v >= drop)) return { baseline, recent };
  return null;
}

/** Standard deviation, the spread used for consistency. */
export function spread(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}
