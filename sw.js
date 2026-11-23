// sw.js — offline app shell. Owned by WP5.
// RELEASE RULE: bump CACHE_VERSION and keep PRECACHE complete on every change (tests/sw.test.js enforces the list).
const CACHE_VERSION = 1;
const CACHE_PREFIX = 'workout-logger-v';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/history.css',
  './css/log.css',
  './css/program.css',
  './css/progress.css',
  './css/settings.css',
  './css/today.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './src/app.js',
  './src/backupActions.js',
  './src/components/bandPicker.js',
  './src/components/banner.js',
  './src/components/chart.js',
  './src/components/chartExercise.js',
  './src/components/exerciseCard.js',
  './src/components/logData.js',
  './src/components/logSheets.js',
  './src/components/setRow.js',
  './src/components/stepper.js',
  './src/db.js',
  './src/lib/backup.js',
  './src/lib/dates.js',
  './src/lib/format.js',
  './src/lib/importer.js',
  './src/lib/lastTime.js',
  './src/lib/progression.js',
  './src/lib/stats.js',
  './src/pwa.js',
  './src/screens/history.js',
  './src/screens/historyEdit.js',
  './src/screens/log.js',
  './src/screens/program.js',
  './src/screens/programExercise.js',
  './src/screens/programShared.js',
  './src/screens/programSheets.js',
  './src/screens/progress.js',
  './src/screens/settings.js',
  './src/screens/settingsData.js',
  './src/screens/settingsEquipment.js',
  './src/screens/settingsParts.js',
  './src/screens/today.js',
  './src/seed/program.js',
  './src/ui.js',
];

const url = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(url(p), { cache: 'reload' })))),
  );
  // No skipWaiting here: the page asks for it (SKIP_WAITING) so an update never lands mid-workout.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await cache.match(url('./index.html'));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
