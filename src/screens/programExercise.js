// programExercise.js — exercise editor (edit existing or create new). WP4b.
import { h, replace, screenHeader, toast } from '../ui.js';
import { getExercise, listExercises, putExercise, getWorkout, putWorkout } from '../db.js';
import { choice, field, group, uniqueId, makeTargetText } from './programShared.js';

/** @param {string|null} exerciseId null = new. @param {string|null} workoutId workout to add a new exercise to. */
export async function renderExerciseEditor(container, exerciseId, workoutId, ctx) {
  const existing = exerciseId ? await getExercise(exerciseId) : null;
  const all = await listExercises({ includeArchived: true });
  const back = () => ctx.navigate(workoutId ? `program/${workoutId}` : 'program/exercises');
  if (exerciseId && !existing) {
    replace(container, screenHeader('Exercise', { back }), h('div', { class: 'empty-state' }, 'Exercise not found.'));
    return;
  }
  const ex = existing || { id: '', name: '', category: '', loadType: 'none', measure: 'reps', perSide: false, sideUnit: null, cue: '', rest: '', archived: false };

  const name = h('input', { class: 'input', type: 'text', value: ex.name, 'data-f': 'name', autocomplete: 'off' });
  const category = h('input', { class: 'input', type: 'text', value: ex.category, 'data-f': 'category', autocomplete: 'off' });
  const cats = [...new Set(all.map((e) => e.category).filter(Boolean))].sort();
  const catChips = h('div', { class: 'pgm-choice' }, cats.map((c) => h('button', {
    type: 'button', class: 'chip', 'data-cat': c, onClick: () => { category.value = c; },
  }, c)));
  const loadType = choice([['dumbbell', 'Dumbbell'], ['band', 'Band'], ['none', 'None']], ex.loadType);
  const measure = choice([['reps', 'Reps'], ['seconds', 'Seconds'], ['done', 'Done']], ex.measure);
  const sideUnit = choice([['leg', 'Leg'], ['side', 'Side']], ex.sideUnit || 'side');
  const sideWrap = group('Side unit', sideUnit);
  const perSide = h('input', { type: 'checkbox', class: 'pgm-check', checked: !!ex.perSide, 'data-f': 'perSide' });
  const archived = h('input', { type: 'checkbox', class: 'pgm-check', checked: !!ex.archived, 'data-f': 'archived' });
  const cue = h('textarea', { class: 'textarea', 'data-f': 'cue' }); cue.value = ex.cue || '';
  const rest = h('input', { class: 'input', type: 'text', value: ex.rest || '', placeholder: 'e.g. 60-90s', 'data-f': 'rest' });
  const error = h('p', { class: 'pgm-error', role: 'alert', hidden: true });
  const syncSide = () => { sideWrap.hidden = !perSide.checked; };
  perSide.addEventListener('change', syncSide); syncSide();

  const save = async () => {
    const nm = name.value.trim();
    if (!nm) { error.textContent = 'Name is required.'; error.hidden = false; name.focus(); return; }
    const next = {
      ...ex, name: nm, category: category.value.trim() || 'Other', loadType: loadType.getValue(), measure: measure.getValue(),
      perSide: perSide.checked, sideUnit: perSide.checked ? sideUnit.getValue() : null,
      cue: cue.value.trim(), rest: rest.value.trim(), archived: archived.checked,
    };
    if (!existing) next.id = uniqueId(nm, all.map((e) => e.id)); // ids never change after creation
    await putExercise(next);
    if (!existing && workoutId) {
      const w = await getWorkout(workoutId);
      if (w) {
        const done = next.measure === 'done';
        const item = { exerciseId: next.id, part: 'PM', sets: done ? 1 : 3, repMin: done ? null : 8, repMax: done ? null : 10, targetText: '' };
        item.targetText = makeTargetText(item, next);
        w.items = [...w.items, item];
        await putWorkout(w);
      }
    }
    toast(existing ? 'Exercise saved' : 'Exercise created');
    back();
  };

  replace(container,
    screenHeader(existing ? 'Edit exercise' : 'New exercise', { back, subtitle: existing ? `id: ${ex.id}` : null }),
    h('div', { class: 'card pgm-form' },
      field('Name', name),
      field('Category', category, 'Type a new one or tap an existing category.'), catChips,
      group('Load type', loadType),
      group('Measure', measure),
      h('label', { class: 'pgm-toggle' }, perSide, h('span', null, 'Done per side')),
      sideWrap,
      field('Cue', cue), field('Rest', rest),
      h('label', { class: 'pgm-toggle' }, archived, h('span', null, 'Archived (hidden from pickers, history kept)')),
      error),
    h('button', { class: 'btn btn-primary btn-large btn-block', 'data-act': 'save-exercise', onClick: save }, existing ? 'Save' : 'Create exercise'));
}
