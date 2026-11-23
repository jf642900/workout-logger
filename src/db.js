// db.js — the ONLY module that touches IndexedDB. Owned by WP0; signatures are frozen.
// Every function returns plain objects. Screens call these; src/lib/ never imports this file.

import { PROGRAM_SEED } from './seed/program.js';

export const DB_NAME = 'workout-logger-db';
export const DB_VERSION = 1;
export const STORES = ['settings', 'exercises', 'workouts', 'sessions', 'sets'];
const WORKOUT_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri'];

/** Thrown by createSession when an unfinished session already exists. */
export class ActiveSessionError extends Error {
  /** @param {Session} session */
  constructor(session) {
    super('An unfinished workout already exists');
    this.name = 'ActiveSessionError';
    this.session = session;
  }
}

/**
 * @typedef {{id:'settings', blockStartDate:string, blockWeeks:number, deloadWeeks:number[], units:'lb',
 *   dumbbellStep:number, dumbbellMin:number, dumbbellMax:number,
 *   bands:{id:string,name:string,colour:string,order:number}[], progressionLadder:string[],
 *   lastBackupAt:string|null, backupNudgeDismissedAt:string|null, schemaVersion:number}} Settings
 * @typedef {{id:string, name:string, category:string, loadType:'dumbbell'|'band'|'none',
 *   measure:'reps'|'seconds'|'done', perSide:boolean, sideUnit:'leg'|'side'|null,
 *   cue:string, rest:string, archived:boolean}} Exercise
 * @typedef {{exerciseId:string, part:'AM'|'PM', sets:number, repMin:number|null, repMax:number|null, targetText:string}} WorkoutItem
 * @typedef {{id:string, name:string, items:WorkoutItem[]}} Workout
 * @typedef {{id:string, workoutId:string, date:string, startedAt:string, finishedAt:string|null,
 *   blockWeek:number, isDeload:boolean, note:string, source:'app'|'import',
 *   skipped?:string[]}} Session
 * @typedef {{id:string, sessionId:string, workoutId:string, exerciseId:string, date:string,
 *   position:number, setIndex:number, load:number|null, bandId:string|null, value:number|null,
 *   done:boolean, overridden:boolean, rir:number|null, flag:string|null}} SetRow
 */

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/** Versioned migrations. Add a new numbered entry and bump DB_VERSION; never edit an old one. */
const MIGRATIONS = {
  1(db, tx) {
    db.createObjectStore('settings', { keyPath: 'id' });
    db.createObjectStore('exercises', { keyPath: 'id' });
    db.createObjectStore('workouts', { keyPath: 'id' });
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('date', 'date');
    sessions.createIndex('workoutId', 'workoutId');
    const sets = db.createObjectStore('sets', { keyPath: 'id' });
    sets.createIndex('sessionId', 'sessionId');
    sets.createIndex('exerciseId_date', ['exerciseId', 'date']);
    sets.createIndex('workoutId_exerciseId_date', ['workoutId', 'exerciseId', 'date']);
    seedInto(tx);
  },
};

function seedInto(tx) {
  tx.objectStore('settings').put({
    id: 'settings',
    ...PROGRAM_SEED.settings,
    progressionLadder: PROGRAM_SEED.progressionLadder,
    lastBackupAt: null,
    backupNudgeDismissedAt: null,
    schemaVersion: PROGRAM_SEED.schemaVersion,
  });
  for (const ex of PROGRAM_SEED.exercises) tx.objectStore('exercises').put(ex);
  for (const w of PROGRAM_SEED.workouts) tx.objectStore('workouts').put(w);
}

/** @returns {Promise<IDBDatabase>} */
export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        for (let v = event.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v](db, request.transaction);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database upgrade blocked: close other copies of the app'));
    });
  }
  return dbPromise;
}

async function readAll(storeName) {
  const db = await openDB();
  return promisify(db.transaction(storeName).objectStore(storeName).getAll());
}

async function readOne(storeName, key) {
  const db = await openDB();
  const value = await promisify(db.transaction(storeName).objectStore(storeName).get(key));
  return value ?? null;
}

async function writeMany(storeName, records) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  for (const r of records) tx.objectStore(storeName).put(r);
  await done(tx);
}

/** @returns {string} a new unique id */
export function newId(prefix = 'id') {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

// ---------- settings ----------

/** @returns {Promise<Settings>} */
export async function getSettings() {
  return readOne('settings', 'settings');
}

/** Shallow-merges patch into settings. @returns {Promise<Settings>} */
export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch, id: 'settings' };
  await writeMany('settings', [next]);
  return next;
}

// ---------- exercises & workouts (the program) ----------

/** @returns {Promise<Exercise[]>} sorted by name */
export async function listExercises({ includeArchived = false } = {}) {
  const all = await readAll('exercises');
  return all.filter((e) => includeArchived || !e.archived).sort((a, b) => a.name.localeCompare(b.name));
}

/** @returns {Promise<Exercise|null>} */
export async function getExercise(id) {
  return readOne('exercises', id);
}

/** Insert or replace an exercise. Ids never change once created (history hangs on them). */
export async function putExercise(exercise) {
  await writeMany('exercises', [exercise]);
  return exercise;
}

/** @returns {Promise<Workout[]>} in Mon–Fri order */
export async function listWorkouts() {
  const all = await readAll('workouts');
  return all.sort((a, b) => WORKOUT_ORDER.indexOf(a.id) - WORKOUT_ORDER.indexOf(b.id));
}

/** @returns {Promise<Workout|null>} */
export async function getWorkout(id) {
  return readOne('workouts', id);
}

export async function putWorkout(workout) {
  await writeMany('workouts', [workout]);
  return workout;
}

// ---------- sessions ----------

