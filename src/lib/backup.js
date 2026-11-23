// backup.js — backup envelope, validation and CSV. Pure: never import db.js. Owned by WP4a.

export const BACKUP_FORMAT = 'workout-logger-backup';
const ARRAYS = ['exercises', 'workouts', 'sessions', 'sets'];
const CSV_HEADER = ['date', 'week', 'workout', 'exercise', 'set', 'load_lb', 'band', 'value', 'unit', 'flag'];

/**
 * Wraps exportAll() data in a versioned envelope.
 * @param {{settings:object, exercises:object[], workouts:object[], sessions:object[], sets:object[]}} data
 * @param {string} nowISO
 * @returns {{format:string, schemaVersion:number, exportedAt:string, data:object}}
 */
export function buildBackup(data, nowISO) {
  return { format: BACKUP_FORMAT, schemaVersion: 1, exportedAt: nowISO, data };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** @returns {{ok:boolean, errors:string[], data?:object}} validates a parsed backup file before replaceAll() */
export function validateBackup(obj) {
  const errors = [];
  if (!isObj(obj)) return { ok: false, errors: ['This is not a backup file.'] };
  if (obj.format !== BACKUP_FORMAT) errors.push(`Not a Workout Logger backup (format is "${obj.format ?? 'missing'}").`);
  if (obj.schemaVersion !== 1) errors.push(`Unsupported backup version: ${obj.schemaVersion ?? 'missing'}.`);
  const data = obj.data;
  if (!isObj(data)) return { ok: false, errors: [...errors, 'The backup has no data section.'] };
  if (!isObj(data.settings)) errors.push('Settings are missing.');
  for (const k of ARRAYS) if (!Array.isArray(data[k])) errors.push(`The "${k}" list is missing.`);
  if (errors.length) return { ok: false, errors };
  const sessionIds = new Set(data.sessions.map((s) => s?.id));
  const exerciseIds = new Set(data.exercises.map((e) => e?.id));
  const badSession = new Set();
  const badExercise = new Set();
  for (const s of data.sets) {
    if (!sessionIds.has(s?.sessionId)) badSession.add(s?.sessionId);
    if (!exerciseIds.has(s?.exerciseId)) badExercise.add(s?.exerciseId);
  }
  if (badSession.size) errors.push(`${badSession.size} session id(s) used by sets are missing: ${[...badSession].slice(0, 5).join(', ')}.`);
  if (badExercise.size) errors.push(`${badExercise.size} exercise id(s) used by sets are missing: ${[...badExercise].slice(0, 5).join(', ')}.`);
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], data };
}

/** Quotes a CSV field per RFC 4180. */
function csvField(v) {
  if (v == null) return '';
  const str = String(v);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** One CSV row per set: date, week, workout, exercise, set, load_lb, band, value, unit, flag. @returns {string} */
export function toCSV({ sessions = [], sets = [], exercises = [], workouts = [], settings = {} }) {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const bandById = new Map((settings.bands || []).map((b) => [b.id, b]));
  const sorted = [...sets].sort((a, b) => String(a.date).localeCompare(String(b.date))
    || (a.position ?? 0) - (b.position ?? 0) || (a.setIndex ?? 0) - (b.setIndex ?? 0));
  const rows = [CSV_HEADER];
  for (const s of sorted) {
    const ses = sessionById.get(s.sessionId);
    const ex = exById.get(s.exerciseId);
    const wk = wById.get(s.workoutId);
    rows.push([
      s.date, ses?.blockWeek ?? '', wk?.name ?? s.workoutId, ex?.name ?? s.exerciseId, s.setIndex,
      s.load, s.bandId ? (bandById.get(s.bandId)?.name ?? s.bandId) : '', s.value,
      ex ? (ex.measure === 'seconds' ? 'seconds' : ex.measure === 'done' ? 'done' : 'reps') : '', s.flag,
    ]);
  }
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** @returns {string} file name like 'workout-logger-backup-2026-11-23.json' */
export function backupFileName(nowISO, ext = 'json') {
  return `workout-logger-backup-${nowISO.slice(0, 10)}.${ext}`;
}
