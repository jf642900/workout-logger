import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, addDays, blockWeek, isDeloadWeek, workoutIdForDate, formatShortDate, mondayOf } from '../src/lib/dates.js';

test('todayISO formats local date', () => {
  assert.equal(todayISO(new Date(2026, 10, 23, 23, 59)), '2026-11-23');
});
test('blockWeek counts from the block start Monday', () => {
  assert.equal(blockWeek('2026-09-28', '2026-09-28'), 1);
  assert.equal(blockWeek('2026-10-04', '2026-09-28'), 1);
  assert.equal(blockWeek('2026-10-05', '2026-09-28'), 2);
  assert.equal(blockWeek('2026-11-23', '2026-09-28'), 9);
  assert.equal(blockWeek('2026-12-27', '2026-09-28'), 13);
});
test('deload weeks', () => {
  assert.equal(isDeloadWeek(6, { deloadWeeks: [6, 12] }), true);
  assert.equal(isDeloadWeek(7, { deloadWeeks: [6, 12] }), false);
});
test('workoutIdForDate maps weekdays and null on weekends', () => {
  assert.equal(workoutIdForDate('2026-11-23'), 'mon');
  assert.equal(workoutIdForDate('2026-11-27'), 'fri');
  assert.equal(workoutIdForDate('2026-11-28'), null);
});
test('formatting and arithmetic', () => {
  assert.equal(formatShortDate('2026-11-09'), 'Mon 9 Nov');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 7), '2026-11-08'); // across DST change
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
});
