// stats.js — pure reporting functions (WP3). Never import db.js. Volume always comes from setVolume() in ./format.js.
import { setVolume, formatNumber } from './format.js';

/** Exercise categories that make up each weekly volume bucket (from the workbook's Weekly Summary). */
export const VOLUME_BUCKETS = {
  push: ['Horizontal Push', 'Vertical Push'],
  pull: ['Horizontal Pull', 'Vertical Pull'],
  lower: ['Squat', 'Hinge', 'Glutes', 'Calves'],
};

const PUSHUP_ID = 'push-ups-density-sets';

const byId = (list) => new Map(list.map((x) => [x.id, x]));
const isFinished = (s) => !!s && s.finishedAt != null;

/**
 * One row per block week that has any finished session, ascending by week. Deload sessions count.
 * pullupReps = reps of exercises whose id starts with 'pull-up'; pushupReps = 'push-ups-density-sets'.
 * flowsDone = done sets of measure 'done' exercises; workoutsDone = finished sessions that week.
 * @param {{sessions:import('../db.js').Session[], sets:import('../db.js').SetRow[],
 *   exercises:import('../db.js').Exercise[]}} args
 * @returns {{week:number, pullupReps:number, pushupReps:number, pushVolume:number, pullVolume:number,
 *   lowerVolume:number, workoutsDone:number, flowsDone:number}[]}
 */
export function weeklySummary({ sessions, sets, exercises }) {
  const exMap = byId(exercises);
  const sessMap = new Map();
  const rows = new Map();
  const row = (week) => {
    if (!rows.has(week)) {
      rows.set(week, { week, pullupReps: 0, pushupReps: 0, pushVolume: 0, pullVolume: 0, lowerVolume: 0, workoutsDone: 0, flowsDone: 0 });
    }
    return rows.get(week);
  };
  for (const s of sessions) {
    if (!isFinished(s)) continue;
    sessMap.set(s.id, s);
    row(s.blockWeek).workoutsDone += 1;
  }
  for (const set of sets) {
    const session = sessMap.get(set.sessionId);
    const ex = exMap.get(set.exerciseId);
    if (!session || !ex || !set.done) continue;
    const r = row(session.blockWeek);
    if (ex.measure === 'done') { r.flowsDone += 1; continue; }
    if (ex.measure === 'reps' && set.value != null) {
      if (ex.id.startsWith('pull-up')) r.pullupReps += set.value;
      if (ex.id === PUSHUP_ID) r.pushupReps += set.value;
    }
    const vol = setVolume(set, ex);
    if (!vol) continue;
    if (VOLUME_BUCKETS.push.includes(ex.category)) r.pushVolume += vol;
    else if (VOLUME_BUCKETS.pull.includes(ex.category)) r.pullVolume += vol;
    else if (VOLUME_BUCKETS.lower.includes(ex.category)) r.lowerVolume += vol;
  }
  return [...rows.values()].sort((a, b) => a.week - b.week);
}

/** Most common value; ties go to the larger value. */
function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN || (n === bestN && v > best)) { best = v; bestN = n; }
  return best;
}

/**
 * Chart points for one exercise across all workouts, one point per finished session, oldest first.
 * load = the most common load (dumbbell) or band order (band) that session; best = best single set value.
 * Extra fields: blockWeek, isDeload, setCount.
 * @returns {{sessionId:string, date:string, workoutId:string, load:number|null, bandId:string|null,
 *   bandOrder:number|null, totalValue:number, best:number, volume:number, blockWeek:number,
 *   isDeload:boolean, setCount:number}[]}
 */
export function exerciseSeries({ exercise, sessions, sets, settings }) {
  const sessMap = new Map(sessions.filter(isFinished).map((s) => [s.id, s]));
  const bands = new Map((settings?.bands || []).map((b) => [b.id, b]));
  const groups = new Map();
  for (const set of sets) {
    if (set.exerciseId !== exercise.id || !set.done || !sessMap.has(set.sessionId)) continue;
    if (!groups.has(set.sessionId)) groups.set(set.sessionId, []);
    groups.get(set.sessionId).push(set);
  }
  const points = [];
  for (const [sessionId, group] of groups) {
    const session = sessMap.get(sessionId);
    const values = group.map((g) => g.value).filter((v) => v != null);
    const bandId = mode(group.map((g) => g.bandId).filter((b) => b != null));
    points.push({
      sessionId,
      date: session.date,
      workoutId: session.workoutId,
      load: mode(group.map((g) => g.load).filter((l) => l != null)),
      bandId,
      bandOrder: bandId != null ? (bands.get(bandId)?.order ?? null) : null,
      totalValue: values.reduce((a, b) => a + b, 0),
      best: values.length ? Math.max(...values) : 0,
      volume: group.reduce((sum, g) => sum + setVolume(g, exercise), 0),
      blockWeek: session.blockWeek,
      isDeload: !!session.isDeload,
      setCount: group.length,
    });
  }
  const start = (id) => sessMap.get(id).startedAt || '';
  return points.sort((a, b) => a.date.localeCompare(b.date) || start(a.sessionId).localeCompare(start(b.sessionId)));
}

