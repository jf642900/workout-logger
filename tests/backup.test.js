import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, validateBackup, toCSV, backupFileName } from '../src/lib/backup.js';

const data = () => ({
  settings: { id: 'settings', bands: [{ id: 'blue', name: 'Blue', colour: '#00f', order: 1 }] },
  exercises: [{ id: 'a', name: 'Curl, "heavy"', measure: 'reps' }, { id: 'b', name: 'Hold', measure: 'seconds' }],
  workouts: [{ id: 'mon', name: 'Monday', items: [] }],
  sessions: [{ id: 's1', workoutId: 'mon', date: '2026-10-05', blockWeek: 2 }, { id: 's0', workoutId: 'mon', date: '2026-10-01', blockWeek: 1 }],
  sets: [
    { id: 'x3', sessionId: 's1', workoutId: 'mon', exerciseId: 'b', date: '2026-10-05', position: 2, setIndex: 1, load: null, bandId: null, value: 30, flag: null },
    { id: 'x2', sessionId: 's1', workoutId: 'mon', exerciseId: 'a', date: '2026-10-05', position: 1, setIndex: 2, load: 10, bandId: 'blue', value: 8, flag: 'odd, "flag"' },
    { id: 'x1', sessionId: 's0', workoutId: 'mon', exerciseId: 'a', date: '2026-10-01', position: 1, setIndex: 1, load: 10, bandId: null, value: 9, flag: null },
    { id: 'x4', sessionId: 's1', workoutId: 'mon', exerciseId: 'a', date: '2026-10-05', position: 1, setIndex: 1, load: 10, bandId: null, value: 10, flag: null },
  ],
});

test('buildBackup wraps data and validates', () => {
  const b = buildBackup(data(), '2026-11-23T10:00:00.000Z');
  assert.equal(b.format, 'workout-logger-backup');
  const v = validateBackup(JSON.parse(JSON.stringify(b)));
  assert.equal(v.ok, true);
  assert.equal(v.data.sets.length, 4);
});

test('validateBackup reports readable errors', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.match(validateBackup({ format: 'x', schemaVersion: 1, data: data() }).errors[0], /Not a Workout Logger backup/);
  const noArr = buildBackup(data(), 'n'); delete noArr.data.sets;
  assert.match(validateBackup(noArr).errors.join(' '), /"sets"/);
  const noSettings = buildBackup(data(), 'n'); noSettings.data.settings = null;
  assert.match(validateBackup(noSettings).errors.join(' '), /Settings/);
  const badVer = buildBackup(data(), 'n'); badVer.schemaVersion = 9;
  assert.equal(validateBackup(badVer).ok, false);
});

test('validateBackup checks set references', () => {
  const d = data(); d.sets[0].sessionId = 'nope'; d.sets[1].exerciseId = 'ghost';
  const v = validateBackup(buildBackup(d, 'n'));
  assert.equal(v.ok, false);
  assert.match(v.errors.join(' '), /nope/);
  assert.match(v.errors.join(' '), /ghost/);
});

test('toCSV header, order, quoting', () => {
  const lines = toCSV(data()).trimEnd().split('\r\n');
  assert.equal(lines[0], 'date,week,workout,exercise,set,load_lb,band,value,unit,flag');
  assert.equal(lines.length, 5);
  assert.equal(lines[1], '2026-10-01,1,Monday,"Curl, ""heavy""",1,10,,9,reps,');
  assert.match(lines[2], /"Curl, ""heavy""",1,10,,10,reps,$/);
  assert.match(lines[3], /,2,10,Blue,8,reps,"odd, ""flag"""$/);
  assert.equal(lines[4], '2026-10-05,2,Monday,Hold,1,,,30,seconds,');
});

test('backupFileName', () => {
  assert.equal(backupFileName('2026-11-23T10:00:00Z'), 'workout-logger-backup-2026-11-23.json');
  assert.equal(backupFileName('2026-11-23T10:00:00Z', 'csv'), 'workout-logger-backup-2026-11-23.csv');
});
