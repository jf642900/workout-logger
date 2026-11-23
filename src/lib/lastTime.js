// lastTime.js — STUB from WP0; implemented by WP1. Pure: never import db.js.

/**
 * Finds what was done for an exercise the last time, per SPEC F7.
 * Rule: most recent session that is finished (finishedAt set), not isDeload, not activeSessionId,
 * and of the same workoutId; if none exists, the same rule across all workouts.
 * "Most recent" = latest date, then latest startedAt.
 *
 * @param {{exerciseId:string, workoutId:string, activeSessionId?:string|null,
 *   sessions:import('../db.js').Session[], sets:import('../db.js').SetRow[]}} args
 *   sets may contain any exercises' sets; only done sets of exerciseId count.
 * @returns {{session:import('../db.js').Session, sets:import('../db.js').SetRow[], sameDay:boolean}|null}
 *   sets sorted by setIndex.
 */
export function findLastTime({ exerciseId, workoutId, activeSessionId = null, sessions, sets }) {
  return null;
}
