/* The round itself.
 *
 * Everything is driven off the Web Audio clock rather than setTimeout, so the
 * letter a square is paired with lands on the same millisecond as the flash
 * even when the main thread stutters. Trial k starts at t0 + k * 3.000 s.
 */

import { TIMING, makeRound, flashAlpha } from './engine.js';
import { audio } from './audio.js';
import { $, $$, nav, attachRipple } from './ui.js';

const TEAL  = [24, 169, 152];
const FLASH = [126, 75, 176];

const mixed = (a) =>
  `rgb(${TEAL.map((c, i) => Math.round(c + (FLASH[i] - c) * a)).join(',')})`;

let wired = false;

export function runRound(n) {
  const round = makeRound(n);
  const responses = {
    visual: new Array(round.trials).fill(false),
    audio:  new Array(round.trials).fill(false),
  };

  const cells = $$('#grid .cell[data-i]');
  const btnV = $('#btn-visual');
  const btnA = $('#btn-audio');
  if (!wired) { attachRipple(btnV); attachRipple(btnA); wired = true; }

  $('#game-title').textContent = `N = ${n}`;
  cells.forEach((c) => { c.style.backgroundColor = ''; });
  btnV.classList.remove('used');
  btnA.classList.remove('used');

  return new Promise((resolve) => {
    let raf = 0;
    let lit = null;
    let trial = -1;
    let finished = false;
    let t0 = 0;
    const sources = [];

    const press = (kind, btn) => {
      if (finished || btn.classList.contains('used')) return;
      const elapsed = audio.now - t0;
      if (elapsed >= round.trials * (TIMING.trial / 1000)) return;   // window closed
      const i = Math.max(0, Math.floor(elapsed / (TIMING.trial / 1000)));
      responses[kind][i] = true;
      btn.classList.add('used');
      audio.tap();
    };

    const onVisual = () => press('visual', btnV);
    const onAudio  = () => press('audio', btnA);
    const onQuit   = () => stop(null);
    const onHide   = () => { if (document.hidden) stop(null); };

    function stop(result) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      sources.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
      btnV.removeEventListener('pointerdown', onVisual);
      btnA.removeEventListener('pointerdown', onAudio);
      $('#game-back').removeEventListener('click', onQuit);
      document.removeEventListener('visibilitychange', onHide);
      cells.forEach((c) => { c.style.backgroundColor = ''; });
      btnV.classList.remove('used');
      btnA.classList.remove('used');
      resolve(result);
    }

    function frame() {
      const elapsed = (audio.now - t0) * 1000;
      const idx = Math.floor(elapsed / TIMING.trial);

      if (idx !== trial && idx >= 0 && idx < round.trials) {
        trial = idx;
        btnV.classList.remove('used');
        btnA.classList.remove('used');
      }

      const inTrial = elapsed - idx * TIMING.trial;
      const active = idx >= 0 && idx < round.trials ? cells[round.positions[idx]] : null;
      const alpha = active ? flashAlpha(inTrial) : 0;

      if (lit && lit !== active) { lit.style.backgroundColor = ''; lit = null; }
      if (active) {
        if (alpha > 0) { active.style.backgroundColor = mixed(alpha); lit = active; }
        else if (lit) { lit.style.backgroundColor = ''; lit = null; }
      }

      if (elapsed >= round.trials * TIMING.trial + TIMING.endPause) {
        stop({ round, responses });
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    btnV.addEventListener('pointerdown', onVisual);
    btnA.addEventListener('pointerdown', onAudio);
    $('#game-back').addEventListener('click', onQuit);
    document.addEventListener('visibilitychange', onHide);

    // Fade the game screen in, then give the player the same 1.8 s of quiet
    // the original does before the first square lights up.
    nav.sequential('game').then(() => {
      if (finished) return;
      t0 = audio.now + TIMING.leadIn / 1000;
      for (let i = 0; i < round.trials; i++) {
        const src = audio.letter(round.letters[i], t0 + i * (TIMING.trial / 1000));
        if (src) sources.push(src);
      }
      raf = requestAnimationFrame(frame);
    });
  });
}
