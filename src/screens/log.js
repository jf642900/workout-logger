// log.js — the workout logging screen, #/log/<sessionId> (WP1; SPEC F1–F10, F15, F16).
import { h, replace, confirmSheet, toast } from '../ui.js';
import {
  getSession, getSettings, getWorkout, listExercises, listSessions, listSets,
  getSetsForSession, putSets, updateSession, finishSession, newId,
} from '../db.js';
import { formatShortDate } from '../lib/dates.js';
import { totalVolume } from '../lib/format.js';
import { findLastTime } from '../lib/lastTime.js';
import { suggestNext } from '../lib/progression.js';
import { Banner } from '../components/banner.js';
import { ExerciseCard } from '../components/exerciseCard.js';
import { buildInitialSets, personalBests } from '../components/logData.js';
import { openSummarySheet } from '../components/logSheets.js';

/** @param {HTMLElement} container @param {string[]} params @param {{navigate:Function, setTabHidden:Function}} ctx */
export async function render(container, params, ctx) {
  const sheets = new Set();
  const track = (close) => { sheets.add(close); };
  const cleanup = () => {
    ctx.setTabHidden(false);
    for (const close of sheets) { try { close(); } catch { /* already closed */ } }
  };
  ctx.setTabHidden(true);

  const sessionId = params[0];
  let session = sessionId ? await getSession(sessionId) : null;
  if (!session) {
    replace(container, Header(null, () => ctx.navigate('today')),
      h('div', { class: 'empty-state' }, h('p', null, 'This workout no longer exists.'),
        h('button', { class: 'btn btn-primary', onClick: () => ctx.navigate('today') }, 'Back to Today')));
    return cleanup;
  }
  if (session.finishedAt) { ctx.navigate(`history/${session.id}`); return cleanup; }

  const [settings, workout, exercises, sessions, allSets] = await Promise.all([
    getSettings(), getWorkout(session.workoutId), listExercises({ includeArchived: true }), listSessions(), listSets(),
  ]);
  const exercisesById = new Map(exercises.map((e) => [e.id, e]));
  const items = workout?.items || [];

  let sets = await getSetsForSession(session.id);
  if (!sets.length && workout) {
    sets = buildInitialSets({ session, workout, exercisesById, settings, sessions, sets: allSets });
    await putSets(sets);
  }

  // One card per workout item; sets left from an edited program become extra cards at the end.
  const groups = items.map((item, position) => ({ item, position, sets: sets.filter((s) => s.position === position && s.exerciseId === item.exerciseId) }));
  const claimed = new Set(groups.flatMap((g) => g.sets.map((s) => s.id)));
  const orphanKeys = [...new Set(sets.filter((s) => !claimed.has(s.id)).map((s) => `${s.position}|${s.exerciseId}`))];
  for (const key of orphanKeys) {
    const [pos, exerciseId] = key.split('|');
    const rows = sets.filter((s) => `${s.position}|${s.exerciseId}` === key);
    groups.push({ item: { exerciseId, part: null, sets: rows.length, repMin: null, repMax: null, targetText: '' }, position: Number(pos), sets: rows });
  }

  const makeSet = (position, exerciseId) => (partial) => ({
    id: newId('set'), sessionId: session.id, workoutId: session.workoutId, exerciseId, date: session.date, position,
    done: false, overridden: false, rir: null, flag: null, load: null, bandId: null, value: null, ...partial,
  });

  const progressText = h('span', { class: 'log-bar__count num' });
  const progressFill = h('span', { class: 'log-bar__fill' });
  const cards = [];
  const updateProgress = () => {
    const active = cards.filter((c) => !c.skipped());
    const total = active.reduce((n, c) => n + c.sets().length, 0);
    const done = active.reduce((n, c) => n + c.sets().filter((s) => s.done).length, 0);
    progressText.textContent = `${done} of ${total} sets`;
    progressFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  };

  const list = h('div', { class: 'log-list' });
  let lastPart = null;
  for (const g of groups) {
    const exercise = exercisesById.get(g.item.exerciseId);
    if (!exercise) continue;
    if (g.item.part && g.item.part !== lastPart) { list.append(h('div', { class: 'divider-label' }, g.item.part)); lastPart = g.item.part; }
    const last = findLastTime({ exerciseId: exercise.id, workoutId: session.workoutId, activeSessionId: session.id, sessions, sets: allSets });
    const card = ExerciseCard({
      item: g.item, exercise, settings, sets: g.sets, last, hint: suggestNext({ exercise, item: g.item, last, settings }),
      skipped: (session.skipped || []).includes(exercise.id), makeSet: makeSet(g.position, exercise.id), track,
      onChange: updateProgress, onSkip: (skip) => setSkipped(exercise.id, skip),
    });
    cards.push(card);
    list.append(card.el);
  }

  async function setSkipped(exerciseId, skip) {
    const current = new Set(session.skipped || []);
    if (skip) current.add(exerciseId); else current.delete(exerciseId);
    session = { ...session, skipped: [...current] };
    try { session = await updateSession(session.id, { skipped: session.skipped }); } catch (e) { console.error(e); toast('Could not save. Try again.'); }
  }

  // ---------- header + deload ----------
  const bannerSlot = h('div', { class: 'log-banner' });
  const paintDeload = () => {
    deloadBtn.setAttribute('aria-pressed', session.isDeload ? 'true' : 'false');
    deloadBtn.classList.toggle('is-on', !!session.isDeload);
    replace(bannerSlot, session.isDeload ? Banner({ tone: 'warn', title: 'Deload week: aim for half your normal sets', text: 'Sets are not cut for you. Skip or remove what you do not need.' }) : null);
  };
  const deloadBtn = h('button', { class: 'log-deload', type: 'button', onClick: async () => {
    session = { ...session, isDeload: !session.isDeload };
    paintDeload();
    try { session = await updateSession(session.id, { isDeload: session.isDeload }); } catch (e) { console.error(e); toast('Could not save. Try again.'); }
  } }, h('span', { class: 'log-deload__switch', 'aria-hidden': 'true' }), 'Deload');
  paintDeload();

  // ---------- finish ----------
  let finishing = false;
  async function finish() {
    if (finishing) return;
    const active = cards.filter((c) => !c.skipped());
    const open = active.reduce((n, c) => n + c.sets().filter((s) => !s.done).length, 0);
    const doneCount = active.reduce((n, c) => n + c.sets().filter((s) => s.done).length, 0);
    if (!doneCount) {
      const ok = await confirmSheet('No sets are ticked yet. Finish anyway? The workout will be saved with nothing in it.', { confirmLabel: 'Finish', cancelLabel: 'Keep logging' });
      if (!ok) return;
    } else if (open) {
      const ok = await confirmSheet(`${open} ${open === 1 ? 'set is' : 'sets are'} not ticked. Unticked sets are discarded, not saved as zero.`, { confirmLabel: 'Finish and discard', cancelLabel: 'Keep logging' });
      if (!ok) return;
    }
    finishing = true;
    try {
      const finished = await finishSession(session.id);
      session = finished;
      const kept = await getSetsForSession(session.id);
      const bests = personalBests({ session, sessionSets: kept, allSets, sessions, exercisesById });
      track(openSummarySheet({
        setsDone: kept.length, volume: totalVolume(kept, exercisesById), exercisesDone: new Set(kept.map((s) => s.exerciseId)).size, bests,
        onDone: async (note) => {
          if (note) { try { await updateSession(session.id, { note }); } catch (e) { console.error(e); } }
          ctx.navigate('today');
        },
      }));
    } catch (e) {
      finishing = false;
      console.error(e);
      toast('Could not finish. Try again.');
    }
  }

  const bar = h('div', { class: 'log-bar' }, h('div', { class: 'log-bar__inner' },
    h('div', { class: 'log-bar__progress' }, progressText, h('span', { class: 'log-bar__track' }, progressFill)),
    h('button', { class: 'btn btn-primary log-bar__finish', type: 'button', onClick: finish }, 'Finish')));

  container.classList.add('log-screen');
  replace(container, Header(session, () => ctx.navigate('today'), workout, deloadBtn), bannerSlot,
    workout ? null : h('p', { class: 'muted' }, 'This workout was removed from the program; showing what was logged.'), list, bar);
  updateProgress();
  return cleanup;
}

function Header(session, onBack, workout, deloadBtn) {
  const [day, ...rest] = (workout?.name || 'Workout').split(' · ');
  return h('header', { class: 'log-head' },
    h('button', { class: 'btn-icon log-head__back', type: 'button', 'aria-label': 'Back to Today', onClick: onBack }, '‹'),
    h('div', { class: 'log-head__titles' },
      h('h1', { class: 'screen-title log-head__title' }, session ? day : 'Workout'),
      session ? h('p', { class: 'log-head__sub' }, rest.length ? h('span', { class: 'log-head__focus' }, rest.join(' · ')) : null,
        h('span', { class: 'log-head__date num' }, `${formatShortDate(session.date)} · Week ${session.blockWeek}`)) : null),
    deloadBtn || null);
}
