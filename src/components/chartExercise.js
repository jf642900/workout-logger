// chartExercise.js — builds the charts for one exercise from its series, chosen by load type and measure (WP3).
import { h } from '../ui.js';
import { formatDayMonth, formatShortDate } from '../lib/dates.js';
import { formatNumber, bandById } from '../lib/format.js';
import { lineChart, barChart, stepChart } from './chart.js';

const DAY = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };

function tipFor(p, exercise, settings, rows) {
  const unit = exercise.measure === 'seconds' ? 's' : '';
  const load = exercise.loadType === 'dumbbell' && p.load != null ? `${p.load} lb`
    : exercise.loadType === 'band' && p.bandId ? `${bandById(settings, p.bandId)?.name ?? p.bandId} band` : null;
  const base = [['Workout', DAY[p.workoutId] || p.workoutId]];
  if (load) base.push(['Load', load]);
  return { title: formatShortDate(p.date), rows: [...base, ...rows(unit)] };
}

/** @returns {HTMLElement[]} */
export function exerciseCharts({ exercise, series, settings }) {
  const x = (p) => formatDayMonth(p.date);
  const pts = (valueOf, rows) => series.map((p) => ({ x: x(p), y: valueOf(p), tip: tipFor(p, exercise, settings, rows) }));
  const out = [];
  const { loadType, measure } = exercise;

  if (measure === 'done') {
    const weeks = new Map();
    for (const p of series) weeks.set(p.blockWeek, (weeks.get(p.blockWeek) || 0) + 1);
    const points = [...weeks].sort((a, b) => a[0] - b[0]).map(([w, n]) => ({
      x: `W${w}`, y: n, tip: { title: `Week ${w}`, rows: [['Times done', n]] } }));
    return [barChart({ points, title: 'Times done per week' })];
  }
  if (loadType === 'dumbbell' && measure === 'reps') {
    out.push(lineChart({ points: pts((p) => p.load ?? 0, () => []).map((pt, i) => ({ ...pt,
      tip: tipFor(series[i], exercise, settings, () => [['Total reps', series[i].totalValue], ['Volume', `${formatNumber(series[i].volume)} lb`]]) })),
    title: 'Working load (lb)' }));
    out.push(barChart({ points: pts((p) => p.volume, () => []).map((pt, i) => ({ ...pt,
      tip: tipFor(series[i], exercise, settings, () => [['Volume', `${formatNumber(series[i].volume)} lb`], ['Total reps', series[i].totalValue]]) })),
    title: 'Session volume (lb)', yFormat: (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n)), showValues: false }));
    return out;
  }
  if (loadType === 'band') {
    const bands = settings.bands;
    const points = series.filter((p) => p.bandOrder != null).map((p) => ({
      x: x(p), rank: p.bandOrder, color: bandById(settings, p.bandId)?.colour,
      tip: tipFor(p, exercise, settings, () => [['Total reps', p.totalValue]]) }));
    out.push(points.length ? stepChart({ points, bands, title: 'Band used' })
      : h('p', { class: 'muted prog-note' }, 'No band colour was recorded for these sessions.'));
    out.push(barChart({ points: pts((p) => p.totalValue, () => []).map((pt, i) => ({ ...pt,
      tip: tipFor(series[i], exercise, settings, () => [['Total reps', series[i].totalValue]]) })), title: 'Total reps per session' }));
    return out;
  }
  if (measure === 'seconds') {
    out.push(lineChart({ points: pts((p) => p.best, (u) => []).map((pt, i) => ({ ...pt,
      tip: tipFor(series[i], exercise, settings, () => [['Longest set', `${series[i].best}s`]]) })), title: 'Longest set (s)', zeroBased: true }));
    if (loadType === 'dumbbell' && series.some((p) => p.load != null)) {
      out.push(lineChart({ points: pts((p) => p.load ?? 0, () => []), title: 'Carry load (lb)' }));
    }
    return out;
  }
  // bodyweight reps
  out.push(barChart({ points: pts((p) => p.totalValue, () => []).map((pt, i) => ({ ...pt,
    tip: tipFor(series[i], exercise, settings, () => [['Total reps', series[i].totalValue], ['Best set', series[i].best]]) })), title: 'Total reps per session' }));
  out.push(lineChart({ points: pts((p) => p.best, () => []).map((pt, i) => ({ ...pt,
    tip: tipFor(series[i], exercise, settings, () => [['Best set', series[i].best], ['Total reps', series[i].totalValue]]) })), title: 'Best single set', zeroBased: true }));
  return out;
}

/** Segmented range control. */
export function rangeControl(current, onPick) {
  const opts = [['block', 'This block'], ['4w', 'Last 4 weeks'], ['all', 'All time']];
  return h('div', { class: 'prog-range', role: 'group', 'aria-label': 'Range' },
    opts.map(([id, label]) => h('button', { class: ['prog-range__btn', id === current && 'is-selected'], 'aria-pressed': String(id === current), onClick: () => onPick(id) }, label)));
}
