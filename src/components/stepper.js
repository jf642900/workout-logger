// stepper.js — [−] value [+] control that patches its own number in place (WP1).
import { h } from '../ui.js';

/**
 * @param {{value:number|null, step?:number, min?:number, max?:number, unit?:string, start?:number,
 *   size?:'md'|'lg', label?:string, onChange:(v:number)=>void}} opts
 *   start: value used when + is tapped on an empty (null) stepper.
 * @returns {HTMLElement & {setValue:(v:number|null)=>void}}
 */
export function Stepper({ value, step = 1, min = 0, max = Infinity, unit = '', start, size = 'md', label = 'value', onChange }) {
  let current = value;
  const num = h('span', { class: 'stepper__num num' });
  const unitEl = unit ? h('span', { class: 'stepper__unit' }, unit) : null;
  const minus = h('button', { class: 'stepper__btn', type: 'button', 'aria-label': `Decrease ${label}`, onClick: () => bump(-1) }, '−');
  const plus = h('button', { class: 'stepper__btn', type: 'button', 'aria-label': `Increase ${label}`, onClick: () => bump(1) }, '+');
  const el = h('div', { class: ['stepper', `stepper--${size}`] },
    minus, h('span', { class: 'stepper__val', 'aria-live': 'polite' }, num, unitEl), plus);

  function paint() {
    num.textContent = current == null ? '–' : String(current);
    minus.disabled = current == null || current <= min;
    plus.disabled = current != null && current >= max;
  }
  function bump(dir) {
    let next;
    if (current == null) next = dir > 0 ? (start ?? min) : null;
    else next = Math.min(max, Math.max(min, current + dir * step));
    if (next == null || next === current) return;
    current = next;
    paint();
    onChange(current);
  }
  el.setValue = (v) => { current = v; paint(); };
  paint();
  return el;
}
