// lastTime.js — "last time" lookup (SPEC F7). Implemented by WP1. Pure: never import db.js.

function newestFirst(a, b) {
  return b.date.localeCompare(a.date) || (b.startedAt || '').localeCompare(a.startedAt || '');
}

/**
 * Finds what was done for an exercise the last time, per SPEC F7.
 * Rule: most recent session that is finished (finishedAt set), not isDeload, not activeSessionId,
 * and of the same workoutId; if none exists, the same rule across all workouts.
 * "Most recent" = latest date, then latest startedAt.
 * Sessions where the exercise has no done sets (skipped, or not in that workout) never count.
 *
 * @param {{exerciseId:string, workoutId:string, activeSessionId?:string|null,
 *   sessions:import('../db.js').Session[], sets:import('../db.js').SetRow[]}} args
 *   sets may contain any exercises' sets; only done sets of exerciseId count.
 * @returns {{session:import('../db.js').Session, sets:import('../db.js').SetRow[], sameDay:boolean}|null}
 *   sets sorted by setIndex.
 */
export function findLastTime({ exerciseId, workoutId, activeSessionId = null, sessions, sets }) {
  const bySession = new Map();
  for (const set of sets || []) {
    if (set.exerciseId !== exerciseId || !set.done) continue;
    if (!bySession.has(set.sessionId)) bySession.set(set.sessionId, []);
    bySession.get(set.sessionId).push(set);
  }
  if (!bySession.size) return null;
  const eligible = (sessions || [])
    .filter((s) => s.finishedAt && !s.isDeload && s.id !== activeSessionId && bySession.has(s.id))
    .sort(newestFirst);
  const same = eligible.find((s) => s.workoutId === workoutId);
  const session = same || eligible[0];
  if (!session) return null;
  const rows = [...bySession.get(session.id)].sort((a, b) => a.setIndex - b.setIndex);
  return { session, sets: rows, sameDay: !!same };
}
