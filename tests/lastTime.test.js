import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLastTime } from '../src/lib/lastTime.js';

const session = (id, workoutId, date, extra = {}) => ({
  id, workoutId, date, startedAt: `${date}T12:00:00`, finishedAt: `${date}T13:00:00`,
  blockWeek: 1, isDeload: false, note: '', source: 'import', ...extra,
});
const sets = (sessionId, workoutId, date, exerciseId, load, values, done = true) => values.map((value, i) => ({
  id: `${sessionId}-${exerciseId}-${i + 1}`, sessionId, workoutId, exerciseId, date, position: 1, setIndex: i + 1,
  load, bandId: null, value, done, overridden: false, rir: null, flag: null,
}));

// Goblet Squat is on Tuesday (3 x 10-12) and Friday (3 x 12): mirrors the imported history.
const sessions = [
  session('tue-1027', 'tue', '2026-10-27'),
  session('fri-1030', 'fri', '2026-10-30'),
  session('tue-1103', 'tue', '2026-11-03', { isDeload: true }),
  session('tue-1110', 'tue', '2026-11-10'),
  session('fri-1113', 'fri', '2026-11-13'),
  session('tue-1117', 'tue', '2026-11-17', { finishedAt: null }),
];
const allSets = [
  ...sets('tue-1027', 'tue', '2026-10-27', 'goblet-squat', 40, [10, 12, 10]),
  ...sets('fri-1030', 'fri', '2026-10-30', 'goblet-squat', 40, [12, 12, 12]),
  ...sets('tue-1103', 'tue', '2026-11-03', 'goblet-squat', 40, [12, 12, 12]),
  ...sets('tue-1110', 'tue', '2026-11-10', 'goblet-squat', 40, [12, 11, 12]).reverse(),
  ...sets('fri-1113', 'fri', '2026-11-13', 'goblet-squat', 35, [12, 12, 12]),
  ...sets('tue-1117', 'tue', '2026-11-17', 'goblet-squat', 45, [12, 12, 12]),
  ...sets('tue-1110', 'tue', '2026-11-10', 'band-pull-apart', null, [15, 15]),
];

test('same workout day wins over a more recent other day', () => {
  const r = findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', sessions, sets: allSets });
  assert.equal(r.session.id, 'tue-1110');
  assert.equal(r.sameDay, true);
  assert.deepEqual(r.sets.map((s) => s.value), [12, 11, 12], 'sorted by setIndex');
  assert.ok(r.sets.every((s) => s.exerciseId === 'goblet-squat'));
});

test('Friday looks at Friday', () => {
  const r = findLastTime({ exerciseId: 'goblet-squat', workoutId: 'fri', sessions, sets: allSets });
  assert.equal(r.session.id, 'fri-1113');
  assert.equal(r.sets[0].load, 35);
});

test('ignores deload, unfinished and the active session', () => {
  const onlyBad = sessions.filter((s) => ['tue-1103', 'tue-1117'].includes(s.id));
  assert.equal(findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', sessions: onlyBad, sets: allSets }), null);
  const finishedDraft = sessions.map((s) => (s.id === 'tue-1117' ? { ...s, finishedAt: '2026-11-17T13:00:00' } : s));
  const r = findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', activeSessionId: 'tue-1117', sessions: finishedDraft, sets: allSets });
  assert.equal(r.session.id, 'tue-1110');
});

test('falls back to any day when the same day has none', () => {
  const r = findLastTime({ exerciseId: 'goblet-squat', workoutId: 'mon', sessions, sets: allSets });
  assert.equal(r.session.id, 'fri-1113');
  assert.equal(r.sameDay, false);
});

test('latest date, then latest startedAt', () => {
  const twins = [
    session('a', 'tue', '2026-11-10', { startedAt: '2026-11-10T07:00:00' }),
    session('b', 'tue', '2026-11-10', { startedAt: '2026-11-10T18:00:00' }),
  ];
  const rows = [...sets('a', 'tue', '2026-11-10', 'goblet-squat', 30, [10]), ...sets('b', 'tue', '2026-11-10', 'goblet-squat', 35, [10])];
  assert.equal(findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', sessions: twins, sets: rows }).session.id, 'b');
});

test('only done sets count; sessions without done sets are skipped', () => {
  const s2 = [session('x', 'tue', '2026-11-10'), session('y', 'tue', '2026-11-12')];
  const rows = [...sets('x', 'tue', '2026-11-10', 'goblet-squat', 30, [10, 10]), ...sets('y', 'tue', '2026-11-12', 'goblet-squat', 35, [10], false)];
  const r = findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', sessions: s2, sets: rows });
  assert.equal(r.session.id, 'x');
});

test('no history → null', () => {
  assert.equal(findLastTime({ exerciseId: 'nope', workoutId: 'tue', sessions, sets: allSets }), null);
  assert.equal(findLastTime({ exerciseId: 'goblet-squat', workoutId: 'tue', sessions: [], sets: [] }), null);
});
