// history.js — History list (#/history) and session detail/edit (#/history/<id>) (WP2).
import { h, replace, screenHeader, confirmSheet, toast } from '../ui.js';
import {
  getSettings, listWorkouts, listExercises, listSessions, listSets, getSession, getSetsForSession,
  updateSession, deleteSession,
} from '../db.js';
import { formatShortDate } from '../lib/dates.js';
import { formatLoad, sideLabel, totalVolume, formatNumber } from '../lib/format.js';
import { openSetEditor } from './historyEdit.js';

/** Renders list or detail depending on params[0]. @param {HTMLElement} container */
export async function render(container, params, ctx) {
  if (params[0]) return renderDetail(container, params[0], ctx);
  return renderList(container, ctx);
}

async function renderList(container, ctx) {
  const [workouts, exercises, sessions, allSets] = await Promise.all([
    listWorkouts(), listExercises({ includeArchived: true }), listSessions(), listSets(),
  ]);
  const wName = new Map(workouts.map((w) => [w.id, w.name]));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const bySession = new Map();
  for (const s of allSets) {
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId).push(s);
  }
  const ordered = [...sessions.filter((s) => !s.finishedAt), ...sessions.filter((s) => s.finishedAt)];
  if (!ordered.length) {
    replace(container, screenHeader('History'),
      h('div', { class: 'empty-state' }, h('p', null, 'No workouts yet. Finished workouts show up here.')));
    return;
  }
  const out = [screenHeader('History', { subtitle: `${sessions.filter((s) => s.finishedAt).length} workouts` })];
  let list = null;
  let lastKey = null;
  for (const s of ordered) {
    const key = s.finishedAt ? `w${s.blockWeek}` : 'active';
    if (key !== lastKey) {
      lastKey = key;
      if (s.finishedAt) out.push(h('h3', { class: 'section-title hist-week' }, `Week ${s.blockWeek}`));
      list = h('div', { class: 'list' });
      out.push(list);
    }
    const sets = bySession.get(s.id) || [];
    const doneSets = sets.filter((x) => x.done);
    const flagged = sets.some((x) => x.flag);
    const vol = totalVolume(doneSets, exById);
    const href = s.finishedAt ? `#/history/${s.id}` : `#/log/${s.id}`;
    list.append(h('a', { class: 'list-row hist-row', href },
      h('span', { class: 'list-row__main' },
        h('span', { class: 'list-row__title' }, wName.get(s.workoutId) ?? s.workoutId),
        h('span', { class: 'list-row__sub' }, formatShortDate(s.date)),
        h('span', { class: 'hist-row__badges' },
          s.finishedAt ? null : h('span', { class: 'badge badge--accent' }, 'In progress'),
          s.isDeload ? h('span', { class: 'badge badge--warn' }, 'Deload') : null,
          flagged ? h('span', { class: 'badge badge--warn' }, 'Flagged') : null)),
      h('span', { class: 'hist-row__stats' },
        h('span', { class: 'num hist-row__big' }, `${doneSets.length}`), h('span', { class: 'muted hist-row__unit' }, 'sets'),
        vol ? h('span', { class: 'num muted hist-row__vol' }, `${formatNumber(vol)} lb`) : null),
      h('span', { class: 'list-row__chev', 'aria-hidden': 'true' }, '›')));
  }
  replace(container, ...out);
}

async function renderDetail(container, id, ctx) {
  const session = await getSession(id);
  if (!session) {
    replace(container, screenHeader('History', { back: () => ctx.navigate('history') }),
      h('div', { class: 'empty-state' }, h('p', null, 'That workout no longer exists.')));
    return;
  }
  const [settings, workouts, exercises, sets] = await Promise.all([
    getSettings(), listWorkouts(), listExercises({ includeArchived: true }), getSetsForSession(id),
  ]);
  const workout = workouts.find((w) => w.id === session.workoutId);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const groups = [];
  for (const st of sets) {
    let g = groups.find((x) => x.exerciseId === st.exerciseId && x.position === st.position);
    if (!g) { g = { exerciseId: st.exerciseId, position: st.position, sets: [] }; groups.push(g); }
    g.sets.push(st);
  }
  const refresh = () => renderDetail(container, id, ctx);

  const note = h('textarea', { class: 'textarea', placeholder: 'Add a note', 'aria-label': 'Note', value: session.note || '',
    onBlur: async () => { if (note.value !== (session.note || '')) { await updateSession(id, { note: note.value }); session.note = note.value; toast('Note saved'); } } });

  const cards = groups.map((g) => {
    const ex = exById.get(g.exerciseId) || { id: g.exerciseId, name: g.exerciseId, loadType: 'none', measure: 'reps', perSide: false };
    const unit = ex.measure === 'seconds' ? 's' : '';
    return h('section', { class: 'card card--tight hist-ex' },
      h('h3', { class: 'hist-ex__name' }, ex.name, ex.perSide ? h('span', { class: 'badge hist-ex__side' }, sideLabel(ex)) : null),
      g.sets.map((st) => {
        const load = formatLoad(st, ex, settings);
        const val = ex.measure === 'done' ? 'Done' : st.value == null ? '–' : `${st.value}${unit}`;
        return h('button', { class: ['hist-set', st.flag && 'is-flagged'], onClick: () => openSetEditor(st, ex, settings, refresh) },
          h('span', { class: 'hist-set__idx muted' }, `Set ${st.setIndex}`),
          h('span', { class: 'hist-set__load' }, load),
          h('span', { class: 'hist-set__val num' }, val, ex.measure !== 'done' && ex.perSide ? h('span', { class: 'muted hist-set__side' }, ` ${sideLabel(ex)}`) : null),
          st.flag ? h('span', { class: 'hist-set__flag' }, st.flag) : null);
      }));
  });

  replace(container,
    screenHeader(workout?.name ?? session.workoutId, {
      back: () => ctx.navigate('history'),
      subtitle: `${formatShortDate(session.date)} · Week ${session.blockWeek}${session.isDeload ? ' · Deload' : ''}`,
    }),
    h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Note'), note),
    cards.length ? cards : h('div', { class: 'empty-state' }, h('p', null, 'No sets were logged.')),
    h('button', { class: 'btn btn-danger btn-block hist-delete', onClick: async () => {
      if (await confirmSheet('Delete this workout and all its sets? This cannot be undone.', { confirmLabel: 'Delete workout', danger: true })) {
        await deleteSession(id); toast('Workout deleted'); ctx.navigate('history');
      }
    } }, 'Delete workout'));
}
