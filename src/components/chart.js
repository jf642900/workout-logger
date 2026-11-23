// chart.js — small hand-drawn SVG charts (WP3). Sized by viewBox, so they scale to the container width.
// Colours come from CSS classes (css/progress.css) so light/dark follow the tokens; only band colours are inline.
// Point shape: { x: 'label', y: number, tip: { title: string, rows: [label, value][] }, color?: string }
import { h, s } from '../ui.js';

const W = 360;

/** Round-number ticks covering [min, max], 3 to 5 of them. @returns {number[]} */
export function niceTicks(min, max, count = 4, integer = false) {
  if (!(max > min)) { max = min + 1; }
  const nice = (range, round) => {
    const exp = Math.floor(Math.log10(range));
    const f = range / 10 ** exp;
    const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
    return nf * 10 ** exp;
  };
  let step = nice((max - min) / (count - 1), true);
  if (integer) step = Math.max(1, Math.round(step));
  const build = () => {
    const out = [];
    for (let v = Math.floor(min / step) * step; v < Math.ceil(max / step) * step + step / 2; v += step) out.push(+v.toFixed(6));
    return out;
  };
  let ticks = build();
  while (ticks.length > 5) { step = nice(step * 1.01, false) === step ? step * 2 : nice(step * 1.01, false); ticks = build(); }
  return ticks;
}

function frame({ height, left = 36, right = 12, top = 12, bottom = 26 }) {
  return { W, H: height, left, right, top, bottom, pw: W - left - right, ph: height - top - bottom };
}

/** Wrap an svg with a title and a tooltip layer. */
function shell(title, svg, tipLayer, extraClass) {
  return h('figure', { class: ['chart', extraClass] },
    title ? h('figcaption', { class: 'chart__title' }, title) : null,
    h('div', { class: 'chart__plot' }, svg, tipLayer));
}

function makeTip() {
  const box = h('div', { class: 'chart__tip', role: 'status', hidden: true });
  const state = { current: null };
  const show = (el, px, py, tip) => {
    state.current?.classList.remove('is-active');
    el.classList.add('is-active');
    state.current = el;
    box.replaceChildren(h('div', { class: 'chart__tip-title' }, tip.title),
      ...(tip.rows || []).map(([k, v]) => h('div', { class: 'chart__tip-row' }, h('span', { class: 'muted' }, k), h('b', { class: 'num' }, String(v)))));
    box.hidden = false;
    const pct = (px / W) * 100;
    box.style.left = `${pct}%`;
    box.style.top = `${(py / box.__H) * 100}%`;
    box.dataset.align = pct < 28 ? 'left' : pct > 72 ? 'right' : 'center';
  };
  const hide = () => { box.hidden = true; state.current?.classList.remove('is-active'); state.current = null; };
  return { box, show, hide };
}

function axes(svg, f, ticks, yOf, yFormat) {
  for (const t of ticks) {
    const y = yOf(t);
    svg.append(s('line', { class: 'chart__grid', x1: f.left, x2: W - f.right, y1: y, y2: y }),
      s('text', { class: 'chart__tick', x: f.left - 6, y: y + 4, 'text-anchor': 'end' }, yFormat(t)));
  }
}

function xLabels(svg, f, labels, xOf) {
  const longest = Math.max(...labels.map((l) => String(l).length));
  const maxLabels = Math.max(2, Math.floor(f.pw / (longest * 6.2 + 12)));
  const step = Math.ceil(labels.length / maxLabels);
  for (let i = labels.length - 1; i >= 0; i -= step) {
    svg.append(s('text', { class: 'chart__tick', x: xOf(i), y: f.H - 8, 'text-anchor': 'middle' }, labels[i]));
  }
}