function sessionSort(a, b) {
  return b.date.localeCompare(a.date) || (b.startedAt || '').localeCompare(a.startedAt || '');
}

/** @returns {Promise<Session[]>} newest first */
export async function listSessions({ finishedOnly = false } = {}) {
  const all = await readAll('sessions');
  return all.filter((s) => !finishedOnly || s.finishedAt).sort(sessionSort);
}

/** @returns {Promise<Session|null>} */
export async function getSession(id) {
  return readOne('sessions', id);
}

/** The single unfinished session, if any. @returns {Promise<Session|null>} */
export async function getActiveSession() {
  const all = await readAll('sessions');
  return all.filter((s) => !s.finishedAt).sort(sessionSort)[0] ?? null;
}

/**
 * Creates an unfinished session. Enforces the single-draft rule.
 * Callers compute blockWeek / isDeload with src/lib/dates.js.
 * @param {{workoutId:string, date:string, blockWeek:number, isDeload:boolean}} args
 * @returns {Promise<Session>}
 * @throws {ActiveSessionError}
 */
export async function createSession({ workoutId, date, blockWeek, isDeload }) {
  const active = await getActiveSession();
  if (active) throw new ActiveSessionError(active);
  const session = {
    id: newId('s'), workoutId, date, startedAt: new Date().toISOString(), finishedAt: null,
    blockWeek, isDeload: !!isDeload, note: '', source: 'app', skipped: [],
  };
  await writeMany('sessions', [session]);
  return session;
}

/** @returns {Promise<Session>} */
export async function updateSession(id, patch) {
  const current = await getSession(id);
  if (!current) throw new Error(`No session ${id}`);
  const next = { ...current, ...patch, id };
  await writeMany('sessions', [next]);
  return next;
}

/** Marks finished and deletes sets that were never ticked (done:false). @returns {Promise<Session>} */
export async function finishSession(id, { note } = {}) {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const sessions = tx.objectStore('sessions');
  const sets = tx.objectStore('sets');
  const session = await promisify(sessions.get(id));
  if (!session) throw new Error(`No session ${id}`);
  const rows = await promisify(sets.index('sessionId').getAll(id));
  for (const r of rows) if (!r.done) sets.delete(r.id);
  const next = { ...session, finishedAt: new Date().toISOString(), note: note ?? session.note };
  sessions.put(next);
  await done(tx);
  return next;
}

/** Deletes a session and all its sets. */
export async function deleteSession(id) {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const rows = await promisify(tx.objectStore('sets').index('sessionId').getAllKeys(id));
  for (const key of rows) tx.objectStore('sets').delete(key);
  tx.objectStore('sessions').delete(id);
  await done(tx);
}

// ---------- sets ----------

/** @returns {Promise<SetRow[]>} every set in the database */
export async function listSets() {
  return readAll('sets');
}

/** @returns {Promise<SetRow[]>} ordered by position, then setIndex */
export async function getSetsForSession(sessionId) {
  const db = await openDB();
  const rows = await promisify(db.transaction('sets').objectStore('sets').index('sessionId').getAll(sessionId));
  return rows.sort((a, b) => a.position - b.position || a.setIndex - b.setIndex);
}

/** @returns {Promise<SetRow[]>} all sets of one exercise, oldest first */
export async function getSetsForExercise(exerciseId) {
  const db = await openDB();
  const range = IDBKeyRange.bound([exerciseId, ''], [exerciseId, '￿']);
  return promisify(db.transaction('sets').objectStore('sets').index('exerciseId_date').getAll(range));
}

export async function putSet(set) {
  await writeMany('sets', [set]);
  return set;
}

export async function putSets(sets) {
  await writeMany('sets', sets);
  return sets;
}

export async function deleteSet(id) {
  const db = await openDB();
  const tx = db.transaction('sets', 'readwrite');
  tx.objectStore('sets').delete(id);
  await done(tx);
}

// ---------- whole-database operations (backup, restore, import) ----------

/** @returns {Promise<{settings:Settings, exercises:Exercise[], workouts:Workout[], sessions:Session[], sets:SetRow[]}>} */
export async function exportAll() {
  const [settings, exercises, workouts, sessions, sets] = await Promise.all([
    getSettings(), readAll('exercises'), readAll('workouts'), readAll('sessions'), readAll('sets'),
  ]);
  return { settings, exercises, workouts, sessions, sets };
}

/** Restore: wipes every store and writes the given data in one transaction. */
export async function replaceAll(data) {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) tx.objectStore(name).clear();
  tx.objectStore('settings').put({ ...data.settings, id: 'settings' });
  for (const name of ['exercises', 'workouts', 'sessions', 'sets']) {
    for (const r of data[name] || []) tx.objectStore(name).put(r);
  }
  await done(tx);
}

/**
 * Adds sessions and sets whose ids are not already present (history import; safe to run twice).
 * Accepts the build-inputs/history-import.json shape directly.
 * @returns {Promise<{addedSessions:number, addedSets:number}>}
 */
export async function mergeHistory({ sessions = [], sets = [] }) {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'sets'], 'readwrite');
  const existingSessions = new Set(await promisify(tx.objectStore('sessions').getAllKeys()));
  const existingSets = new Set(await promisify(tx.objectStore('sets').getAllKeys()));
  let addedSessions = 0;
  let addedSets = 0;
  for (const s of sessions) if (!existingSessions.has(s.id)) { tx.objectStore('sessions').put(s); addedSessions++; }
  for (const s of sets) if (!existingSets.has(s.id)) { tx.objectStore('sets').put(s); addedSets++; }
  await done(tx);
  return { addedSessions, addedSets };
}

/** Test/dev helper: deletes the database entirely (Settings "erase all data"). */
export async function deleteDatabase() {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await promisify(indexedDB.deleteDatabase(DB_NAME));
}
