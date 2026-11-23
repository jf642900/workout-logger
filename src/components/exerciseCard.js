// exerciseCard.js — one exercise on the Log screen. Owns its sets, saves every change with putSet,
// and re-renders only itself (WP1).
import { h, replace, toast } from '../ui.js';
import { putSet, putSets, deleteSet } from '../db.js';
import { formatValues, sideLabel } from '../lib/format.js';
import { formatShortDate } from '../lib/dates.js';
import { Stepper } from './stepper.js';
import { BandPicker } from './bandPicker.js';
import { SetRow, TickIcon } from './setRow.js';
import { loadSummary, compactValues, startingLoad } from './logData.js';
import { openInfoSheet, openOverrideSheet } from './logSheets.js';

const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };

/**
 * @param {{item:import('../db.js').WorkoutItem, exercise:import('../db.js').Exercise, settings:import('../db.js').Settings,
 *   sets:import('../db.js').SetRow[], last:ReturnType<typeof import('../lib/lastTime.js').findLastTime>,
 *   hint:ReturnType<typeof import('../lib/progression.js').suggestNext>, skipped:boolean,
 *   makeSet:(partial:object)=>import('../db.js').SetRow, onChange:()=>void, onSkip:(skip:boolean)=>void,
 *   track:(close:Function)=>void}} opts
 * @returns {{el:HTMLElement, sets:()=>import('../db.js').SetRow[], skipped:()=>boolean}}
 */
