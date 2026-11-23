# Workout Logger PWA — BRD & Solution Architecture

Nov 23, 2026 · @Jeff

## Summary

Build a small offline web app (a Progressive Web App) that installs to the phone's home screen, stores everything on the phone, and replaces the Numbers Daily Log for day-to-day logging. It needs no app store, no account and no server beyond a free static host that delivers the code once.

The app opens on today's workout (Mon–Fri, AM and PM merged into one), shows what was lifted last time for each exercise, and lets each set be logged with a couple of taps. Dumbbells step in 5 lb increments, bands are picked by colour, and bodyweight, timed and mobility items need no weight. A Progress tab charts each exercise over time and rebuilds the workbook's Weekly Summary.

Status: final for build, revised on 23 Nov after Gemini's review (see Review decisions). The seed program and history import files are already generated, so WP0 can start.

## Current state

The workbook (workout-tracker.numbers) runs a 13-week block that started Mon 28 Sep 2026, with 10 weekday sessions (Mon–Fri, AM and PM) plus optional weekend walks and yoga. Logging stopped after Wed 11 Nov (week 7); weeks 8–13 are pre-filled but empty, and today is the Monday of week 9.

| Sheet | What it holds | Actually used? | In the app |
| --- | --- | --- | --- |
| Daily Log | 572 pre-filled rows: week, date, session, exercise, target, one load (lb), up to 7 set columns, RIR, Done, Notes | 156 rows logged across weeks 1–7; RIR, Done and Notes never filled | Replaced by the logging screen; history imported |
| Program | 41 exercise slots with target, rest period and technique cue, plus shoulder, pull-up, progression and deload rules | Reference | Seeds the 5 workouts; cues shown on each exercise |
| Weekly Summary | Pull-up reps, push-up reps, push / pull / lower volume per week, all calculated | Calculated only | Rebuilt as a Progress view |
| Adherence | Y/N grid of 12 session slots × 13 weeks | Empty | Derived automatically from logged workouts |
| Benchmarks | Max pull-ups, push-ups and test loads in weeks 1, 5, 9, 13 | Empty | Not in v1 |
| Body & Nutrition | Daily bodyweight, protein, calories, sleep | Empty | Not in v1 |

What the log shows about how you actually train:

- **One weight per exercise.** Load is a single number for all sets; every loaded value is a multiple of 5 (10–40 lb).
- **Bands are not tracked.** Side-Lying External Rotation and Band Pull-Apart log reps only; there is nowhere to put the colour.
- **Seconds go in the rep columns.** Hollow body, side plank and carries hold 30–45 s values in the Set columns, so the app needs a timed type.
- **Mobility rows are never filled.** Flows and the scap + cuff prep only ever need a done tick.
- **9 sets are ambiguous**: Single-Leg Calf Raise sets of 45 and 60 against a 2 x 15 target (seconds, or both legs?), one calf set of 1, and Farmer's Carry with a single set of 80. The import carries them as logged, flagged for review in History.

## Business requirements

The app succeeds if a full workout can be logged one-handed between sets in under 10 seconds per set, without ever opening the spreadsheet.

**Goals**

1. Log a workout faster than the spreadsheet: prefilled values, taps instead of typing.
2. Know where to start: last session's weight and reps visible on every exercise.
3. Track the three kinds of resistance properly: dumbbells (5 lb steps), band colours, and none.
4. See progress over time per exercise and per week.
5. Keep all data on the phone, with a backup that survives losing or replacing it.

**Out of scope for v1:** accounts, cloud sync, multiple users, sharing, Apple Health / Google Fit, nutrition and bodyweight tracking, benchmarks, rest timer, RIR and weekend logging, and coaching beyond the program's own progression rule.

### Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| F1 | Five fixed workouts, Mon–Fri, each the AM and PM exercises of that day in program order (AM first, with an AM / PM divider) | Must |
| F2 | Home screen opens on today's workout; any of the five can be started on any date (e.g. Monday's workout done on Tuesday) | Must |
| F3 | Each exercise has a load type (dumbbell, band, none) and a measure (reps, seconds, done-only) that decide which inputs appear | Must |
| F4 | Dumbbell load: stepper in 5 lb steps from 5 to 40 lb, per hand, entered once per exercise and copied to every set not yet ticked or overridden; a weight chip on each set row opens a per-set override | Must |
| F5 | Band load: colour chips (blue, yellow, red, green), set once per exercise, with the same update rule and per-set override as F4 | Must |
| F6 | Reps or seconds per set via stepper, prefilled from the last session; one tap confirms a set as done; per-side exercises show a "/ side" or "/ leg" badge | Must |
| F7 | Last time panel on each exercise: date, load or band, and reps/seconds per set from the most recent finished, non-deload session of the same workout day (Tuesday's Goblet Squat vs last Tuesday's); falls back to any day if that day has none | Must |
| F8 | Sets can be added or removed per exercise; the target (e.g. 3 x 8–10) shows as the default set count | Must |
| F9 | Every change saves immediately; only one unfinished workout exists at a time and reopening resumes it; one left open past midnight shows an "Unfinished" card on Today with Resume and Finish now | Must |
| F10 | Finish workout: summary of sets, volume and any personal bests; optional note | Must |
| F11 | History list of past workouts, open any to view or correct entries, including flagged imported sets | Must |
| F12 | Progress charts per exercise and a weekly summary (see Reporting) | Must |
| F13 | Export all data as a JSON backup and a CSV through the share sheet, with a plain download as fallback; restore from a backup | Must |
| F14 | One-time import of the 156 logged rows from the Numbers workbook, via the prepared history-import.json | Must |
| F15 | Progression hint: when every set reached the top of the rep range last time, suggest the next 5 lb step (the program's double-progression rule). At 40 lb, the heaviest dumbbell, suggest the next step on the program's "out of dumbbell" ladder instead: 4s lowering, bottom pause, 1.5 reps, single-arm or single-leg, added range, then 15–20 reps | Should |
| F16 | Technique cue and rest period from the Program sheet shown on tap | Should |
| F17 | Block week number on the home screen, with a banner on Today and Log in weeks 6 and 12 ("Deload week: aim for half your normal sets"); set rows are not cut automatically, and a Deload toggle on each workout is on by default in those weeks | Should |
| F18 | Program editor on its own screen: add, remove, rename, swap, reorder or retarget exercises, and change an exercise's load type or measure | Must |
| F19 | Optional RIR (reps in reserve) per exercise, one tap from 0–4 | Won't (v1) |
| F20 | Rest timer that starts when a set is ticked | Won't (v1) |
| F21 | Weekend walk / yoga as a done-only log | Won't (v1) |
| F22 | Benchmarks and bodyweight / nutrition logs | Won't (v1) |

### Non-functional requirements

| ID | Requirement |
| --- | --- |
| N1 | Works fully offline after first install; no network calls while logging |
| N2 | All data stays on the device; the host serves code only and never receives data |
| N3 | Installs to the home screen and opens full-screen like an app |
| N4 | Opens to a usable screen in under 1 second on a recent phone; every tap responds in under 100 ms |
| N5 | Tap targets at least 44 × 44 pt; usable one-handed; readable in a dim gym; follows system dark mode; no double-tap zoom; nothing hidden behind the Dynamic Island or home indicator |
| N6 | Pounds throughout; dates in local time (America/Toronto) |
| N7 | No data loss on app update: schema changes migrate existing data |
| N8 | If no backup has been made in 14 days, a dismissible banner (never a blocking pop-up) offers one-tap Export |
| N9 | Built and tested for current iOS Safari on iPhone, used from the home screen; Android is not a target |

## Solution architecture

A static, offline-first Progressive Web App: plain HTML, CSS and JavaScript served once from a free HTTPS host, then cached on the phone by a service worker, with all data in the browser's IndexedDB database on the device.

&#91;embedded content: architecture · on-device app, static host, file backups\]

Screens never touch storage directly: they call `db.js` and the pure functions in `lib/`, which is what lets several sub-agents build screens in parallel.

### Platform options considered

| Option | Install | Data stays local | Build effort | Verdict |
| --- | --- | --- | --- | --- |
| Progressive Web App (PWA) | Add to Home Screen from the browser | Yes, IndexedDB on the phone | Low: static files, no toolchain | **Recommended** |
| Native iOS (SwiftUI) | Xcode + Apple developer account, re-sign yearly or every 7 days | Yes | High; needs a Mac build loop for every change | Overkill for one user |
| Cross-platform (React Native / Flutter) | App store or side-loading | Yes | High; heavy toolchain for small sub-agents | Overkill |
| Better spreadsheet (Numbers / Sheets form) | None | Depends | Low | Doesn't fix the typing-on-a-grid problem |

### Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Preact + htm, vendored as one file, no build step | Components keep each screen self-contained, so sub-agents can work in parallel; no bundler or npm needed to run it |
| Styling | One CSS file with custom properties; light and dark themes | Simple, no framework |
| Storage | IndexedDB through the tiny `idb` wrapper (vendored) | Structured, indexed queries for "last time" lookups; far larger and safer than localStorage |
| Charts | Chart.js (vendored) | Line and bar charts with little code; well known to smaller models |
| Offline | Hand-written service worker, cache-first for the app shell, versioned cache name | Opens with no signal; an update arrives on the next launch with signal |
| Install | Web App Manifest with `display: standalone`, icons, theme colour | Opens full-screen from the home screen |
| Tests | `node --test` for the pure logic (progression, aggregation, import parsing) | No test framework to install |
| Hosting | GitHub Pages, under your account | Free HTTPS, which a service worker requires; serves code only |

### Storage durability and backup

On iPhone, Safari deletes site data after 7 days without use, but that cap does not apply to the first-party data of an app launched from the home screen, which keeps its own days-of-use counter ([The Register, quoting WebKit](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/)). The app will also request persistent storage with `navigator.storage.persist()`, which WebKit grants based on signals such as running as a home screen app ([WebKit storage policy](https://webkit.org/?p=14403)).

Two consequences for the design:

- **Use it from the home screen icon only.** A home screen app does not share storage with Safari ([WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849)), so the history import and any restore must be done inside the installed app.
- **Backups are the safety net.** Export writes one JSON file through the share sheet (to Files, iCloud Drive or email); restore reads it back. The app nudges for a backup every 14 days (N8). Deleting the home screen icon deletes the data.

### Privacy

The deployed code contains the program but no logged history. Your past workouts are imported from a file on the phone, so nothing personal sits on the public host.

### iPhone and GitHub Pages hardening

These rules apply to every package and are checked in WP6.

| Area | Rule | Why |
| --- | --- | --- |
| Paths | Relative paths (`./`) everywhere: `index.html`, manifest `start_url`, `scope` and `icons`, `sw.js`. Register with `navigator.serviceWorker.register('./sw.js', { scope: './' })` | A GitHub Pages project site lives under `/<repo>/`, so root paths like `/sw.js` 404 after deploy while working on localhost |
| Shared origin | IndexedDB database named `workout-logger-db`; cache names prefixed `workout-logger-v`; cache cleanup deletes only keys with that prefix | Every project site under `<user>.github.io` shares one origin and storage |
| Safe areas | `viewport-fit=cover` in the viewport meta tag; padding from `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`; tab bar pinned with `position: fixed; bottom: 0` rather than a `100dvh` shell | Keeps the header clear of the Dynamic Island and the tab bar clear of the home indicator in standalone mode |
| Icons | `apple-touch-icon` 180 × 180 link in `index.html` beside the manifest icons | iOS uses it for the home screen icon |
| Taps | `touch-action: manipulation` on steppers and buttons; `overscroll-behavior-y: none` on the Log screen; clear space between `+` and the tick | Stops double-tap zoom, pull-bounce and sweaty-hand misfires |
| Backup export | Check `navigator.canShare({ files })` before `navigator.share()`; treat `AbortError` as a cancel; fall back to an `<a download>` file | iOS may refuse a JSON file in the share sheet |
| App updates | Check for a new service worker when Today is shown; show "Update ready, tap to reload"; never reload during a workout | Home screen apps are rarely force-quit, so a waiting update can sit unused |
| Charts | Chart.js category x-axis with formatted date labels | Avoids a date-adapter library |

## Data model and exercise catalogue

Five stores in one IndexedDB database, `workout-logger-db`, hold everything; an exercise's load type and measure drive every input, chart and calculation.

| Store | Key fields | Notes |
| --- | --- | --- |
| `settings` (one record) | blockStartDate (2026-09-28), blockWeeks (13), deloadWeeks \[6, 12\], dumbbellStep (5), dumbbellMin (5), dumbbellMax (40), bands \[ {id, name, colour, order} \], lastBackupAt, schemaVersion | Bands seeded light → heavy as blue, yellow, red, green; charts rank them in that order |
| `exercises` | id (slug), name, category, loadType (`dumbbell` \| `band` \| `none`), measure (`reps` \| `seconds` \| `done`), perSide, cue, rest, archived | Shared across workouts, so Goblet Squat on Tue and Fri is one exercise with one chart |
| `workouts` | id (`mon`…`fri`), name, items \[ {exerciseId, part AM/PM, sets, repMin, repMax, targetText} \] | The program; editable in the app (F18) |
| `sessions` | id, workoutId, date, startedAt, finishedAt (null while in progress), blockWeek, isDeload, note, source (`app` \| `import`) | At most one session with no finishedAt |
| `sets` | id, sessionId, workoutId, exerciseId, date, position, setIndex, load (lb), bandId, value (reps or seconds), done, overridden, rir (unused in v1), flag | Indexes on \[workoutId, exerciseId, date\] and \[exerciseId, date\] answer "last time" and charts |

Rules the code must follow:

- Dumbbell load is **per hand** (as in the workbook's Benchmarks sheet). Goblet Squat uses one dumbbell and records that dumbbell's weight.
- Volume = load × reps, summed over sets: the workbook's own formula, confirmed on all 81 logged rows with a volume. It is computed when read and never stored, so a per-exercise multiplier could be added later without migrating data. Band and bodyweight sets add reps, not volume.
- Per-side exercises record reps or seconds per side, as the workbook does.
- "Last time" = the most recent session that is finished, not marked deload, not the one in progress, and of the same workout day; if none, the same rule across all days. The progression hint uses the same lookup.
- Deload sessions still count toward weekly volume, reps and workouts done.
- Functions in `src/lib/` take plain arrays and objects and never import `db.js`, so `node --test` runs them without a browser database.

### Exercise catalogue

Confirmed on 23 Nov and generated as `build-inputs/program.json`.

| Exercise | Day(s) | Target | Load | Measure |
| --- | --- | --- | --- | --- |
| Vinyasa hip + thoracic flow | Mon | 10 min | none | done |
| Bulgarian Split Squat | Mon | 3 x 8-10 / leg | dumbbell | reps / side |
| DB Romanian Deadlift | Mon | 3 x 10-12 @ 4s lower | dumbbell | reps |
| Dead Bug | Mon | 3 x 12 / side | none | reps / side |
| Scap + cuff prep | Mon, Tue, Thu | 4-5 min | none | done |
| Flat DB Bench Press | Mon | 4 x 8-10 | dumbbell | reps |
| Chest-Supported DB Row | Mon | 4 x 10-12 | dumbbell | reps |
| Face Pull (replaces Side-Lying External Rotation) | Mon | 2 x 12 | band | reps |
| Dynamic flow (lateral lunge, lizard) | Tue | 10 min | none | done |
| Goblet Squat | Tue, Fri | 3 x 10-12 (Tue), 3 x 12 (Fri) | dumbbell | reps |
| Single-Leg Glute Bridge | Tue | 3 x 12 / leg | none | reps / side |
| Hollow Body Hold | Tue | 3 x 30 sec | none | seconds |
| Pull-up - Strength Clusters | Tue | 7 x 2 | none | reps |
| Band Pull-Apart | Tue | 7 x 15 | band | reps |
| Seated Neutral-Grip DB Press | Tue | 3 x 8-10 | dumbbell | reps |
| DB Biceps Curl | Tue, Wed | 2 x 10 | dumbbell | reps |
| Restorative flow - NO chaturanga | Wed | 20-25 min | none | done |
| Wall Slide | Wed | 2 x 10 | none | reps |
| Push-up Plus (serratus) | Wed | 2 x 10 | none | reps |
| Chest-Supported Rear Delt Flye | Wed | 3 x 12-15 | dumbbell | reps |
| Overhead Triceps Extension | Wed | 2 x 10 | dumbbell | reps |
| Sun Salutations | Thu | 10 min | none | done |
| DB Reverse Lunge | Thu | 3 x 10 / leg | dumbbell | reps / side |
| Single-Leg / B-Stance RDL | Thu | 3 x 8 / leg | dumbbell | reps / side |
| Side Plank + Thread-the-Needle | Thu | 3 x 30 sec / side | none | seconds / side |
| Pull-up - Eccentric (5s lower) | Thu | 4 x 4 | none | reps |
| Pull-up - Foot-Assisted | Thu | 2 x 6-8 | none | reps |
| Incline DB Bench / Floor Press | Thu | 3 x 10 | dumbbell | reps |
| Single-Arm DB Row | Thu | 3 x 10 / side | dumbbell | reps / side |
| Single-Leg Calf Raise | Thu | 2 x 15 | dumbbell | reps |
| Hip + back flow | Fri | 10 min | none | done |
| Single-Leg Hip Thrust (bench) | Fri | 3 x 12 / leg | none | reps / side |
| Suitcase Carry | Fri | 3 x 40 sec / side | dumbbell | seconds / side |
| Push-ups - Density Sets | Fri | 4 sets @ 2 shy of failure | none | reps |
| Inverted Row | Fri | 3 x 10-12 | none | reps |
| Farmer's Carry | Fri | 3 x 40 sec | dumbbell | seconds |
| Active Hang | Fri | 2 x 30-45 sec | none | seconds |

Any exercise can switch load type later (for example adding a dumbbell to the hip thrust) without losing its history. Past sets logged as Side-Lying External Rotation import as Face Pull, since that is what was done; its technique cue starts blank.

## Key screens and user flows

Four tabs along the bottom (Today, History, Progress, Settings, with Program opened from Settings), with the logging screen as the heart of the app.

| Screen | What it shows | Main actions |
| --- | --- | --- |
| Today | Block week (e.g. "Week 9 of 13"), today's workout and its exercises, this week's done days. Banners when they apply: Unfinished workout, Deload week, Backup due, Update ready | Start or resume today's workout; pick a different day; Finish now on an unfinished one; Export; reload for an update |
| Log workout | One card per exercise in program order with an AM / PM divider; a card collapses to one line once every set is ticked ("✓ Flat DB Bench Press · 40 lb · 10/10/10/10"); Deload toggle and banner in the header | Log sets, override one set's load, add / remove a set, skip an exercise, finish |
| History | Past workouts newest first, with date, workout name, sets done and volume; flagged imported sets marked | Open one to view or edit; delete with confirmation |
| Progress | Exercise picker, charts and personal bests; weekly summary | See Reporting |
| Program | The five workouts and their exercises | Add, remove, rename, swap, reorder, retarget; change load type or measure |
| Settings | Band colours, dumbbell range, block start date, backup / restore, CSV export, history import | Export, restore, import, edit |

### Logging an exercise

Each exercise card is laid out so the decision about where to start is made at a glance:

```
── PM ────────────────────────────────────────
Flat DB Bench Press                     4 x 8-10
Last time  Mon 9 Nov · 40 lb · 10 / 10 / 10 / 10
Hint       At your heaviest dumbbell → try 4s lowering

Load   [ − ]   40 lb   [ + ]
Set 1  40   [ − ]  10  [ + ]        [ ✓ ]
Set 2  40   [ − ]  10  [ + ]        [ ✓ ]
Set 3  40   [ − ]  10  [ + ]        [ ✓ ]
Set 4  40   [ − ]  10  [ + ]        [ ✓ ]
                                + add set
```

1. Open the workout; every set is prefilled with last time's load and reps for that day (or the target if there is no history).
2. Adjust the load once if needed; it updates every set not yet ticked or overridden. Tap a set's weight chip (the "40") to change that set alone.
3. After each set, nudge the reps if they differ, then tick. A ticked set turns green and saves; the tick sits apart from the steppers so it is hard to hit by mistake.
4. A band exercise shows colour chips instead of the load stepper; a timed exercise shows seconds in 5 s steps; a done-only item shows a single tick. Per-side exercises carry a "/ side" or "/ leg" badge.
5. When every set is ticked the card collapses to one line; tap to reopen it.
6. Tap the exercise name for the cue and rest period.
7. Finish shows the summary and any personal bests; unticked sets are discarded, not saved as zero.

## Reporting

The Progress tab answers two questions: is each lift moving, and is the week on track. All figures are computed on the phone from the `sets` store.

### Per exercise

| Load type / measure | Chart (x = date) | Personal best shown |
| --- | --- | --- |
| Dumbbell, reps | Working load per session (line) with total reps as a label; session volume (bars) | Heaviest load with every set at or above the bottom of the rep range |
| Band, reps | Band used per session, plotted by rank light → heavy and labelled by colour; total reps | Heaviest band at full target reps |
| None, reps | Total reps per session; best single set | Most reps in one set |
| Seconds (holds, carries) | Longest set per session; carries also show load | Longest hold, heaviest carry |
| Done-only (flows) | Count per week | None |

Each chart combines every day the exercise appears on, shows the day in each point's tooltip, and can be ranged by block, last 4 weeks or all time.

### Weekly summary

One row per block week, rebuilding the workbook's Weekly Summary from logged data. Volume uses the workbook's formula (load × reps, load per hand), and on the imported history it reproduces weeks 1–7 exactly. Deload sessions count.

| Measure | Definition |
| --- | --- |
| Pull-up reps | Sum of reps across the three pull-up exercises (the workbook's headline number, target about +2 a week) |
| Push-up reps | Sum of reps on Push-ups - Density Sets |
| Push volume (lb) | Load × reps for Horizontal and Vertical Push |
| Pull volume (lb) | Load × reps for Horizontal and Vertical Pull |
| Lower volume (lb) | Load × reps for Squat, Hinge, Glutes and Calves |
| Workouts done | Finished workouts out of 5 |
| Flows done | Mobility items ticked |

The week's pull-up reps also appear as a small bar chart, since that is the one trend the program says to watch. CSV export (F13) covers anything deeper, such as pulling the data back into Numbers.

## Build plan for sub-agents

One foundation package fixes the data layer and file contracts first; four feature packages then run in parallel, each owning its own files, and a final QA pass checks the whole on a real phone.

### Repository layout

```
workout-logger/
  index.html                 app shell; relative paths only; viewport-fit=cover
  manifest.webmanifest       start_url and scope "./", icons, display: standalone
  sw.js                      service worker; caches prefixed workout-logger-v
  icons/                     192 and 512 px PNG (maskable) + apple-touch-icon 180 px
  css/app.css                design tokens, light + dark, safe areas, touch-action
  vendor/                    preact-htm.js, idb.js, chart.js (pinned, committed)
  docs/SPEC.md               this document, exported as Markdown
  src/
    app.js                   tab bar + hash routing
    db.js                    workout-logger-db: schema v1, migrations, all reads and writes
    seed/program.json        copied from build-inputs/program.json
    lib/                     pure functions on plain data, never import db.js, unit tested
      lastTime.js  progression.js  stats.js  backup.js  importer.js  dates.js
    components/              Stepper, SetRow, ExerciseCard, BandPicker, Banner, Chart
    screens/                 today.js, log.js, history.js, progress.js, settings.js, program.js
  tests/                     *.test.js, run with node --test
.gitignore                   history-import.json and any *.numbers file
```

### Rules for every sub-agent

- No build step, no npm packages, no new libraries beyond `vendor/`.
- Never call `indexedDB` directly; go through `db.js`. Never change `db.js` signatures or the `program.json` shape outside WP0.
- `src/lib/` holds pure functions that take plain arrays and objects; nothing there imports `db.js` or touches the DOM, and each has a `node --test` test.
- Relative paths only, and the hardening rules in the Solution architecture section apply to every package.
- No network requests anywhere except the service worker caching its own files.
- JSDoc types on every exported function; files under about 300 lines.
- Each sub-agent gets `docs/SPEC.md`, its own work package row, and the WP0 contracts; it edits only the files its package owns.

### Work packages

| WP | Delivers | Depends on | Done when |
| --- | --- | --- | --- |
| 0 Foundation | Scaffold, `db.js` (schema v1, migrations, indexes, single-draft rule), seed copied from `build-inputs/program.json`, `lib/` signatures with stubs and JSDoc, app shell with tab bar, CSS tokens and safe areas | none | App loads in a browser showing the five seeded workouts; `node --test` runs; contracts frozen |
| 1 Logging | Log screen, Stepper / SetRow / ExerciseCard / BandPicker, `lastTime.js`, `progression.js` (F1–F10, F15, F16) | 0 | A full Monday workout logs in airplane mode; force-quitting mid-workout and reopening resumes it; "last time" for Tuesday's Goblet Squat shows the previous Tuesday, skipping deload and unfinished sessions; at 40 lb the hint shows the ladder, not 45 lb |
| 2 Today + History | Today with block week, banners (Unfinished, Deload, Backup due, Update ready); History list and edit (F2, F9, F11, F17) | 0 | Today picks the right workout for each weekday; a draft left overnight shows the Unfinished card; an edited past set changes its charts |
| 3 Progress | Progress screen, `stats.js`, Chart wrapper (F12) | 0 | Weekly summary on the imported history equals the workbook for weeks 1–7: pull-up reps 0, 32, 46, 46, 38, 50, 12 and push volume 750, 1980, 3155, 1705, 3775, 3475, 1600 lb |
| 4a Settings + data | Settings screen, `backup.js` export / restore with share fallback, CSV export, `importer.js` (F13, F14) | 0 | Export → delete app → reinstall → restore gives identical data; history import loads 28 workouts and 479 sets, with the 9 flagged sets marked |
| 4b Program editor | `screens/program.js` (F18) | 0 | Renaming or swapping an exercise keeps its history; changing a target changes the next workout's default sets |
| 5 PWA + deploy | Manifest, icons, `sw.js` with update banner hook, `storage.persist()`, GitHub Pages publish | 1–4b | Installs to the home screen from the Pages URL, opens full-screen offline, and a new version shows "Update ready" on Today |
| 6 QA review | Device checklist (including the hardening table) and code review by an agent that did not build it | 5 | Checklist passes on your iPhone; review findings fixed |

WP0 should go to the strongest model available, since every other package builds on its contracts. Packages 1, 2, 3, 4a and 4b can then run in parallel.

### Before the build starts

- [x] Seed program generated from the Program sheet: `build-inputs/program.json` (37 exercises, 41 slots, Face Pull in place of Side-Lying External Rotation)
- [x] History converted from the Numbers file: `build-inputs/history-import.json` (28 workouts, 479 sets; kept out of git). Phones can't read .numbers files, so the app only ever reads this JSON
- [ ] Create a GitHub repository named `workout-logger` and turn on GitHub Pages for it
- [ ] Export this doc as Markdown into `docs/SPEC.md`
- [ ] Run WP0, then 1, 2, 3, 4a and 4b in parallel, then 5 and 6

## Review decisions

Gemini reviewed the draft on 23 Nov. Every suggestion was adopted except the volume multiplier, and the workbook conversion has already been done rather than left to WP0.

| Suggestion | Decision | Where it landed |
| --- | --- | --- |
| Per-exercise `loadMultiplier` so volume counts both hands or sides | **Declined.** The workbook's Volume is load × reps on all 81 logged rows, and keeping it gives exact parity with your history. A constant multiplier doesn't change any single exercise's trend. It also forces judgement calls (a split squat with two dumbbells: ×2 or ×4?). Volume is computed, not stored, so a multiplier can still be added later with no data migration | Data model rules |
| Deload as a banner only, `isDeload` on sessions, excluded from "last time" | Accepted | F7, F17, data model |
| "Last time" and hints matched by workout day, falling back to any day | Accepted: Goblet Squat is 10–12 with a pause on Tuesday and 12 on Friday | F7, data model |
| One unfinished workout at a time, with an Unfinished card | Accepted | F9, Today |
| Ignore unfinished, deload and in-progress sessions in "last time" | Accepted | Data model rules |
| Progression hint suggested 45 lb above the 40 lb cap | Accepted: the wireframe was wrong, and your bench is already at 40 lb. At the cap the hint now follows the program's out-of-dumbbell ladder | F15, wireframe |
| `src/lib/` never imports `db.js` | Accepted | Data model rules, build rules |
| Align the WP3 parity test with the volume formula | Accepted in a simpler form: with no multiplier the test is exact, and it already passes on the generated history | WP3 |
| Relative paths, shared-origin namespacing, safe areas, touch icon, share fallback, update banner, Chart.js category axis | Accepted | Hardening table |
| Per-set override chip, no double-tap zoom, collapsing cards, AM / PM divider, per-side badge, non-blocking backup nudge | Accepted | F1–F9, N5, N8, logging flow |
| Split the program editor out of WP4 | Accepted as WP4b with its own screen | Work packages |
| Convert the .numbers file before the build | Accepted and done now | Before the build starts |

## Assumptions, risks and open questions

### Assumptions

| # | Assumption |
| --- | --- |
| A1 | One person, one phone; no sync between devices |
| A2 | Pounds only; dumbbells per hand, 5 lb steps from 5 lb to 40 lb, the heaviest you own; the maximum can be raised in Settings |
| A3 | Mon–Fri workouts are AM + PM merged in program order; weekend activity is not logged |
| A4 | Hosted on GitHub Pages under your GitHub account (confirmed) |
| A5 | Weeks 1–7 history is imported once; weeks 8–9 stay empty |
| A6 | The current 13-week block runs to Sun 27 Dec 2026; the app keeps working after that with the same five workouts until they are edited |

### Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Phone storage cleared or icon deleted | All data lost | Home screen install, persistent-storage request, 14-day backup banner, one-tap export |
| App opened in Safari instead of from the icon | Looks empty (separate storage) | Banner in the browser tab: "Open from your home screen" |
| Another app on your `github.io` site clears caches or storage | App files or data lost | App-specific database name and cache prefix; cleanup limited to that prefix |
| An update never activates because the app is never closed | Fixes don't arrive | Update check when Today is shown, with an "Update ready" banner |
| Sub-agents drift from the contracts | Screens break each other | Contracts frozen in WP0; per-package file ownership; independent QA in WP6 |
| Schema change in a later version | Old data unreadable | Versioned migrations in `db.js`, tested on a copy of the imported history |
| Ambiguous historical entries | Odd points on charts | 9 sets flagged on import; editable in History |

### Open questions

Answered 23 Nov: iPhone; one weight per exercise with a per-set override; no extras in v1; import weeks 1–7 and edit the program in the app.

Also answered 23 Nov: bands are blue, yellow, red, green (light → heavy); dumbbells run 5–40 lb; GitHub Pages under your account; catalogue confirmed, with Face Pull replacing Side-Lying External Rotation. No questions remain open.

Sources: [WebKit storage policy](https://webkit.org/?p=14403) · [The Register on home screen apps and the 7-day cap](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/) · [WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849)
