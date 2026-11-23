// banner.js — shared non-blocking banner (Unfinished, Deload, Backup due, Update ready). Owned by WP0.
import { h } from '../ui.js';

/**
 * @param {{tone?:'info'|'warn'|'success', title:string, text?:string,
 *   actions?:{label:string, onClick:Function, primary?:boolean}[], onDismiss?:Function}} opts
 * @returns {HTMLElement}
 */
export function Banner({ tone = 'info', title, text, actions = [], onDismiss }) {
  return h('div', { class: ['banner', `banner--${tone}`], role: 'status' },
    h('div', { class: 'banner__body' },
      h('strong', { class: 'banner__title' }, title),
      text ? h('span', { class: 'banner__text' }, text) : null),
    actions.length || onDismiss ? h('div', { class: 'banner__actions' },
      actions.map((a) => h('button', { class: ['btn', 'btn-small', a.primary ? 'btn-primary' : 'btn-secondary'], onClick: a.onClick }, a.label)),
      onDismiss ? h('button', { class: 'btn-icon btn-small', 'aria-label': 'Dismiss', onClick: onDismiss }, '×') : null) : null);
}
