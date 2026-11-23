# Build contracts (frozen by WP0)

Read `docs/SPEC.md` for the requirements. This file says how the code is put together and who owns what.
If something here conflicts with SPEC.md on implementation detail, this file wins. Requirements (F1–F18, N1–N9) still come from SPEC.md.

## Deviation from SPEC: no third-party libraries

The build environment has no npm/CDN access, so `vendor/` (Preact, htm, idb, Chart.js) is dropped:

| SPEC said | Built as |
| --- | --- |
| Preact + htm | `src/ui.js`: `h(tag, props, ...children)` DOM builder; screens re-render their own container |
| idb | raw IndexedDB inside `src/db.js` |
| Chart.js | hand-drawn SVG in `src/components/chart.js` (WP3) using `s()` from ui.js |

Everything else (no build step, ES modules, relative paths, offline) is unchanged.

## Rules for every package

1. Edit only the files your package owns (table below). Other agents are editing their files **at the same time** in the same folder.
2. Do **not** run any git command. The lead commits.
3. Never change a frozen signature (db.js, lib stubs' signatures, pwa.js, backupActions.js, ui.js, Banner). If you need a contract change, say so in your final report and work around it.
4. `src/lib/*` = pure functions on plain data. No DOM, no `db.js` import. Each gets `tests/<name>.test.js` (node:test).
5. Relative paths only (`./`, `../`). No network requests. No `window.alert/confirm/prompt` (use `confirmSheet` / `openSheet` / `toast` from ui.js).
6. Mobile first: test at iPhone 14 size. Tap targets ≥ 44 px (`--tap`). Inputs ≥ 16 px font. Use tokens from `css/app.css`.
7. Screen CSS goes in `css/<screen>.css` with a class prefix (below). Reuse shared classes from `css/app.css` first.
8. JSDoc on exported functions; files under ~300 lines (split into components if needed).
9. Dates are local ISO `YYYY-MM-DD`; use `src/lib/dates.js`. For manual testing "today" is Mon 2026-11-23, block week 9.

## Ownership

| Package | Owns | CSS prefix |
| --- | --- | --- |
| WP0 | index.html, css/app.css, src/app.js, src/ui.js, src/db.js, src/seed/, src/lib/dates.js, src/lib/format.js, src/components/banner.js, tests/{dates,format,seed}.test.js, tests/browser/smoke.py, docs/CONTRACTS.md, package.json | shared |
| WP1 Logging | src/screens/log.js, src/components/{stepper,setRow,exerciseCard,bandPicker}.js (+ more `log*` components if needed), src/lib/lastTime.js, src/lib/progression.js, css/log.css, tests/{lastTime,progression}.test.js, tests/browser/wp1_*.py | `log-`, `set-`, `ex-`, `stepper` |
| WP2 Today + History | src/screens/today.js, src/screens/history.js (list + `#/history/<id>` detail/edit), css/today.css, css/history.css, tests/browser/wp2_*.py | `today-`, `hist-` |
| WP3 Progress | src/screens/progress.js, src/components/chart.js, src/lib/stats.js, css/progress.css, tests/stats.test.js, tests/browser/wp3_*.py | `prog-`, `chart-` |
| WP4a Settings + data | src/screens/settings.js, src/backupActions.js, src/lib/backup.js, src/lib/importer.js, css/settings.css, tests/{backup,importer}.test.js, tests/browser/wp4a_*.py | `set-` is taken → `settings-` |
| WP4b Program editor | src/screens/program.js, css/program.css, tests/browser/wp4b_*.py | `pgm-` |
| WP5 PWA | manifest.webmanifest, sw.js, src/pwa.js, icons/ | — |

## Routes (src/app.js)

`#/today` · `#/log/<sessionId>` · `#/history` · `#/history/<sessionId>` · `#/progress` · `#/progress/<exerciseId>` · `#/settings` · `#/program`

Screen module contract: `export async function render(container, params, ctx)`; may return a cleanup function.
`ctx.navigate('log/abc')`, `ctx.refresh()` (re-render current route), `ctx.setTabHidden(true)` (Log hides the tab bar).
A screen re-renders itself by rebuilding its container (`replace(container, ...)`), or patches nodes for speed (Log).

## Data (src/db.js — read its JSDoc)

Stores: settings, exercises, workouts, sessions, sets. Typedefs `Settings`, `Exercise`, `Workout`, `WorkoutItem`, `Session`, `SetRow` are in db.js.
Key functions: `getSettings/saveSettings`, `listExercises/getExercise/putExercise`, `listWorkouts/getWorkout/putWorkout`,
`listSessions/getSession/getActiveSession/createSession/updateSession/finishSession/deleteSession`,
`listSets/getSetsForSession/getSetsForExercise/putSet/putSets/deleteSet`, `exportAll/replaceAll/mergeHistory/deleteDatabase`, `newId`.

### The workout lifecycle (shared by WP1 and WP2)

1. **Start** (Today, WP2): `createSession({workoutId, date, blockWeek, isDeload})` with `blockWeek()`/`isDeloadWeek()` from dates.js, then `ctx.navigate('log/' + id)`. On `ActiveSessionError`, offer to resume `err.session`.
2. **Log** (WP1): on open, if the session has no sets yet, create one `SetRow` per planned set of every workout item (`done:false`), prefilled from `findLastTime()` (same set count as the item's `sets`; load/band from last time; value = last time's value for that setIndex, else `repMax ?? repMin ?? null`). Done-only items get one set row with `value:null`. Every tap writes with `putSet`.
   `SetRow.position` = index of the item in `workout.items`. `SetRow.workoutId/date` copy the session's.
   Skipping an exercise: add its id to `session.skipped` via `updateSession`.
   Deload toggle: `updateSession(id, {isDeload})`.
3. **Finish** (WP1, also "Finish now" on Today's Unfinished card, WP2): `finishSession(id)` deletes unticked sets.
4. **History edit** (WP2): `putSet` / `deleteSet` on a finished session; `deleteSession` with confirmSheet.

### Shared helpers you should use

- `src/lib/format.js`: `formatLoad`, `formatValues`, `sideLabel`, `setVolume`, `totalVolume`, `bandById`, `formatNumber`.
- `src/lib/dates.js`: `todayISO`, `blockWeek`, `isDeloadWeek`, `workoutIdForDate`, `formatShortDate`, `formatDayMonth`, `mondayOf`, `addDays`.
- `src/components/banner.js`: `Banner({tone, title, text, actions, onDismiss})`.
- `src/ui.js`: `h`, `s`, `replace`, `screenHeader`, `toast`, `confirmSheet`, `openSheet`.
- `src/pwa.js` (WP5): `checkForUpdate()`, `applyUpdate()`, `isStandalone()`.
- `src/backupActions.js` (WP4a): `exportBackup()`.

## Testing

- Unit: `node --test tests/<yours>.test.js` (run the WP0 ones too: `node --test tests/dates.test.js tests/format.test.js tests/seed.test.js`). Others' tests may be mid-edit; don't fix them.
- Browser: `python3 tests/browser/smoke.py --history /home/claude/build-inputs/history-import.json --out /tmp/<wp>-shots`
  serves the repo, opens headless Chrome as an iPhone 14 (dark mode), imports the 28 historical workouts, visits each tab, fails on console errors.
  Write your own `tests/browser/<wp>_*.py` (import helpers from smoke.py: `serve`, `open_iphone`, `import_history`) to click through your screen, and **look at your screenshots** with the Read tool.
  Each Playwright browser context starts with an empty database, so seed what you need in the script.
- Test data: `/home/claude/build-inputs/history-import.json` (28 sessions, 479 sets, weeks 1–7; 9 sets have `flag`). Never copy it into the repo.

## Visual direction

Clean, calm, high-contrast, made for a sweaty thumb in a dim gym: big numbers (`.num`), generous spacing, one accent colour (`--accent`) for primary actions, green (`--done`) only for completed sets, amber (`--warn`) for deload/attention. Follows system light/dark automatically. No emoji in UI copy.
