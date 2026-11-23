// logData.js — data helpers for the Log screen: initial set rows, summaries, personal bests (WP1).
import { newId } from '../db.js';
import { bandById, formatValues } from '../lib/format.js';
import { findLastTime } from '../lib/lastTime.js';

/** Lightest band by order, or null. */
export function lightestBand(settings) {
  return [...(settings?.bands || [])].sort((a, b) => a.order - b.order)[0] ?? null;
}

/** Most frequent non-null value, ties → the larger (the working weight). */
function workingValue(values) {
  const counts = new Map();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  for (const [v, n] of counts) if (best == null || n > counts.get(best) || (n === counts.get(best) && v > best)) best = v;
  return best;
}

/** Exercise-level starting load / band, from last time or the settings fallback. */
export function startingLoad(exercise, last, settings) {
  if (exercise.loadType === 'dumbbell') {
    return { load: workingValue((last?.sets || []).map((s) => s.load)) ?? settings.dumbbellMin, bandId: null };
  }
  if (exercise.loadType === 'band') {
    const used = workingValue((last?.sets || []).map((s) => s.bandId));
    return { load: null, bandId: used ?? lightestBand(settings)?.id ?? null };
  }
  return { load: null, bandId: null };
}

/**
 * SetRows for a session that has none yet (lifecycle step 2 in CONTRACTS.md).
 * @returns {import('../db.js').SetRow[]}
 */
export function buildInitialSets({ session, workout, exercisesById, settings, sessions, sets }) {
  const rows = [];
  workout.items.forEach((item, position) => {
    const exercise = exercisesById.get(item.exerciseId);
    if (!exercise) return;
    const base = { sessionId: session.id, workoutId: session.workoutId, exerciseId: item.exerciseId, date: session.date,
      position, done: false, overridden: false, rir: null, flag: null };
    if (exercise.measure === 'done') {
      rows.push({ ...base, id: newId('set'), setIndex: 1, load: null, bandId: null, value: null });
      return;
    }
    const last = findLastTime({ exerciseId: item.exerciseId, workoutId: session.workoutId, activeSessionId: session.id, sessions, sets });
    const { load, bandId } = startingLoad(exercise, last, settings);
    const count = Math.max(1, item.sets || 1);
    for (let i = 0; i < count; i++) {
      const value = last?.sets[i]?.value ?? item.repMax ?? item.repMin ?? null;
      rows.push({ ...base, id: newId('set'), setIndex: i + 1, load, bandId, value });
    }
  });
  return rows;
}

/** '40 lb', '35–40 lb', 'Red band', 'Blue–Red band' or '' for a group of sets. */
export function loadSummary(sets, exercise, settings) {
  if (exercise.loadType === 'dumbbell') {
    const loads = sets.map((s) => s.load).filter((l) => l != null);
    if (!loads.length) return '';
    const lo = Math.min(...loads);
    const hi = Math.max(...loads);
    return lo === hi ? `${hi} lb` : `${lo}–${hi} lb`;
  }
  if (exercise.loadType === 'band') {
    const names = [...new Set(sets.map((s) => s.bandId).filter(Boolean))]
      .map((id) => bandById(settings, id)).filter(Boolean).sort((a, b) => a.order - b.order).map((b) => b.name);
    if (!names.length) return '';
    return `${names.length > 1 ? `${names[0]}–${names[names.length - 1]}` : names[0]} band`;
  }
  return '';
}

/** '10/10/10/10' or '30s/30s'. */
export function compactValues(sets, exercise) {
  return formatValues(sets, exercise).replaceAll(' / ', '/');
}

/**
 * Personal bests in this session versus every earlier finished session (simple rules):
 * dumbbell reps → heavier load than ever, else more reps at the same top load;
 * other reps / seconds → longest or biggest single set. First-ever sessions are not PBs.
 * @returns {{exerciseId:string, name:string, text:string}[]}
 */
export function personalBests({ session, sessionSets, allSets, sessions, exercisesById }) {
  const finished = new Set(sessions.filter((s) => s.finishedAt && s.id !== session.id).map((s) => s.id));
  const out = [];
  const exerciseIds = [...new Set(sessionSets.filter((s) => s.done).map((s) => s.exerciseId))];
  for (const id of exerciseIds) {
    const ex = exercisesById.get(id);
    if (!ex || ex.measure === 'done') continue;
    const mine = sessionSets.filter((s) => s.exerciseId === id && s.done && s.value != null);
    const before = allSets.filter((s) => s.exerciseId === id && s.done && s.value != null && finished.has(s.sessionId));
    if (!mine.length || !before.length) continue;
    if (ex.loadType === 'dumbbell' && ex.measure === 'reps' && mine.some((s) => s.load != null)) {
      const top = Math.max(...mine.map((s) => s.load ?? 0));
      const prevTop = Math.max(0, ...before.map((s) => s.load ?? 0));
      if (top > prevTop) { out.push({ exerciseId: id, name: ex.name, text: `${top} lb, heaviest yet (was ${prevTop} lb)` }); continue; }
      if (top === prevTop) {
        const reps = Math.max(...mine.filter((s) => s.load === top).map((s) => s.value));
        const prevReps = Math.max(...before.filter((s) => s.load === top).map((s) => s.value));
        if (reps > prevReps) out.push({ exerciseId: id, name: ex.name, text: `${reps} reps at ${top} lb (was ${prevReps})` });
      }
      continue;
    }
    const best = Math.max(...mine.map((s) => s.value));
    const prev = Math.max(...before.map((s) => s.value));
    const secs = ex.measure === 'seconds';
    if (best > prev) out.push({ exerciseId: id, name: ex.name, text: secs ? `${best}s hold (was ${prev}s)` : `${best} reps in one set (was ${prev})` });
  }
  return out;
}
