"""Browser smoke test: serves the repo, opens it in headless Chrome as an iPhone, optionally imports
the history file, visits every tab, fails on console errors, and saves screenshots.

Usage:  python3 tests/browser/smoke.py [--history /home/claude/build-inputs/history-import.json] [--out /tmp/shots]
Agents: copy this pattern for package-specific checks (keep your own scripts in tests/browser/<wp>_*.py).
"""
import argparse, contextlib, functools, http.server, json, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

@contextlib.contextmanager
def serve(port=0):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        yield f'http://127.0.0.1:{httpd.server_address[1]}/'
    finally:
        httpd.shutdown()

def open_iphone(p):
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--no-first-run'])
    ctx = browser.new_context(**p.devices['iPhone 14'], color_scheme='dark')
    return browser, ctx

def import_history(page, path):
    data = json.load(open(path))
    return page.evaluate("""async (d) => { const db = await import('./src/db.js'); return db.mergeHistory(d); }""", data)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--history')
    ap.add_argument('--out', default='/tmp/shots')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    with serve() as url, sync_playwright() as p:
        browser, ctx = open_iphone(p)
        page = ctx.new_page()
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url + '#/today')
        page.wait_for_selector('.tabbar .tab')
        if args.history:
            print('import', import_history(page, args.history))
        for route in ['today', 'history', 'progress', 'settings', 'program']:
            page.goto(url + '#/' + route)
            page.wait_for_timeout(400)
            page.screenshot(path=f'{args.out}/{route}.png', full_page=True)
        browser.close()
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors)); sys.exit(1)
    print('smoke ok; screenshots in', args.out)

if __name__ == '__main__':
    main()
