// ui.js — tiny DOM helpers used by every screen (no framework). Owned by WP0.
//
//   h('button', { class: 'btn', onClick: () => save() }, 'Save')
//   h('div', { class: ['card', done && 'is-done'] }, child1, [child2, child3], null)
//
// Props: class (string or array, falsy entries dropped), style (object or string), dataset (object),
// on<Event> (function → addEventListener), value / checked / disabled / hidden (set as properties),
// anything else → setAttribute. Children: nodes, strings, numbers, arrays; null/undefined/false are skipped.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      if (cls) el.setAttribute('class', cls);
    } else if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else Object.assign(el.style, value);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (['value', 'checked', 'disabled', 'hidden', 'selected'].includes(key)) {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Create an HTML element. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

/** Create an SVG element (charts, icons). */
export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

/** Replace all children of el. */
export function replace(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

/** Standard screen header: title, optional subtitle, optional right-side action node. */
export function screenHeader(title, { subtitle, action, back } = {}) {
  return h('header', { class: 'screen-header' },
    back ? h('button', { class: 'btn-icon', 'aria-label': 'Back', onClick: back }, '‹') : null,
    h('div', { class: 'screen-header__titles' },
      h('h1', { class: 'screen-title' }, title),
      subtitle ? h('p', { class: 'screen-subtitle' }, subtitle) : null),
    action || null);
}

/** Brief message at the bottom of the screen. */
export function toast(message, { ms = 2200 } = {}) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => { el.classList.remove('is-visible'); setTimeout(() => el.remove(), 300); }, ms);
}

/**
 * In-app confirm sheet (never window.confirm: it blocks automation and looks foreign in standalone mode).
 * @returns {Promise<boolean>}
 */
export function confirmSheet(message, { confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const close = (result) => { overlay.remove(); resolve(result); };
    const overlay = h('div', { class: 'sheet-overlay', onClick: (e) => { if (e.target === overlay) close(false); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        h('p', { class: 'sheet__message' }, message),
        h('div', { class: 'sheet__actions' },
          h('button', { class: 'btn btn-secondary', onClick: () => close(false) }, cancelLabel),
          h('button', { class: ['btn', danger ? 'btn-danger' : 'btn-primary'], onClick: () => close(true) }, confirmLabel))));
    document.body.append(overlay);
  });
}

/** Bottom sheet with arbitrary content; returns a close function. */
export function openSheet(content, { onClose } = {}) {
  const close = () => { overlay.remove(); onClose?.(); };
  const overlay = h('div', { class: 'sheet-overlay', onClick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, content));
  document.body.append(overlay);
  return close;
}
