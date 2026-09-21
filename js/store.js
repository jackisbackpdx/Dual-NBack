/* Settings and training history, kept in localStorage. */

const KEY = 'dual-n-back/v1';

const DEFAULTS = {
  settings: { firstN: 'always1', theme: 'system', tapSounds: true },
  n: 1,
  day: '',            // day the counters below belong to
  roundsToday: 0,
  history: {},        // 'YYYY-MM-DD' -> { rounds, nSum }
};

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

  firstNForNewDay() {
    const mode = this.state.settings.firstN;
    if (mode === 'last') return Math.max(1, this.state.n || 1);
    if (mode === 'average') {
      const days = Object.keys(this.state.history).sort();
      const last = days[days.length - 1];
      const d = last && this.state.history[last];
      if (d && d.rounds) return Math.max(1, Math.round(d.nSum / d.rounds));
    }
    return 1;
  }

  /** Book a finished round: `n` is the level that was just played. */
  finishRound(n, nextN) {
    this.rollDay();
    const t = this.state.day;
    const d = this.state.history[t] || (this.state.history[t] = { rounds: 0, nSum: 0 });
    d.rounds++;
    d.nSum += n;
    this.state.roundsToday++;
    this.state.n = nextN;
    this.save();
  }

  /** Chronological [{ day, rounds, avgN }] for the statistics chart. */
  series() {
    return Object.keys(this.state.history).sort().map((day) => {
      const d = this.state.history[day];
      return { day, rounds: d.rounds, avgN: d.nSum / d.rounds };
    });
  }
}

export const store = new Store();
