// today.js — placeholder from WP0; implemented by WP2. Contract: render(container, params, ctx) → cleanup?
import { h, screenHeader } from '../ui.js';

export async function render(container, params, ctx) {
  container.append(screenHeader('Today'), h('div', { class: 'empty-state' }, h('p', null, 'Coming in WP2.')));
}
