"""WP5: offline + update test. Serves the repo under /workout-logger/ like GitHub Pages.
Usage: python3 tests/browser/wp5_offline.py [--out /tmp/wp5-shots]"""
import argparse, contextlib, functools, http.server, os, re, socketserver, sys, tempfile, threading
sys.path.insert(0, os.path.dirname(__file__))
from smoke import ROOT, open_iphone
from playwright.sync_api import sync_playwright

state = {'sw_version': None}

@contextlib.contextmanager
def serve_subpath():
    tmp = tempfile.mkdtemp()
    os.symlink(ROOT, os.path.join(tmp, 'workout-logger'))
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache')
            super().end_headers()
        def do_GET(self):
            if self.path.split('?')[0] == '/workout-logger/sw.js' and state['sw_version']:
                src = open(os.path.join(ROOT, 'sw.js')).read()
                src = re.sub(r'const CACHE_VERSION = \d+;', f"const CACHE_VERSION = {state['sw_version']};", src)
                b = src.encode()
                self.send_response(200); self.send_header('Content-Type', 'text/javascript')
                self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
            super().do_GET()
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(H, directory=tmp))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try: yield f'http://127.0.0.1:{httpd.server_address[1]}/workout-logger/'
    finally: httpd.shutdown()

def check(cond, msg):
    if not cond: print('FAIL:', msg); sys.exit(1)
    print('ok:', msg)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default='/tmp/wp5-shots'); args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    errors = []
    with serve_subpath() as url, sync_playwright() as p:
        browser, ctx = open_iphone(p)
        page = ctx.new_page()
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url + '#/today')
        page.wait_for_selector('.tabbar .tab')
        page.wait_for_function("navigator.serviceWorker.getRegistration().then(r => !!r && !!r.active)", timeout=20000)
        page.reload(); page.wait_for_selector('.tabbar .tab')
        page.wait_for_function("!!navigator.serviceWorker.controller", timeout=10000)
        check(True, 'service worker controls the page under /workout-logger/')
        names = page.evaluate("caches.keys()")
        check(names == ['workout-logger-v1'], f'cache names {names}')
        n = page.evaluate("caches.open('workout-logger-v1').then(c => c.keys()).then(k => k.length)")
        check(n >= 30, f'{n} files precached')

        # manifest + icons
        m = page.evaluate("""async () => {
          const href = document.querySelector('link[rel=manifest]').href;
          const man = await (await fetch(href)).json();
          const res = [];
          for (const i of man.icons) { const r = await fetch(new URL(i.src, href)); const b = await r.blob(); res.push([i.src, r.ok, b.type, i.sizes]); }
          const at = await fetch(document.querySelector('link[rel=apple-touch-icon]').href);
          return {man, res, apple: at.ok};
        }""")
        man = m['man']
        check(man['display'] == 'standalone' and man['scope'] == './' and man['start_url'] == './#/today', 'manifest fields')
        check(all(r[1] and r[2] == 'image/png' for r in m['res']) and len(m['res']) == 3 and m['apple'], 'icons load')
        check(any(i['purpose'] == 'maskable' for i in man['icons']), 'maskable icon declared')

        # offline
        ctx.set_offline(True)
        for route in ['today', 'history', 'progress', 'settings', 'program']:
            page.goto(url + '#/' + route); page.reload()
            page.wait_for_selector('.tabbar .tab')
            page.wait_for_selector('#main .screen', timeout=8000)
            page.wait_for_timeout(300)
            if page.locator('.error-detail').count(): print(page.locator('.error-detail').inner_text())
            check(page.locator('#main .screen').count() == 1 and not page.locator('.error-detail').count(), f'offline render #{route}')
            page.screenshot(path=f'{args.out}/offline-{route}.png')
        page.goto(url + 'index.html?x=1#/today'); page.wait_for_selector('.tabbar .tab')
        check(True, 'offline navigation with query string')
        ctx.set_offline(False)

        # update
        page.goto(url + '#/today'); page.wait_for_selector('.tabbar .tab')
        pwa = "import('./src/pwa.js')"
        check(page.evaluate(f"{pwa}.then(m => m.checkForUpdate())") is False, 'no update when unchanged')
        state['sw_version'] = 2
        check(page.evaluate(f"{pwa}.then(m => m.checkForUpdate())") is True, 'checkForUpdate true with new sw')
        check(page.evaluate("navigator.serviceWorker.getRegistration().then(r => !!r.waiting)"), 'worker waits (no auto skipWaiting)')
        check(page.evaluate("caches.keys()") == ['workout-logger-v1', 'workout-logger-v2'], 'old cache kept until activation')
        with page.expect_navigation(timeout=15000):
            page.evaluate(f"{pwa}.then(m => m.applyUpdate())")
        page.wait_for_selector('.tabbar .tab')
        page.wait_for_function("caches.keys().then(k => k.length === 1 && k[0] === 'workout-logger-v2')", timeout=10000)
        check(True, 'applyUpdate reloaded; old cache deleted')
        page.screenshot(path=f'{args.out}/after-update.png')
        browser.close()
    if errors:
        print('CONSOLE ERRORS:\n' + '\n'.join(errors)); sys.exit(1)
    print('wp5 ok')

if __name__ == '__main__':
    main()