/** Earliest date among candidates achieving the max of key (strictly better replaces). */
function pickBest(cands, key) {
  let best = null;
  for (const c of cands) if (!best || c[key] > best[key] || (c[key] === best[key] && c.date < best.date)) best = c;
  return best;
}

/**
 * Personal bests for one exercise (SPEC Reporting table).
 * @param {{exercise:object, item?:{repMin:number|null, repMax:number|null}|null, sessions:object[], sets:object[], settings:object}} args
 * @returns {{label:string, value:string, date:string}[]}
 */
export function personalBests({ exercise, item, sessions, sets, settings }) {
  if (exercise.measure === 'done') return [];
  const sessMap = new Map(sessions.filter(isFinished).map((s) => [s.id, s]));
  const mine = sets.filter((s) => s.exerciseId === exercise.id && s.done && s.value != null && sessMap.has(s.sessionId));
  if (!mine.length) return [];
  const withDate = mine.map((s) => ({ ...s, date: sessMap.get(s.sessionId).date }));
  const out = [];
  const series = exerciseSeries({ exercise, sessions, sets, settings });
  const unit = exercise.measure === 'seconds' ? 's' : ' reps';
  const target = item?.repMax ?? item?.repMin ?? null;
  const floor = item?.repMin ?? item?.repMax ?? null;

  // (session, key) groups, where every set in the group must satisfy the target.
  const groupQualified = (keyFn, minValue) => {
    const groups = new Map();
    for (const s of withDate) {
      const k = `${s.sessionId}|${keyFn(s)}`;
      if (!groups.has(k)) groups.set(k, { date: s.date, key: keyFn(s), ok: true });
      if (minValue != null && s.value < minValue) groups.get(k).ok = false;
    }
    return [...groups.values()].filter((g) => g.ok);
  };

  if (exercise.loadType === 'dumbbell') {
    if (exercise.measure === 'reps') {
      const q = groupQualified((s) => s.load, floor).filter((g) => g.key != null);
      const best = pickBest(q, 'key');
      if (best) out.push({ label: floor != null ? `Heaviest load, all sets at ${floor}+ reps` : 'Heaviest load', value: `${best.key} lb`, date: best.date });
      const v = pickBest(series, 'volume');
      if (v && v.volume > 0) out.push({ label: 'Best session volume', value: `${formatNumber(v.volume)} lb`, date: v.date });
      const r = pickBest(withDate, 'value');
      out.push({ label: 'Most reps in one set', value: `${r.value} reps`, date: r.date });
    } else {
      const l = pickBest(withDate.filter((s) => s.load != null), 'load');
      const t = pickBest(withDate, 'value');
      out.push({ label: 'Longest hold', value: `${t.value}s`, date: t.date });
      if (l) out.push({ label: 'Heaviest carry', value: `${l.load} lb`, date: l.date });
    }
    return out;
  }
  if (exercise.loadType === 'band') {
    const order = new Map((settings?.bands || []).map((b) => [b.id, b]));
    const q = groupQualified((s) => s.bandId, target).filter((g) => g.key != null && order.has(g.key))
      .map((g) => ({ ...g, rank: order.get(g.key).order }));
    const best = pickBest(q, 'rank');
    if (best) out.push({ label: target != null ? `Heaviest band, all sets at ${target}+ reps` : 'Heaviest band', value: `${order.get(best.key).name} band`, date: best.date });
    const t = pickBest(series, 'totalValue');
    out.push({ label: 'Most reps in a session', value: `${t.totalValue} reps`, date: t.date });
    return out;
  }
  const b = pickBest(withDate, 'value');
  out.push({ label: exercise.measure === 'seconds' ? 'Longest hold' : 'Most reps in one set', value: `${b.value}${unit}`, date: b.date });
  if (exercise.measure === 'reps') {
    const t = pickBest(series, 'totalValue');
    out.push({ label: 'Most reps in a session', value: `${t.totalValue} reps`, date: t.date });
  }
  return out;
}
