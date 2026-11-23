// setRow.js — one set: [n] [load chip] [− value +] ........ [tick] (WP1).
import { h } from '../ui.js';
import { bandById } from '../lib/format.js';
import { Stepper } from './stepper.js';

/**
 * @param {{set:import('../db.js').SetRow, exercise:import('../db.js').Exercise, item:import('../db.js').WorkoutItem,
 *   settings:import('../db.js').Settings, onValue:(v:number)=>void, onToggle:()=>void, onLoadTap:()=>void}} opts
 * @returns {HTMLElement}
 */
export function SetRow({ set, exercise, item, settings, onValue, onToggle, onLoadTap }) {
  const seconds = exercise.measure === 'seconds';
  return h('div', { class: ['set-row', set.done && 'is-done'], dataset: { setIndex: set.setIndex } },
    h('span', { class: 'set-idx num', 'aria-label': `Set ${set.setIndex}` }, set.setIndex),
    LoadChip({ set, exercise, settings, onClick: onLoadTap }),
    Stepper({
      value: set.value, step: seconds ? 5 : 1, min: 0, max: seconds ? 600 : 100, unit: seconds ? 's' : '',
      start: item?.repMax ?? item?.repMin ?? (seconds ? 30 : 10),
      label: seconds ? `seconds for set ${set.setIndex}` : `reps for set ${set.setIndex}`, onChange: onValue,
    }),
    h('span', { class: 'set-gap' }),
    h('button', {
      class: 'set-tick', type: 'button', onClick: onToggle,
      'aria-pressed': set.done ? 'true' : 'false', 'aria-label': `${set.done ? 'Untick' : 'Tick'} set ${set.setIndex}`,
    }, TickIcon()));
}

/** Per-set load chip: '40' for dumbbells, a colour dot for bands, nothing for bodyweight. */
function LoadChip({ set, exercise, settings, onClick }) {
  if (exercise.loadType === 'dumbbell') {
    return h('button', {
      class: ['set-chip', set.overridden && 'is-overridden'], type: 'button', onClick,
      'aria-label': `Set ${set.setIndex} load ${set.load ?? 'none'} lb, change this set only`,
    }, h('span', { class: 'num' }, set.load ?? '–'));
  }
  if (exercise.loadType === 'band') {
    const band = bandById(settings, set.bandId);
    return h('button', {
      class: ['set-chip', 'set-chip--band', set.overridden && 'is-overridden'], type: 'button', onClick,
      'aria-label': `Set ${set.setIndex} ${band ? band.name : 'no'} band, change this set only`,
    }, h('span', { class: 'band-swatch', style: { background: band?.colour || 'transparent' } }));
  }
  return null;
}

/** Check-mark icon (SVG so it renders the same everywhere). */
export function TickIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'tick-icon');
  svg.innerHTML = '<path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}
