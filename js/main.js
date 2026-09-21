/* Wiring: icons, theme, navigation and the round loop. */

import { DAILY_GOAL, TIMING, scoreRound, nextN } from './engine.js';
import { audio } from './audio.js';
import { store } from './store.js';
import { icons, paint } from './icons.js';
import { $, $$, nav, drawer, dialog, closeDialog, toast, ring, attachRipple } from './ui.js';
import { enhanceAllSelects } from './select.js';
import { runRound } from './game.js';
import { showResults, paintScoreIcons, scoreLegendDialog, shareText } from './results.js';
import { renderChart } from './stats.js';

let lastScore = null;
let busy = false;

/* ── icons ───────────────────────────────────────────────── */
function paintIcons() {
  paint($('#home-menu'), 'menu');
  paint($('#home-stats'), 'chart');
  paint($('#game-back'), 'back');
  paint($('#results-back'), 'back');
  paint($('#stats-back'), 'back');
  paint($('#help-menu'), 'menu');
  paint($('#settings-menu'), 'menu');
  paint($('#home-play'), 'play');
  paint($('#results-play'), 'play');
  paint($('#btn-visual'), 'eye');
  paint($('#btn-audio'), 'ear');
  paint($('#demo-visual'), 'eye');
  paint($('#demo-audio'), 'ear');
  paintScoreIcons();
  $('#share-score .ic').innerHTML = icons.share();
  $('#tap-sounds .ic').innerHTML = icons.volume();
  const drawerIcons = ['grid', 'chart', 'question', 'gear'];
  $$('.drawer-item').forEach((el, i) => { el.querySelector('.ic').innerHTML = icons[drawerIcons[i]](); });
  $('#score-card').style.setProperty('--icon-knockout', 'var(--bg)');
}

/* ── theme ───────────────────────────────────────────────── */
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = store.settings.theme;
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = '#18a998';
}
media.addEventListener('change', applyTheme);

/* ── home ────────────────────────────────────────────────── */
function renderHome() {
  store.rollDay();
  ring($('#home-ring'), { value: store.roundsToday, max: DAILY_GOAL, n: store.n });
  $('#drawer-sub').textContent = `N = ${store.n}`;
}

/* ── one round, start to finish ──────────────────────────── */
async function playRound() {
  if (busy) return;
  busy = true;
  try {
    await audio.unlock();
    const n = store.n;
    const result = await runRound(n);
    if (!result) { await nav.sequential('home'); renderHome(); return; }

    const score = scoreRound(result.round, result.responses);
    const next = nextN(n, score);
    lastScore = { score, n };
    store.finishRound(n, next, score);
    await showResults({ score, fromN: n, toN: next, roundsToday: store.roundsToday });
    renderHome();
  } finally {
    busy = false;
  }
}

/* ── help demos ───────────────────────────────────────────
   One panel, moved under whichever control started it. The two little
   buttons under HITTING TARGETS are quick illustrations; the tutorials
   walk a real sequence at the game's own three-second tempo. */

const DEMOS = {
  eye: {
    n: 2, step: 1100, grid: true, sound: false,
    positions: [1, 6, 1],
    lead: 'N = 2 — watch the squares.',
  },
  ear: {
    n: 2, step: 1100, grid: false, sound: true,
    letters: [0, 3, 0],
    lead: 'N = 2 — listen to the letters.',
  },
  1: {
    n: 1, step: TIMING.trial, grid: true, sound: true,
    positions: [1, 1, 6, 2, 2, 4],
    letters:   [0, 2, 2, 5, 5, 5],
    lead: 'Dual 1-Back — compare each square and sound with the one just before it.',
  },
  2: {
    n: 2, step: TIMING.trial, grid: true, sound: true,
    positions: [0, 5, 0, 3, 7, 3, 7],
    letters:   [1, 4, 6, 4, 2, 2, 0],
    lead: 'Dual 2-Back — compare each square and sound with the one two back.',
  },
};

let demo = null;

function stopDemo() {
  if (!demo) return;
  demo.timers.forEach(clearTimeout);
  demo.button.classList.remove('playing');
  $$('#help-grid .cell[data-i]').forEach((c) => { c.style.backgroundColor = ''; });
  $('#demo-panel').hidden = true;
  audio.stopAll();
  demo = null;
}

