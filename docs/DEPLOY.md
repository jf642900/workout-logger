# Deploying and installing

## Publish on GitHub Pages
1. Push the repo to GitHub (`jf642900/workout-logger`).
2. Settings -> Pages -> Build and deployment -> Deploy from a branch -> `main` / `/ (root)` -> Save.
3. After a minute the app is at https://jf642900.github.io/workout-logger/

## Install on iPhone
1. Open the URL in **Safari** (not Chrome).
2. Share -> Add to Home Screen -> Add.
3. From now on open it only from the home-screen icon. The home-screen app has its own storage; Safari tabs do not share it. Deleting the icon deletes the data.

## First run
1. Open the app from the icon (once, with signal, so it caches itself).
2. Settings -> Import history -> pick `history-import.json` (from the Workout Tracker/build-inputs folder) via the Files app.
3. Make a backup export now and then; the app nudges every 14 days.

## Releasing a change
On every change that ships:
1. Bump `CACHE_VERSION` in `sw.js`.
2. Update the `PRECACHE` list in `sw.js` for any added/removed/renamed file. `node --test tests/sw.test.js` fails if the list differs from the files in `src/`, `css/`, `icons/`.
3. Push to `main`. The phone fetches the new worker on the next launch with signal; Today shows "Update ready", and tapping it reloads (never during a workout).

Local check: `python3 tests/browser/wp5_offline.py` (serves under /workout-logger/, tests offline and update).
