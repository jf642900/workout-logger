// progress.js — Progress tab (WP3): weekly summary, pull-up chart, exercise list and per-exercise detail.
// Routes: #/progress and #/progress/<exerciseId>
import { h, replace, screenHeader } from '../ui.js';
import * as db from '../db.js';
import { blockWeek, todayISO, addDays, formatShortDate } from '../lib/dates.js';
import { formatNumber, formatValues, bandById } from '../lib/format.js';
import { weeklySummary, exerciseSeries, personalBests } from '../lib/stats.js';
import { barChart, sparkline } from '../components/chart.js';
import { exerciseCharts, rangeControl } from '../components/chartExercise.js';

const CATEGORY_ORDER = ['Horizontal Push', 'Vertical Push', 'Horizontal Pull', 'Vertical Pull', 'Squat', 'Hinge', 'Glutes', 'Calves', 'Core', 'Arms', 'Prehab', 'Carry', 'Mobility'];
let range = 'block';

async function load() {
  const [settings, exercises, workouts, sessions, sets] = await Promise.all([
    db.getSettings(), db.listExercises({ includeArchived: true }), db.listWorkouts(), db.listSessions({ finishedOnly: true }), db.listSets()]);
  return { settings, exercises, workouts, sessions, sets };
}

export async function render(container, params, ctx) {
  const data = await load();
  if (params[0]) return renderDetail(container, params[0], data, ctx);
  return renderOverview(container, data);
}

// ---------- overview ----------

function weekRows(data) {
  const { settings, sessions, sets, exercises } = data;
  const have = new Map(weeklySummary({ sessions, sets, exercises }).map((r) => [r.week, r]));
  const current = blockWeek(todayISO(), settings.blockStartDate);
  // Empty rows run to the current week (capped at the block length); weeks with data always show, even past the block.
  const last = Math.max(Math.min(current, settings.blockWeeks), ...have.keys(), 0);
  const rows = [];
  for (let w = 1; w <= last; w++) rows.push(have.get(w) || { week: w, empty: true });
  return rows;
}

function summaryTable(rows, settings) {
  const cell = (r, key, fmt = formatNumber) => h('td', { class: 'num', 'data-col': key }, r.empty ? '–' : fmt(r[key]));
  return h('div', { class: 'card card--tight prog-table-wrap' }, h('table', { class: 'prog-table', 'data-testid': 'weekly-table' },
    h('thead', null,
      h('tr', { class: 'prog-table__group' }, h('th'), h('th', { colspan: 2 }, 'Reps'), h('th', { colspan: 3 }, 'Volume, lb'), h('th', { colspan: 2 }, 'Sessions')),
      h('tr', null, h('th', null, 'Wk'), h('th', null, 'Pull-up'), h('th', null, 'Push-up'), h('th', null, 'Push'), h('th', null, 'Pull'), h('th', null, 'Lower'), h('th', null, 'Done'), h('th', null, 'Flows'))),
    h('tbody', null, rows.map((r) => h('tr', { 'data-week': r.week, class: r.empty && 'is-empty' },
      h('th', { scope: 'row', class: 'num' }, String(r.week), settings.deloadWeeks.includes(r.week) ? h('span', { class: 'prog-dl', title: 'Deload week' }, 'D') : null),
      cell(r, 'pullupReps'), cell(r, 'pushupReps'), cell(r, 'pushVolume'), cell(r, 'pullVolume'), cell(r, 'lowerVolume'),
      cell(r, 'workoutsDone', (n) => `${n}/5`), cell(r, 'flowsDone'))))));
}

/** Latest summary of one exercise for the list row. */
function latestInfo(ex, series, sets, settings) {
  const last = series[series.length - 1];
  const when = formatShortDate(last.date);
  const lastSets = sets.filter((s) => s.sessionId === last.sessionId && s.exerciseId === ex.id && s.done).sort((a, b) => a.setIndex - b.setIndex);
  const vals = formatValues(lastSets, ex);
  if (ex.measure === 'done') return { main: `${series.length}×`, sub: `Last ${when}`, trend: [] };
  if (ex.loadType === 'dumbbell') return { main: last.load != null ? `${last.load} lb` : `${last.best}${ex.measure === 'seconds' ? 's' : ''}`, sub: `${when} · ${vals}`, trend: series.map((p) => (ex.measure === 'seconds' ? p.best : p.load ?? 0)) };
  if (ex.loadType === 'band') return { main: last.bandId ? bandById(settings, last.bandId)?.name ?? last.bandId : `${last.totalValue}`, sub: `${when} · ${vals}`, trend: series.map((p) => p.bandOrder ?? 0) };
  if (ex.measure === 'seconds') return { main: `${last.best}s`, sub: `${when} · ${vals}`, trend: series.map((p) => p.best) };
  return { main: `${last.totalValue} reps`, sub: `${when} · ${vals}`, trend: series.map((p) => p.totalValue) };
}

