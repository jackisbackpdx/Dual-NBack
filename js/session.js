/* The training session, and the ring that shows it.
 *
 * A session is either a length of time (10 to 30 minutes, 15 by default) or a
 * number of rounds (5, 10, 15 or 20). It starts when the first round does, so
 * the clock never runs while the player is still getting settled. A round
 * started with time on the clock always plays to the end; the session closes
 * once it has been booked. Between rounds, the rings on the home and results
 * screens fill with the time spent (or the rounds played), count down the time
 * left, and count the rounds so far.
 */

import { store, today } from './store.js';
import { $, ring, dialog } from './ui.js';

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'S'}`;

export const SESSION_MINUTES = [10, 15, 20, 25, 30];
export const SESSION_ROUNDS = [5, 10, 15, 20];

export const session = {
  get timed() { return store.settings.goal !== 'rounds'; },
  get lengthMs() { return Number(store.settings.minutes || 15) * 60 * 1000; },
  get roundGoal() { return Number(store.settings.roundGoal || 20); },

  /** Yesterday's session, finished or not, is not today's. */
  get current() {
    const s = store.session;
    return s.start && s.day === today() ? s : null;
  },

  /** Milliseconds left on the clock; the full length before the first round. */
  get left() {
    const s = this.current;
    if (!s) return this.lengthMs;
    return Math.max(0, s.start + this.lengthMs - Date.now());
  },

  get rounds() { return this.current ? this.current.rounds : 0; },

  get done() {
    if (!this.current) return false;
    return this.timed ? this.left <= 0 : this.rounds >= this.roundGoal;
  },

  /** 0 → 1, how far through the session the player is. */
  get progress() {
    if (this.timed) return this.current ? 1 - this.left / this.lengthMs : 0;
    return Math.min(1, this.rounds / this.roundGoal);
  },

  /** A round is starting: open a session if none is running. */
  beforeRound() {
    if (!this.current || this.done) {
      store.setSession({ start: Date.now(), rounds: 0, day: today(), announced: false });
    }
  },

  /** A round was booked. True when that round closed the session. */
  afterRound() {
    if (!this.current) return false;
    store.setSession({ rounds: this.rounds + 1 });
    if (this.done && !store.session.announced) {
      store.setSession({ announced: true });
      return true;
    }
    return false;
  },

  /** The clock ran out between rounds. True once, the moment it is noticed. */
  expiredIdle() {
    if (!this.timed || !this.done || store.session.announced) return false;
    store.setSession({ announced: true });
    return true;
  },
};

/** What the ring says, as [big line, small line]. */
function labels() {
  const n = session.rounds;
  if (session.timed) {
    if (session.done) return ['DONE', plural(n, 'ROUND')];
    return [clock(session.left), plural(n, 'ROUND')];
  }
  return [`${n}/${session.roundGoal}`, session.done ? 'DONE' : 'ROUNDS'];
}

/** Paint the home ring, and the results ring once its reveal has shown it. */
export function paintRings({ results = true } = {}) {
  const [sub, detail] = labels();
  const value = session.progress;
  ring($('#home-ring'), { value, max: 1, n: store.n, sub, detail });
  const res = $('#results-ring');
  if (results && res.style.opacity !== '0') ring(res, { value, max: 1, sub, detail });
}

export function sessionDoneDialog() {
  const what = session.timed
    ? `your ${store.settings.minutes} minute session — ${plural(session.rounds, 'round').toLowerCase()}`
    : `your ${session.roundGoal} round session`;
  dialog('SESSION COMPLETE',
    `<p>That is ${what}. Stopping here is the point: the window for training ` +
    'is short, and the recovery happens in the rest that follows.</p>' +
    '<p>Press play whenever you are ready to start a new session.</p>');
}
