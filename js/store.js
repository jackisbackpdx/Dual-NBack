/* Settings and training history, kept in localStorage. */

import { dPrime, roundDPrime, roundAccuracy, spread } from './engine.js';

const KEY = 'dual-n-back/v1';

const DEFAULTS = {
  settings: {
    firstN: 'always1', theme: 'system', tapSounds: true,
    goal: 'time',         // what ends a session: 'time' | 'rounds'
    minutes: '15',        // time-based session length: '10' ... '30', in fives
    roundGoal: '20',      // round-based session length: '5' | '10' | '15' | '20'
    rest: 'off',          // rehab rest between rounds: 'off' | '45' (seconds)
    fatigue: 'off',       // fatigue detection: 'off' | 'on'
    hand: 'both',         // answer buttons: 'both' | 'left' | 'right'
  },
  n: 1,
  best: 1,            // highest N ever reached
  day: '',            // day the counters below belong to
  roundsToday: 0,
  history: {},        // 'YYYY-MM-DD' -> see blankDay()
  log: [],            // the most recent rounds, one entry each — see finishRound()
  rehab: { restUntil: 0, reason: '', fatigueAt: 0 },   // epoch ms
  session: { start: 0, rounds: 0, day: '', announced: false },  // the running session
};

const LOG_MAX = 1000;

const blankDay = () => ({
  rounds: 0, nSum: 0, bestN: 0, trials: 0, seconds: 0,
  vHit: 0, vMiss: 0, vFalse: 0, aHit: 0, aMiss: 0, aFalse: 0,
});

/** One round's wall-clock cost: the trials plus the lead-in and the pause. */
const roundSeconds = (n) => (ROUND_TRIALS + n) * 3 + 3.3;
const ROUND_TRIALS = 20;

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

