// importer.js — history file parser. Pure: never import db.js. Owned by WP4a.
// Reads the history file prepared from the Numbers workbook (format 'workout-logger-history', schemaVersion 1).

export const HISTORY_FORMAT = 'workout-logger-history';

/**
 * Validates the parsed history file against the current exercises.
 * @param {any} obj parsed JSON
 * @param {{exercises:import('../db.js').Exercise[]}} ctx
 * @returns {{ok:boolean, errors:string[], sessions:object[], sets:object[], flagged:object[]}}
 *   flagged = sets with a non-null flag. Feed {sessions, sets} to db.mergeHistory().
 */
export function parseHistoryFile(obj, { exercises = [] } = {}) {
  const fail = (errors) => ({ ok: false, errors, sessions: [], sets: [], flagged: [] });
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail(['This is not a history file.']);
  const errors = [];
  if (obj.format !== HISTORY_FORMAT) errors.push(`Not a history file (format is "${obj.format ?? 'missing'}").`);
  if (obj.schemaVersion !== 1) errors.push(`Unsupported history version: ${obj.schemaVersion ?? 'missing'}.`);
  if (!Array.isArray(obj.sessions)) errors.push('The "sessions" list is missing.');
  if (!Array.isArray(obj.sets)) errors.push('The "sets" list is missing.');
  if (errors.length) return fail(errors);

  const known = new Set(exercises.map((e) => e.id));
  const sessionIds = new Set(obj.sessions.map((s) => s?.id));
  const unknownEx = new Set();
  const orphan = new Set();
  let badValues = 0;
  for (const s of obj.sets) {
    if (!known.has(s?.exerciseId)) unknownEx.add(s?.exerciseId);
    if (!sessionIds.has(s?.sessionId)) orphan.add(s?.sessionId);
    const numOrNull = (v) => v == null || (typeof v === 'number' && Number.isFinite(v));
    if (!numOrNull(s?.value) || !numOrNull(s?.load)) badValues++;
  }
  if (unknownEx.size) errors.push(`Unknown exercise id(s): ${[...unknownEx].join(', ')}.`);
  if (orphan.size) errors.push(`${orphan.size} set session id(s) are not in the file: ${[...orphan].slice(0, 5).join(', ')}.`);
  if (badValues) errors.push(`${badValues} set(s) have a load or value that is not a number.`);
  if (errors.length) return fail(errors);
  return {
    ok: true, errors: [], sessions: obj.sessions, sets: obj.sets,
    flagged: obj.sets.filter((s) => s.flag != null && s.flag !== ''),
  };
}
