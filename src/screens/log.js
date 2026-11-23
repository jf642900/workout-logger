// log.js — placeholder from WP0; implemented by WP1. Contract: render(container, params, ctx) → cleanup?
import { h, screenHeader } from '../ui.js';

export async function render(container, params, ctx) {
  container.append(screenHeader('Log'), h('div', { class: 'empty-state' }, h('p', null, 'Coming in WP1.')));
}
