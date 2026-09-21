/* Settings and training history, kept in localStorage. */

const KEY = 'dual-n-back/v1';

const DEFAULTS = {
  settings: { firstN: 'always1', theme: 'system', tapSounds: true },
  n: 1,
  best: 1,            // highest N ever reached
  day: '',            // day the counters below belong to
  roundsToday: 0,
  history: {},        // 'YYYY-MM-DD' -> see blankDay()
};

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
    };
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
    this.state.roundsToday++;
    this.state.best = Math.max(this.state.best || 1, n, nextN);
    this.state.n = nextN;
    this.save();
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
      today: rows[rows.length - 1].day === today() ? rows[rows.length - 1] : null,
    };
  }
}

export const store = new Store();
