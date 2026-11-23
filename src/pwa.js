// pwa.js — service worker registration, updates, persistence. STUB from WP0; implemented by WP5.
// Signatures are frozen; Today (WP2) calls checkForUpdate() / applyUpdate().

/** Called once by app.js after the first screen renders. Registers ./sw.js, requests persistent storage. */
export function initPWA() {}

/** @returns {boolean} true when running from the home screen (standalone display mode). */
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** Asks the browser for a new service worker. @returns {Promise<boolean>} true if an update is waiting. */
export async function checkForUpdate() {
  return false;
}

/** Activates the waiting service worker and reloads. Never call during a workout. */
export function applyUpdate() {}
