/* Wiring: icons, theme, navigation and the round loop. */

import { DAILY_GOAL, scoreRound, nextN } from './engine.js';
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
    store.finishRound(n, next);
    await showResults({ score, fromN: n, toN: next, roundsToday: store.roundsToday });
    renderHome();
  } finally {
    busy = false;
  }
}

/* ── help demos ──────────────────────────────────────────── */
let demoTimer = [];
function clearDemo() {
  demoTimer.forEach(clearTimeout);
  demoTimer = [];
  $$('#help-grid .cell[data-i]').forEach((c) => { c.style.backgroundColor = ''; });
}

function demoVisual() {
  clearDemo();
  audio.unlock();
  const grid = $('#help-grid');
  grid.hidden = false;
  $('#help-caption').textContent = 'N = 2 — the third square repeats the first, so the eye button is due.';
  const cells = $$('#help-grid .cell[data-i]');
  [1, 6, 1].forEach((pos, i) => {
    demoTimer.push(setTimeout(() => {
      const c = cells[pos];
      c.style.transition = 'background-color 260ms linear';
      c.style.backgroundColor = '#7e4bb0';
      demoTimer.push(setTimeout(() => { c.style.backgroundColor = ''; }, 700));
    }, i * 1100));
  });
  demoTimer.push(setTimeout(clearDemo, 4200));
}

function demoAudio() {
  clearDemo();
  $('#help-grid').hidden = true;
  $('#help-caption').textContent = 'N = 2 — the third sound repeats the first, so the ear button is due.';
  audio.unlock().then(() => {
    const t = audio.now + 0.25;
    [0, 3, 0].forEach((letter, i) => audio.letter(letter, t + i * 1.1));
  });
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
    const to = item.dataset.goto;
    if (to === 'stats') renderChart();
    if (to === 'settings') renderSettings();
    if (to === 'home') renderHome();
    nav.show(to);
  }));

  // home
  $('#home-stats').addEventListener('click', () => { renderChart(); nav.show('stats'); });
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
    '<p>Which N the first round of a new day starts from.</p>' +
    '<p><b>ALWAYS 1</b> warms up from the bottom every day.<br>' +
    '<b>SAME AS LAST ROUND</b> carries yesterday\'s level over.<br>' +
    '<b>AVERAGE OF LAST DAY</b> starts from the average N of your last day of training.</p>'));

  // help
  $('#demo-visual').addEventListener('click', demoVisual);
  $('#demo-audio').addEventListener('click', demoAudio);

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
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
}
