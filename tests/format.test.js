import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setVolume, totalVolume, formatLoad, formatValues, sideLabel } from '../src/lib/format.js';
import { PROGRAM_SEED } from '../src/seed/program.js';

const ex = Object.fromEntries(PROGRAM_SEED.exercises.map((e) => [e.id, e]));
const settings = PROGRAM_SEED.settings;

test('volume is load x reps for dumbbell rep exercises only', () => {
  const bench = ex['flat-db-bench-press'];
  assert.equal(setVolume({ load: 40, value: 10, done: true }, bench), 400);
  assert.equal(setVolume({ load: 40, value: 10, done: false }, bench), 0);
  assert.equal(setVolume({ load: 30, value: 40, done: true }, ex['farmer-s-carry']), 0);
  assert.equal(setVolume({ load: null, bandId: 'red', value: 15, done: true }, ex['face-pull']), 0);
  assert.equal(totalVolume([
    { exerciseId: 'flat-db-bench-press', load: 40, value: 10, done: true },
    { exerciseId: 'flat-db-bench-press', load: 40, value: 9, done: true },
  ], ex), 760);
});
test('display helpers', () => {
  assert.equal(formatLoad({ load: 40 }, ex['flat-db-bench-press'], settings), '40 lb');
  assert.equal(formatLoad({ bandId: 'yellow' }, ex['face-pull'], settings), 'Yellow band');
  assert.equal(formatValues([{ value: 10 }, { value: 9 }], ex['flat-db-bench-press']), '10 / 9');
  assert.equal(formatValues([{ value: 30 }], ex['hollow-body-hold']), '30s');
  assert.equal(sideLabel(ex['bulgarian-split-squat']), '/ leg');
  assert.equal(sideLabel(ex['single-arm-db-row']), '/ side');
});
