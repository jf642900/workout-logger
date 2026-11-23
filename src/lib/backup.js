// backup.js — STUB from WP0; implemented by WP4a. Pure: never import db.js.

export const BACKUP_FORMAT = 'workout-logger-backup';

/**
 * Wraps exportAll() data in a versioned envelope.
 * @param {{settings:object, exercises:object[], workouts:object[], sessions:object[], sets:object[]}} data
 * @param {string} nowISO
 * @returns {{format:string, schemaVersion:number, exportedAt:string, data:object}}
 */
export function buildBackup(data, nowISO) {
  return { format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: nowISO, data };
}

/** @returns {{ok:boolean, errors:string[], data?:object}} validates a parsed backup file before replaceAll() */
export function validateBackup(obj) {
  return { ok: false, errors: ['Not implemented'] };
}

/** One CSV row per set: date, week, workout, exercise, set, load_lb, band, value, unit, flag. @returns {string} */
export function toCSV({ sessions, sets, exercises, workouts, settings }) {
  return '';
}

/** @returns {string} file name like 'workout-logger-backup-2026-11-23.json' */
export function backupFileName(nowISO, ext = 'json') {
  return `workout-logger-backup-${nowISO.slice(0, 10)}.${ext}`;
}
