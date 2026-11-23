"""WP4b browser test: Program editor. Usage: python3 tests/browser/wp4b_program.py [--out /tmp/wp4b-shots]"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, open_iphone
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--out', default='/tmp/wp4b-shots'); args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)
errors = []

def check(cond, msg):
    if not cond:
        print('FAIL:', msg); errors.append(msg)

def run(browser_ctx_factory, url, scheme):
    browser, ctx = browser_ctx_factory(scheme)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(url + '#/program')
    page.wait_for_selector('[data-workout="mon"]')
    shot = lambda n: page.screenshot(path=f'{args.out}/{scheme}-{n}.png', full_page=True)
    shot('1-list')
    check(page.locator('[data-workout]').count() == 5, 'five workouts')
    ev = lambda js, a=None: page.evaluate(js, a)
    getw = lambda i: ev("async (i) => (await import('./src/db.js')).getWorkout(i)", i)
    gete = lambda i: ev("async (i) => (await import('./src/db.js')).getExercise(i)", i)

    page.click('[data-workout="mon"]'); page.wait_for_selector('[data-item]')
    shot('2-monday')
    # retarget Face Pull
    page.click('[data-item="face-pull"] [data-act="edit"]')
    page.fill('[data-f="sets"]', '3'); page.fill('[data-f="repMin"]', '15'); page.fill('[data-f="repMax"]', '15')
    check(page.input_value('[data-f="targetText"]') == '3 x 15', 'generated target ' + page.input_value('[data-f="targetText"]'))
    shot('3-item-sheet')
    page.click('[data-act="save-item"]'); page.wait_for_timeout(300)
    page.reload(); page.wait_for_selector('[data-item]')
    fp = [i for i in getw('mon')['items'] if i['exerciseId'] == 'face-pull'][0]
    check(fp['targetText'] == '3 x 15' and fp['sets'] == 3, f'persisted {fp}')
    check('3 x 15' in page.inner_text('[data-item="face-pull"]'), 'shown after reload')

    # validation
    page.click('[data-item="face-pull"] [data-act="edit"]')
    page.fill('[data-f="sets"]', '11'); page.click('[data-act="save-item"]')
    check(page.locator('.pgm-error:visible').count() == 1, 'sets validation')
    page.fill('[data-f="sets"]', '3'); page.fill('[data-f="repMin"]', '20'); page.click('[data-act="save-item"]')
    check(page.locator('.pgm-error:visible').count() == 1, 'range validation')
    page.click('.sheet .btn-secondary')

    # move up
    before = [i['exerciseId'] for i in getw('mon')['items']]
    pm = [i for i in getw('mon')['items'] if i['part'] == 'PM']
    target = pm[1]['exerciseId']
    page.click(f'[data-item="{target}"] [data-act="up"]'); page.wait_for_timeout(300)
    after = [i['exerciseId'] for i in getw('mon')['items']]
    check(after.index(target) == before.index(target) - 1, 'moved up')

    # swap and back
    first = pm[0]['exerciseId']
    page.click(f'[data-item="{first}"] [data-act="swap"]')
    page.fill('.sheet input[type=search]', 'goblet'); shot('4-picker')
    page.click('.sheet [data-exercise="goblet-squat"]'); page.wait_for_timeout(300)
    check(page.locator('[data-item="goblet-squat"]').count() == 1, 'swapped in')
    old_sets = [i for i in getw('mon')['items'] if i['exerciseId'] == 'goblet-squat'][0]
    page.click('[data-item="goblet-squat"] [data-act="swap"]')
    page.click(f'.sheet [data-exercise="{first}"]'); page.wait_for_timeout(300)
    check(page.locator(f'[data-item="{first}"]').count() == 1, 'swapped back')

    # remove with confirm
    n = len(getw('mon')['items'])
    page.click(f'[data-item="{first}"] [data-act="remove"]'); shot('5-confirm')
    page.click('.sheet .btn-danger'); page.wait_for_timeout(300)
    check(len(getw('mon')['items']) == n - 1, 'removed')
    page.click('[data-act="add"]'); page.click(f'.sheet [data-exercise="{first}"]'); page.wait_for_timeout(300)
    check(len(getw('mon')['items']) == n, 'added back')

    # new exercise on Wednesday
    page.goto(url + '#/program/wed'); page.wait_for_selector('[data-item]')
    page.click('[data-act="add"]'); page.click('[data-act="create-exercise"]')
    page.wait_for_selector('[data-f="name"]')
    page.fill('[data-f="name"]', 'Cable-Free Y Raise'); page.fill('[data-f="category"]', 'Prehab')
    page.click('.pgm-form .pgm-choice >> text=Band'); page.click('.pgm-form .pgm-choice >> text=Reps')
    shot('6-new-exercise')
    page.click('[data-act="save-exercise"]'); page.wait_for_selector('[data-item="cable-free-y-raise"]')
    e = gete('cable-free-y-raise')
    check(e and e['loadType'] == 'band' and e['measure'] == 'reps', f'new exercise {e}')
    check(any(i['exerciseId'] == 'cable-free-y-raise' for i in getw('wed')['items']), 'in Wednesday')
    shot('7-wednesday')

    # rename keeps id, archive
    page.goto(url + '#/program/exercises'); page.wait_for_selector('[data-exercise]')
    shot('8-all')
    page.click('[data-exercise="cable-free-y-raise"]'); page.wait_for_selector('[data-f="name"]')
    page.fill('[data-f="name"]', 'Band Y Raise')
    page.check('[data-f="archived"]'); shot('9-edit-exercise')
    page.click('[data-act="save-exercise"]'); page.wait_for_selector('[data-exercise]')
    e = gete('cable-free-y-raise')
    check(e and e['name'] == 'Band Y Raise' and e['archived'], f'renamed+archived {e}')
    check(ev("async () => (await (await import('./src/db.js')).getExercise('band-y-raise')) === null"), 'no new id')
    check('Archived' in page.inner_text('[data-exercise="cable-free-y-raise"]'), 'archived marked')
    # workout rename
    page.goto(url + '#/program/fri'); page.wait_for_selector('[data-f="workout-name"]')
    page.fill('[data-f="workout-name"]', 'Friday test'); page.press('[data-f="workout-name"]', 'Enter'); page.wait_for_timeout(300)
    check(getw('fri')['name'] == 'Friday test', 'workout rename')
    browser.close()

with serve() as url, sync_playwright() as p:
    def factory(scheme):
        browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--no-first-run'])
        return browser, browser.new_context(**p.devices['iPhone 14'], color_scheme=scheme)
    for scheme in ['dark', 'light']:
        run(factory, url, scheme)
if errors:
    print('ERRORS:\n' + '\n'.join(errors)); sys.exit(1)
print('wp4b ok; screenshots in', args.out)
