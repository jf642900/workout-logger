// today.js — Today screen (WP2): week header, banners, start/resume, different-workout chooser, week strip.
import { h, replace, screenHeader, toast, confirmSheet } from '../ui.js';
import {
  getSettings, listWorkouts, listExercises, listSessions, getActiveSession, getSetsForSession,
  createSession, finishSession, deleteSession, saveSettings, ActiveSessionError,
} from '../db.js';
import {
  todayISO, blockWeek, isDeloadWeek, workoutIdForDate, formatShortDate, mondayOf, addDays, weekdayShort,
} from '../lib/dates.js';
import { Banner } from '../components/banner.js';
import { checkForUpdate, applyUpdate } from '../pwa.js';
import { exportBackup } from '../backupActions.js';

const BACKUP_DAYS = 14;

function olderThan(iso, days) {
  return !iso || Date.now() - new Date(iso).getTime() > days * 86400000;
}

/** @returns {string} "Week 9 of 13" or "Week 14 · block complete" */
function weekLabel(week, settings) {
  if (week > settings.blockWeeks) return `Week ${week} · block complete`;
  if (week < 1) return 'Before the block';
  return `Week ${week} of ${settings.blockWeeks}`;
}

/** Renders the Today screen. @param {HTMLElement} container */
export async function render(container, params, ctx) {
  const today = todayISO();
  const [settings, workouts, exercises, sessions, active] = await Promise.all([
    getSettings(), listWorkouts(), listExercises({ includeArchived: true }), listSessions(), getActiveSession(),
  ]);
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const week = blockWeek(today, settings.blockStartDate);
  const deload = isDeloadWeek(week, settings);
  const activeToday = active && active.date >= today ? active : null;
  const activeOld = active && active.date < today ? active : null;
  const finished = sessions.filter((s) => s.finishedAt);

  let starting = false; // a double tap must not start (or offer to resume) a second workout
  async function start(workoutId) {
    if (starting) return;
    starting = true;
    try {
      const s = await createSession({ workoutId, date: today, blockWeek: week, isDeload: deload });
      ctx.navigate('log/' + s.id);
    } catch (err) {
      starting = false;
      if (!(err instanceof ActiveSessionError)) { console.error(err); toast('Could not start the workout. Try again.'); return; }
      const w = wById.get(err.session.workoutId);
      const ok = await confirmSheet(
        `You already have an unfinished workout: ${w?.name ?? 'workout'} from ${formatShortDate(err.session.date)}. Resume it?`,
        { confirmLabel: 'Resume' });
      if (ok) ctx.navigate('log/' + err.session.id);
    }
  }

  // Finishing an old draft with nothing ticked would save an empty workout: offer to discard it instead.
  async function finishOld(session) {
    const sets = await getSetsForSession(session.id);
    if (!sets.some((x) => x.done)) {
      const discard = await confirmSheet('Nothing was ticked in this workout. Discard it?', { confirmLabel: 'Discard', danger: true });
      if (!discard) return;
      await deleteSession(session.id);
      toast('Workout discarded');
    } else {
      await finishSession(session.id);
      toast('Workout finished');
    }
    ctx.refresh();
  }

  // ----- banners -----
  const banners = h('div', { class: 'today-banners' });
  if (activeOld) {
    const w = wById.get(activeOld.workoutId);
    banners.append(Banner({
      tone: 'warn', title: `Unfinished: ${w?.name ?? 'workout'} from ${formatShortDate(activeOld.date)}`,
      actions: [
        { label: 'Resume', primary: true, onClick: () => ctx.navigate('log/' + activeOld.id) },
        { label: 'Finish now', onClick: () => finishOld(activeOld) },
      ],
    }));
  }
  const updateSlot = h('div', { class: 'today-update-slot' });
  banners.append(updateSlot);
  if (deload) {
    banners.append(Banner({ tone: 'warn', title: 'Deload week', text: 'Aim for half your normal sets.' }));
  }
  if (olderThan(settings.lastBackupAt, BACKUP_DAYS) && olderThan(settings.backupNudgeDismissedAt, BACKUP_DAYS)) {
    banners.append(Banner({
      title: 'Backup due',
      text: settings.lastBackupAt ? 'No backup in over two weeks.' : 'You have not made a backup yet.',
      actions: [{ label: 'Export', primary: true, onClick: async () => {
        const r = await exportBackup();
        if (r.ok) { toast('Backup saved'); ctx.refresh(); } else if (!r.cancelled) toast(r.error || 'Backup failed');
      } }],
      onDismiss: async () => { await saveSettings({ backupNudgeDismissedAt: new Date().toISOString() }); ctx.refresh(); },
    }));
  }

  if (!active) {
    checkForUpdate().then((ready) => {
      if (!ready || !updateSlot.isConnected) return;
      updateSlot.append(Banner({ title: 'Update ready', text: 'Reload to get the latest version.',
        actions: [{ label: 'Reload', primary: true, onClick: () => applyUpdate() }] }));
    }).catch(() => {});
  }

  // ----- main card -----
  const wid = workoutIdForDate(today);
  const todays = wid ? wById.get(wid) : null;
  let mainCard;
  if (activeToday) {
    const w = wById.get(activeToday.workoutId);
    const sets = await getSetsForSession(activeToday.id);
    const ticked = sets.filter((x) => x.done).length;
    mainCard = h('section', { class: 'card today-resume' },
      h('p', { class: 'today-eyebrow' }, 'In progress'),
      h('h2', { class: 'today-title' }, `Resume ${w?.name ?? 'workout'}`),
      h('p', { class: 'today-sub' }, sets.length
        ? h('span', null, h('span', { class: 'num today-count' }, `${ticked}`), ` of ${sets.length} sets ticked`)
        : 'No sets ticked yet'),
      h('button', { class: 'btn btn-primary btn-large btn-block', onClick: () => ctx.navigate('log/' + activeToday.id) }, 'Resume'));
  } else if (todays && finished.some((x) => x.date === today && x.workoutId === todays.id)) {
    // Already done today: don't invite a duplicate with a big Start button.
    const doneToday = finished.find((x) => x.date === today && x.workoutId === todays.id);
    mainCard = h('section', { class: 'card today-workout today-done' },
      h('p', { class: 'today-eyebrow' }, 'Done today'),
      h('h2', { class: 'today-title' }, `\u2713 ${todays.name}`),
      h('p', { class: 'today-sub' }, 'Nice work. See how it went, or start it again from the list below.'),
      h('button', { class: 'btn btn-secondary btn-large btn-block', onClick: () => ctx.navigate('history/' + doneToday.id) }, 'View workout'));
  } else if (todays) {
    mainCard = h('section', { class: 'card today-workout' },
      h('p', { class: 'today-eyebrow' }, "Today's workout"),
      h('h2', { class: 'today-title' }, todays.name),
      exerciseList(todays, exById),
      h('button', { class: 'btn btn-primary btn-large btn-block today-start', onClick: () => start(todays.id) }, 'Start workout'));
  } else {
    mainCard = h('section', { class: 'card today-rest' },
      h('p', { class: 'today-eyebrow' }, 'Weekend'),
      h('h2', { class: 'today-title' }, 'Rest day'),
      h('p', { class: 'today-sub' }, 'Nothing planned. Walk, yoga or put your feet up. You can still start a workout below.'));
  }

  // ----- chooser -----
  const lastDone = (id) => finished.find((s) => s.workoutId === id)?.date;
  const chooser = h('div', { class: 'list today-chooser' }, workouts.map((w) => {
    const d = lastDone(w.id);
    return h('button', { class: 'list-row', onClick: () => start(w.id) },
      h('span', { class: 'list-row__main' },
        h('span', { class: 'list-row__title' }, w.name),
        h('span', { class: 'list-row__sub today-block' }, d ? `Last finished ${formatShortDate(d)}` : 'Not done yet')),
      h('span', { class: 'btn btn-small btn-secondary today-chooser__go' }, 'Start'));
  }));

  // ----- week strip -----
  const monday = mondayOf(today);
  const doneDates = new Set(finished.map((s) => s.date));
  const strip = h('div', { class: 'today-strip', role: 'list' }, [0, 1, 2, 3, 4].map((i) => {
    const d = addDays(monday, i);
    const isDone = doneDates.has(d);
    return h('div', { role: 'listitem',
      class: ['today-day', d === today && 'is-today', isDone && 'is-done', d > today && 'is-future'],
      'aria-label': `${formatShortDate(d)}${isDone ? ', done' : ''}` },
      h('span', { class: 'today-day__name' }, weekdayShort(d)),
      h('span', { class: 'today-day__mark num' }, isDone ? '✓' : String(Number(d.slice(8)))));
  }));

  replace(container,
    screenHeader('Today', { subtitle: `${formatShortDate(today)} · ${weekLabel(week, settings)}` }),
    banners, mainCard,
    h('h3', { class: 'section-title' }, 'This week'), strip,
    h('h3', { class: 'section-title' }, 'Different workout'), chooser);
}

function exerciseList(workout, exById) {
  const out = [];
  for (const part of ['AM', 'PM']) {
    const items = workout.items.filter((i) => i.part === part);
    if (!items.length) continue;
    out.push(h('div', { class: 'divider-label' }, part));
    for (const it of items) {
      out.push(h('div', { class: 'today-ex' },
        h('span', { class: 'today-ex__name' }, exById.get(it.exerciseId)?.name ?? it.exerciseId),
        h('span', { class: 'today-ex__target muted' }, it.targetText)));
    }
  }
  return h('div', { class: 'today-exlist' }, out);
}
