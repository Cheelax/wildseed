// Run against dist/ in the offline Playwright container; an optional directory receives scene PNGs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  const file = join(process.cwd(), 'dist', path === '/' ? 'index.html' : path);
  try {
    const bytes = readFileSync(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(bytes);
  }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('pageerror', e => errors.push(e.message));
const id = name => `[data-testid="${name}"]`;
async function open(seed) {
  await page.goto(`${base}?seed=${encodeURIComponent(seed)}`);
  await page.waitForFunction(() => window.__wild?.ready === true);
}
const long = n => `((${"a".repeat(22)}*${"b".repeat(22)})*(${"c".repeat(22)}*${"d".repeat(22)}))*${"e".repeat(n)}`;
try {
  for (const [label, seed] of [['#1→#2', long(22)], ['#9→#10', long(20) + '#9']]) {
    assert.equal(seed.length, 120);
    await open(seed);
    const before = await page.evaluate(() => JSON.stringify(window.__wild.creature));
    await page.click(id('next-egg'));
    const reason = await page.locator(id('seed-error')).innerText();
    assert.match(reason, /120/);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__wild.creature)), before);
    assert.equal(await page.evaluate(() => window.__wild.ready), true);
    await page.click(id('random'));
    await page.waitForFunction(() => window.__wild.ready);
    console.log(`P2 ${label}: length=120; reason="${reason}"; creature kept=true; usable=true; uncaught=${errors.length}`);
  }
  await open('anchor*bagel');
  assert.equal(errors.length, 0);
  await open('crez');
  const readyMs = await page.evaluate(() => performance.now());
  await page.waitForTimeout(2000);
  const card = page.locator(id('creature-card'));
  const previous = await card.innerText(), bounds = await card.boundingBox();
  await page.fill(id('parent-a'), 'anchor');
  await page.fill(id('parent-b'), 'bagel');
  await page.click('.crossing button[type=submit]');
  await page.evaluate(() => {
    window.crossStart = performance.now();
    window.crossFrames = 0;
    const frame = () => {
      window.crossFrames++;
      if (window.__wild.ready) window.crossDuration = performance.now() - window.crossStart;
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (const at of [300, 850, 1300, 1650, 2100]) {
    const elapsed = await page.evaluate(() => performance.now() - window.crossStart);
    await page.waitForTimeout(Math.max(0, at - elapsed));
    assert.equal(await card.innerText(), previous);
    assert.deepEqual(await card.boundingBox(), bounds);
    if (process.argv[2]) await page.locator(id('scene')).screenshot({ path: join(process.argv[2], `meeting-${at}.png`) });
  }
  await page.waitForFunction(() => window.crossDuration);
  const metrics = await page.evaluate(() => ({ ms: window.crossDuration, fps: window.crossFrames * 1000 / window.crossDuration }));
  if (process.argv[2]) await page.locator(id('scene')).screenshot({ path: join(process.argv[2], 'meeting-child.png') });
  console.log(`P3: load ready=${Math.round(readyMs)}ms; crossing=${Math.round(metrics.ms)}ms; fps=${metrics.fps.toFixed(1)}; stable card=true; uncaught=${errors.length}`);
  assert.ok(metrics.ms < 4000);
  assert.equal(errors.length, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open('crez');
  await page.click('.crossing button[type=submit]');
  const start = performance.now();
  await page.waitForFunction(() => window.__wild.ready);
  console.log(`Reduced motion: ready after ${Math.round(performance.now() - start)}ms; uncaught=${errors.length}`);
  assert.equal(errors.length, 0);
} finally { await browser.close(); server.close(); }
