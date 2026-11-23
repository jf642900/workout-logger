"""Today: 'Done today' replaces Start after today's workout is finished; 'Finish now' on an empty old draft discards it."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from smoke import serve, open_iphone
from playwright.sync_api import sync_playwright

errors = []
with serve() as url, sync_playwright() as p:
    browser, ctx = open_iphone(p)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url + '#/today'); page.wait_for_selector('.today-start')
    page.evaluate("""async () => { const db = await import('./src/db.js'); const d = await import('./src/lib/dates.js');
      const today = d.todayISO(); const wid = d.workoutIdForDate(today) || 'mon';
      const s = await db.createSession({ workoutId: wid, date: today, blockWeek: 9, isDeload: false });
      await db.putSet({ id: 'x1', sessionId: s.id, workoutId: wid, exerciseId: 'dead-bug', date: today, position: 3, setIndex: 1,
        load: null, bandId: null, value: 12, done: true, overridden: false, rir: null, flag: null });
      await db.finishSession(s.id); }""")
    page.reload(); page.wait_for_selector('.today-done')
    assert page.locator('.today-start').count() == 0, 'Start button should be gone after finishing today'
    print('ok: done-today card replaces Start')
    sid = page.evaluate("""async () => { const db = await import('./src/db.js');
      return (await db.createSession({ workoutId: 'fri', date: '2026-11-20', blockWeek: 8, isDeload: false })).id; }""")
    page.reload(); page.get_by_role('button', name='Finish now').click()
    page.get_by_role('button', name='Discard').click(); page.wait_for_timeout(400)
    gone = page.evaluate("async (id) => (await (await import('./src/db.js')).getSession(id)) === null", sid)
    assert gone, 'empty draft should be discarded'
    print('ok: empty old draft discarded')
    page.screenshot(path='/tmp/lead-today-done.png', full_page=False)
    browser.close()
if errors: print(errors); sys.exit(1)
print('lead today ok')
