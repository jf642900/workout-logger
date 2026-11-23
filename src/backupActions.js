// backupActions.js — STUB from WP0; implemented by WP4a. Screen-level actions that need db + the share sheet.
// Today (WP2) calls exportBackup() from the "Backup due" banner.

/**
 * Builds a JSON backup (lib/backup.js), shares it via navigator.share({files}) when canShare allows,
 * otherwise downloads it with <a download>. On success saves settings.lastBackupAt.
 * A user cancel (AbortError) resolves {ok:false, cancelled:true} without an error toast.
 * @returns {Promise<{ok:boolean, cancelled?:boolean, method?:'share'|'download', error?:string}>}
 */
export async function exportBackup() {
  return { ok: false, error: 'Not implemented yet' };
}
