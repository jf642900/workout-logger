// app.js — tab bar + hash router. Owned by WP0.
//
// Routes:  #/today  #/log/<sessionId>  #/history  #/history/<sessionId>  #/progress  #/progress/<exerciseId>
//          #/settings  #/program
// Each screen module exports:  render(container, params, ctx) → (optional) cleanup function
//   params: string[] path segments after the route name
//   ctx:    { navigate(path), refresh(), setTabHidden(bool) }

import { h } from './ui.js';
import { openDB } from './db.js';
import { initPWA } from './pwa.js';

const ROUTES = {
  today: { load: () => import('./screens/today.js'), tab: 'today' },
  log: { load: () => import('./screens/log.js'), tab: 'today' },
  history: { load: () => import('./screens/history.js'), tab: 'history' },
  progress: { load: () => import('./screens/progress.js'), tab: 'progress' },
  settings: { load: () => import('./screens/settings.js'), tab: 'settings' },
  program: { load: () => import('./screens/program.js'), tab: 'settings' },
};

const TABS = [
  { id: 'today', label: 'Today', icon: '●' },
  { id: 'history', label: 'History', icon: '☰' },
  { id: 'progress', label: 'Progress', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

const main = document.getElementById('main');
const tabbar = document.getElementById('tabbar');
let cleanup = null;
let renderToken = 0;

function parseHash() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'today').split('/').map(decodeURIComponent);
  const name = ROUTES[parts[0]] ? parts[0] : 'today';
  return { name, params: parts.slice(1) };
}

export function navigate(path) {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (location.hash === target) route();
  else location.hash = target;
}

function renderTabbar(active) {
  tabbar.replaceChildren(...TABS.map((t) => h('a', {
    class: ['tab', t.id === active && 'is-active'], href: `#/${t.id}`,
    'aria-current': t.id === active ? 'page' : null,
  }, h('span', { class: 'tab__icon', 'aria-hidden': 'true' }, t.icon), h('span', { class: 'tab__label' }, t.label))));
}

async function route() {
  const token = ++renderToken;
  const { name, params } = parseHash();
  const def = ROUTES[name];
  renderTabbar(def.tab);
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  document.body.classList.remove('tabbar-hidden');
  try {
    const mod = await def.load();
    if (token !== renderToken) return;
    const container = h('div', { class: `screen screen--${name}` });
    main.replaceChildren(container);
    window.scrollTo(0, 0);
    const ctx = {
      navigate,
      refresh: () => route(),
      setTabHidden: (hidden) => document.body.classList.toggle('tabbar-hidden', !!hidden),
    };
    cleanup = (await mod.render(container, params, ctx)) || null;
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'screen' },
      h('div', { class: 'empty-state' }, h('p', null, 'Something went wrong loading this screen.'),
        h('pre', { class: 'error-detail' }, String(err?.message || err)))));
  }
}

async function start() {
  await openDB();
  window.addEventListener('hashchange', route);
  await route();
  initPWA();
}

start().catch((err) => {
  console.error(err);
  main.replaceChildren(h('div', { class: 'empty-state' }, h('p', null, `Could not open the app's database: ${err.message}`)));
});
