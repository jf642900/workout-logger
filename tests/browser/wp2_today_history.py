"""WP2 browser test: Today + History. Usage: python3 tests/browser/wp2_today_history.py [--out /tmp/wp2-shots]"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, open_iphone, import_history
from playwright.sync_api import sync_playwright

HIST = '/home/claude/build-inputs/history-import.json'
errors = []

def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        errors.append('assert: ' + msg)

def new_page(ctx, url):
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(url + '#/today')
    page.wait_for_selector('.tabbar .tab')
    return page

def go(page, url, route):
    page.goto(url + '#/' + route)
    page.wait_for_timeout(300)
    page.reload()
    page.wait_for_timeout(500)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/wp2-shots')
    out = ap.parse_args().out
    os.makedirs(out, exist_ok=True)
    with serve() as url, sync_playwright() as p:
        for scheme in ['dark', 'light']:
            browser, ctx = open_iphone(p)
            ctx.close()
            ctx = browser.new_context(**p.devices['iPhone 14'], color_scheme=scheme)
            page = new_page(ctx, url)
            import_history(page, HIST)
            go(page, url, 'today')
            txt = page.inner_text('.screen--today')
            check('Week 9 of 13' in txt, f'{scheme}: Week 9 of 13')
            check('Mon 23 Nov' in txt, f'{scheme}: date shown')
            check('Backup due' in txt, f'{scheme}: backup banner')
            check('Start workout' in txt and 'different workout' in txt.lower(), f'{scheme}: start + chooser')
            page.screenshot(path=f'{out}/today-{scheme}.png', full_page=True)
            page.click('.today-start')
            page.wait_for_function("location.hash.startsWith('#/log/')")
            sid = page.evaluate("location.hash.split('/')[2]")
            check(bool(sid), f'{scheme}: navigated to #/log/<id>')
            page.goto(url + '#/today'); page.reload(); page.wait_for_timeout(500)
            check('Resume' in page.inner_text('.today-resume'), f'{scheme}: Resume card')
            page.screenshot(path=f'{out}/today-resume-{scheme}.png', full_page=True)
            # history
            go(page, url, 'history')
            check(page.locator('.hist-row').count() == 29, f'{scheme}: 28 imported + 1 in progress rows ({page.locator(".hist-row").count()})')
            check('In progress' in page.locator('.hist-row').first.inner_text(), f'{scheme}: in-progress first')
            page.screenshot(path=f'{out}/history-{scheme}.png', full_page=True)
            # history detail Thu 8 Oct
            row = page.locator('.hist-row', has_text='Thu 8 Oct')
            row.first.click()
            page.wait_for_selector('.hist-ex')
            check(page.locator('.hist-set.is-flagged').count() >= 2, f'{scheme}: flagged calf sets')
            check('Calf Raise' in page.inner_text('.screen--history'), f'{scheme}: calf raise shown')
            page.screenshot(path=f'{out}/detail-{scheme}.png', full_page=True)
            if scheme == 'dark':
                flagged = page.locator('.hist-set.is-flagged').first
                flagged.click()
                page.wait_for_selector('.hist-edit')
                page.screenshot(path=f'{out}/edit-{scheme}.png')
                page.click('[aria-label="Increase Reps"]')
                page.click('.hist-edit .btn-primary')
                page.wait_for_timeout(400)
                page.reload(); page.wait_for_selector('.hist-ex')
                vals = page.locator('.hist-set__val').all_inner_texts()
                check(any('61' in v for v in vals), f'{scheme}: edited value persisted after reload')
                # note
                page.fill('.screen--history textarea', 'felt good')
                page.locator('.hist-ex').first.click()  # blur
                page.wait_for_timeout(300)
                page.reload(); page.wait_for_selector('.hist-ex')
                check(page.input_value('.screen--history textarea') == 'felt good', f'{scheme}: note persisted')
                # delete workout
                page.click('.hist-delete')
                page.click('.sheet .btn-danger')
                page.wait_for_selector('.hist-row')
                check(page.locator('.hist-row').count() == 28, f'{scheme}: workout deleted')
            ctx.close(); browser.close()

        # unfinished from 2026-11-20
        browser, ctx = open_iphone(p)
        page = new_page(ctx, url)
        page.evaluate("""async () => { const db = await import('./src/db.js');
          const s = await db.createSession({workoutId:'fri', date:'2026-11-20', blockWeek:8, isDeload:false});
          await db.putSet({id:'t1', sessionId:s.id, workoutId:'fri', exerciseId:'goblet-squat', date:'2026-11-20', position:1, setIndex:1, load:30, bandId:null, value:12, done:true, overridden:false, rir:null, flag:null});
          await db.putSet({id:'t2', sessionId:s.id, workoutId:'fri', exerciseId:'goblet-squat', date:'2026-11-20', position:1, setIndex:2, load:30, bandId:null, value:12, done:false, overridden:false, rir:null, flag:null}); }""")
        go(page, url, 'today')
        txt = page.inner_text('.screen--today')
        check('Unfinished' in txt and 'Fri 20 Nov' in txt, 'unfinished banner')
        page.screenshot(path=f'{out}/today-unfinished.png', full_page=True)
        page.click('text=Finish now')
        page.wait_for_timeout(600)
        txt = page.inner_text('.screen--today')
        check('Unfinished' not in txt and 'Start workout' in txt, 'finish now clears banner')
        left = page.evaluate("""async () => (await (await import('./src/db.js')).listSets()).length""")
        check(left == 1, 'unticked set discarded by finish')
        browser.close()
    if errors:
        print('\n'.join(errors)); sys.exit(1)
    print('wp2 ok; screenshots in', out)

if __name__ == '__main__':
    main()
