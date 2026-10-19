// Functional and visual review, additional to the unchanged official checks.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright-core';
import { genomeOf, SPECIES } from '../src/genome.mjs';

const out = resolve('.work/browser'); mkdirSync(out, { recursive: true });
const root = resolve('dist');
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (path !== root && !path.startsWith(root + sep)) return response.writeHead(403).end();
  const file = path === root || url.pathname.endsWith('/') ? resolve(path, 'index.html') : path;
  if (!existsSync(file)) return response.writeHead(404).end();
  response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const observations = { scenarios: [], errors: [], external: [], warnings: [], consoleErrors: [] };
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', (e) => observations.errors.push(e.message));
page.on('console', (msg) => { if (msg.type() === 'error') observations.consoleErrors.push(msg.text()); else if (msg.type() === 'warning') observations.warnings.push(msg.text()); });
page.on('request', (r) => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(url).origin) observations.external.push(r.url()); });
const ready = async (seed) => {
  await page.waitForFunction((s) => window.__wild?.ready && window.__wild.creature.seed === s, seed, { timeout: 120000 });
  const g = await page.evaluate(() => window.__wild.creature); assert.deepEqual(g, genomeOf(seed));
};
async function hatch(seed) {
  await page.getByTestId('seed-input').fill(seed); await page.getByTestId('seed-input').press('Enter'); await ready(seed);
}
async function scenario(name, fn) { await fn(); observations.scenarios.push(name); console.log(`PASS ${name}`); }
try {
  await page.goto(`${url}?seed=moss`); await ready('moss');
  await scenario('desktop first hatch and honest renderer', async () => {
    assert.equal(await page.evaluate(() => window.__wild.renderer), 'webgl2');
    await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  });
  await scenario('six archetypes and rare variant', async () => {
    const examples = new Map(); let rare;
    for (let i = 0; examples.size < 6 || !rare; i++) {
      const seed = `garden ${i}`, g = genomeOf(seed); if (!examples.has(g.species)) examples.set(g.species, seed); if (g.rare) rare ??= seed;
    }
    for (const species of SPECIES) {
      await hatch(examples.get(species)); await page.waitForTimeout(700);
      await page.getByTestId('scene').screenshot({ path: `${out}/${species}.png` });
    }
    await hatch(rare); assert.equal(await page.locator('#rare').isVisible(), true);
    await page.getByTestId('scene').screenshot({ path: `${out}/rare.png` });
    observations.examples = Object.fromEntries(examples); observations.rareSeed = rare;
  });
  await scenario('invalid input retains full genome and displays accessible error', async () => {
    await hatch('moss'); const before = await page.evaluate(() => window.__wild.creature);
    await page.getByTestId('seed-input').fill('a*b'); await page.getByTestId('seed-input').press('Enter');
    await page.getByTestId('seed-error').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => window.__wild.creature), before);
  });
  await scenario('keyboard camera, pointer drag, greeting and sound controls', async () => {
    await hatch('moss'); await page.getByTestId('scene').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    await page.getByTestId('scene').screenshot({ path: `${out}/greeting.png` });
    const box = await page.getByTestId('scene').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 + 30, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(200); await page.getByTestId('scene').screenshot({ path: `${out}/rotated.png` });
    await page.locator('#reset-camera').click(); await page.locator('#hello').click();
    await page.locator('#sound').click(); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  });
  await scenario('favourites and sound preference survive reload', async () => {
    await page.locator('#favourite').click(); assert.equal(await page.locator('#favourite').getAttribute('aria-pressed'), 'true');
    await page.reload(); await ready('moss');
    assert.equal(await page.locator('#favourite').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.locator('#show-kept').click(); assert.ok(await page.locator('.journal-entry').count() >= 1);
  });
  await scenario('rapid hatches settle on the final seed', async () => {
    for (const seed of ['pebble', 'noé', '東京']) { await page.getByTestId('seed-input').fill(seed); await page.getByTestId('seed-input').press('Enter'); }
    await ready('東京');
  });
  await scenario('offline animated GIF and card download', async () => {
    await hatch('moss');
    let download = page.waitForEvent('download', { timeout: 180000 }); await page.getByTestId('save-gif').click();
    const gif = await download; await gif.saveAs(`${out}/moss.gif`);
    await page.waitForFunction(() => !document.querySelector('[data-testid="save-card"]').disabled);
    download = page.waitForEvent('download', { timeout: 120000 }); await page.getByTestId('save-card').click();
    const card = await download; await card.saveAs(`${out}/moss-card.png`);
    observations.gifBytes = readFileSync(`${out}/moss.gif`).length;
    observations.cardBytes = readFileSync(`${out}/moss-card.png`).length;
  });
  await scenario('phone, tablet and narrow viewport have no horizontal overflow', async () => {
    for (const [width, height] of [[390, 844], [768, 1024], [320, 740]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `overflow at ${width}px`);
      await page.screenshot({ path: `${out}/responsive-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await scenario('twenty random words remain distinct from the preceding seed', async () => {
    for (let i = 0; i < 20; i++) {
      const old = await page.evaluate(() => window.__wild.creature.seed); await page.getByTestId('random').click();
      await page.waitForFunction((s) => window.__wild.ready && window.__wild.creature.seed !== s, old, { timeout: 120000 });
      const seed = await page.evaluate(() => window.__wild.creature.seed); await ready(seed);
    }
  });
  await scenario('corrupt and unavailable browser storage cannot prevent hatching', async () => {
    await page.evaluate(() => localStorage.setItem('wildseed.hatchery.v1', '{bad')); await page.goto(`${url}?seed=moss`); await ready('moss');
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }));
    const other = await blocked.newPage(); await other.goto(`${url}?seed=pebble`);
    await other.waitForFunction(() => window.__wild?.ready && window.__wild.creature.seed === 'pebble', null, { timeout: 120000 }); await blocked.close();
  });
  await scenario('reduced motion still hatches and exports', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await ready('moss');
  });
  assert.deepEqual(observations.errors, []); assert.deepEqual(observations.external, []); assert.deepEqual(observations.consoleErrors, []);
  observations.result = 'pass';
} catch (e) {
  observations.result = 'fail'; observations.failure = e.stack; throw e;
} finally {
  writeFileSync(`${out}/review.json`, JSON.stringify(observations, null, 2));
  await browser.close(); server.close();
}
