// progression.js — STUB from WP0; implemented by WP1. Pure: never import db.js.

/**
 * Progression hint, per SPEC F15 (double progression).
 * Only for exercises with measure 'reps' and an item with repMax. If every set last time
 * reached item.repMax (and there were at least item.sets sets):
 *   - dumbbell below settings.dumbbellMax → {kind:'load', load: last load + settings.dumbbellStep, text}
 *   - dumbbell at settings.dumbbellMax   → {kind:'ladder', step: settings.progressionLadder[0], text}
 *   - band below the heaviest band        → {kind:'band', bandId: next band by order, text}
 *   - band at heaviest / bodyweight      → {kind:'reps', text: 'Add a rep or a set'}
 * Otherwise null.
 * @param {{exercise:import('../db.js').Exercise, item:import('../db.js').WorkoutItem,
 *   last:{sets:import('../db.js').SetRow[]}|null, settings:import('../db.js').Settings}} args
 * @returns {{kind:'load'|'ladder'|'band'|'reps', text:string, load?:number, bandId?:string, step?:string}|null}
 */
export function suggestNext({ exercise, item, last, settings }) {
  return null;
}
