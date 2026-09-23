/* Wiring: icons, theme, navigation and the round loop. */

import {
  TIMING, VISUAL_POSITIONS, LETTER_COUNT,
  makeSequence, scoreRound, nextN,
} from './engine.js';
import { audio } from './audio.js';
import { store } from './store.js';
import { icons, paint } from './icons.js';
import { $, $$, nav, drawer, dialog, closeDialog, toast, attachRipple, wait } from './ui.js';
import { enhanceAllSelects } from './select.js';
import { runRound } from './game.js';
import { showResults, paintScoreIcons, scoreLegendDialog, shareText } from './results.js';
import { renderChart } from './stats.js';
import { rehab, refresh as refreshRehab, startTicker, showFatigueBreak } from './rehab.js';
import { session, paintRings, sessionDoneDialog } from './session.js';

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
  paint($('#rehab-menu'), 'menu');
  paint($('#break-back'), 'back');
  paint($('#home-play'), 'play');
  paint($('#results-play'), 'play');
  paint($('#btn-visual'), 'eye');
  paint($('#btn-audio'), 'ear');
  paint($('#demo-visual'), 'eye');
  paint($('#demo-audio'), 'ear');
  paintScoreIcons();
  paintPlayIcon();
  $('#share-score .ic').innerHTML = icons.share();
  $('#tap-sounds .ic').innerHTML = icons.volume();
  const drawerIcons = ['grid', 'chart', 'heart', 'question', 'gear'];
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

/* ── answer button layout ────────────────────────────────── */
function applyHand() {
  document.documentElement.dataset.hand = store.settings.hand;
}

/* ── home ────────────────────────────────────────────────── */
function renderHome() {
  store.rollDay();
  paintRings({ results: false });
  $('#drawer-sub').textContent = `N = ${store.n}`;
}

/* ── one round, start to finish ──────────────────────────── */
async function playRound() {
  if (busy || rehab.resting) return;
  busy = true;
  try {
    await audio.unlock();
    const n = store.n;
    session.beforeRound();
    const result = await runRound(n);
    if (!result) { await nav.sequential('home'); renderHome(); return; }

    const score = scoreRound(result.round, result.responses);
    const next = nextN(n, score);
    lastScore = { score, n };
    store.finishRound(n, next, score);
    const told = rehab.afterRound();
    await showResults({ score, fromN: n, toN: next });
    renderHome();
    if (told.fatigue) {
      await wait(1500);
      if (nav.current === $('#screen-results')) await showFatigueBreak(told.fatigue);
    } else if (told.sessionDone) {
      sessionDoneDialog();
    }
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
    key: 'eye', n: 2, step: 1100, grid: true, sound: false,
    positions: [1, 6, 1],
    lead: 'N = 2. Watch the squares.',
  },
  ear: {
    key: 'ear', n: 2, step: 1100, grid: false, sound: true,
    letters: [0, 3, 0],
    lead: 'N = 2. Listen to the letters.',
  },
};

/* A tutorial is generated per press, so it is a fresh sequence every time,
   at the game's own three-second tempo. Two matches per sense in the few
   trials that can hold one. */
function tutorialSpec(n) {
  const trials = n + 3;
  return {
    key: `tutorial-${n}`, n, step: TIMING.trial, grid: true, sound: true,
    positions: makeSequence(n, trials, VISUAL_POSITIONS, 2),
    letters: makeSequence(n, trials, LETTER_COUNT, 2),
    lead: `Dual ${n}-Back. Compare each square and sound with the one ` +
          `${n === 1 ? 'just before it' : `${n} back`}.`,
  };
}

const specFor = (trigger) => (trigger.dataset.demo === 'tutorial'
  ? tutorialSpec(Number(trigger.dataset.n || $('#tutorial-n').value))
  : DEMOS[trigger.dataset.demo]);

let demo = null;

function stopDemo() {
  if (!demo) return;
  demo.timers.forEach(clearTimeout);
  demo.button.classList.remove('playing');
  demo = null;
  $$('#help-grid .cell[data-i]').forEach((c) => { c.style.backgroundColor = ''; });
  $('#demo-panel').hidden = true;
  audio.stopAll();
  paintPlayIcon();
}

/** The tutorial's play button doubles as its stop button. */
function paintPlayIcon() {
  const btn = $('#tutorial-play');
  if (!btn) return;
  const running = demo && demo.button === btn;
  btn.innerHTML = running ? icons.stop() : icons.play();
  const n = $('#tutorial-n').value;
  btn.setAttribute('aria-label', `${running ? 'Stop' : 'Play'} Dual ${n}-Back tutorial`);
}

function playDemo(button, spec) {
  if (!spec) return;
  const restart = !demo || demo.key !== spec.key;
  stopDemo();
  if (!restart) return;

  const panel = $('#demo-panel');
  const caption = $('#help-caption');
  const cells = $$('#help-grid .cell[data-i]');
  // These controls live in flex rows; dropping the panel straight after one
  // would make it a flex sibling — beside the buttons, stretching them. Hang
  // it off the row instead, so it always lands underneath.
  (button.closest('.help-demo, .tutorial-row') || button).after(panel);
  panel.hidden = false;
  $('#help-grid').hidden = !spec.grid;
  button.classList.add('playing');
  caption.textContent = spec.lead;

  const steps = (spec.positions || spec.letters).length;
  const timers = [];
  demo = { key: spec.key, button, timers };
  paintPlayIcon();
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
        ? `${i + 1} of ${steps}: nothing to compare it with yet.`
        : hitPos && hitSnd ? `${i + 1} of ${steps}: both match. Press the eye and the ear.`
        : hitPos ? `${i + 1} of ${steps}: the position matches. Press the eye.`
        : hitSnd ? `${i + 1} of ${steps}: the sound matches. Press the ear.`
        : `${i + 1} of ${steps}: no match. Press nothing.`;
    }, i * spec.step));
  }

  timers.push(setTimeout(() => {
    caption.textContent = 'That is the whole game, repeated for 20+N squares and sounds.';
    button.classList.remove('playing');
    demo = null;              // a second press replays it rather than clearing it
    paintPlayIcon();
  }, steps * spec.step));
}

