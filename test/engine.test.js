import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMING, LETTER_COUNT, VISUAL_POSITIONS, MATCHES_PER_SENSE,
  makeSequence, makeRound, isMatchAt, scoreRound, nextN, flashAlpha, trialsFor,
} from '../js/engine.js';

/* deterministic rng so a failure is reproducible */
function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const countMatches = (seq, n) => seq.reduce((c, _, i) => c + (isMatchAt(seq, i, n) ? 1 : 0), 0);

test('a round runs 20 + N trials', () => {
  for (let n = 1; n <= 9; n++) assert.equal(trialsFor(n), 20 + n);
  assert.equal(makeRound(4, rng()).trials, 24);
});

test('every generated sequence holds exactly six matches', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = rng(seed);
    for (let n = 1; n <= 9; n++) {
      const trials = trialsFor(n);
      const pos = makeSequence(n, trials, VISUAL_POSITIONS, MATCHES_PER_SENSE, r);
      const let_ = makeSequence(n, trials, LETTER_COUNT, MATCHES_PER_SENSE, r);
      assert.equal(countMatches(pos, n), MATCHES_PER_SENSE, `positions n=${n} seed=${seed}`);
      assert.equal(countMatches(let_, n), MATCHES_PER_SENSE, `letters n=${n} seed=${seed}`);
      assert.ok(pos.every((v) => v >= 0 && v < VISUAL_POSITIONS));
      assert.ok(let_.every((v) => v >= 0 && v < LETTER_COUNT));
    }
  }
});

test('never asks for more matches than the sequence can hold', () => {
  const seq = makeSequence(9, 12, 8, 6, rng(7));   // only 3 candidate slots
  assert.equal(countMatches(seq, 9), 3);
});

test('scoring splits hits, misses and false alarms', () => {
  const round = { n: 2, trials: 6, positions: [0, 1, 0, 3, 3, 5], letters: [0, 1, 2, 1, 4, 5] };
  //             visual matches at i=2 (0==0) and i=4? pos[4]=3 pos[2]=0 -> no. matches: {2}
  //             audio  matches at i=3 (1==1)
  const responses = {
    visual: [false, false, true, false, true, false],   // 1 hit, 1 false alarm
    audio:  [true, false, false, false, false, false],  // 1 false alarm, 1 miss
  };
  const s = scoreRound(round, responses);
  assert.deepEqual(
    { h: s.visual.hits, m: s.visual.misses, f: s.visual.false }, { h: 1, m: 0, f: 1 });
  assert.deepEqual(
    { h: s.audio.hits, m: s.audio.misses, f: s.audio.false }, { h: 0, m: 1, f: 1 });
  assert.equal(s.visual.mistakes, 1);
  assert.equal(s.audio.mistakes, 2);
});

test('a press before trial N is always a false alarm', () => {
  const round = { n: 3, trials: 5, positions: [0, 1, 2, 3, 4], letters: [0, 1, 2, 3, 4] };
  const s = scoreRound(round, {
    visual: [true, false, false, false, false],
    audio: new Array(5).fill(false),
  });
  assert.equal(s.visual.false, 1);
  assert.equal(s.visual.hits, 0);
});

test('the N ladder matches the help text', () => {
  const score = (vm, vf, am, af) => ({
    visual: { misses: vm, false: vf, mistakes: vm + vf },
    audio:  { misses: am, false: af, mistakes: am + af },
  });
  assert.equal(nextN(4, score(0, 0, 0, 0)), 5, 'clean round goes up');
  assert.equal(nextN(4, score(0, 2, 0, 2)), 5, 'under three each still goes up');
  assert.equal(nextN(4, score(0, 3, 0, 0)), 4, 'three in one sense holds');
  assert.equal(nextN(4, score(0, 3, 0, 3)), 3, 'more than five in total goes down');
  assert.equal(nextN(1, score(5, 5, 5, 5)), 1, 'N never drops below 1');
});

test('the recorded round reproduces its recorded score sheet', () => {
  // The round in the source recording: 24 trials at N = 4, the square positions
  // and letter groups read off the video frames and the audio track, and the
  // button presses timed from the same frames.
  // positions are 0-7, reading the grid left to right / top to bottom with the
  // unused middle square left out
  const positions = [1, 3, 7, 0, 1, 4, 0, 0, 5, 0, 1, 1, 5, 0, 6, 4, 5, 6, 2, 2, 5, 3, 1, 1];
  const letters   = [0, 1, 1, 2, 0, 1, 3, 4, 1, 0, 5, 0, 6, 5, 5, 3, 1, 1, 3, 5, 1, 1, 3, 4];
  const round = { n: 4, trials: 24, positions, letters };
  const pressed = (idx) => {
    const a = new Array(24).fill(false);
    idx.forEach((i) => { a[i] = true; });
    return a;
  };
  const s = scoreRound(round, {
    visual: pressed([4, 7, 9, 12, 13, 16, 19, 20]),
    audio:  pressed([4, 5, 8, 11, 13, 17, 20, 21, 23]),
  });
  // The app showed: eye 6 / 0 / 2 and ear 4 / 2 / 5, and dropped N from 4 to 3.
  assert.deepEqual([s.visual.hits, s.visual.misses, s.visual.false], [6, 0, 2]);
  assert.deepEqual([s.audio.hits, s.audio.misses, s.audio.false], [4, 2, 5]);
  assert.equal(nextN(4, s), 3);
});

test('the flash ramp hits the shape measured off the video', () => {
  assert.equal(flashAlpha(-10), 0);
  assert.equal(flashAlpha(0), 0);
  assert.ok(Math.abs(flashAlpha(250) - 0.5) < 1e-9, 'half way up at 250 ms');
  assert.equal(flashAlpha(TIMING.flashIn), 1);
  assert.equal(flashAlpha(TIMING.flashIn + TIMING.flashHold - 1), 1);
  assert.ok(Math.abs(flashAlpha(925 + TIMING.flashOut / 2) - 0.5) < 0.01, 'half way down');
  assert.equal(flashAlpha(2000), 0, 'back to teal after 2 s');
  assert.equal(flashAlpha(2999), 0);
  assert.ok(TIMING.flashIn + TIMING.flashHold + TIMING.flashOut < TIMING.trial);
});
