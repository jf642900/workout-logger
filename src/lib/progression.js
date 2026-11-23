// progression.js — double-progression hint (SPEC F15). Implemented by WP1. Pure: never import db.js.

/**
 * Progression hint, per SPEC F15 (double progression).
 * Only for exercises with measure 'reps' and an item with repMax. If every set last time
 * reached item.repMax (and there were at least item.sets sets):
 *   - dumbbell below settings.dumbbellMax → {kind:'load', load: last load + settings.dumbbellStep, text}
 *   - dumbbell at settings.dumbbellMax   → {kind:'ladder', step: settings.progressionLadder[0], text}
 *   - band below the heaviest band        → {kind:'band', bandId: next band by order, text}
 *   - band at heaviest / bodyweight      → {kind:'reps', text: 'Add a rep or a set'}
 * Otherwise null. The working load is the heaviest load of last time's sets. A dumbbell set with no
 * recorded load, or a band set with no recorded band, gives no hint (there is nothing to step from).
 * @param {{exercise:import('../db.js').Exercise, item:import('../db.js').WorkoutItem,
 *   last:{sets:import('../db.js').SetRow[]}|null, settings:import('../db.js').Settings}} args
 * @returns {{kind:'load'|'ladder'|'band'|'reps', text:string, load?:number, bandId?:string, step?:string}|null}
 */
export function suggestNext({ exercise, item, last, settings }) {
  if (!exercise || !item || !last || exercise.measure !== 'reps' || item.repMax == null) return null;
  const sets = (last.sets || []).filter((s) => s.done !== false);
  if (!sets.length || sets.length < (item.sets || 0)) return null;
  if (!sets.every((s) => s.value != null && s.value >= item.repMax)) return null;

  const reps = { kind: 'reps', text: 'Add a rep or a set' };
  if (exercise.loadType === 'dumbbell') {
    const loads = sets.map((s) => s.load).filter((l) => l != null);
    if (!loads.length) return null;
    const load = Math.max(...loads);
    const max = settings?.dumbbellMax ?? 40;
    const step = settings?.dumbbellStep ?? 5;
    if (load < max) {
      const next = Math.min(load + step, max);
      return { kind: 'load', load: next, text: `Go up to ${next} lb` };
    }
    const ladderStep = settings?.progressionLadder?.[0];
    if (!ladderStep) return reps;
    return { kind: 'ladder', step: ladderStep, text: `Heaviest dumbbell reached: try ${ladderStep}` };
  }
  if (exercise.loadType === 'band') {
    const bands = [...(settings?.bands || [])].sort((a, b) => a.order - b.order);
    const used = sets.map((s) => bands.findIndex((b) => b.id === s.bandId)).filter((i) => i >= 0);
    if (!used.length) return null;
    const next = bands[Math.max(...used) + 1];
    if (!next) return reps;
    return { kind: 'band', bandId: next.id, text: `Move up to the ${next.name} band` };
  }
  return reps;
}
