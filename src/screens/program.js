// program.js — Program editor (WP4b, F18).
// Routes: #/program · #/program/<workoutId> · #/program/exercises · #/program/exercise/<id> · #/program/new-exercise/<workoutId|all>
import { h, replace, screenHeader, toast, confirmSheet } from '../ui.js';
import { listWorkouts, getWorkout, putWorkout, listExercises } from '../db.js';
import { renderExerciseEditor } from './programExercise.js';
import { openItemSheet, openPicker } from './programSheets.js';
import { badges, makeTargetText } from './programShared.js';

export async function render(container, params, ctx) {
  const [a, b] = params;
  if (a === 'exercise' && b) return renderExerciseEditor(container, b, null, ctx);
  if (a === 'new-exercise') return renderExerciseEditor(container, null, b && b !== 'all' ? b : null, ctx);
  if (a === 'exercises') return renderAllExercises(container, ctx);
  if (a) return renderWorkout(container, a, ctx);
  return renderList(container, ctx);
}

async function renderList(container, ctx) {
  const [workouts, exercises] = await Promise.all([listWorkouts(), listExercises({ includeArchived: true })]);
  replace(container,
    screenHeader('Program', { back: () => ctx.navigate('settings'), subtitle: 'Tap a workout to edit it' }),
    h('div', { class: 'list' }, workouts.map((w) => h('button', {
      class: 'list-row', 'data-workout': w.id, onClick: () => ctx.navigate(`program/${w.id}`),
    }, h('div', { class: 'list-row__main' },
      h('div', { class: 'list-row__title' }, w.name),
      h('div', { class: 'list-row__sub' }, `${w.items.length} exercises`)),
    h('span', { class: 'list-row__chev' }, '›')))),
    h('div', { class: 'list' }, h('button', { class: 'list-row', 'data-act': 'all-exercises', onClick: () => ctx.navigate('program/exercises') },
      h('div', { class: 'list-row__main' },
        h('div', { class: 'list-row__title' }, 'All exercises'),
        h('div', { class: 'list-row__sub' }, `${exercises.length} in the library`)),
      h('span', { class: 'list-row__chev' }, '›'))));
}

async function renderAllExercises(container, ctx) {
  const exercises = await listExercises({ includeArchived: true });
  replace(container,
    screenHeader('All exercises', { back: () => ctx.navigate('program') }),
    h('button', { class: 'btn btn-primary btn-block pgm-add', 'data-act': 'new-exercise', onClick: () => ctx.navigate('program/new-exercise/all') }, 'New exercise'),
    h('div', { class: 'list' }, exercises.map((e) => h('button', {
      class: ['list-row', e.archived && 'pgm-archived'], 'data-exercise': e.id, onClick: () => ctx.navigate(`program/exercise/${e.id}`),
    }, h('div', { class: 'list-row__main' },
      h('div', { class: 'list-row__title' }, e.name),
      h('div', { class: 'pgm-badges' }, h('span', { class: 'list-row__sub' }, e.category), ...badges(e))),
    h('span', { class: 'list-row__chev' }, '›')))));
}