function playDemo(button, key) {
  const spec = DEMOS[key];
  const restart = !demo || demo.key !== key;
  stopDemo();
  if (!restart) return;

  const panel = $('#demo-panel');
  const caption = $('#help-caption');
  const cells = $$('#help-grid .cell[data-i]');
  button.after(panel);
  panel.hidden = false;
  $('#help-grid').hidden = !spec.grid;
  button.classList.add('playing');
  caption.textContent = spec.lead;

  const steps = (spec.positions || spec.letters).length;
  const timers = [];
  demo = { key, button, timers };
  audio.unlock();

  for (let i = 0; i < steps; i++) {
    timers.push(setTimeout(() => {
      const pos = spec.positions && spec.positions[i];
      const hitPos = spec.positions && i >= spec.n && pos === spec.positions[i - spec.n];
      const hitSnd = spec.letters && i >= spec.n &&
        spec.letters[i] === spec.letters[i - spec.n];

      if (spec.grid && pos !== undefined) {
        const cell = cells[pos];
        cell.style.transition = 'background-color 260ms linear';
        cell.style.backgroundColor = '#7e4bb0';
        timers.push(setTimeout(() => { cell.style.backgroundColor = ''; },
          Math.min(spec.step - 200, 900)));
      }
      if (spec.sound && spec.letters) audio.letter(spec.letters[i]);

      caption.textContent = i < spec.n
        ? `${i + 1} of ${steps} — nothing to compare it with yet.`
        : hitPos && hitSnd ? `${i + 1} of ${steps} — both match. Press the eye and the ear.`
        : hitPos ? `${i + 1} of ${steps} — the position matches. Press the eye.`
        : hitSnd ? `${i + 1} of ${steps} — the sound matches. Press the ear.`
        : `${i + 1} of ${steps} — no match. Press nothing.`;
    }, i * spec.step));
  }

  timers.push(setTimeout(() => {
    caption.textContent = 'That is the whole game — the same thing, for 20+N of them.';
    button.classList.remove('playing');
    demo = null;              // a second press replays it rather than clearing it
  }, steps * spec.step));
}

/* ── settings ────────────────────────────────────────────── */
function renderSettings() {
  $('#first-n-select').value = store.settings.firstN;
  $('#theme-select').value = store.settings.theme;
  $('#tap-sounds').classList.toggle('off', !store.settings.tapSounds);
}

/* ── boot ────────────────────────────────────────────────── */
function bind() {
  // drawer
  ['#home-menu', '#help-menu', '#settings-menu'].forEach((s) =>
    $(s).addEventListener('click', () => drawer.open()));
  $('#scrim').addEventListener('click', () => drawer.close());
  $$('.drawer-item').forEach((item) => item.addEventListener('click', () => {
    drawer.close();
    stopDemo();
    const to = item.dataset.goto;
    if (to === 'stats') renderChart();
    if (to === 'settings') renderSettings();
    if (to === 'home') renderHome();
    nav.show(to);
  }));

  // home
  $('#home-stats').addEventListener('click', () => { renderChart(); nav.show('stats'); });
  $('#stats-back').addEventListener('click', stopDemo);
  $('#home-play').addEventListener('click', playRound);
  $('#stats-back').addEventListener('click', () => { renderHome(); nav.show('home'); });

  // results
  $('#results-back').addEventListener('click', () => { renderHome(); nav.show('home'); });
  $('#results-play').addEventListener('click', playRound);
  $('#score-help').addEventListener('click', scoreLegendDialog);
  $('#share-score').addEventListener('click', async () => {
    if (!lastScore) return;
    const text = shareText(lastScore.score, lastScore.n);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Score copied'); }
    } catch { /* dismissed */ }
  });

  // settings
  $('#first-n-select').addEventListener('change', (e) => store.set('firstN', e.target.value));
  $('#theme-select').addEventListener('change', (e) => { store.set('theme', e.target.value); applyTheme(); });
  $('#tap-sounds').addEventListener('click', () => {
    const on = !store.settings.tapSounds;
    store.set('tapSounds', on);
    audio.tapEnabled = on;
    renderSettings();
    if (on) { audio.unlock().then(() => audio.tap()); }
  });
  $('#first-n-help').addEventListener('click', () => dialog('DAILY FIRST N',
    "<p>Setting 'DAILY FIRST N' sets N for the first game each day. SAME AS " +
    "YESTERDAY'S LAST means that N is the same as where you left off in the last " +
    'game, ALWAYS 1 sets N always to one and ALWAYS MY BEST sets N to the highest ' +
    "N you've ever reached.</p>"));

  // help
  $$('#screen-help [data-demo]').forEach((btn) => btn.addEventListener('click', () =>
    playDemo(btn, btn.dataset.demo === 'tutorial' ? btn.dataset.n : btn.dataset.demo)));
  $('#help-menu').addEventListener('click', stopDemo);

  // dialog
  $('#dialog-ok').addEventListener('click', closeDialog);
  $('#dialog-scrim').addEventListener('click', (e) => { if (e.target.id === 'dialog-scrim') closeDialog(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDialog(); drawer.close(); }
  });

  [$('#home-play'), $('#results-play'), $('#demo-visual'), $('#demo-audio')].forEach(attachRipple);
}

paintIcons();
applyTheme();
enhanceAllSelects();
bind();
renderHome();
renderSettings();
nav.show('home');
audio.load();
audio.tapEnabled = store.settings.tapSounds;

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // When a new worker replaces one that was already running this page, the
    // page is holding the old code — take the update straight away.
    reg.addEventListener('updatefound', () => {
      const fresh = reg.installing;
      if (!fresh) return;
      fresh.addEventListener('statechange', () => {
        if (fresh.state === 'activated' && navigator.serviceWorker.controller) location.reload();
      });
    });
  }).catch(() => { /* offline cache is optional */ });
}
