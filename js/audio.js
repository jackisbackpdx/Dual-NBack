/* Sound bank + scheduler.
 *
 * The letter voice, the tap and the level chime are the original app's own
 * samples, lifted out of the screen recording by tools/extract_assets.py.
 * All three letter-bank files share one gain, so their relative loudness is
 * exactly what the recording had; only the tap is nudged up, because a phone
 * plays tap sounds through a channel a screen recording under-captures.
 */

import { LETTER_COUNT } from './engine.js';

const FILES = {
  tap:   'assets/sounds/tap.wav',
  level: 'assets/sounds/level.wav',
};
for (let i = 0; i < LETTER_COUNT; i++) FILES['letter' + i] = `assets/sounds/letter-${i}.wav`;

const GAIN = { letter: 1.0, tap: 0.34, level: 0.5 };

class Engine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.playing = new Set();
    this.ready = null;
    this.tapEnabled = true;
  }

  /** Create the context (suspended until a gesture) and decode everything. */
  load() {
    if (this.ready) return this.ready;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.ready = Promise.resolve(); return this.ready; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    this.ready = Promise.all(Object.entries(FILES).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        const raw = await res.arrayBuffer();
        const buf = await new Promise((ok, fail) => {
          const p = this.ctx.decodeAudioData(raw, ok, fail);
          if (p && p.then) p.then(ok, fail);
        });
        this.buffers.set(name, buf);
      } catch (err) {
        console.warn('could not load', url, err);
      }
    }));
    return this.ready;
  }

  /** Must run inside a user gesture on iOS/Android before anything is heard. */
  async unlock() {
    await this.load();
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }
    // A zero-length blip convinces stubborn WebKit builds the context is live.
    if (this.ctx) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      s.connect(this.master);
      s.start(0);
    }
  }

  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }

  play(name, at = 0, gain = 1) {
    const buf = this.buffers.get(name);
    if (!this.ctx || !buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    const when = Math.max(at, this.ctx.currentTime);
    src.start(when);
    this.playing.add(src);
    src.onended = () => this.playing.delete(src);
    return src;
  }

  letter(i, at = 0) { return this.play('letter' + i, at, GAIN.letter); }
  tap()             { if (this.tapEnabled) this.play('tap', 0, GAIN.tap); }
  level()           { return this.play('level', 0, GAIN.level); }

  stopAll() {
    for (const src of this.playing) { try { src.stop(); } catch { /* already done */ } }
    this.playing.clear();
  }
}

export const audio = new Engine();