async function renderWorkout(container, id, ctx) {
  const workout = await getWorkout(id);
  if (!workout) {
    replace(container, screenHeader('Workout', { back: () => ctx.navigate('program') }), h('div', { class: 'empty-state' }, 'Workout not found.'));
    return;
  }
  const exMap = new Map((await listExercises({ includeArchived: true })).map((e) => [e.id, e]));
  const save = async (msg) => { await putWorkout(workout); toast(msg); draw(); };
  const sortParts = () => {
    workout.items = [...workout.items.filter((i) => i.part === 'AM'), ...workout.items.filter((i) => i.part !== 'AM')];
  };
  const move = (item, dir) => {
    const idx = workout.items.indexOf(item);
    let j = idx + dir;
    while (workout.items[j] && workout.items[j].part !== item.part) j += dir;
    if (!workout.items[j]) return;
    [workout.items[idx], workout.items[j]] = [workout.items[j], workout.items[idx]];
    save('Order saved');
  };
  const remove = async (item) => {
    const ok = await confirmSheet(`Remove ${exMap.get(item.exerciseId)?.name ?? 'this exercise'} from this workout? Its history is kept.`, { confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    workout.items = workout.items.filter((i) => i !== item);
    save('Exercise removed');
  };
  const edit = (item) => openItemSheet(item, exMap.get(item.exerciseId), (next) => {
    workout.items[workout.items.indexOf(item)] = next;
    sortParts();
    save('Exercise saved');
  });
  const swap = (item) => openPicker('Swap exercise', workout.items.map((i) => i.exerciseId), (e) => {
    item.exerciseId = e.id;
    save(`Swapped to ${e.name}`);
  });
  const add = () => openPicker('Add exercise', workout.items.map((i) => i.exerciseId), (e) => {
    const done = e.measure === 'done';
    const item = { exerciseId: e.id, part: 'PM', sets: done ? 1 : 3, repMin: done ? null : 8, repMax: done ? null : 10, targetText: '' };
    item.targetText = makeTargetText(item, e);
    workout.items.push(item);
    sortParts();
    exMap.set(e.id, e);
    save('Exercise added');
  }, () => ctx.navigate(`program/new-exercise/${workout.id}`));

  const nameInput = h('input', { class: 'input pgm-name', type: 'text', value: workout.name, 'aria-label': 'Workout name', 'data-f': 'workout-name' });
  const commitName = async () => {
    const v = nameInput.value.trim();
    if (!v) { toast('Name is required'); nameInput.value = workout.name; return; }
    if (v === workout.name) return;
    workout.name = v;
    await putWorkout(workout); toast('Workout renamed');
  };
  nameInput.addEventListener('change', commitName);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

  function itemCard(item, idx, group) {
    const ex = exMap.get(item.exerciseId);
    const pos = group.indexOf(item);
    return h('div', { class: 'card pgm-item', 'data-item': item.exerciseId },
      h('div', { class: 'pgm-item__head' },
        h('div', { class: 'pgm-item__name' }, ex?.name ?? item.exerciseId),
        h('div', { class: 'pgm-item__target num' }, item.targetText || '–')),
      h('div', { class: 'pgm-badges' }, badges(ex)),
      h('div', { class: 'pgm-actions' },
        h('button', { class: 'btn btn-secondary pgm-act', 'aria-label': 'Move up', 'data-act': 'up', disabled: pos === 0, onClick: () => move(item, -1) }, '↑'),
        h('button', { class: 'btn btn-secondary pgm-act', 'aria-label': 'Move down', 'data-act': 'down', disabled: pos === group.length - 1, onClick: () => move(item, 1) }, '↓'),
        h('button', { class: 'btn btn-secondary pgm-act pgm-act--text', 'data-act': 'edit', onClick: () => edit(item) }, 'Edit'),
        h('button', { class: 'btn btn-secondary pgm-act pgm-act--text', 'data-act': 'swap', onClick: () => swap(item) }, 'Swap'),
        h('button', { class: 'btn btn-secondary pgm-act pgm-act--text pgm-act--danger', 'data-act': 'remove', onClick: () => remove(item) }, 'Remove')));
  }

  function draw() {
    const parts = ['AM', 'PM'].map((p) => [p, workout.items.filter((i) => i.part === p)]);
    replace(container,
      screenHeader('Edit workout', { back: () => ctx.navigate('program') }),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Workout name'), nameInput),
      parts.map(([p, items]) => items.length ? [
        h('div', { class: 'divider-label' }, p),
        items.map((it) => itemCard(it, workout.items.indexOf(it), items))] : null),
      workout.items.length ? null : h('div', { class: 'empty-state' }, 'No exercises yet.'),
      h('button', { class: 'btn btn-primary btn-large btn-block pgm-add', 'data-act': 'add', onClick: add }, 'Add exercise'));
  }
  draw();
}
