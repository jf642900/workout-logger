// settings.js — placeholder from WP0; implemented by WP4a. Contract: render(container, params, ctx) → cleanup?
import { h, screenHeader } from '../ui.js';

export async function render(container, params, ctx) {
  container.append(screenHeader('Settings'), h('div', { class: 'empty-state' }, h('p', null, 'Coming in WP4a.')));
}
