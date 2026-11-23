// format.js — pure display and volume helpers shared by every screen. Owned by WP0.

/** @returns {{id:string,name:string,colour:string,order:number}|null} */
export function bandById(settings, bandId) {
  return (settings?.bands || []).find((b) => b.id === bandId) ?? null;
}

/** '40 lb', 'Blue band', or '' for bodyweight. @param {{load:number|null, bandId:string|null}} set */
export function formatLoad(set, exercise, settings) {
  if (!set || !exercise) return '';
  if (exercise.loadType === 'dumbbell' && set.load != null) return `${set.load} lb`;
  if (exercise.loadType === 'band' && set.bandId) return `${bandById(settings, set.bandId)?.name ?? set.bandId} band`;
  return '';
}

/** '10 / 10 / 9' for reps, '30s / 30s' for seconds, '✓' for done-only. */
export function formatValues(sets, exercise) {
  if (exercise?.measure === 'done') return sets.some((s) => s.done) ? '✓' : '';
  const unit = exercise?.measure === 'seconds' ? 's' : '';
  return sets.map((s) => (s.value == null ? '–' : `${s.value}${unit}`)).join(' / ');
}

/** '/ leg', '/ side' or '' */
export function sideLabel(exercise) {
  return exercise?.perSide ? `/ ${exercise.sideUnit || 'side'}` : '';
}

/**
 * Volume of one set, the workbook's formula: load × reps (load per hand), dumbbell rep sets only.
 * Band, bodyweight, timed and done-only sets have no volume.
 */
export function setVolume(set, exercise) {
  if (!exercise || exercise.loadType !== 'dumbbell' || exercise.measure !== 'reps') return 0;
  if (!set.done || set.load == null || set.value == null) return 0;
  return set.load * set.value;
}

/** Sum of setVolume over sets. @param {Map<string,object>|Record<string,object>} exercisesById */
export function totalVolume(sets, exercisesById) {
  const get = (id) => (exercisesById instanceof Map ? exercisesById.get(id) : exercisesById[id]);
  return sets.reduce((sum, s) => sum + setVolume(s, get(s.exerciseId)), 0);
}

/** 12345 → '12,345' */
export function formatNumber(n) {
  return Math.round(n).toLocaleString('en-CA');
}