function exerciseList(data) {
  const { exercises, sessions, sets, settings } = data;
  const cats = new Map();
  for (const ex of exercises) {
    if (ex.archived) continue;
    if (!cats.has(ex.category)) cats.set(ex.category, []);
    cats.get(ex.category).push(ex);
  }
  const names = [...cats.keys()].sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 100) % 100 - (CATEGORY_ORDER.indexOf(b) + 100) % 100 || a.localeCompare(b));
  return names.map((cat) => h('section', { class: 'prog-cat' },
    h('h2', { class: 'section-title' }, cat),
    h('div', { class: 'list' }, cats.get(cat).map((ex) => {
      const series = exerciseSeries({ exercise: ex, sessions, sets, settings });
      const info = series.length ? latestInfo(ex, series, sets, settings) : null;
      return h('a', { class: ['list-row', 'prog-ex', !info && 'is-empty'], href: `#/progress/${encodeURIComponent(ex.id)}`, 'data-exercise': ex.id },
        h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, ex.name),
          h('div', { class: 'list-row__sub prog-ex__sub' }, info ? info.sub : 'No data yet')),
        info ? h('div', { class: 'prog-ex__latest' }, h('span', { class: 'num prog-ex__main' }, info.main), info.trend.length > 1 ? sparkline(info.trend) : null) : null,
        h('span', { class: 'list-row__chev', 'aria-hidden': 'true' }, '›'));
    }))));
}

function renderOverview(container, data) {
  const { settings, sessions, sets, exercises } = data;
  const rows = weekRows(data);
  const pullups = rows.filter((r) => !r.empty).map((r) => ({
    x: `W${r.week}`, y: r.pullupReps, tip: { title: `Week ${r.week}`, rows: [['Pull-up reps', r.pullupReps], ['Workouts', `${r.workoutsDone}/5`]] } }));
  replace(container,
    screenHeader('Progress', { subtitle: `Block of ${settings.blockWeeks} weeks` }),
    h('h2', { class: 'section-title' }, 'This block'),
    sessions.length ? [summaryTable(rows, settings),
      h('div', { class: 'card' }, barChart({ points: pullups, title: 'Pull-up reps per week' }))]
      : h('div', { class: 'empty-state' }, h('p', null, 'Finish a workout to see your weekly totals.')),
    exerciseList({ settings, exercises, sessions, sets }));
}

// ---------- detail ----------

function rangeStart(settings) {
  const today = todayISO();
  if (range === 'block') return settings.blockStartDate;
  if (range === '4w') return addDays(today, -27);
  return '0000-00-00';
}

async function renderDetail(container, id, data, ctx) {
  const { settings, exercises, workouts, sessions, sets } = data;
  const exercise = exercises.find((e) => e.id === id);
  const back = () => ctx.navigate('progress');
  if (!exercise) { replace(container, screenHeader('Progress', { back }), h('div', { class: 'empty-state' }, h('p', null, 'Exercise not found.'))); return; }
  const item = workouts.flatMap((w) => w.items).find((i) => i.exerciseId === id) || null;
  const all = exerciseSeries({ exercise, sessions, sets, settings });
  const draw = () => {
    const from = rangeStart(settings);
    const series = all.filter((p) => p.date >= from);
    const unitNote = exercise.perSide ? ` ${exercise.sideUnit ? '/ ' + exercise.sideUnit : '/ side'}` : '';
    const bests = personalBests({ exercise, item, sessions, sets, settings });
    replace(container,
      screenHeader(exercise.name, { back, subtitle: `${exercise.category}${item?.targetText ? ' · ' + item.targetText : ''}${unitNote ? ' ·' + unitNote : ''}` }),
      rangeControl(range, (r) => { range = r; draw(); }),
      !all.length ? h('div', { class: 'empty-state' }, h('p', null, 'No data yet. Log this exercise to see a chart.'))
        : !series.length ? h('div', { class: 'empty-state' }, h('p', null, 'No sessions in this range.'))
          : exerciseCharts({ exercise, series, settings }).map((c) => h('div', { class: 'card prog-chart-card' }, c)),
      bests.length ? [h('h2', { class: 'section-title' }, 'Personal bests'),
        h('div', { class: 'list', 'data-testid': 'bests' }, bests.map((b) => h('div', { class: 'list-row' },
          h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, b.label), h('div', { class: 'list-row__sub' }, formatShortDate(b.date))),
          h('span', { class: 'num prog-pb' }, b.value))))] : null);
  };
  draw();
}
