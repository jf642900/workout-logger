// Keeps sw.js PRECACHE honest: it must list every app file and nothing that is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel));
    else if (!name.startsWith('.')) out.push(rel);
  }
  return out;
}

const listed = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).sort();
const expected = ['index.html', 'manifest.webmanifest', ...walk('src'), ...walk('css'), ...walk('icons')].sort();

test('precache list matches files on disk', () => {
  const missing = expected.filter((f) => !listed.includes(f));
  const extra = listed.filter((f) => !expected.includes(f));
  assert.deepEqual({ missingFromSw: missing, listedButNotAppFiles: extra }, { missingFromSw: [], listedButNotAppFiles: [] },
    `sw.js PRECACHE out of date.\n  add: ${missing.join(', ') || '-'}\n  remove: ${extra.join(', ') || '-'}`);
});

test('precache entries exist and are unique', () => {
  for (const f of listed) assert.ok(existsSync(join(root, f)), `missing file ${f}`);
  assert.equal(new Set(listed).size, listed.length, 'duplicate entries');
});

test('cache naming, no auto skipWaiting, relative paths', () => {
  assert.match(sw, /CACHE_PREFIX = 'workout-logger-v'/);
  assert.match(sw, /const CACHE_VERSION = \d+;/);
  const installBlock = sw.slice(sw.indexOf("'install'"), sw.indexOf("'activate'"));
  assert.ok(!/skipWaiting\(/.test(installBlock.replace(/\/\/.*$/gm, '')), 'install must not call skipWaiting');
  assert.match(sw, /SKIP_WAITING/);
});

test('manifest is valid and relative; icons exist', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, './');
  assert.ok(m.start_url.startsWith('./'));
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/'), 'icon path must be relative');
    assert.ok(existsSync(join(root, i.src)), i.src);
  }
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  void relative;
});
