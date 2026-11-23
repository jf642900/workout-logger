"""WP4a browser test: Settings screen, history import, backup/restore round trip, CSV, persistence.
Usage: python3 tests/browser/wp4a_settings.py [--history PATH] [--out /tmp/wp4a-shots]"""
import argparse, os, sys, csv, io, json
sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, open_iphone
from playwright.sync_api import sync_playwright

HISTORY = '/home/claude/build-inputs/history-import.json'

def counts(page):
    return page.evaluate("""async () => { const db = await import('./src/db.js'); const a = await db.exportAll();
      return {sessions: a.sessions.length, sets: a.sets.length, flagged: a.sets.filter(s => s.flag).length}; }""")

def check(cond, msg):
    if not cond:
        print('FAIL:', msg); sys.exit(1)
    print('ok:', msg)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--history', default=HISTORY)
    ap.add_argument('--out', default='/tmp/wp4a-shots')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    def watch(page):
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
    with serve() as url, sync_playwright() as p:
        browser, ctx = open_iphone(p)
        ctx.set_default_timeout(8000)
        page = ctx.new_page(); watch(page)
        page.goto(url + '#/settings')
        page.wait_for_selector('#settings-import')
        page.screenshot(path=f'{args.out}/settings-dark-full.png', full_page=True)
        check(page.inner_text('#settings-last-backup') == 'Never', 'last backup is Never')

        # import history through the UI
        page.set_input_files('#settings-import-input', args.history)
        page.wait_for_selector('#settings-import-summary')
        summary = page.inner_text('#settings-import-summary')
        check('28 workouts' in summary and '479 sets' in summary and '9 flagged' in summary, f'import preview: {summary}')
        page.screenshot(path=f'{args.out}/settings-import-preview.png', full_page=True)
        page.click('#settings-import-go')
        page.wait_for_selector('.toast.is-visible')
        check('Imported 28 workouts, 479 sets' in page.inner_text('.toast'), 'import toast')
        c = counts(page)
        check(c == {'sessions': 28, 'sets': 479, 'flagged': 9}, f'db counts after import {c}')
        # twice adds nothing
        page.wait_for_timeout(3500)
        page.set_input_files('#settings-import-input', args.history)
        page.wait_for_selector('#settings-import-go'); page.click('#settings-import-go')
        page.wait_for_timeout(600)
        check('Nothing new' in page.locator('.toast').last.inner_text(), 'second import adds nothing')
        check(counts(page)['sets'] == 479, 'still 479 sets')

        # export backup (download fallback)
        with page.expect_download() as d:
            page.click('#settings-export-json')
        backup_path = f'{args.out}/backup.json'
        d.value.save_as(backup_path)
        check(d.value.suggested_filename.startswith('workout-logger-backup-') and d.value.suggested_filename.endswith('.json'), 'backup filename ' + d.value.suggested_filename)
        page.wait_for_timeout(500)
        check(page.inner_text('#settings-last-backup') != 'Never', 'last backup updated')
        # export CSV
        with page.expect_download() as d:
            page.click('#settings-export-csv')
        csv_path = f'{args.out}/export.csv'
        d.value.save_as(csv_path)
        rows = list(csv.reader(io.StringIO(open(csv_path, newline='').read())))
        check(rows[0] == 'date,week,workout,exercise,set,load_lb,band,value,unit,flag'.split(','), 'csv header')
        check(len(rows) == 480, f'csv rows {len(rows)} (479 + header)')

        # equipment persistence
        page.click('[aria-label="Increase Heaviest dumbbell"]')
        page.wait_for_timeout(300)
        page.click('[aria-label="Move Blue heavier"]')
        page.wait_for_timeout(300)
        page.click('[aria-label="Change colour of Red"]')
        page.screenshot(path=f'{args.out}/settings-palette.png', full_page=True)
        page.click('.settings-palette__dot[aria-label="Purple"]')
        page.wait_for_timeout(300)
        before = page.evaluate("async () => (await (await import('./src/db.js')).getSettings())")
        check(before['dumbbellMax'] == 45, 'dumbbell max 45')
        page.reload(); page.wait_for_selector('.settings-band')
        s = page.evaluate("async () => (await (await import('./src/db.js')).getSettings())")
        order = [b['id'] for b in sorted(s['bands'], key=lambda b: b['order'])]
        check(s['dumbbellMax'] == 45 and order[:2] == ['yellow', 'blue'], f'persisted after reload {order}')
        check(page.inner_text('[data-testid="Heaviest dumbbell"]') == '45 lb', 'UI shows 45 lb after reload')
        # used band cannot be removed
        used = page.evaluate("async () => { const a = await (await import('./src/db.js')).exportAll(); return [...new Set(a.sets.map(s => s.bandId).filter(Boolean))]; }")
        for bid in used:
            name = bid.capitalize()
            check(page.is_disabled(f'[aria-label="Remove {name}"]'), f'band in use ({bid}) cannot be removed')
        # fresh band can be added then removed
        page.click('.settings-add'); page.wait_for_selector('[aria-label="Remove New band"]')
        page.click('[aria-label="Remove New band"]'); page.wait_for_timeout(400)
        check(page.locator('.settings-band').count() == 4, 'add then remove band')
        # deload chip + block length
        page.click('.settings-chip:text-is("9")'); page.wait_for_timeout(300)
        s = page.evaluate("async () => (await (await import('./src/db.js')).getSettings())")
        check(s['deloadWeeks'] == [6, 9, 12], f'deload weeks {s["deloadWeeks"]}')
        page.screenshot(path=f'{args.out}/settings-dark-after.png', full_page=True)

        # min tap sizes
        small = page.evaluate("""() => [...document.querySelectorAll('.settings button, .settings input, .settings a')]
          .filter(e => !e.classList.contains('settings-file') && e.offsetParent !== null)
          .map(e => [e.getAttribute('aria-label') || e.id || e.textContent.trim(), Math.round(e.getBoundingClientRect().height)])
          .filter(([, h]) => h < 44)""")
        check(not small, f'all controls >= 44px {small}')

        # restore into a FRESH context
        ctx2 = browser.new_context(**p.devices['iPhone 14'], color_scheme='light')
        ctx2.set_default_timeout(8000)
        page2 = ctx2.new_page(); watch(page2)
        page2.goto(url + '#/settings'); page2.wait_for_selector('#settings-restore')
        check(counts(page2)['sets'] == 0, 'fresh context empty')
        page2.set_input_files('#settings-restore-input', backup_path)
        page2.wait_for_selector('.sheet')
        page2.screenshot(path=f'{args.out}/settings-restore-sheet-light.png')
        txt = page2.inner_text('.sheet__message')
        check('28 workouts' in txt and '479 sets' in txt, 'restore sheet counts: ' + txt)
        page2.click('.sheet .btn-danger')
        page2.wait_for_function("location.hash === '#/today'")
        c2 = counts(page2)
        check(c2 == {'sessions': 28, 'sets': 479, 'flagged': 9}, f'restored counts {c2}')
        s2 = page2.evaluate("async () => (await (await import('./src/db.js')).getSettings())")
        check(s2['dumbbellMax'] == 40, 'restored settings are those at export time')
        # bad file is rejected
        page2.goto(url + '#/settings'); page2.wait_for_selector('#settings-restore')
        open(f'{args.out}/bad.json', 'w').write(json.dumps({'format': 'nope'}))
        page2.set_input_files('#settings-restore-input', f'{args.out}/bad.json')
        page2.wait_for_selector('.settings-errors')
        check(counts(page2)['sets'] == 479, 'bad restore leaves data intact')
        page2.screenshot(path=f'{args.out}/settings-light-full.png', full_page=True)
        browser.close()
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors)); sys.exit(1)
    print('wp4a ok; screenshots in', args.out)

if __name__ == '__main__':
    main()