/* ── settings ────────────────────────────────────────────── */
function renderSettings() {
  $('#first-n-select').value = store.settings.firstN;
  $('#theme-select').value = store.settings.theme;
  $('#tap-sounds').classList.toggle('off', !store.settings.tapSounds);
  $('#hand-select').value = store.settings.hand;
  $('#goal-select').value = store.settings.goal;
  $('#minutes-select').value = store.settings.minutes;
  $('#rounds-select').value = store.settings.roundGoal;
  $('#minutes-card').hidden = store.settings.goal === 'rounds';
  $('#rounds-card').hidden = store.settings.goal !== 'rounds';
  $('#rest-select').value = store.settings.rest;
  $('#fatigue-select').value = store.settings.fatigue;
  // the custom menus paint off the native select's change event
  ['#hand-select', '#goal-select', '#minutes-select', '#rounds-select', '#rest-select',
    '#fatigue-select', '#first-n-select', '#theme-select']
    .forEach((sel) => $(sel).dispatchEvent(new Event('change')));
}

/* ── boot ────────────────────────────────────────────────── */
function bind() {
  // drawer
  ['#home-menu', '#help-menu', '#settings-menu', '#rehab-menu'].forEach((s) =>
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
  $('#hand-select').addEventListener('change', (e) => { store.set('hand', e.target.value); applyHand(); });
  // Session settings apply to the session already running: a longer length
  // gives it more time, a shorter one can close it.
  const sessionSetting = (key, after) => (e) => {
    if (e.target.value === store.settings[key]) return;
    store.set(key, e.target.value);
    store.setSession({ announced: session.done });   // no "complete" for a change of mind
    if (after) after();
    refreshRehab(true);
  };
  $('#goal-select').addEventListener('change', sessionSetting('goal', renderSettings));
  $('#minutes-select').addEventListener('change', sessionSetting('minutes'));
  $('#rounds-select').addEventListener('change', sessionSetting('roundGoal'));
  $('#goal-help').addEventListener('click', () => dialog('SESSION',
    '<p>Sessions BY TIME run for a set number of minutes; sessions BY ROUNDS for a ' +
    'set number of rounds. Either way the session starts with your first round, and ' +
    'the ring on the home screen fills as it goes.</p><p>A round started with time ' +
    'left always plays to the end, and the session closes once it is scored.</p>'));
  $('#rest-select').addEventListener('change', (e) => {
    store.set('rest', e.target.value);
    if (e.target.value === 'off' && store.rehab.reason === 'rest') store.setRehab({ restUntil: 0 });
    refreshRehab(true);
  });
  $('#fatigue-select').addEventListener('change', (e) => store.set('fatigue', e.target.value));
  $('#hand-help').addEventListener('click', () => dialog('ANSWER BUTTONS',
    '<p>ONE-HANDED stacks the position (eye) and sound (ear) buttons on one side of ' +
    'the screen, so the whole game can be played with one thumb. Pick the side of ' +
    'your stronger hand.</p><p>With a keyboard, A and L still answer the squares ' +
    'and the sounds.</p>'));
  $('#rest-help').addEventListener('click', () => dialog('REST TIMER',
    '<p>After every round the play button stays locked for a 45-second rest. Use it ' +
    'to read your score, rest your eyes and reset.</p><p>With a 20-minute session that comes ' +
    'to about 10 to 12 rounds.</p>'));
  $('#fatigue-help').addEventListener('click', () => dialog('FATIGUE DETECTION',
    '<p>If your accuracy falls sharply for two rounds in a row (at least 30 points ' +
    'under your level earlier in the sitting), the app stops you for a five-minute ' +
    'fatigue break.</p><p>Accuracy here is matches caught out of matches caught, ' +
    'missed and pressed by mistake.</p>'));
  $('#first-n-help').addEventListener('click', () => dialog('DAILY FIRST N',
    "<p>Setting 'DAILY FIRST N' sets N for the first game each day. SAME AS " +
    "YESTERDAY'S LAST means that N is the same as where you left off in the last " +
    'game, ALWAYS 1 sets N always to one and ALWAYS MY BEST sets N to the highest ' +
    "N you've ever reached.</p>"));

  // rehabilitation
  $('#rehab-settings').addEventListener('click', () => { renderSettings(); nav.show('settings'); });
  $('#break-back').addEventListener('click', () => { renderHome(); nav.show('home'); });
  $('#break-done').addEventListener('click', () => { renderHome(); nav.show('home'); });

  // help
  $$('#screen-help [data-demo]').forEach((btn) => btn.addEventListener('click', () =>
    playDemo(btn, specFor(btn))));
  $('#tutorial-n').addEventListener('change', () => { stopDemo(); paintPlayIcon(); });
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
applyHand();
enhanceAllSelects();
bind();
renderHome();
renderSettings();
startTicker();
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