function setup(f) {
  const svg = s('svg', { class: 'chart__svg', viewBox: `0 0 ${W} ${f.H}`, role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  const tip = makeTip();
  tip.box.__H = f.H;
  svg.addEventListener('click', (e) => { if (e.target === svg) tip.hide(); });
  return { svg, tip };
}

function yScale(f, lo, hi) { return (v) => f.top + f.ph - ((v - lo) / (hi - lo || 1)) * f.ph; }

/**
 * Line chart with dots on a category x-axis.
 * @param {{points:object[], title?:string, yFormat?:(n:number)=>string, zeroBased?:boolean, height?:number}} o
 */
export function lineChart({ points, title, yFormat = (n) => String(n), zeroBased = false, height = 170 }) {
  const f = frame({ height });
  const { svg, tip } = setup(f);
  const ys = points.map((p) => p.y);
  let lo = zeroBased ? 0 : Math.min(...ys);
  let hi = Math.max(...ys);
  if (hi === lo) { lo = zeroBased ? 0 : lo - 1; hi = hi + 1; }
  const ticks = niceTicks(lo, hi, 4);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const yOf = yScale(f, lo, hi);
  const n = points.length;
  const xOf = (i) => (n === 1 ? f.left + f.pw / 2 : f.left + 10 + (i * (f.pw - 20)) / (n - 1));
  axes(svg, f, ticks, yOf, yFormat);
  xLabels(svg, f, points.map((p) => p.x), xOf);
  if (n > 1) svg.append(s('polyline', { class: 'chart__line', points: points.map((p, i) => `${xOf(i)},${yOf(p.y)}`).join(' ') }));
  points.forEach((p, i) => {
    const cx = xOf(i); const cy = yOf(p.y);
    const g = s('g', { class: 'chart__pt', tabindex: 0 },
      s('circle', { class: 'chart__hit', cx, cy, r: 16 }),
      s('circle', { class: 'chart__dot', cx, cy, r: 4.5, style: p.color ? { fill: p.color } : null }));
    const open = (e) => { e.stopPropagation(); tip.show(g, cx, cy, p.tip); };
    g.addEventListener('click', open);
    g.addEventListener('mouseenter', open);
    svg.append(g);
  });
  return finish(title, svg, tip, 'chart--line');
}

/**
 * Bar chart (zero based).
 * @param {{points:object[], title?:string, yFormat?:(n:number)=>string, height?:number, showValues?:boolean}} o
 */
export function barChart({ points, title, yFormat = (n) => String(n), height = 170, showValues = true }) {
  const f = frame({ height });
  const { svg, tip } = setup(f);
  const hi = Math.max(1, ...points.map((p) => p.y));
  const ticks = niceTicks(0, hi, 4, points.every((p) => Number.isInteger(p.y)));
  const top = ticks[ticks.length - 1];
  const yOf = yScale(f, 0, top);
  const n = points.length;
  const slot = f.pw / n;
  const bw = Math.min(34, slot * 0.62);
  const xOf = (i) => f.left + slot * (i + 0.5);
  axes(svg, f, ticks, yOf, yFormat);
  xLabels(svg, f, points.map((p) => p.x), xOf);
  points.forEach((p, i) => {
    const x = xOf(i); const y = yOf(p.y);
    const g = s('g', { class: 'chart__pt', tabindex: 0 },
      s('rect', { class: 'chart__hit', x: x - slot / 2, y: f.top, width: slot, height: f.ph }),
      s('rect', { class: 'chart__bar', x: x - bw / 2, y, width: bw, height: Math.max(0, yOf(0) - y), rx: 3, style: p.color ? { fill: p.color } : null }));
    if (showValues && n <= 14 && p.y > 0) g.append(s('text', { class: 'chart__val', x, y: y - 4, 'text-anchor': 'middle' }, yFormat(p.y)));
    const open = (e) => { e.stopPropagation(); tip.show(g, x, y, p.tip); };
    g.addEventListener('click', open);
    g.addEventListener('mouseenter', open);
    svg.append(g);
  });
  return finish(title, svg, tip, 'chart--bar');
}

/**
 * Step/dot chart for band rank: rows are bands (light at the bottom), labelled by name, dots in band colour.
 * @param {{points:{x:string, rank:number, color:string, tip:object}[], bands:{name:string,colour:string,order:number}[], title?:string, height?:number}} o
 */
export function stepChart({ points, bands, title, height = 170 }) {
  const f = frame({ height, left: 62 });
  const { svg, tip } = setup(f);
  const sorted = [...bands].sort((a, b) => a.order - b.order);
  const rows = sorted.length;
  const yOf = (order) => {
    const idx = sorted.findIndex((b) => b.order === order);
    return f.top + f.ph - (rows === 1 ? f.ph / 2 : (idx / (rows - 1)) * f.ph);
  };
  sorted.forEach((b) => {
    const y = yOf(b.order);
    svg.append(s('line', { class: 'chart__grid', x1: f.left, x2: W - f.right, y1: y, y2: y }),
      s('circle', { cx: 10, cy: y, r: 4.5, style: { fill: b.colour } }),
      s('text', { class: 'chart__tick', x: f.left - 8, y: y + 4, 'text-anchor': 'end' }, b.name));
  });
  const n = points.length;
  const xOf = (i) => (n === 1 ? f.left + f.pw / 2 : f.left + 10 + (i * (f.pw - 20)) / (n - 1));
  xLabels(svg, f, points.map((p) => p.x), xOf);
  if (n > 1) {
    let d = '';
    points.forEach((p, i) => { const y = yOf(p.rank); d += i === 0 ? `M${xOf(i)},${y}` : `H${xOf(i)}V${y}`; });
    svg.append(s('path', { class: 'chart__line chart__line--step', d }));
  }
  points.forEach((p, i) => {
    const cx = xOf(i); const cy = yOf(p.rank);
    const g = s('g', { class: 'chart__pt', tabindex: 0 },
      s('circle', { class: 'chart__hit', cx, cy, r: 16 }),
      s('circle', { class: 'chart__dot', cx, cy, r: 5.5, style: { fill: p.color } }));
    const open = (e) => { e.stopPropagation(); tip.show(g, cx, cy, p.tip); };
    g.addEventListener('click', open);
    g.addEventListener('mouseenter', open);
    svg.append(g);
  });
  return finish(title, svg, tip, 'chart--step');
}

/** Tiny trend line for list rows. @param {number[]} values */
export function sparkline(values, { width = 64, height = 24 } = {}) {
  const svg = s('svg', { class: 'chart-spark', viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true' });
  if (values.length < 2) {
    if (values.length) svg.append(s('circle', { class: 'chart-spark__dot', cx: width - 4, cy: height / 2, r: 2.5 }));
    return svg;
  }
  const lo = Math.min(...values); const hi = Math.max(...values);
  const pts = values.map((v, i) => `${3 + (i * (width - 8)) / (values.length - 1)},${hi === lo ? height / 2 : height - 4 - ((v - lo) / (hi - lo)) * (height - 8)}`);
  svg.append(s('polyline', { class: 'chart-spark__line', points: pts.join(' ') }));
  const [lx, ly] = pts[pts.length - 1].split(',');
  svg.append(s('circle', { class: 'chart-spark__dot', cx: lx, cy: ly, r: 2.5 }));
  return svg;
}

function finish(title, svg, tip, cls) {
  const el = shell(title, svg, tip.box, cls);
  // tap outside any point hides the tooltip
  el.addEventListener('click', (e) => { if (!e.target.closest?.('.chart__pt')) tip.hide(); });
  return el;
}
