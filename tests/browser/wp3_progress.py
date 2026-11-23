"""WP3 browser test: Progress screen parity table, exercise detail charts, tooltip. Dark and light screenshots.
Usage: python3 tests/browser/wp3_progress.py [--history PATH] [--out /tmp/wp3-shots]"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from smoke import serve, open_iphone, import_history

EXPECT = {
    'pullupReps': [0, 32, 46, 46, 38, 50, 12],
    'pushupReps': [46, 49, 44, 54, 64, 63, 0],
    'pushVolume': [750, 1980, 3155, 1705, 3775, 3475, 1600],
    'pullVolume': [750, 2475, 3405, 1890, 2585, 2595, 2780],
    'lowerVolume': [1170, 4030, 5040, 4380, 5510, 5490, 2880],
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--history', default='/home/claude/build-inputs/history-import.json')
    ap.add_argument('--out', default='/tmp/wp3-shots')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    with serve() as url, sync_playwright() as p:
        for scheme in ['dark', 'light']:
            browser, _ = open_iphone(p)
            ctx = browser.new_context(**p.devices['iPhone 14'], color_scheme=scheme)
            page = ctx.new_page()
            page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(url + '#/today')
            page.wait_for_selector('.tabbar .tab')
            import_history(page, args.history)
            # the real history has no flow ticks; add a few so the done-only chart has data
            flows = {'sessions': [], 'sets': []}
            for i, (d, wk) in enumerate([('2026-10-05', 2), ('2026-10-12', 3), ('2026-10-19', 4)]):
                sid = f'wp3-flow-{i}'
                flows['sessions'].append({'id': sid, 'workoutId': 'mon', 'date': d, 'startedAt': d + 'T09:00:00', 'finishedAt': d + 'T10:00:00', 'blockWeek': wk, 'isDeload': False, 'note': '', 'source': 'import'})
                flows['sets'].append({'id': sid + '-s', 'sessionId': sid, 'workoutId': 'mon', 'exerciseId': 'vinyasa-hip-thoracic-flow', 'date': d, 'position': 0, 'setIndex': 1, 'load': None, 'bandId': None, 'value': None, 'done': True, 'rir': None, 'overridden': False, 'flag': None})
            for i, (d, wk, band) in enumerate([('2026-10-14', 2, 'blue'), ('2026-10-21', 3, 'yellow'), ('2026-10-28', 4, 'yellow')]):
                sid = f'wp3-band-{i}'
                flows['sessions'].append({'id': sid, 'workoutId': 'tue', 'date': d, 'startedAt': d + 'T09:00:00', 'finishedAt': d + 'T10:00:00', 'blockWeek': wk, 'isDeload': False, 'note': '', 'source': 'import'})
                flows['sets'].append({'id': sid + '-s', 'sessionId': sid, 'workoutId': 'tue', 'exerciseId': 'band-pull-apart', 'date': d, 'position': 0, 'setIndex': 1, 'load': None, 'bandId': band, 'value': 15, 'done': True, 'rir': None, 'overridden': False, 'flag': None})
            page.evaluate("async (d) => { const db = await import('./src/db.js'); return db.mergeHistory(d); }", flows)
            page.goto(url + '#/progress'); page.reload()
            page.wait_for_selector('[data-testid=weekly-table]')
            col = {'pullupReps': 'pullupReps', 'pushupReps': 'pushupReps', 'pushVolume': 'pushVolume', 'pullVolume': 'pullVolume', 'lowerVolume': 'lowerVolume'}
            for key, want in EXPECT.items():
                got = [int(page.inner_text(f'tr[data-week="{w}"] td[data-col={key}]').replace(',', '')) for w in range(1, 8)]
                assert got == want, (key, got, want)
            print(scheme, 'parity ok')
            page.screenshot(path=f'{args.out}/{scheme}_overview.png', full_page=True)
            assert 'No data yet' in page.inner_text('body')
            for ex in ['flat-db-bench-press', 'band-pull-apart', 'hollow-body-hold', 'vinyasa-hip-thoracic-flow', 'pull-up-strength-clusters']:
                page.click(f'[data-exercise={ex}]')
                page.wait_for_selector('.chart__svg')
                if ex != 'vinyasa-hip-thoracic-flow':
                    page.click('.prog-range__btn:has-text("All time")')
                page.wait_for_timeout(150)
                pt = page.locator('.chart__pt').first
                pt.click()
                page.wait_for_selector('.chart__tip:not([hidden])')
                tip = page.inner_text('.chart__tip:not([hidden])')
                assert 'Workout' in tip or 'Times done' in tip, tip
                page.screenshot(path=f'{args.out}/{scheme}_{ex}.png', full_page=True)
                page.go_back(); page.wait_for_selector('[data-testid=weekly-table]')
            browser.close()
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors)); sys.exit(1)
    print('wp3 ok; screenshots in', args.out)

if __name__ == '__main__':
    main()
