// stats.js — STUB from WP0; implemented by WP3. Pure: never import db.js.
// Volume always comes from setVolume() in ./format.js (load × reps, per hand).

/** Exercise categories that make up each weekly volume bucket (from the workbook's Weekly Summary). */
export const VOLUME_BUCKETS = {
  push: ['Horizontal Push', 'Vertical Push'],
  pull: ['Horizontal Pull', 'Vertical Pull'],
  lower: ['Squat', 'Hinge', 'Glutes', 'Calves'],
};

/**
 * One row per block week that has any finished session, ascending by week. Deload sessions count.
 * pullupReps = reps of exercises whose id starts with 'pull-up'; pushupReps = 'push-ups-density-sets'.
 * flowsDone = done sets of measure 'done' exercises; workoutsDone = finished sessions that week.
 * @param {{sessions:import('../db.js').Session[], sets:import('../db.js').SetRow[],
 *   exercises:import('../db.js').Exercise[]}} args
 * @returns {{week:number, pullupReps:number, pushupReps:number, pushVolume:number, pullVolume:number,
 *   lowerVolume:number, workoutsDone:number, flowsDone:number}[]}
 */
export function weeklySummary({ sessions, sets, exercises }) {
  return [];
}

/**
 * Chart points for one exercise across all workouts, one point per finished session, oldest first.
 * load = the most common load (dumbbell) or band order (band) that session; best = best single set value.
 * @returns {{sessionId:string, date:string, workoutId:string, load:number|null, bandId:string|null,
 *   bandOrder:number|null, totalValue:number, best:number, volume:number}[]}
 */
export function exerciseSeries({ exercise, sessions, sets, settings }) {
  return [];
}

/**
 * Personal bests for one exercise (SPEC Reporting table).
 * @returns {{label:string, value:string, date:string}[]}
 */
export function personalBests({ exercise, item, sessions, sets, settings }) {
  return [];
}
