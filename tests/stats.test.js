import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weeklySummary, exerciseSeries, personalBests } from '../src/lib/stats.js';
import { PROGRAM_SEED } from '../src/seed/program.js';

const HISTORY = '/home/claude/build-inputs/history-import.json';
const exercises = PROGRAM_SEED.exercises;
const settings = PROGRAM_SEED.settings;
const ex = Object.fromEntries(exercises.map((e) => [e.id, e]));

test('weekly summary matches the workbook for weeks 1-7', (t) => {
  if (!fs.existsSync(HISTORY)) return t.skip('history-import.json not present');
  const data = JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  const sessions = data.sessions.map((s) => ({ ...s, finishedAt: s.finishedAt || s.startedAt || 'x' }));
  const rows = weeklySummary({ sessions, sets: data.sets, exercises });
  const col = (k) => rows.filter((r) => r.week <= 7).map((r) => r[k]);
  assert.deepEqual(rows.map((r) => r.week), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(col('pullupReps'), [0, 32, 46, 46, 38, 50, 12]);
  assert.deepEqual(col('pushupReps'), [46, 49, 44, 54, 64, 63, 0]);
  assert.deepEqual(col('pushVolume'), [750, 1980, 3155, 1705, 3775, 3475, 1600]);
  assert.deepEqual(col('pullVolume'), [750, 2475, 3405, 1890, 2585, 2595, 2780]);
  assert.deepEqual(col('lowerVolume'), [1170, 4030, 5040, 4380, 5510, 5490, 2880]);
});

let n = 0;
const sess = (date, workoutId = 'mon', extra = {}) => ({ id: `s${++n}`, workoutId, date, startedAt: date + 'T10:00', finishedAt: date + 'T11:00', blockWeek: 1, isDeload: false, ...extra });
const mk = (session, exerciseId, rows) => rows.map(([load, value, bandId = null, done = true], i) => ({
  id: `${session.id}-${exerciseId}-${i}`, sessionId: session.id, workoutId: session.workoutId, exerciseId,
  date: session.date, position: 0, setIndex: i + 1, load, bandId, value, done,
}));

test('unfinished sessions and unticked sets are ignored', () => {
  const a = sess('2026-10-05');
  const b = sess('2026-10-06', 'tue', { finishedAt: null });
  const sets = [...mk(a, 'flat-db-bench-press', [[40, 10], [40, 8, null, false]]), ...mk(b, 'flat-db-bench-press', [[40, 10]])];
  const rows = weeklySummary({ sessions: [a, b], sets, exercises });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pushVolume, 400);
  assert.equal(rows[0].workoutsDone, 1);
});

test('band series orders by band rank and keeps the band id', () => {
  const a = sess('2026-10-05', 'tue');
  const b = sess('2026-10-12', 'tue');
  const sets = [...mk(a, 'band-pull-apart', [[null, 15, 'yellow'], [null, 15, 'yellow'], [null, 12, 'blue']]),
    ...mk(b, 'band-pull-apart', [[null, 15, 'green']])];
  const s = exerciseSeries({ exercise: ex['band-pull-apart'], sessions: [b, a], sets, settings });
  assert.deepEqual(s.map((p) => p.bandOrder), [2, 4]);
  assert.equal(s[0].totalValue, 42);
  assert.equal(s[0].best, 15);
  const pb = personalBests({ exercise: ex['band-pull-apart'], item: { repMin: 15, repMax: 15 }, sessions: [a, b], sets, settings });
  assert.equal(pb[0].value, 'Green band');
});

test('dumbbell series combines days and PB needs every set at the rep floor', () => {
  const a = sess('2026-10-05', 'mon');
  const b = sess('2026-10-08', 'thu');
  const sets = [...mk(a, 'flat-db-bench-press', [[30, 10], [30, 9], [35, 6]]), ...mk(b, 'flat-db-bench-press', [[35, 8], [35, 8], [35, 9]])];
  const e = ex['flat-db-bench-press'];
  const s = exerciseSeries({ exercise: e, sessions: [a, b], sets, settings });
  assert.deepEqual(s.map((p) => [p.workoutId, p.load, p.volume]), [['mon', 30, 300 + 270 + 210], ['thu', 35, 35 * 25]]);
  const pb = personalBests({ exercise: e, item: { repMin: 8, repMax: 10 }, sessions: [a, b], sets, settings });
  assert.equal(pb[0].value, '35 lb');
  assert.equal(pb[0].date, '2026-10-08');
});

test('seconds and bodyweight bests', () => {
  const a = sess('2026-10-06', 'tue');
  const b = sess('2026-10-13', 'tue');
  const sets = [...mk(a, 'hollow-body-hold', [[null, 30], [null, 35]]), ...mk(b, 'hollow-body-hold', [[null, 40], [null, 30]]),
    ...mk(a, 'pull-up-strength-clusters', [[null, 2], [null, 3]])];
  const hb = personalBests({ exercise: ex['hollow-body-hold'], item: null, sessions: [a, b], sets, settings });
  assert.deepEqual(hb[0], { label: 'Longest hold', value: '40s', date: '2026-10-13' });
  const pu = personalBests({ exercise: ex['pull-up-strength-clusters'], item: null, sessions: [a, b], sets, settings });
  assert.equal(pu[0].value, '3 reps');
  assert.equal(weeklySummary({ sessions: [a, b], sets, exercises })[0].pullupReps, 5);
  assert.deepEqual(personalBests({ exercise: ex['vinyasa-hip-thoracic-flow'], sessions: [a], sets, settings }), []);
});
