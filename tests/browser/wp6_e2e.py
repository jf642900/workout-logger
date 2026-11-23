"""WP6 QA: full end-to-end run as the user would, served under /workout-logger/ like GitHub Pages.
Imports history via Settings, logs Monday 23 Nov (band, done-only, override, extra set, skip), finishes,
checks History and Progress, starts Tuesday (last-time logic), exports a backup, restores it into a fresh
context and compares every record. Also guards the double-tap Start race and weeks past the block.

Usage: python3 tests/browser/wp6_e2e.py [--history /home/claude/build-inputs/history-import.json] [--out /tmp/wp6-shots]
Needs the real clock (or TZ) to read Mon 23 Nov 2026; otherwise the clock is pinned with an init script.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smoke import open_iphone  # noqa: E402
from wp5_offline import serve_subpath  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

DEFAULT_HISTORY = '/home/claude/build-inputs/history-import.json'
# Pin "now" to Mon 23 Nov 2026, 07:30 local, keeping the clock running.
CLOCK = """(() => { const real = Date; const offset = new real(2026, 10, 23, 7, 30).getTime() - real.now();
  class D extends real { constructor(...a) { if (a.length) super(...a); else super(real.now() + offset); } static now() { return real.now() + offset; } }
  globalThis.Date = D; })();"""
DB = "import('./src/db.js')"


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print('  ok:', msg)


def card(page, ex):
    return page.locator(f'.ex-card[data-exercise="{ex}"]')


def new_page(browser, p, errors, scheme='dark'):
    ctx = browser.new_context(**p.devices['iPhone 14'], color_scheme=scheme, accept_downloads=True)
    ctx.add_init_script(CLOCK)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda d: errors.append(f'native dialog: {d.message}'))
    return ctx, page


def both(page, out, name, full=False):
    for scheme in ('dark', 'light'):
        page.emulate_media(color_scheme=scheme)
        page.wait_for_timeout(80)
        page.screenshot(path=f'{out}/{name}-{scheme}.png', full_page=full)
    page.emulate_media(color_scheme='dark')


def dump(page):
    return page.evaluate(f"""async () => {{ const d = await (await {DB}).exportAll();
      for (const k of ['exercises','workouts','sessions','sets']) d[k].sort((a, b) => a.id < b.id ? -1 : 1);
      delete d.settings.lastBackupAt; return d; }}""")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--history', default=DEFAULT_HISTORY)
    ap.add_argument('--out', default='/tmp/wp6-shots')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    with serve_subpath() as url, sync_playwright() as p:
        browser, _ = open_iphone(p)
        ctx, page = new_page(browser, p, errors)

        # ---- import history through Settings
        page.goto(url + '#/settings'); page.wait_for_selector('#settings-import')
        page.set_input_files('#settings-import-input', args.history)
        page.wait_for_selector('#settings-import-go')
        check('28 workouts, 479 sets, 9 flagged' in page.inner_text('#settings-import-summary'), 'import preview')
        page.click('#settings-import-go')
        page.wait_for_function(f"{DB}.then(m => m.listSets()).then(s => s.length === 479)")

        # ---- Today
        page.goto(url + '#/today'); page.wait_for_selector('.today-start')
        check('Mon 23 Nov · Week 9 of 13' in page.inner_text('.screen-subtitle'), 'Today header week 9')
        check(page.locator('.banner', has_text='Install this app').count() <= 1, 'at most one install hint')
        both(page, args.out, '01-today')
        page.click('.today-start')
        page.wait_for_selector('.ex-card')
        sid = page.evaluate("location.hash.split('/')[2]")
        check(page.locator('.banner', has_text='Install this app').count() == 0, 'no install hint on the Log screen')
        both(page, args.out, '02-log-top')

        # ---- log every Monday exercise
        card(page, 'vinyasa-hip-thoracic-flow').locator('.ex-doneonly').click()
        bss = card(page, 'bulgarian-split-squat')
        for i in range(3):
            bss.locator('.set-tick').nth(i).click()
        rdl = card(page, 'db-romanian-deadlift')
        rdl_load = int(rdl.locator('.ex-load .stepper__num').inner_text())
        rdl.locator('.set-chip').nth(1).click()
        page.locator('.log-loadgrid__btn', has_text=str(rdl_load - 5)).first.click()
        for i in range(3):
            rdl.locator('.set-tick').nth(i).click()
        card(page, 'dead-bug').locator('.ex-action', has_text='Skip').click()
        card(page, 'scap-cuff-prep').locator('.ex-doneonly').click()
        bench = card(page, 'flat-db-bench-press')
        check('4s lowering' in bench.inner_text(), 'bench shows the out-of-dumbbell ladder')
        bench.locator('.ex-action', has_text='Add set').click()
        page.evaluate("document.querySelector('.ex-card[data-exercise=\"flat-db-bench-press\"]').scrollIntoView()")
        both(page, args.out, '03-log-bench')
        for i in range(5):
            bench.locator('.set-tick').nth(i).click()
        row = card(page, 'chest-supported-db-row')
        for i in range(4):
            row.locator('.set-tick').nth(i).click()
        fp = card(page, 'face-pull')
        fp.locator('.ex-band', has_text='Yellow').click()
        page.evaluate("document.querySelector('.ex-card[data-exercise=\"face-pull\"]').scrollIntoView()")
        both(page, args.out, '04-log-band')
        for i in range(2):
            fp.locator('.set-tick').nth(i).click()
        check(page.inner_text('.log-bar__count') == '19 of 19 sets', 'progress 19 of 19 (skipped excluded)')
        page.evaluate('window.scrollTo(0, 0)')
        both(page, args.out, '05-log-done')
        page.click('.log-bar__finish')
        page.wait_for_selector('.log-summary')
        both(page, args.out, '06-summary')
        page.locator('.log-summary textarea').fill('Week 9 Monday')
        page.locator('.log-summary .btn', has_text='Done').click()
        page.wait_for_function("location.hash === '#/today'")

        sets = page.evaluate(f"(id) => {DB}.then(m => m.getSetsForSession(id))", sid)
        check(len(sets) == 19 and all(s['done'] for s in sets), f'19 done sets kept ({len(sets)})')
        by = {(s['exerciseId'], s['setIndex']): s for s in sets}
        check(by[('db-romanian-deadlift', 2)]['overridden'] and by[('db-romanian-deadlift', 2)]['load'] == rdl_load - 5, 'RDL set 2 override saved')
        check(by[('face-pull', 1)]['bandId'] == 'yellow' and by[('face-pull', 2)]['bandId'] == 'yellow', 'face pull band saved')
        check(not any(s['exerciseId'] == 'dead-bug' for s in sets), 'skipped dead bug left no sets')
        check(len([s for s in sets if s['exerciseId'] == 'flat-db-bench-press']) == 5, 'extra bench set kept')
        sess = page.evaluate(f"(id) => {DB}.then(m => m.getSession(id))", sid)
        check(sess['finishedAt'] and sess['note'] == 'Week 9 Monday' and sess['blockWeek'] == 9 and not sess['isDeload'], 'session finished')
        page.wait_for_selector('.today-strip')
        check('done' in page.locator('.today-day').first.get_attribute('aria-label'), 'week strip marks Monday done')

        # ---- History
        page.goto(url + '#/history'); page.wait_for_selector('.hist-row')
        first = page.locator('.hist-row').first.inner_text()
        check('Mon 23 Nov' in first and '19' in first, f'history top row {first!r}')
        check(page.locator('.hist-week').first.inner_text().lower() == 'week 9', 'history week 9 section')
        both(page, args.out, '07-history')
        page.locator('.hist-row').first.click(); page.wait_for_selector('.hist-ex')
        both(page, args.out, '08-history-detail', full=True)

        # ---- Progress
        page.goto(url + '#/progress'); page.wait_for_selector('[data-testid=weekly-table]')
        w9 = page.locator('tr[data-week="9"]')
        bench_vol = sum(s['load'] * s['value'] for s in sets if s['exerciseId'] == 'flat-db-bench-press')
        check(w9.locator('[data-col=workoutsDone]').inner_text() == '1/5', 'week 9 workouts 1/5')
        check(w9.locator('[data-col=flowsDone]').inner_text() == '2', 'week 9 flows 2')
        check(w9.locator('[data-col=pushVolume]').inner_text().replace(',', '') == str(bench_vol), f'week 9 push volume {bench_vol}')
        both(page, args.out, '09-progress', full=True)
        page.goto(url + '#/progress/flat-db-bench-press'); page.wait_for_selector('.chart')
        labels = page.locator('.chart').first.locator('.chart__tick').all_text_contents()
        check('23 Nov' in labels, 'bench chart has the 23 Nov point')
        both(page, args.out, '10-progress-bench', full=True)

        # ---- Tuesday: last-time logic
        page.goto(url + '#/today'); page.wait_for_selector('.today-chooser')
        page.locator('.today-chooser .list-row', has_text='Tuesday').click()
        page.wait_for_selector('.ex-card')
        g = card(page, 'goblet-squat').inner_text()
        check('Tue 10 Nov' in g and 'from' not in g, 'Tuesday goblet squat last = Tue 10 Nov (same day)')
        lt = page.evaluate(f"""async () => {{ const m = await {DB}; const {{ findLastTime }} = await import('./src/lib/lastTime.js');
          const r = findLastTime({{ exerciseId: 'flat-db-bench-press', workoutId: 'mon', sessions: await m.listSessions(), sets: await m.listSets() }});
          return [r.session.date, r.sets.length]; }}""")
        check(lt == ['2026-11-23', 5], f"Monday bench last time is today's 5 sets ({lt})")
        both(page, args.out, '11-tuesday')

        # ---- export, then restore into a fresh context
        page.goto(url + '#/settings'); page.wait_for_selector('#settings-export-json')
        both(page, args.out, '12-settings')
        with page.expect_download() as d:
            page.click('#settings-export-json')
        backup = os.path.join(args.out, 'backup.json')
        d.value.save_as(backup)
        before = dump(page)
        check(len(before['sessions']) == 30 and any(not s['finishedAt'] for s in before['sessions']), '30 sessions incl. open Tuesday')

        ctx2, page2 = new_page(browser, p, errors, 'light')
        page2.goto(url + '#/settings'); page2.wait_for_selector('#settings-restore')
        page2.set_input_files('#settings-restore-input', backup)
        page2.wait_for_selector('.sheet__message')
        page2.locator('.sheet .btn', has_text='Replace all').click()
        page2.wait_for_function("location.hash === '#/today'")
        after = dump(page2)
        for k in ['settings', 'exercises', 'workouts', 'sessions', 'sets']:
            check(json.dumps(before[k], sort_keys=True) == json.dumps(after[k], sort_keys=True), f'restore identical: {k} ({len(after[k]) if isinstance(after[k], list) else 1})')
        page2.wait_for_selector('.today-resume')
        check('Tuesday' in page2.inner_text('.today-resume'), 'restored app resumes Tuesday')
        ctx2.close()

        # ---- regression: double-tap Start makes one session, no stray sheet
        ctx3, page3 = new_page(browser, p, errors)
        page3.goto(url + '#/today'); page3.wait_for_selector('.today-start')
        page3.locator('.today-start').dblclick()
        page3.wait_for_selector('.ex-card'); page3.wait_for_timeout(600)
        open_n = page3.evaluate(f"{DB}.then(m => m.listSessions()).then(s => s.filter(x => !x.finishedAt).length)")
        check(open_n == 1, f'double-tap Start creates one session ({open_n})')
        check(page3.locator('.sheet').count() == 0, 'no resume sheet over the Log screen')
        sid3 = page3.evaluate("location.hash.split('/')[2]")

        # ---- regression: "Remove set" never deletes a ticked set
        rdl = card(page3, 'db-romanian-deadlift')
        rdl.locator('.set-tick').nth(2).click()  # tick the LAST set
        rdl.locator('.ex-action', has_text='Remove set').click()
        rows = page3.evaluate(f"(id) => {DB}.then(m => m.getSetsForSession(id))", sid3)
        rdl_rows = [r for r in rows if r['exerciseId'] == 'db-romanian-deadlift']
        check(len(rdl_rows) == 2 and any(r['done'] and r['setIndex'] == 3 for r in rdl_rows), 'remove set took an unticked set, kept ticked set 3')
        rdl.locator('.set-tick').nth(0).click()
        check(rdl.locator('.ex-action', has_text='Remove set').count() == 0 or 'is-collapsed' in rdl.get_attribute('class'), 'no Remove set when every set is ticked')

        # ---- regression: a done-only item added to the program mid-workout can be ticked
        page3.evaluate(f"""async () => {{ const m = await {DB}; const w = await m.getWorkout('mon');
          w.items.push({{ exerciseId: 'sun-salutations', part: 'PM', sets: 1, repMin: null, repMax: null, targetText: '10 min' }}); await m.putWorkout(w); }}""")
        page3.reload(); page3.wait_for_selector('.ex-card[data-exercise="sun-salutations"]')
        card(page3, 'sun-salutations').locator('.ex-doneonly').click()
        rows = page3.evaluate(f"(id) => {DB}.then(m => m.getSetsForSession(id))", sid3)
        check(any(r['exerciseId'] == 'sun-salutations' and r['done'] for r in rows), 'done-only item added mid-workout saves a ticked set')

        # ---- regression: the Safari install hint never covers a Log deep link
        page3.goto(url + '#/today'); page3.goto(url + '#/log/' + sid3); page3.reload(); page3.wait_for_selector('.ex-card')
        check(page3.locator('.banner', has_text='Install this app').count() == 0, 'no install hint when opened on the Log screen')

        # ---- regression: weeks past the block still show in the weekly summary
        page3.evaluate(f"""async () => {{ const m = await {DB};
          await m.mergeHistory({{ sessions: [{{ id: 'w15', workoutId: 'tue', date: '2027-01-05', startedAt: '2027-01-05T12:00:00Z',
            finishedAt: '2027-01-05T13:00:00Z', blockWeek: 15, isDeload: false, note: '', source: 'app' }}],
            sets: [{{ id: 'w15-1', sessionId: 'w15', workoutId: 'tue', exerciseId: 'pull-up-strength-clusters', date: '2027-01-05',
              position: 0, setIndex: 1, load: null, bandId: null, value: 3, done: true, overridden: false, rir: null, flag: null }}] }}); }}""")
        page3.goto(url + '#/progress'); page3.wait_for_selector('[data-testid=weekly-table]')
        check(page3.locator('tr[data-week="15"] [data-col=pullupReps]').inner_text() == '3', 'week 15 row shown after a 13-week block')
        ctx3.close()
        browser.close()
    errors = [e for e in errors if 'Failed to load resource' not in e]
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors))
        sys.exit(1)
    print('wp6 e2e ok; screenshots in', args.out)


if __name__ == '__main__':
    main()
