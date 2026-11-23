// settingsParts.js — small shared pieces for the Settings screen (WP4a).
import { h } from '../ui.js';

/** Section heading + children. */
export function section(title, ...children) {
  return h('section', { class: 'settings-section' }, h('h2', { class: 'section-title' }, title), ...children);
}

/** A row with label on the left and a − value + stepper on the right. */
export function stepperRow({ label, sub, value, display, onMinus, onPlus, minusDisabled, plusDisabled }) {
  return h('div', { class: 'list-row settings-row' },
    h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, label), sub ? h('div', { class: 'list-row__sub' }, sub) : null),
    h('div', { class: 'settings-stepper' },
      h('button', { class: 'settings-stepper__btn', 'aria-label': `Decrease ${label}`, disabled: !!minusDisabled, onClick: onMinus }, '−'),
      h('span', { class: 'settings-stepper__value num', 'data-testid': label }, display ?? value),
      h('button', { class: 'settings-stepper__btn', 'aria-label': `Increase ${label}`, disabled: !!plusDisabled, onClick: onPlus }, '+')));
}

/** A tappable list row (button) with title, optional sub line and a chevron/trailing text. */
export function actionRow({ title, sub, trailing = '›', onClick, danger, id }) {
  return h('button', { class: ['list-row', 'settings-action', danger && 'is-danger'], id, onClick },
    h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, title), sub ? h('div', { class: 'list-row__sub' }, sub) : null),
    h('span', { class: 'list-row__chev' }, trailing));
}

/** Hidden file input plus a function that opens it. */
export function hiddenFileInput(accept, onFile, id) {
  const input = h('input', { type: 'file', accept, class: 'settings-file', id, tabindex: '-1', 'aria-hidden': 'true' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (file) await onFile(file);
    input.value = '';
  });
  return input;
}
