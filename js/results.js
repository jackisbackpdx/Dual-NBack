/* End-of-round choreography + the results screen.
 *
 * The beats below are lifted from the recording: the game screen dissolves,
 * the old N drifts into the middle of an empty screen, ticks over to the new
 * N with a chime, flies up into the app bar, and the rest of the screen
 * arrives behind it one piece at a time.
 */

import { TIMING } from './engine.js';
import { paintRings } from './session.js';
import { audio } from './audio.js';
import { $, nav, resetRing, wait, legendHtml, dialog } from './ui.js';
import { icons } from './icons.js';

const BEAT = {
  fadeOut: TIMING.screenOut,   // game screen dissolves
  nAppears:   150,   // ... then the old N appears in the middle
  nChanges:  1050,   // ... ticks over, with the chime
  nFlies:     750,   // ... and flies up to the app bar
  flight:     430,
  card:       300,   // the reveal cascade, each relative to the previous
  ringIn:     700,
  play:       100,
  footer:     500,
  bar:        600,
};

export function paintScore(score) {
  const v = score.visual;
  const a = score.audio;
  const set = (id, value, bad) => {
    const el = $('#' + id);
    el.textContent = value;
    el.classList.toggle('bad', !!bad);
  };
  set('sc-v-hit', v.hits, false);
  set('sc-v-miss', v.misses, v.mistakes >= 3);
  set('sc-v-false', v.false, v.mistakes >= 3);
  set('sc-a-hit', a.hits, false);
  set('sc-a-miss', a.misses, a.mistakes >= 3);
  set('sc-a-false', a.false, a.mistakes >= 3);
}

function stage(els, hidden) {
  els.forEach((el) => {
    el.style.transition = hidden ? 'none' : 'opacity 220ms linear';
    el.style.opacity = hidden ? '0' : '1';
  });
}

export async function showResults({ score, fromN, toN }) {
  const bar = $('#screen-results .bar');
  const card = $('#score-card');
  const ringEl = $('#results-ring');
  const play = $('#results-play');
  const footer = $('.results-footer');
  const flight = $('#n-flight');
  const parts = [card, ringEl, play, footer];

  paintScore(score);
  resetRing(ringEl);
  bar.classList.add('hidden');
  stage(parts, true);
  $('#results-title').textContent = `N = ${toN}`;

  await nav.fadeOut(BEAT.fadeOut);
  nav.show('results');

  // 1. the old N, dead centre
  flight.hidden = false;
  flight.textContent = `N = ${fromN}`;
  flight.style.transition = 'none';
  flight.style.opacity = '0';
  // the app is a centred window on wide screens, so measure the frame
  const frame = flight.offsetParent || document.documentElement;
  const centreY = Math.round(frame.clientHeight / 2 - flight.offsetHeight / 2);
  const setAt = (y, scale) => {
    flight.style.setProperty('--t', `translateY(${y}px) scale(${scale})`);
    flight.style.transform = `translateY(${y}px) scale(${scale})`;
  };
  setAt(centreY, 1.5);
  await wait(BEAT.nAppears);
  flight.style.transition = 'opacity 220ms linear';
  flight.style.opacity = '1';

  // 2. it ticks over to the new level
  await wait(BEAT.nChanges);
  flight.textContent = `N = ${toN}`;
  if (toN !== fromN) audio.level();
  flight.classList.add('pop');
  flight.addEventListener('animationend', () => flight.classList.remove('pop'), { once: true });

  // 3. and flies up to where the app bar title will be
  await wait(BEAT.nFlies);
  const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 56;
  const safeTop = bar.getBoundingClientRect().height - barH;
  flight.classList.add('moving');
  setAt(Math.round(safeTop + barH / 2 - flight.offsetHeight / 2), 1);

  // 4. the screen fills in behind it
  await wait(BEAT.flight + BEAT.card);
  stage([card], false);
  await wait(BEAT.ringIn);
  stage([ringEl], false);
  paintRings();
  await wait(BEAT.play);
  stage([play], false);
  await wait(BEAT.footer);
  stage([footer], false);
  await wait(BEAT.bar);
  bar.classList.remove('hidden');
  flight.hidden = true;
  flight.classList.remove('moving');
}

export function scoreLegendDialog() {
  dialog('SCORE', legendHtml() +
    '<p>There can be two kinds of mistakes: 1) not pressing audio (ear) or ' +
    'visual (eye) button when should have and 2) pressing audio or visual ' +
    'button when should not have.</p>');
}

export function shareText(score, n) {
  const v = score.visual;
  const a = score.audio;
  return `Dual N-Back — N = ${n}\n` +
         `eye ${v.hits} hit / ${v.misses} missed / ${v.false} false\n` +
         `ear ${a.hits} hit / ${a.misses} missed / ${a.false} false`;
}

export function paintScoreIcons() {
  const map = {
    'sc-eye': 'eyeScore', 'sc-eye-minus': 'eyeMinus', 'sc-eye-plus': 'eyePlus',
    'sc-ear': 'earScore', 'sc-ear-minus': 'earMinus', 'sc-ear-plus': 'earPlus',
  };
  for (const [id, name] of Object.entries(map)) $('#' + id).innerHTML = icons[name]();
}
