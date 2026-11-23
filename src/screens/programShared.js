// programShared.js — helpers shared by the Program editor screens (WP4b).
import { h } from '../ui.js';

export const LOAD_LABEL = { dumbbell: 'Dumbbell', band: 'Band', none: 'No load' };
export const MEASURE_LABEL = { reps: 'Reps', seconds: 'Seconds', done: 'Done' };

/** Lower-case slug of a name, e.g. "Cable-Free Y Raise" -> "cable-free-y-raise". */
export function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'exercise';
}

/** Slug made unique among existing ids by appending -2, -3... */
export function uniqueId(name, existingIds) {
  const taken = new Set(existingIds);
  const base = slugify(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** Generated target text such as "3 x 8-10", "3 x 30 sec / side". */
export function makeTargetText(item, exercise) {
  const { sets, repMin, repMax } = item;
  if (exercise?.measure === 'done' && repMin == null) return '';
  let range = '';
  if (repMin != null && repMax != null && repMin !== repMax) range = `${repMin}-${repMax}`;
  else if (repMin != null || repMax != null) range = String(repMin ?? repMax);
  const unit = exercise?.measure === 'seconds' ? ' sec' : '';
  const side = exercise?.perSide ? ` / ${exercise.sideUnit || 'side'}` : '';
  return range ? `${sets} x ${range}${unit}${side}` : `${sets} sets`;
}

/** Single-select chip group. Returns an element with .getValue(). */
export function choice(options, value, onChange) {
  let current = value;
  const buttons = options.map(([val, label]) => h('button', {
    type: 'button', class: ['chip', 'pgm-choice__chip', val === current && 'is-selected'],
    'aria-pressed': String(val === current),
    onClick: () => {
      current = val;
      buttons.forEach((b, i) => {
        const on = options[i][0] === current;
        b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', String(on));
      });
      onChange?.(val);
    },
  }, label));
  const el = h('div', { class: 'pgm-choice', role: 'group' }, buttons);
  el.getValue = () => current;
  return el;
}

/** Labelled form field. */
export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), control,
    hint ? h('span', { class: 'muted pgm-hint' }, hint) : null);
}

/** Non-label field wrapper (for chip groups). */
export function group(label, control) {
  return h('div', { class: 'field', role: 'group', 'aria-label': label },
    h('span', { class: 'field__label' }, label), control);
}

export function badges(ex) {
  if (!ex) return [];
  return [
    h('span', { class: 'badge' }, LOAD_LABEL[ex.loadType] || ex.loadType),
    h('span', { class: 'badge' }, MEASURE_LABEL[ex.measure] || ex.measure),
    ex.perSide ? h('span', { class: 'badge' }, `/ ${ex.sideUnit || 'side'}`) : null,
    ex.archived ? h('span', { class: 'badge badge--warn' }, 'Archived') : null,
  ];
}
