import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseHistoryFile } from '../src/lib/importer.js';
import { PROGRAM_SEED } from '../src/seed/program.js';

const FILE = '/home/claude/build-inputs/history-import.json';
const mini = () => ({
  format: 'workout-logger-history', schemaVersion: 1,
  sessions: [{ id: 's1' }],
  sets: [{ id: 'a', sessionId: 's1', exerciseId: 'ex', value: 5, load: 10, flag: null }, { id: 'b', sessionId: 's1', exerciseId: 'ex', value: 5, load: null, flag: 'check' }],
});
const ctx = { exercises: [{ id: 'ex' }] };

test('parses a minimal file and flags', () => {
  const r = parseHistoryFile(mini(), ctx);
  assert.equal(r.ok, true);
  assert.equal(r.sets.length, 2);
  assert.equal(r.flagged.length, 1);
});

test('rejects bad format, version, shapes', () => {
  assert.equal(parseHistoryFile(null, ctx).ok, false);
  assert.equal(parseHistoryFile({ ...mini(), format: 'x' }, ctx).ok, false);
  assert.equal(parseHistoryFile({ ...mini(), schemaVersion: 2 }, ctx).ok, false);
  const m = mini(); delete m.sets;
  assert.equal(parseHistoryFile(m, ctx).ok, false);
});

test('reports unknown exercises, orphan sets, bad values', () => {
  const m = mini(); m.sets[0].exerciseId = 'zzz'; m.sets[1].sessionId = 'gone'; m.sets[1].value = '5';
  const r = parseHistoryFile(m, ctx);
  assert.equal(r.ok, false);
  const text = r.errors.join(' ');
  assert.match(text, /zzz/); assert.match(text, /gone/); assert.match(text, /not a number/);
});

test('real history file', { skip: !existsSync(FILE) && 'history file not present' }, () => {
  const r = parseHistoryFile(JSON.parse(readFileSync(FILE, 'utf8')), { exercises: PROGRAM_SEED.exercises });
  assert.deepEqual(r.errors, []);
  assert.equal(r.sessions.length, 28);
  assert.equal(r.sets.length, 479);
  assert.equal(r.flagged.length, 9);
});
