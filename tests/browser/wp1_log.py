"""WP1 browser test: the Log screen end to end on an iPhone 14 viewport.

Usage: python3 tests/browser/wp1_log.py [--history /home/claude/build-inputs/history-import.json] [--out /tmp/wp1-shots]
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smoke import serve, open_iphone, import_history  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

DEFAULT_HISTORY = '/home/claude/build-inputs/history-import.json'


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print('  ok:', msg)


def db_sets(page, sid):
    return page.evaluate("""async (id) => (await import('./src/db.js')).getSetsForSession(id)""", sid)


def card(page, ex):
    return page.locator(f'.ex-card[data-exercise="{ex}"]')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--history', default=DEFAULT_HISTORY)
    ap.add_argument('--out', default='/tmp/wp1-shots')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    with serve() as url, sync_playwright() as p:
        browser, ctx = open_iphone(p)
        page = ctx.new_page()
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url + '#/settings')
        page.wait_for_selector('.tabbar .tab')
        print('import', import_history(page, args.history))
        sid = page.evaluate("""async () => { const db = await import('./src/db.js');
            return (await db.createSession({ workoutId: 'mon', date: '2026-11-23', blockWeek: 9, isDeload: false })).id; }""")

        page.goto(url + '#/log/' + sid)
        page.wait_for_selector('.ex-card')
        shot = lambda name: page.screenshot(path=f'{args.out}/{name}.png')

        def scroll_to(ex):
            page.evaluate("(sel) => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }", f'.ex-card[data-exercise="{ex}"]')
        check(page.evaluate("getComputedStyle(document.getElementById('tabbar')).display") == 'none', 'tab bar hidden')
        check(page.locator('.divider-label').all_inner_texts() == ['AM', 'PM'], 'AM / PM dividers')
        rows = db_sets(page, sid)
        check(len(rows) == 1 + 3 + 3 + 3 + 1 + 4 + 4 + 2, f'initial set rows created ({len(rows)})')

        bench = card(page, 'flat-db-bench-press')
        text = bench.inner_text()
        check('Mon 9 Nov' in text and '40 lb' in text and '10 / 10 / 10 / 10' in text, 'bench last time = Mon 9 Nov 40 lb 10x4')
        check('4s lowering' in bench.locator('.ex-hint').inner_text(), 'bench shows ladder hint')
        check(bench.locator('.ex-load .stepper__num').inner_text() == '40', 'bench load prefilled 40')
        check(bench.locator('.set-chip').all_inner_texts() == ['40'] * 4, 'bench set chips 40')
        check(bench.locator('.set-row .stepper__num').all_inner_texts() == ['10'] * 4, 'bench reps prefilled 10')
        flye = card(page, 'face-pull')
        check(flye.locator('.ex-band.is-selected').inner_text().strip() == 'Blue', 'face pull defaults to lightest band')
        check('/ leg' in card(page, 'bulgarian-split-squat').inner_text(), 'per-side badge')
        shot('01-open-dark')
        scroll_to('flat-db-bench-press')
        shot('01b-bench-dark')

        # change a load: chest-supported row up one step
        row = card(page, 'chest-supported-db-row')
        before = int(row.locator('.ex-load .stepper__num').inner_text())
        row.locator('.ex-load .stepper__btn').nth(0).click()
        check(row.locator('.set-chip').all_inner_texts() == [str(before - 5)] * 4, f'row load {before} → {before - 5} on every set')

        # tick two bench sets, override set 3, then change the exercise load
        bench.locator('.set-tick').nth(0).click()
        bench.locator('.set-row').nth(1).locator('.stepper__btn').nth(0).click()  # 10 → 9 reps
        bench.locator('.set-tick').nth(1).click()
        bench.locator('.set-chip').nth(2).click()
        page.wait_for_selector('.log-loadgrid')
        shot('02-override-sheet')
        page.locator('.log-loadgrid__btn', has_text='35').click()
        check('is-overridden' in bench.locator('.set-chip').nth(2).get_attribute('class'), 'set 3 overridden')
        bench.locator('.ex-load .stepper__btn').nth(0).click()  # 40 → 35
        bench.locator('.ex-load .stepper__btn').nth(1).click()  # back to 40
        check(bench.locator('.set-chip').all_inner_texts() == ['40', '40', '35', '40'], 'load change skips ticked and overridden sets')
        scroll_to('flat-db-bench-press')
        shot('03-mid-bench')
        bench.locator('.set-tick').nth(2).click()
        bench.locator('.set-tick').nth(3).click()
        check('is-collapsed' in bench.get_attribute('class'), 'bench collapses when all ticked')
        line = bench.inner_text()
        check('Flat DB Bench Press' in line and '35–40 lb' in line and '10/9/10/10' in line, f'collapsed line: {line!r}')

        # done-only flow, band choice, skip, deload
        card(page, 'vinyasa-hip-thoracic-flow').locator('.ex-doneonly').click()
        check('is-collapsed' in card(page, 'vinyasa-hip-thoracic-flow').get_attribute('class'), 'flow ticked and collapsed')
        flye.locator('.ex-band', has_text='Red').click()
        check(flye.locator('.set-chip .band-swatch').count() == 2, 'band swatches on set chips')
        card(page, 'dead-bug').locator('.ex-action', has_text='Skip').click()
        check('is-skipped' in card(page, 'dead-bug').get_attribute('class'), 'dead bug skipped')
        card(page, 'db-romanian-deadlift').locator('.ex-action', has_text='Add set').click()
        check(card(page, 'db-romanian-deadlift').locator('.set-row').count() == 4, 'add set')
        card(page, 'db-romanian-deadlift').locator('.ex-action', has_text='Remove set').click()
        check(card(page, 'db-romanian-deadlift').locator('.set-row').count() == 3, 'remove set')
        card(page, 'db-romanian-deadlift').locator('.set-tick').nth(0).click()
        page.click('.log-deload')
        check(page.locator('.banner--warn').count() == 1 and 'Deload week' in page.locator('.banner--warn').inner_text(), 'deload banner')
        card(page, 'bulgarian-split-squat').locator('.ex-name').click()
        page.wait_for_selector('.log-info')
        shot('04-info-sheet')
        page.locator('.sheet .btn', has_text='Close').click()
        page.wait_for_timeout(300)
        page.evaluate('window.scrollTo(0, 0)')
        shot('05-logged-dark')
        scroll_to('chest-supported-db-row')
        shot('05b-lower-dark')
        page.emulate_media(color_scheme='light')
        shot('06-logged-light')
        page.evaluate('window.scrollTo(0, 0)')
        shot('06b-top-light')
        page.emulate_media(color_scheme='dark')

        # reload: everything persisted
        page.reload()
        page.wait_for_selector('.ex-card')
        bench = card(page, 'flat-db-bench-press')
        check('is-collapsed' in bench.get_attribute('class'), 'after reload bench still collapsed')
        check('is-skipped' in card(page, 'dead-bug').get_attribute('class'), 'after reload dead bug still skipped')
        check(page.locator('.banner--warn').count() == 1, 'after reload deload still on')
        check(card(page, 'face-pull').locator('.ex-band.is-selected').inner_text().strip() == 'Red', 'after reload band red')
        check(card(page, 'chest-supported-db-row').locator('.set-chip').first.inner_text() == str(before - 5), 'after reload row load kept')
        rows = {(r['exerciseId'], r['setIndex']): r for r in db_sets(page, sid)}
        check(rows[('flat-db-bench-press', 3)]['overridden'] and rows[('flat-db-bench-press', 3)]['load'] == 35, 'override saved')
        check(rows[('flat-db-bench-press', 2)]['value'] == 9, 'rep change saved')
        bench.locator('.ex-collapsed').click()
        check(bench.locator('.set-row').count() == 4, 'collapsed card expands on tap')
        page.click('.log-deload')
        check(page.locator('.banner--warn').count() == 0, 'deload off')
        ticked = sum(1 for r in rows.values() if r['done'])
        check(page.locator('.log-bar__count').inner_text() == f'{ticked} of {len(rows) - 3} sets', 'progress counts ticked / total (skipped excluded)')

        # finish
        page.click('.log-bar__finish')
        page.wait_for_selector('.sheet__message')
        check('discarded' in page.locator('.sheet__message').inner_text(), 'finish warns about unticked sets')
        shot('07-finish-confirm')
        page.locator('.sheet .btn', has_text='Finish and discard').click()
        page.wait_for_selector('.log-summary')
        summary = page.locator('.log-summary').inner_text()
        check('Workout finished' in summary and str(ticked) in summary, 'summary shows sets done')
        shot('08-summary')
        page.emulate_media(color_scheme='light')
        shot('09-summary-light')
        page.emulate_media(color_scheme='dark')
        page.locator('.log-summary textarea').fill('Felt strong')
        page.locator('.log-summary .btn', has_text='Done').click()
        page.wait_for_function("location.hash === '#/today'")
        page.wait_for_timeout(300)
        left = db_sets(page, sid)
        check(len(left) == ticked and all(r['done'] for r in left), f'unticked sets deleted ({len(left)} kept)')
        sess = page.evaluate("""async (id) => (await import('./src/db.js')).getSession(id)""", sid)
        check(sess['finishedAt'] and sess['note'] == 'Felt strong' and sess['skipped'] == ['dead-bug'], 'session finished with note')
        check(page.evaluate("getComputedStyle(document.getElementById('tabbar')).display") != 'none', 'tab bar restored')
        page.goto(url + '#/log/' + sid)
        page.wait_for_function("location.hash.startsWith('#/history/')")
        check(True, 'finished session redirects to history')

        # a Tuesday session: Goblet Squat last time comes from Tuesday, not Friday
        tid = page.evaluate("""async () => { const db = await import('./src/db.js');
            return (await db.createSession({ workoutId: 'tue', date: '2026-11-24', blockWeek: 9, isDeload: false })).id; }""")
        page.goto(url + '#/log/' + tid)
        page.wait_for_selector('.ex-card')
        g = card(page, 'goblet-squat').inner_text()
        check('Tue 10 Nov' in g, 'Tuesday goblet squat last time = Tue 10 Nov (skips deload Tue 3 Nov)')
        shot('10-tuesday')
        browser.close()
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors))
        sys.exit(1)
    print('wp1 ok; screenshots in', args.out)


if __name__ == '__main__':
    main()
