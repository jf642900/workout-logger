// pwa.js — service worker registration, updates, persistence. Implemented by WP5.
// Signatures are frozen; Today (WP2) calls checkForUpdate() / applyUpdate().
import { Banner } from './components/banner.js';

let registrationPromise = null;
let reloading = false;
const HINT_KEY = 'wl-install-hint-dismissed';

const swSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

function isIOSSafari() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function showInstallHint() {
  try {
    if (localStorage.getItem(HINT_KEY)) return;
    const main = document.getElementById('main');
    if (!main) return;
    const banner = Banner({
      tone: 'info',
      title: 'Install this app',
      text: 'Tap Share, then Add to Home Screen, and open it from the icon. Your data lives in the home-screen app only.',
      onDismiss: () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ } banner.remove(); },
    });
    main.prepend(banner);
  } catch { /* never throw */ }
}

/** Called once by app.js after the first screen renders. Registers ./sw.js, requests persistent storage. */
export function initPWA() {
  try {
    if (swSupported()) {
      registrationPromise = navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => {
        console.warn('Service worker registration failed', e);
        return null;
      });
    }
    if (isStandalone()) {
      navigator.storage?.persist?.().catch(() => {});
    } else if (isIOSSafari()) {
      showInstallHint();
    }
  } catch (e) { console.warn('initPWA', e); }
}

/** @returns {boolean} true when running from the home screen (standalone display mode). */
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** Asks the browser for a new service worker. @returns {Promise<boolean>} true if an update is waiting. */
export async function checkForUpdate() {
  try {
    if (!swSupported()) return false;
    const reg = (registrationPromise && await registrationPromise) || await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await reg.update();
    if (reg.waiting) return true;
    const installing = reg.installing;
    if (installing) {
      await new Promise((resolve) => {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' || installing.state === 'redundant' || installing.state === 'activated') resolve();
        });
      });
    }
    return !!reg.waiting;
  } catch {
    return false;
  }
}

/** Activates the waiting service worker and reloads. Never call during a workout. */
export function applyUpdate() {
  try {
    if (!swSupported()) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      else location.reload();
    }).catch(() => {});
  } catch { /* ignore */ }
}
