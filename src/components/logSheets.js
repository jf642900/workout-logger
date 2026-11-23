// logSheets.js — bottom sheets used by the Log screen: exercise info, per-set override, finish summary (WP1).
import { h, openSheet } from '../ui.js';
import { formatNumber, sideLabel } from '../lib/format.js';
import { BandPicker } from './bandPicker.js';

/** Cue and rest period for an exercise (F16). */
export function openInfoSheet(exercise, item) {
  let close;
  const content = h('div', { class: 'log-sheet' },
    h('h2', { class: 'log-sheet__title' }, exercise.name),
    h('p', { class: 'log-sheet__sub' }, [item?.targetText, sideLabel(exercise) && !item?.targetText?.includes('/') ? sideLabel(exercise) : null].filter(Boolean).join(' ')),
    h('dl', { class: 'log-info' },
      h('dt', null, 'Technique'), h('dd', null, exercise.cue || 'No cue yet. Add one in Program.'),
      h('dt', null, 'Rest'), h('dd', null, exercise.rest || '–')),
    h('button', { class: 'btn btn-secondary btn-block', onClick: () => close() }, 'Close'));
  close = openSheet(content);
  return close;
}

/**
 * Change one set's load or band (F4/F5 override).
 * @param {{exercise:object, settings:object, set:object, cardLoad:number|null, cardBand:string|null,
 *   onPick:(patch:{load?:number|null, bandId?:string|null})=>void}} opts
 */
export function openOverrideSheet({ exercise, settings, set, cardLoad, cardBand, onPick }) {
  let close;
  const pick = (patch) => { onPick(patch); close(); };
  let picker;
  let resetLabel;
  if (exercise.loadType === 'dumbbell') {
    const loads = [];
    for (let l = settings.dumbbellMin; l <= settings.dumbbellMax; l += settings.dumbbellStep) loads.push(l);
    picker = h('div', { class: 'log-loadgrid' }, loads.map((l) => h('button', {
      class: ['log-loadgrid__btn', 'num', l === set.load && 'is-selected'], type: 'button', onClick: () => pick({ load: l }),
    }, String(l))));
    resetLabel = `Use the exercise load (${cardLoad} lb)`;
  } else {
    picker = BandPicker({ bands: settings.bands, selected: set.bandId, large: true, onSelect: (bandId) => pick({ bandId }) });
    const name = settings.bands.find((b) => b.id === cardBand)?.name;
    resetLabel = `Use the exercise band (${name || 'none'})`;
  }
  const content = h('div', { class: 'log-sheet' },
    h('h2', { class: 'log-sheet__title' }, `Set ${set.setIndex} only`),
    h('p', { class: 'log-sheet__sub' }, `${exercise.name}. Changes this set; the exercise load stays as it is.`),
    picker,
    h('div', { class: 'sheet__actions log-sheet__actions' },
      set.overridden ? h('button', { class: 'btn btn-secondary', onClick: () => pick({ reset: true }) }, resetLabel) : null,
      h('button', { class: 'btn btn-secondary', onClick: () => close() }, 'Cancel')));
  close = openSheet(content);
  return close;
}

/**
 * Finish summary (F10): sets done, volume, personal bests, optional note.
 * @param {{setsDone:number, volume:number, exercisesDone:number, bests:{name:string,text:string}[],
 *   onDone:(note:string)=>void}} opts
 */
export function openSummarySheet({ setsDone, volume, exercisesDone, bests, onDone }) {
  const note = h('textarea', { class: 'textarea log-note', placeholder: 'Note (optional)', rows: 2, 'aria-label': 'Workout note' });
  const stat = (value, label) => h('div', { class: 'log-stat' }, h('span', { class: 'log-stat__value num' }, value), h('span', { class: 'log-stat__label' }, label));
  let closed = false;
  const done = () => { if (closed) return; closed = true; close(); onDone(note.value.trim()); };
  const content = h('div', { class: 'log-sheet log-summary' },
    h('h2', { class: 'log-sheet__title' }, 'Workout finished'),
    h('div', { class: 'log-stats' },
      stat(String(setsDone), setsDone === 1 ? 'set' : 'sets'),
      stat(String(exercisesDone), exercisesDone === 1 ? 'exercise' : 'exercises'),
      stat(formatNumber(volume), 'lb volume')),
    bests.length ? h('div', { class: 'log-bests' },
      h('h3', { class: 'section-title' }, 'Personal bests'),
      h('ul', { class: 'log-bests__list' }, bests.map((b) => h('li', null,
        h('span', { class: 'log-bests__name' }, b.name), h('span', { class: 'log-bests__text num' }, b.text))))) : null,
    note,
    h('button', { class: 'btn btn-primary btn-large btn-block', onClick: done }, 'Done'));
  const close = openSheet(content, { onClose: done });
  return close;
}
