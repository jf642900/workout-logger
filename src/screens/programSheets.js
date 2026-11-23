// programSheets.js — item edit sheet and exercise picker for the workout editor (WP4b).
import { h, openSheet } from '../ui.js';
import { listExercises } from '../db.js';
import { choice, field, group, makeTargetText, badges } from './programShared.js';

const numOrNull = (v) => (String(v).trim() === '' ? null : Number(v));

/** Edit one workout item. onSave(newItem) is called with a validated item. */
export function openItemSheet(item, exercise, onSave) {
  const unit = exercise?.measure === 'seconds' ? 'seconds' : 'reps';
  const state = { ...item };
  const initialGenerated = makeTargetText(item, exercise);
  let userEdited = item.targetText !== initialGenerated;

  const sets = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1, max: 10, value: String(item.sets), 'data-f': 'sets' });
  const min = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, value: item.repMin ?? '', 'data-f': 'repMin' });
  const max = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, value: item.repMax ?? '', 'data-f': 'repMax' });
  const target = h('input', { class: 'input', type: 'text', value: item.targetText, 'data-f': 'targetText', onInput: () => { userEdited = true; } });
  const part = choice([['AM', 'AM'], ['PM', 'PM']], item.part);
  const error = h('p', { class: 'pgm-error', role: 'alert', hidden: true });

  const read = () => ({ ...state, sets: Number(sets.value), repMin: numOrNull(min.value), repMax: numOrNull(max.value), part: part.getValue() });
  const regen = () => {
    if (userEdited) return;
    const cur = read();
    if (Number.isFinite(cur.sets)) target.value = makeTargetText(cur, exercise);
  };
  for (const el of [sets, min, max]) el.addEventListener('input', regen);

  const save = () => {
    const next = read();
    let msg = '';
    if (!Number.isInteger(next.sets) || next.sets < 1 || next.sets > 10) msg = 'Sets must be between 1 and 10.';
    else if (next.repMin != null && next.repMax != null && next.repMin > next.repMax) msg = `Min ${unit} must not exceed max.`;
    if (msg) { error.textContent = msg; error.hidden = false; return; }
    next.targetText = target.value.trim() || makeTargetText(next, exercise);
    close();
    onSave(next);
  };
  const close = openSheet(h('div', { class: 'pgm-sheet' },
    h('h2', { class: 'pgm-sheet__title' }, exercise?.name || 'Exercise'),
    h('div', { class: 'pgm-row3' }, field('Sets', sets), field(`Min ${unit}`, min), field(`Max ${unit}`, max)),
    field('Target text', target, 'Shown on the workout. Updates with sets and reps until you edit it.'),
    group('Part of day', part),
    error,
    h('div', { class: 'sheet__actions' },
      h('button', { class: 'btn btn-secondary', onClick: () => close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', 'data-act': 'save-item', onClick: save }, 'Save'))));
}

/**
 * Pick an existing (non-archived) exercise. `exclude` = ids to hide.
 * onPick(exercise); onCreate() when the user wants a new one (omit to hide the button).
 */
export async function openPicker(title, exclude, onPick, onCreate) {
  const all = (await listExercises()).filter((e) => !exclude.includes(e.id));
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search exercises', 'aria-label': 'Search exercises' });
  const list = h('div', { class: 'list pgm-picker' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const rows = all.filter((e) => !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    list.replaceChildren(...(rows.length ? rows.map((e) => h('button', {
      class: 'list-row', 'data-exercise': e.id, onClick: () => { close(); onPick(e); },
    }, h('div', { class: 'list-row__main' },
      h('div', { class: 'list-row__title' }, e.name),
      h('div', { class: 'pgm-badges' }, h('span', { class: 'list-row__sub' }, e.category), ...badges(e))))) :
      [h('p', { class: 'empty-state' }, 'No matching exercises.')]));
  };
  search.addEventListener('input', draw);
  draw();
  const close = openSheet(h('div', { class: 'pgm-sheet' },
    h('h2', { class: 'pgm-sheet__title' }, title),
    onCreate ? h('button', { class: 'btn btn-primary btn-block', 'data-act': 'create-exercise', onClick: () => { close(); onCreate(); } }, 'Create new exercise') : null,
    h('div', { class: 'pgm-picker__search' }, search),
    list,
    h('button', { class: 'btn btn-secondary btn-block', onClick: () => close() }, 'Cancel')));
}
