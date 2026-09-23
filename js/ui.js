/* Screen switching, drawer, dialog, toast and the shared widgets. */

import { icons } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── screens ─────────────────────────────────────────────── */
export const nav = {
  current: null,

  show(name) {
    const next = $('#screen-' + name);
    if (!next || next === this.current) return;
    if (this.current) this.current.classList.remove('active', 'fading');
    next.classList.remove('fading');
    next.classList.add('active');
    this.current = next;
    markDrawer(name);
  },

  /** Fade the old screen out first, then bring the new one in. */
  async sequential(name, outMs = 300, inMs = 300) {
    const next = $('#screen-' + name);
    if (!next) return;
    if (this.current && this.current !== next) {
      this.current.classList.remove('active');
      await wait(outMs);
    }
    next.classList.add('active');
    this.current = next;
    markDrawer(name);
    await wait(inMs);
  },

  /** Slow fade used when a round ends. */
  async fadeOut(ms = 550) {
    if (!this.current) return;
    this.current.classList.add('fading');
    this.current.classList.remove('active');
    await wait(ms);
    this.current.classList.remove('fading');
  },
};

function markDrawer(name) {
  $$('.drawer-item').forEach((b) => b.classList.toggle('current', b.dataset.goto === name));
}

/* ── drawer ──────────────────────────────────────────────── */
export const drawer = {
  open() { $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); },
  close() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); },
  get isOpen() { return $('#drawer').classList.contains('open'); },
};

/* ── dialog ──────────────────────────────────────────────── */
export function dialog(title, bodyHtml) {
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = bodyHtml;
  $('#dialog-scrim').classList.add('open');
}
export const closeDialog = () => $('#dialog-scrim').classList.remove('open');

/* ── toast ───────────────────────────────────────────────── */
let toastTimer;
export function toast(message, ms = 2200) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ── progress ring ───────────────────────────────────────── */
const STROKE = 5.6;                       // % of the ring's diameter
const R = 50 - STROKE / 2;
const C = 2 * Math.PI * R;

/* `sub` replaces the value/max line; `detail` adds a small line under it. */
export function ring(el, { value, max, n, sub, detail }) {
  if (!el.dataset.built) {
    el.innerHTML =
      `<svg viewBox="0 0 100 100">
         <circle class="ring-track" cx="50" cy="50" r="${R}" stroke-width="${STROKE}"/>
         <circle class="ring-value" cx="50" cy="50" r="${R}" stroke-width="${STROKE}"
                 stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/>
       </svg>
       <div class="ring-label">
         ${n === undefined ? '' : '<span class="ring-n"></span>'}
         <span class="ring-sub"></span>
         <span class="ring-detail" hidden></span>
       </div>`;
    el.dataset.built = '1';
  }
  const frac = max ? Math.min(value / max, 1) : 0;
  // let the browser paint the 0 state first so the sweep is visible
  requestAnimationFrame(() => {
    $('.ring-value', el).style.strokeDashoffset = (C * (1 - frac)).toFixed(2);
  });
  if (n !== undefined) $('.ring-n', el).textContent = `N = ${n}`;
  $('.ring-sub', el).textContent = sub ?? `${value}/${max}`;
  const more = $('.ring-detail', el);
  more.textContent = detail || '';
  more.hidden = !detail;
}

export function resetRing(el) {
  const v = $('.ring-value', el);
  if (v) v.style.strokeDashoffset = C.toFixed(2);
}

/* ── material-ish ripple ─────────────────────────────────── */
export function attachRipple(el) {
  el.addEventListener('pointerdown', (ev) => {
    if (el.classList.contains('used') || el.disabled) return;
    const r = el.getBoundingClientRect();
    const span = document.createElement('span');
    const size = Math.hypot(r.width, r.height) * 2;
    span.className = 'ripple';
    span.style.cssText =
      `left:${ev.clientX - r.left}px;top:${ev.clientY - r.top}px;width:${size}px;height:${size}px`;
    el.appendChild(span);
    setTimeout(() => span.remove(), 460);
  });
}

/* ── the score legend, shared by the results "?" and help ── */
export const LEGEND = [
  ['eyeScore', "square's position matches answered"],
  ['eyeMinus', 'visual (eye) button not pressed when should have'],
  ['eyePlus',  'visual (eye) button pressed when should not have'],
  ['earScore', 'letter sound matches answered'],
  ['earMinus', 'audio (ear) button not pressed when should have'],
  ['earPlus',  'audio (ear) button pressed when should not have'],
];

export const legendHtml = () =>
  '<ul class="legend-list">' +
  LEGEND.map(([ic, text]) => `<li><span class="ic">${icons[ic]()}</span><span>${text}</span></li>`).join('') +
  '</ul>';
