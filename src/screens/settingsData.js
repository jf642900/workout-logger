// settingsData.js — Backup, Import history and About sections of Settings (WP4a).
import { h, replace, toast, confirmSheet } from '../ui.js';
import { DB_NAME, listExercises, mergeHistory } from '../db.js';
import { exportBackup, exportCSV, restoreFromFile, applyRestore } from '../backupActions.js';
import { parseHistoryFile } from '../lib/importer.js';
import { formatShortDate, todayISO } from '../lib/dates.js';
import { formatNumber } from '../lib/format.js';
import { section, actionRow, hiddenFileInput } from './settingsParts.js';

export const APP_VERSION = '1.0.0';

function errorList(errors) {
  return h('div', { class: 'card settings-errors', role: 'alert' },
    h('div', { class: 'list-row__title' }, 'That file cannot be used'),
    h('ul', null, errors.map((e) => h('li', null, e))));
}

function lastBackupText(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Never' : formatShortDate(todayISO(d));
}

/** Backup section. api: {get, refreshSettings, ctx} */
export function backupSection(api) {
  const box = h('div');
  const notice = h('div');
  function draw() {
    const st = api.get();
    const restoreInput = hiddenFileInput('.json,application/json', async (file) => {
      replace(notice);
      const r = await restoreFromFile(file);
      if (!r.ok) { replace(notice, errorList(r.errors)); return; }
      const when = r.summary.exportedAt ? ` from ${lastBackupText(r.summary.exportedAt)}` : '';
      const ok = await confirmSheet(
        `Restore the backup${when}? This replaces everything on this phone with ${formatNumber(r.summary.sessions)} workouts and ${formatNumber(r.summary.sets)} sets. Your current data will be erased.`,
        { confirmLabel: 'Replace all', danger: true });
      if (!ok) return;
      try {
        await applyRestore(r.data);
        toast(`Restored ${formatNumber(r.summary.sessions)} workouts, ${formatNumber(r.summary.sets)} sets`);
        api.ctx.navigate('today');
      } catch (e) { replace(notice, errorList([e?.message || String(e)])); }
    }, 'settings-restore-input');
    const run = async (fn, okMsg, touchesBackup) => {
      const r = await fn();
      if (r.ok) { toast(okMsg); if (touchesBackup) { await api.refreshSettings(); draw(); } }
      else if (!r.cancelled) toast(`Export failed: ${r.error || 'unknown error'}`, { ms: 3500 });
    };
    replace(box,
      h('div', { class: 'list' },
        h('div', { class: 'list-row' }, h('div', { class: 'list-row__main list-row__title' }, 'Last backup'),
          h('span', { class: 'muted', id: 'settings-last-backup' }, lastBackupText(st.lastBackupAt))),
        actionRow({ title: 'Export backup', sub: 'One JSON file with everything. Save it to Files or iCloud Drive.', id: 'settings-export-json',
          onClick: () => run(exportBackup, 'Backup exported', true) }),
        actionRow({ title: 'Export CSV', sub: 'One row per set, for spreadsheets.', id: 'settings-export-csv',
          onClick: () => run(exportCSV, 'CSV exported', false) }),
        actionRow({ title: 'Restore from backup', sub: 'Replaces everything on this phone.', id: 'settings-restore', danger: true,
          onClick: () => restoreInput.click() })),
      restoreInput, notice);
  }
  draw();
  return section('Backup', box);
}

/** Import history section. */
export function importSection(api) {
  const box = h('div');
  const panel = h('div');
  const input = hiddenFileInput('.json,application/json', async (file) => {
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { replace(panel, errorList(['This file is not valid JSON.'])); return; }
    const exercises = await listExercises({ includeArchived: true });
    const r = parseHistoryFile(obj, { exercises });
    if (!r.ok) { replace(panel, errorList(r.errors)); return; }
    const names = new Map(exercises.map((e) => [e.id, e.name]));
    replace(panel, h('div', { class: 'card settings-preview' },
      h('div', { class: 'list-row__title', id: 'settings-import-summary' },
        `${formatNumber(r.sessions.length)} workouts, ${formatNumber(r.sets.length)} sets, ${r.flagged.length} flagged`),
      r.flagged.length ? h('div', null,
        h('div', { class: 'list-row__sub' }, 'Flagged sets are imported as logged. Review them in History.'),
        h('ul', { class: 'settings-flagged' }, r.flagged.map((s) => h('li', null,
          h('strong', null, `${formatShortDate(s.date)} · ${names.get(s.exerciseId) || s.exerciseId}`),
          h('span', { class: 'muted' }, ` set ${s.setIndex}: ${s.flag}`))))) : null,
      h('div', { class: 'settings-preview__actions' },
        h('button', { class: 'btn btn-secondary', onClick: () => replace(panel) }, 'Cancel'),
        h('button', { class: 'btn btn-primary', id: 'settings-import-go', onClick: async () => {
          const res = await mergeHistory({ sessions: r.sessions, sets: r.sets });
          replace(panel);
          toast(res.addedSessions || res.addedSets
            ? `Imported ${res.addedSessions} workouts, ${res.addedSets} sets`
            : 'Nothing new: already imported', { ms: 3000 });
        } }, 'Import'))));
  }, 'settings-import-input');
  replace(box,
    h('div', { class: 'list' }, actionRow({ title: 'Import history file', sub: 'Past workouts from the workbook. Safe to run twice.',
      id: 'settings-import', onClick: () => input.click() })),
    input, panel);
  return section('Import history', box);
}

/** About section. */
export function aboutSection() {
  const persisted = h('span', { class: 'muted', id: 'settings-persisted' }, '…');
  (async () => {
    try {
      const p = await navigator.storage?.persisted?.();
      persisted.textContent = p === true ? 'Protected' : p === false ? 'Not protected' : 'Unknown';
    } catch { persisted.textContent = 'Unknown'; }
  })();
  const row = (label, value) => h('div', { class: 'list-row' }, h('div', { class: 'list-row__main list-row__title' }, label), value);
  return section('About', h('div', { class: 'list' },
    row('Version', h('span', { class: 'muted num', id: 'settings-version' }, APP_VERSION)),
    row('Storage', persisted),
    row('Database', h('span', { class: 'muted', id: 'settings-dbname' }, DB_NAME))));
}
