// dates.js — pure date helpers. All dates are local-calendar ISO strings 'YYYY-MM-DD'. Owned by WP0.

export const WORKOUT_IDS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** @param {Date} [now] @returns {string} today's local date as YYYY-MM-DD */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @param {string} iso @returns {Date} local noon on that date (noon avoids DST edge cases) */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** @returns {string} iso shifted by n days */
export function addDays(iso, n) {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + n);
  return todayISO(dt);
}

/** @returns {number} whole days from a to b (b - a) */
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

/** 1-based block week for a date. Before the block start it is <= 0; after the block it keeps counting. */
export function blockWeek(iso, blockStartISO) {
  return Math.floor(daysBetween(blockStartISO, iso) / 7) + 1;
}

/** @param {number} week @param {{deloadWeeks:number[]}} settings */
export function isDeloadWeek(week, settings) {
  return (settings?.deloadWeeks || []).includes(week);
}

/** @returns {'mon'|'tue'|'wed'|'thu'|'fri'|null} the workout for that weekday, null on weekends */
export function workoutIdForDate(iso) {
  const id = DAY_IDS[parseISO(iso).getDay()];
  return WORKOUT_IDS.includes(id) ? id : null;
}

/** @returns {string} 'Mon' */
export function weekdayShort(iso) {
  return DAY_SHORT[parseISO(iso).getDay()];
}

/** @returns {string} 'Mon 9 Nov' */
export function formatShortDate(iso) {
  const dt = parseISO(iso);
  return `${DAY_SHORT[dt.getDay()]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}`;
}

/** @returns {string} '9 Nov' — compact chart label */
export function formatDayMonth(iso) {
  const dt = parseISO(iso);
  return `${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}`;
}

/** @returns {string} the Monday (YYYY-MM-DD) of the week containing iso */
export function mondayOf(iso) {
  const day = parseISO(iso).getDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}