export function ExerciseCard(opts) {
  const { item, exercise, settings, last, hint, makeSet, onChange, onSkip, track } = opts;
  let sets = [...opts.sets].sort((a, b) => a.setIndex - b.setIndex);
  let skipped = opts.skipped;
  let expanded = false;
  const doneOnly = exercise.measure === 'done';
  const free = sets.find((s) => !s.overridden) || sets[0];
  const fallback = startingLoad(exercise, last, settings);
  let cardLoad = free?.load ?? fallback.load;
  let cardBand = free?.bandId ?? fallback.bandId;
  const el = h('section', { class: 'ex-card', dataset: { exercise: exercise.id } });

  const allDone = () => sets.length > 0 && sets.every((s) => s.done);
  const save = (rows) => { (rows.length === 1 ? putSet(rows[0]) : putSets(rows)).catch(fail); onChange(); };

  function render() {
    el.className = ['ex-card', skipped && 'is-skipped', !skipped && allDone() && !expanded && 'is-collapsed', doneOnly && 'ex-card--done-only'].filter(Boolean).join(' ');
    if (skipped) return replace(el, SkippedLine());
    if (allDone() && !expanded) return replace(el, CollapsedLine());
    replace(el, Head(), Meta(), doneOnly ? DoneOnlyRow() : [LoadControl(), h('div', { class: 'ex-sets' }, sets.map(Row)), Actions()]);
  }

  function Head() {
    const side = sideLabel(exercise);
    const target = item.targetText?.replace(/\s*\/\s*(leg|side)\b/i, '') || '';
    return h('div', { class: 'ex-head' },
      h('div', { class: 'ex-head__row' },
        h('button', { class: 'ex-name', type: 'button', onClick: () => track(openInfoSheet(exercise, item)), 'aria-label': `${exercise.name}: technique and rest` },
          h('span', { class: 'ex-name__text' }, exercise.name), h('span', { class: 'ex-name__info', 'aria-hidden': 'true' }, 'i')),
        allDone() ? h('button', { class: 'ex-fold', type: 'button', 'aria-label': 'Collapse', onClick: () => { expanded = false; render(); } }, '⌃') : null),
      target || side ? h('div', { class: 'ex-target' }, target, side ? h('span', { class: 'badge badge--accent ex-side' }, side) : null) : null);
  }

  function Meta() {
    if (doneOnly) return null;
    const lines = [];
    if (last) {
      const parts = [formatShortDate(last.session.date), loadSummary(last.sets, exercise, settings), formatValues(last.sets, exercise)].filter(Boolean);
      lines.push(h('div', { class: 'ex-line' }, h('span', { class: 'ex-line__label' }, 'Last'),
        h('span', { class: 'ex-line__text num' }, parts.join(' · '),
          !last.sameDay ? h('span', { class: 'ex-line__day' }, ` from ${DAY_NAMES[last.session.workoutId] || last.session.workoutId}`) : null)));
    } else {
      lines.push(h('div', { class: 'ex-line' }, h('span', { class: 'ex-line__label' }, 'Last'), h('span', { class: 'ex-line__text muted' }, 'First time')));
    }
    if (hint) {
      const apply = (hint.kind === 'load' && hint.load !== cardLoad) || (hint.kind === 'band' && hint.bandId !== cardBand)
        ? h('button', { class: 'btn btn-small btn-ghost ex-hint__apply', type: 'button',
          onClick: () => (hint.kind === 'load' ? setCardLoad(hint.load) : setCardBand(hint.bandId)) }, 'Use') : null;
      lines.push(h('div', { class: 'ex-line ex-hint' }, h('span', { class: 'ex-line__label' }, 'Next'), h('span', { class: 'ex-line__text' }, hint.text), apply));
    }
    return h('div', { class: 'ex-meta' }, lines);
  }

  function LoadControl() {
    if (exercise.loadType === 'dumbbell') {
      return h('div', { class: 'ex-load' }, h('span', { class: 'ex-load__label' }, 'Load', h('small', null, 'per hand')),
        Stepper({ value: cardLoad, step: settings.dumbbellStep, min: settings.dumbbellMin, max: Math.max(settings.dumbbellMax, cardLoad ?? 0),
          unit: 'lb', size: 'lg', label: 'load', start: settings.dumbbellMin, onChange: setCardLoad }));
    }
    if (exercise.loadType === 'band') {
      return h('div', { class: 'ex-load ex-load--band' }, BandPicker({ bands: settings.bands, selected: cardBand, onSelect: setCardBand }));
    }
    return null;
  }

  function Row(set) {
    return SetRow({ set, exercise, item, settings,
      onValue: (v) => { set.value = v; save([set]); },
      onToggle: () => toggle(set),
      onLoadTap: () => track(openOverrideSheet({ exercise, settings, set, cardLoad, cardBand, onPick: (p) => override(set, p) })) });
  }

  function DoneOnlyRow() {
    const set = sets[0];
    const tap = () => {
      if (set) return toggle(set);
      const row = makeSet({ setIndex: 1 }); // item added to the program after this workout started
      sets.push(row);
      toggle(row);
    };
    return h('button', { class: ['ex-doneonly', set?.done && 'is-done'], type: 'button', onClick: tap, 'aria-pressed': set?.done ? 'true' : 'false' },
      h('span', { class: 'ex-doneonly__tick' }, TickIcon()), h('span', null, set?.done ? 'Done' : 'Mark done'));
  }

  function Actions() {
    return h('div', { class: 'ex-actions' },
      h('button', { class: 'ex-action', type: 'button', onClick: addSet }, '+ Add set'),
      sets.length > 1 && sets.some((s) => !s.done) ? h('button', { class: 'ex-action', type: 'button', onClick: removeSet }, '− Remove set') : null,
      h('span', { class: 'ex-actions__gap' }),
      h('button', { class: 'ex-action ex-action--quiet', type: 'button', onClick: () => setSkipped(true) }, 'Skip'));
  }

  function CollapsedLine() {
    const detail = doneOnly ? item.targetText : [loadSummary(sets, exercise, settings), compactValues(sets, exercise)].filter(Boolean).join(' · ');
    return h('button', { class: 'ex-collapsed', type: 'button', 'aria-expanded': 'false', onClick: () => { expanded = true; render(); } },
      h('span', { class: 'ex-collapsed__tick' }, TickIcon()),
      h('span', { class: 'ex-collapsed__text' }, h('span', { class: 'ex-collapsed__name' }, exercise.name),
        detail ? h('span', { class: 'ex-collapsed__detail num' }, ` · ${detail}`) : null));
  }

  function SkippedLine() {
    return h('div', { class: 'ex-skipped' }, h('span', { class: 'ex-skipped__text' }, h('span', { class: 'ex-skipped__name' }, exercise.name), h('span', { class: 'muted' }, ' · skipped')),
      h('button', { class: 'btn btn-small btn-ghost', type: 'button', onClick: () => setSkipped(false) }, 'Undo'));
  }

  // ---------- changes ----------
  function setCardLoad(load) {
    cardLoad = load;
    const changed = sets.filter((s) => !s.done && !s.overridden);
    for (const s of changed) s.load = load;
    if (changed.length) save(changed);
    render();
  }
  function setCardBand(bandId) {
    cardBand = bandId;
    const changed = sets.filter((s) => !s.done && !s.overridden);
    for (const s of changed) s.bandId = bandId;
    if (changed.length) save(changed);
    render();
  }
  function override(set, patch) {
    if (patch.reset) { set.load = cardLoad; set.bandId = cardBand; set.overridden = false; }
    if ('load' in patch) { set.load = patch.load; set.overridden = patch.load !== cardLoad; }
    if ('bandId' in patch) { set.bandId = patch.bandId; set.overridden = patch.bandId !== cardBand; }
    save([set]);
    render();
  }
  function toggle(set) {
    set.done = !set.done;
    if (allDone()) expanded = false;
    save([set]);
    render();
  }
  function addSet() {
    const prev = sets[sets.length - 1];
    const row = makeSet({ setIndex: (prev?.setIndex ?? 0) + 1, load: exercise.loadType === 'dumbbell' ? cardLoad : null,
      bandId: exercise.loadType === 'band' ? cardBand : null, value: prev?.value ?? item.repMax ?? item.repMin ?? null });
    sets.push(row);
    expanded = true;
    save([row]);
    render();
  }
  function removeSet() {
    // Only ever remove an unticked set: a ticked set is logged work (untick it first to remove it).
    const idx = sets.findLastIndex((s) => !s.done);
    if (idx < 0 || sets.length <= 1) return;
    const [row] = sets.splice(idx, 1);
    deleteSet(row.id).catch(fail);
    onChange();
    render();
  }
  function setSkipped(value) {
    skipped = value;
    onSkip(value);
    onChange();
    render();
  }

  render();
  return { el, sets: () => sets, skipped: () => skipped };
}

function fail(err) {
  console.error(err);
  toast('Could not save. Try again.');
}
