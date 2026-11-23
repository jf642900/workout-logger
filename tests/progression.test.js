import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestNext } from '../src/lib/progression.js';
import { PROGRAM_SEED } from '../src/seed/program.js';

const settings = { ...PROGRAM_SEED.settings, progressionLadder: PROGRAM_SEED.progressionLadder };
const ex = (id) => PROGRAM_SEED.exercises.find((e) => e.id === id);
const item = (workoutId, exerciseId) => PROGRAM_SEED.workouts.find((w) => w.id === workoutId).items.find((i) => i.exerciseId === exerciseId);
const last = (values, { load = null, bandId = null } = {}) => ({
  sets: values.map((value, i) => ({ setIndex: i + 1, value, load, bandId, done: true })),
});

test('Flat DB Bench Press at 40 lb 10/10/10/10 → ladder, never 45 lb', () => {
  const r = suggestNext({ exercise: ex('flat-db-bench-press'), item: item('mon', 'flat-db-bench-press'), last: last([10, 10, 10, 10], { load: 40 }), settings });
  assert.equal(r.kind, 'ladder');
  assert.equal(r.step, '4s lowering (eccentric)');
  assert.match(r.text, /4s lowering/);
  assert.equal(r.load, undefined);
});

test('Rear Delt Flye 20 lb 15/15/15 at 3 x 12-15 → 25 lb', () => {
  const r = suggestNext({ exercise: ex('chest-supported-rear-delt-flye'), item: item('wed', 'chest-supported-rear-delt-flye'), last: last([15, 15, 15], { load: 20 }), settings });
  assert.deepEqual({ kind: r.kind, load: r.load }, { kind: 'load', load: 25 });
  assert.match(r.text, /25 lb/);
});

test('one set short of the top of the range → no hint', () => {
  assert.equal(suggestNext({ exercise: ex('chest-supported-rear-delt-flye'), item: item('wed', 'chest-supported-rear-delt-flye'), last: last([15, 15, 14], { load: 15 }), settings }), null);
});

test('fewer sets than the target → no hint', () => {
  assert.equal(suggestNext({ exercise: ex('flat-db-bench-press'), item: item('mon', 'flat-db-bench-press'), last: last([10, 10, 10], { load: 35 }), settings }), null);
});

test('Goblet Squat 40 lb 12/12/12: Tue (10-12) and Fri (12) both at the cap → ladder', () => {
  for (const day of ['tue', 'fri']) {
    const r = suggestNext({ exercise: ex('goblet-squat'), item: item(day, 'goblet-squat'), last: last([12, 12, 12], { load: 40 }), settings });
    assert.equal(r.kind, 'ladder', day);
  }
  const r = suggestNext({ exercise: ex('goblet-squat'), item: item('tue', 'goblet-squat'), last: last([10, 12, 10], { load: 35 }), settings });
  assert.equal(r, null);
});

test('respects a raised dumbbellMax and clamps the step', () => {
  const r = suggestNext({ exercise: ex('flat-db-bench-press'), item: item('mon', 'flat-db-bench-press'), last: last([10, 10, 10, 10], { load: 40 }), settings: { ...settings, dumbbellMax: 50 } });
  assert.deepEqual([r.kind, r.load], ['load', 45]);
  const c = suggestNext({ exercise: ex('flat-db-bench-press'), item: item('mon', 'flat-db-bench-press'), last: last([10, 10, 10, 10], { load: 38 }), settings });
  assert.equal(c.load, 40);
});

test('band → next band by order; heaviest band → add a rep or a set', () => {
  const fp = ex('face-pull');
  const it = item('mon', 'face-pull');
  const r = suggestNext({ exercise: fp, item: it, last: last([12, 12], { bandId: 'yellow' }), settings });
  assert.deepEqual([r.kind, r.bandId], ['band', 'red']);
  assert.match(r.text, /Red/);
  assert.equal(suggestNext({ exercise: fp, item: it, last: last([15, 15], { bandId: 'green' }), settings }).kind, 'reps');
  assert.equal(suggestNext({ exercise: fp, item: it, last: last([15, 15]), settings }), null, 'no band recorded');
});

test('bodyweight reps at the top → add a rep or a set', () => {
  const r = suggestNext({ exercise: ex('pull-up-strength-clusters'), item: item('tue', 'pull-up-strength-clusters'), last: last([2, 2, 2, 2, 2, 2, 2]), settings });
  assert.deepEqual(r, { kind: 'reps', text: 'Add a rep or a set' });
});

test('seconds, done-only, missing repMax or no history → null', () => {
  assert.equal(suggestNext({ exercise: ex('hollow-body-hold'), item: item('tue', 'hollow-body-hold'), last: last([30, 30, 30]), settings }), null);
  assert.equal(suggestNext({ exercise: ex('scap-cuff-prep'), item: item('mon', 'scap-cuff-prep'), last: last([null]), settings }), null);
  const pushups = ex('push-ups-density-sets');
  assert.equal(suggestNext({ exercise: pushups, item: { ...item('fri', 'push-ups-density-sets'), repMax: null }, last: last([20, 20, 20, 20]), settings }), null);
  assert.equal(suggestNext({ exercise: ex('flat-db-bench-press'), item: item('mon', 'flat-db-bench-press'), last: null, settings }), null);
});
