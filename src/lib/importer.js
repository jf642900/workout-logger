// importer.js — STUB from WP0; implemented by WP4a. Pure: never import db.js.
// Reads the history file prepared from the Numbers workbook (format 'workout-logger-history', schemaVersion 1).

/**
 * Validates the parsed history file against the current exercises.
 * @param {any} obj parsed JSON
 * @param {{exercises:import('../db.js').Exercise[]}} ctx
 * @returns {{ok:boolean, errors:string[], sessions:object[], sets:object[], flagged:object[]}}
 *   flagged = sets with a non-null flag. Feed {sessions, sets} to db.mergeHistory().
 */
export function parseHistoryFile(obj, { exercises }) {
  return { ok: false, errors: ['Not implemented'], sessions: [], sets: [], flagged: [] };
}
