/* Rehab mode: the rest between rounds and the fatigue break.
 *
 * Both are pacing the player would otherwise have to keep in their head. With
 * the rest on, every round is followed by 45 seconds before play unlocks. With
 * fatigue detection on, two sharp drops in accuracy in a row end the sitting
 * in a five minute break. The state lives in the store, so a reload in the
 * middle of a rest doesn't cut it short. The session itself — its clock and
 * its ring — is session.js; this module's ticker keeps that ring moving.
 */

import { fatigueCheck } from './engine.js';
import { store } from './store.js';
import { $, $$, nav } from './ui.js';
import { icons } from './icons.js';
import { paintRings, session, sessionDoneDialog } from './session.js';

export const REST_MS = 45 * 1000;
export const BREAK_MS = 5 * 60 * 1000;
const SITTING_GAP = 10 * 60 * 1000;   // a longer pause than this starts a new sitting

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const pct = (v) => `${Math.round(v * 100)}%`;

export const rehab = {
  get on() { return store.settings.rest !== 'off'; },

  /** Milliseconds of rest still owed, 0 when play is open. */
  get resting() { return Math.max(0, store.rehab.restUntil - Date.now()); },

  /** Called once a round is booked. Says what the player should be told. */
  afterRound() {
    const now = Date.now();
    const out = { fatigue: null, sessionDone: session.afterRound() };

    if (store.settings.fatigue === 'on') {
      const hit = fatigueCheck(sitting(now).map((r) => r.accuracy));
      if (hit) {
        out.fatigue = hit;
        // the rounds before the break don't count against the rounds after it
        store.setRehab({ restUntil: now + BREAK_MS, reason: 'fatigue', fatigueAt: now + 1 });
      }
    }

    // no rest owed after the round that closed the session
    if (this.on && !out.fatigue && !out.sessionDone) {
      store.setRehab({ restUntil: now + REST_MS, reason: 'rest' });
    }
    refresh();
    return out;
  },
};

/** This sitting's rounds: back from now until a long pause or the last break. */
function sitting(now) {
  const since = store.rehab.fatigueAt || 0;
  const rounds = store.rounds(since);
  let i = rounds.length - 1;
  let prev = now;
  while (i >= 0 && prev - rounds[i].at < SITTING_GAP) { prev = rounds[i].at; i--; }
  return rounds.slice(i + 1);
}

/* ── painting ────────────────────────────────────────────── */
let lastPaint = '';

function pillText() {
  const rest = rehab.resting;
  if (rest && store.rehab.reason === 'fatigue') return `FATIGUE BREAK · ${clock(rest)}`;
  if (rest) return `REST · ${clock(rest)}`;
  return '';
}

/** Repaint the session rings, the pills, the play buttons and the break clock. */
export function refresh(force = false) {
  const inRound = $('#screen-game').classList.contains('active');
  if (!inRound) {
    paintRings();
    if (session.expiredIdle()) sessionDoneDialog();
  }
  if (force) lastPaint = '';
  const rest = rehab.resting;
  const text = pillText();
  const key = `${text}|${rest ? clock(rest) : ''}`;
  if (key === lastPaint) return;
  lastPaint = key;

  $$('.rehab-pill').forEach((el) => { el.textContent = text; el.hidden = !text; });
  $$('.play-btn').forEach((btn) => {
    btn.disabled = !!rest;
    btn.classList.toggle('resting', !!rest);
    btn.innerHTML = rest
      ? `<span class="rest-count">${clock(rest)}</span><span class="rest-label">REST</span>`
      : icons.play();
    btn.setAttribute('aria-label', rest ? `Resting, ${clock(rest)} to go` : btn.dataset.label);
  });

  const breakClock = $('#break-clock');
  if (breakClock) {
    breakClock.textContent = rest ? clock(rest) : '0:00';
    $('#break-done').textContent = rest ? 'BACK TO HOME' : 'READY WHEN YOU ARE';
  }
}

export function startTicker() {
  $$('.play-btn').forEach((btn) => { btn.dataset.label = btn.getAttribute('aria-label'); });
  refresh();
  setInterval(() => refresh(), 500);
}

/* ── what the player is told ─────────────────────────────── */
export function showFatigueBreak({ baseline, recent }) {
  $('#break-text').innerHTML =
    `Your last two rounds came in at <b>${pct(recent[0])}</b> and <b>${pct(recent[1])}</b>, ` +
    `well under the <b>${pct(baseline)}</b> you were catching earlier in this sitting. ` +
    'A drop that sharp is usually fatigue, not ability.';
  refresh(true);
  return nav.sequential('break');
}
