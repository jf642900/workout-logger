import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_SEED } from '../src/seed/program.js';

test('seed program shape', () => {
  assert.equal(PROGRAM_SEED.workouts.map((w) => w.id).join(), 'mon,tue,wed,thu,fri');
  assert.equal(PROGRAM_SEED.exercises.length, 37);
  const ids = new Set(PROGRAM_SEED.exercises.map((e) => e.id));
  for (const w of PROGRAM_SEED.workouts) for (const i of w.items) assert.ok(ids.has(i.exerciseId), i.exerciseId);
  assert.deepEqual(PROGRAM_SEED.settings.bands.map((b) => b.id), ['blue', 'yellow', 'red', 'green']);
  assert.equal(PROGRAM_SEED.settings.dumbbellMax, 40);
  assert.ok(ids.has('face-pull'));
});
