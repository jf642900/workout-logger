// settings.js — Settings screen (#/settings). Owned by WP4a. Contract: render(container, params, ctx) → cleanup?
import { h, screenHeader, toast } from '../ui.js';
import { getSettings, saveSettings, listSets } from '../db.js';
import { section } from './settingsParts.js';
import { equipmentSection, blockSection } from './settingsEquipment.js';
import { backupSection, importSection, aboutSection } from './settingsData.js';

export async function render(container, params, ctx) {
  let settings = await getSettings();
  const api = {
    ctx,
    get: () => settings,
    refreshSettings: async () => { settings = await getSettings(); },
    save: async (patch) => { settings = await saveSettings(patch); toast('Saved', { ms: 1200 }); },
    bandUsage: async () => {
      const usage = new Map();
      for (const s of await listSets()) if (s.bandId) usage.set(s.bandId, (usage.get(s.bandId) || 0) + 1);
      return usage;
    },
  };
  container.replaceChildren(
    screenHeader('Settings'),
    h('div', { class: 'settings' },
      section('Program', h('div', { class: 'list' },
        h('a', { class: 'list-row settings-action', href: '#/program', id: 'settings-program' },
          h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, 'Edit workouts and exercises'),
            h('div', { class: 'list-row__sub' }, 'Add, rename, reorder or retarget')),
          h('span', { class: 'list-row__chev' }, '›')))),
      equipmentSection(api),
      blockSection(api),
      backupSection(api),
      importSection(api),
      aboutSection()));
}