class Store {
  constructor() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* first run */ }
    this.state = {
      ...DEFAULTS, ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}) },
      history: saved.history || {},
      log: saved.log || [],
      rehab: { ...DEFAULTS.rehab, ...(saved.rehab || {}) },
      session: { ...DEFAULTS.session, ...(saved.session || {}) },
    };
    // Rehab mode used to carry its own 15 or 20 minute session; session length is
    // a setting of its own now, and rehab mode is just the rest between rounds.
    // Sessions top out at 30 minutes; a longer saved length comes down to it.
    if (Number(this.state.settings.minutes) > 30) { this.state.settings.minutes = '30'; this.save(); }
    const old = this.state.settings.session;
    if (old !== undefined) {
      if (old !== 'off') Object.assign(this.state.settings, { rest: '45', goal: 'time', minutes: old });
      delete this.state.settings.session;
      delete this.state.rehab.start;
      this.save();
    }
    this.rollDay();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* private mode */ }
  }

  get settings() { return this.state.settings; }
  get n() { return this.state.n; }
  get roundsToday() { return this.state.roundsToday; }

  set(key, value) { this.state.settings[key] = value; this.save(); }

  /** Start of a new day: reset the counter and pick the day's first N. */
  rollDay() {
    const t = today();
    if (this.state.day === t) return false;
    this.state.day = t;
    this.state.roundsToday = 0;
    this.state.n = this.firstNForNewDay();
    this.save();
    return true;
  }

  /** The three modes the app's help text describes. */
  firstNForNewDay() {
    const mode = this.state.settings.firstN;
    if (mode === 'last') return Math.max(1, this.state.n || 1);
    if (mode === 'best') return Math.max(1, this.state.best || 1);
    return 1;
  }

  /** Book a finished round: `n` is the level that was just played. */
  finishRound(n, nextN, score) {
    this.rollDay();
    const t = this.state.day;
    const d = Object.assign(blankDay(), this.state.history[t]);
    this.state.history[t] = d;
    d.rounds++;
    d.nSum += n;
    d.bestN = Math.max(d.bestN, n);
    d.trials += ROUND_TRIALS + n;
    d.seconds += roundSeconds(n);
    if (score) {
      d.vHit += score.visual.hits; d.vMiss += score.visual.misses; d.vFalse += score.visual.false;
      d.aHit += score.audio.hits;  d.aMiss += score.audio.misses;  d.aFalse += score.audio.false;
    }
    this.state.log.push({
      day: t, at: Date.now(), n,
      v: score ? [score.visual.hits, score.visual.misses, score.visual.false] : [0, 0, 0],
      a: score ? [score.audio.hits, score.audio.misses, score.audio.false] : [0, 0, 0],
    });
    if (this.state.log.length > LOG_MAX) this.state.log.splice(0, this.state.log.length - LOG_MAX);
    this.state.roundsToday++;
    this.state.best = Math.max(this.state.best || 1, n, nextN);
    this.state.n = nextN;
    this.save();
  }

  get rehab() { return this.state.rehab; }
  setRehab(patch) { Object.assign(this.state.rehab, patch); this.save(); }
  get session() { return this.state.session; }
  setSession(patch) { Object.assign(this.state.session, patch); this.save(); }

  /** Logged rounds as score sheets, oldest first; `since` is epoch ms. */
  rounds(since = 0) {
    const sheet = ([hits, misses, f]) => ({ hits, misses, false: f, mistakes: misses + f });
    return this.state.log.filter((r) => r.at >= since).map((r) => {
      const score = { visual: sheet(r.v), audio: sheet(r.a) };
      const trials = ROUND_TRIALS + r.n;
      return { ...r, score, trials, accuracy: roundAccuracy(score), d: roundDPrime(score, trials) };
    });
  }

  /** Chronological per-day rows for the statistics screen. */
  series() {
    return Object.keys(this.state.history).sort().map((day) => {
      const d = Object.assign(blankDay(), this.state.history[day]);
      return {
        day, ...d,
        avgN: d.rounds ? d.nSum / d.rounds : 0,
        hits: d.vHit + d.aHit,
        misses: d.vMiss + d.aMiss,
        falses: d.vFalse + d.aFalse,
        // d′ per sense; every trial of the day was shown to both senses
        dEye: dPrime(d.vHit, d.vMiss, d.vFalse, d.trials),
        dEar: dPrime(d.aHit, d.aMiss, d.aFalse, d.trials),
        dBoth: dPrime(d.vHit + d.aHit, d.vMiss + d.aMiss, d.vFalse + d.aFalse, d.trials * 2),
      };
    });
  }

  /** How many days in a row, counting back from today (or yesterday). */
  streak() {
    const days = new Set(Object.keys(this.state.history)
      .filter((d) => this.state.history[d].rounds > 0));
    if (!days.size) return 0;
    const cursor = new Date();
    if (!days.has(today(cursor))) cursor.setDate(cursor.getDate() - 1);
    let n = 0;
    while (days.has(today(cursor))) { n++; cursor.setDate(cursor.getDate() - 1); }
    return n;
  }

  /** Everything the statistics screen puts in a tile or a sentence. */
  metrics() {
    const rows = this.series().filter((d) => d.rounds > 0);
    if (!rows.length) return null;
    const sum = (list, key) => list.reduce((a, d) => a + d[key], 0);
    const mean = (list) => (list.length
      ? list.reduce((a, d) => a + d.avgN * d.rounds, 0) / sum(list, 'rounds') : 0);
    const last7 = rows.slice(-7);
    const prev7 = rows.slice(-14, -7);
    const caught = (h, m) => (h + m ? h / (h + m) : 0);
    const pooled = (list) => dPrime(sum(list, 'hits'), sum(list, 'misses'), sum(list, 'falses'),
      sum(list, 'trials') * 2);
    // Consistency: how far round-to-round d′ wanders over the last twenty rounds.
    // Days stand in for rounds when the history predates the round log.
    const recent = this.rounds().slice(-20).map((r) => r.d.both);
    const consistency = recent.length >= 3
      ? { spread: spread(recent), count: recent.length, unit: 'rounds' }
      : rows.length >= 3
        ? { spread: spread(rows.slice(-7).map((d) => d.dBoth)), count: Math.min(rows.length, 7), unit: 'days' }
        : null;
    return {
      rows,
      days: rows.length,
      best: this.state.best || Math.max(...rows.map((d) => d.bestN || 0), 1),
      rounds: sum(rows, 'rounds'),
      minutes: Math.round(sum(rows, 'seconds') / 60),
      avg7: mean(last7),
      avgPrev7: mean(prev7),
      roundsPerDay7: last7.length ? sum(last7, 'rounds') / last7.length : 0,
      accuracy: caught(sum(rows, 'hits'), sum(rows, 'misses')),
      eyeAccuracy: caught(sum(rows, 'vHit'), sum(rows, 'vMiss')),
      earAccuracy: caught(sum(rows, 'aHit'), sum(rows, 'aMiss')),
      falsePerRound: sum(rows, 'rounds') ? sum(rows, 'falses') / sum(rows, 'rounds') : 0,
      eyeMissPerRound: sum(rows, 'rounds') ? sum(rows, 'vMiss') / sum(rows, 'rounds') : 0,
      earMissPerRound: sum(rows, 'rounds') ? sum(rows, 'aMiss') / sum(rows, 'rounds') : 0,
      streak: this.streak(),
      d7: pooled(last7),
      dPrev7: prev7.length ? pooled(prev7) : null,
      dEye: dPrime(sum(rows, 'vHit'), sum(rows, 'vMiss'), sum(rows, 'vFalse'), sum(rows, 'trials')),
      dEar: dPrime(sum(rows, 'aHit'), sum(rows, 'aMiss'), sum(rows, 'aFalse'), sum(rows, 'trials')),
      consistency,
      today: rows[rows.length - 1].day === today() ? rows[rows.length - 1] : null,
    };
  }
}

export const store = new Store();
