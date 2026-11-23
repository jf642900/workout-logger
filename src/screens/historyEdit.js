// historyEdit.js — bottom sheet to edit or delete one set of a finished session (WP2).
import { h, openSheet, toast, confirmSheet } from '../ui.js';
import { putSet, deleteSet } from '../db.js';

/**
 * Opens the edit sheet. Calls onChanged() after a save or delete.
 * @param {import('../db.js').SetRow} set @param {import('../db.js').Exercise} exercise
 * @param {import('../db.js').Settings} settings @param {Function} onChanged
 */
export function openSetEditor(set, exercise, settings, onChanged) {
  const step = settings.dumbbellStep || 5;
  const vStep = exercise.measure === 'seconds' ? 5 : 1;
  let load = set.load;
  let bandId = set.bandId;
  let value = set.value;
  let close = () => {};

  const loadOut = h('span', { class: 'num hist-edit__num' });
  const valueOut = h('span', { class: 'num hist-edit__num' });
  const paint = () => {
    loadOut.textContent = load == null ? '–' : `${load} lb`;
    valueOut.textContent = value == null ? '–' : `${value}${exercise.measure === 'seconds' ? ' s' : ''}`;
  };
  const stepper = (out, label, dec, inc) => h('div', { class: 'hist-edit__row' },
    h('span', { class: 'hist-edit__label' }, label),
    h('div', { class: 'hist-edit__stepper' },
      h('button', { class: 'btn btn-secondary hist-edit__btn', 'aria-label': `Decrease ${label}`, onClick: () => { dec(); paint(); } }, '−'),
      out,
      h('button', { class: 'btn btn-secondary hist-edit__btn', 'aria-label': `Increase ${label}`, onClick: () => { inc(); paint(); } }, '+')));

  const rows = [];
  if (exercise.loadType === 'dumbbell') {
    rows.push(stepper(loadOut, 'Load',
      () => { load = Math.max(0, (load ?? step) - step); },
      () => { load = (load ?? 0) + step; }));
  } else if (exercise.loadType === 'band') {
    const chips = h('div', { class: 'hist-edit__chips' });
    const drawChips = () => chips.replaceChildren(...(settings.bands || []).map((b) =>
      h('button', { class: ['chip', bandId === b.id && 'is-selected'], onClick: () => { bandId = b.id; drawChips(); } },
        h('span', { class: 'band-swatch', style: { background: b.colour } }), b.name)));
    drawChips();
    rows.push(h('div', { class: 'hist-edit__row hist-edit__row--wrap' }, h('span', { class: 'hist-edit__label' }, 'Band'), chips));
  }
  if (exercise.measure !== 'done') {
    rows.push(stepper(valueOut, exercise.measure === 'seconds' ? 'Seconds' : 'Reps',
      () => { value = Math.max(0, (value ?? vStep) - vStep); },
      () => { value = (value ?? 0) + vStep; }));
  }
  paint();

  const save = async () => {
    await putSet({ ...set, load, bandId, value, flag: null });
    close(); toast('Set saved'); onChanged();
  };
  const remove = async () => {
    const ok = await confirmSheet("Delete this set? This can't be undone.", { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await deleteSet(set.id);
    close(); toast('Set deleted'); onChanged();
  };

  close = openSheet(h('div', { class: 'hist-edit' },
    h('h3', { class: 'hist-edit__title' }, `${exercise.name} · set ${set.setIndex}`),
    set.flag ? h('p', { class: 'hist-edit__flag' }, `Flagged: ${set.flag}. Saving clears the flag.`) : null,
    ...rows,
    h('div', { class: 'sheet__actions hist-edit__actions' },
      h('button', { class: 'btn btn-secondary', onClick: remove }, 'Delete set'),
      h('button', { class: 'btn btn-primary', onClick: save }, 'Save'))));
}
