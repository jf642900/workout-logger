// backupActions.js — screen-level data actions: export (share sheet / download), CSV, restore. Owned by WP4a.
// Today (WP2) calls exportBackup() from the "Backup due" banner.
import { exportAll, replaceAll, saveSettings } from './db.js';
import { buildBackup, validateBackup, toCSV, backupFileName } from './lib/backup.js';

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Shares the file when the platform can, else downloads it. */
async function deliver(file, title) {
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return { ok: true, method: 'share' };
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, cancelled: true };
    // Share refused (e.g. iOS rejects the file type): fall through to the download.
  }
  downloadFile(file);
  return { ok: true, method: 'download' };
}

/**
 * Builds a JSON backup (lib/backup.js), shares it via navigator.share({files}) when canShare allows,
 * otherwise downloads it with <a download>. On success saves settings.lastBackupAt.
 * A user cancel (AbortError) resolves {ok:false, cancelled:true} without an error toast.
 * @returns {Promise<{ok:boolean, cancelled?:boolean, method?:'share'|'download', error?:string}>}
 */
export async function exportBackup() {
  try {
    const now = new Date().toISOString();
    const backup = buildBackup(await exportAll(), now);
    const file = new File([JSON.stringify(backup)], backupFileName(now), { type: 'application/json' });
    const result = await deliver(file, 'Workout Logger backup');
    if (result.ok) await saveSettings({ lastBackupAt: now });
    return result;
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** Exports one CSV row per set. Does not change lastBackupAt. @returns {Promise<{ok:boolean, cancelled?:boolean, method?:string, error?:string}>} */
export async function exportCSV() {
  try {
    const now = new Date().toISOString();
    const file = new File([toCSV(await exportAll())], backupFileName(now, 'csv'), { type: 'text/csv' });
    return await deliver(file, 'Workout Logger CSV');
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Reads and validates a backup file without changing anything.
 * @param {File} file
 * @returns {Promise<{ok:boolean, errors:string[], data?:object, summary?:{sessions:number, sets:number, exportedAt:string|null}}>}
 */
export async function restoreFromFile(file) {
  let obj;
  try {
    obj = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ['This file is not valid JSON.'] };
  }
  const v = validateBackup(obj);
  if (!v.ok) return { ok: false, errors: v.errors };
  return {
    ok: true, errors: [], data: v.data,
    summary: { sessions: v.data.sessions.length, sets: v.data.sets.length, exportedAt: obj.exportedAt ?? null },
  };
}

/** Replaces the whole database with validated backup data. @param {object} data from restoreFromFile().data */
export async function applyRestore(data) {
  await replaceAll(data);
}
