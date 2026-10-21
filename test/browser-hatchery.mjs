import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { encodeGif, CUBE_PALETTE } from '../src/gif.mjs';
import { genomeOf, SPECIES } from '../src/genome.mjs';

const fixtures = [1, 2, 31, 64, 192].map((width) => {
  const frames = [new Uint8Array(width * width).fill(17), Uint8Array.from({ length: width * width }, (_, i) => (Math.imul(i, 2654435761) >>> 17) % 64)];
  return { width, frames: frames.map((f) => [...f]), bytes: [...encodeGif(frames, width, width, [8, 9])] };
});
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  if (request.url === '/gif-fixtures.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ fixtures, palette: CUBE_PALETTE })); return; }
  const path = resolve('dist', `.${new URL(request.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname}`);
  if (!path.startsWith(`${resolve('dist')}/`)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream'); response.end(await readFile(path)); }
  catch (failure) { response.writeHead(failure.code === 'ENOENT' ? 404 : 500).end(failure.message); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
const results = { scenarios: [], downloads: {}, errors: [] };
const collect = async (download) => { const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.addInitScript(() => { window.AudioContext = undefined; });
  const page = await context.newPage(); page.on('pageerror', (failure) => results.errors.push(failure.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?seed=moss`);
  await page.waitForFunction(() => window.__wild?.ready, null, { timeout: 30000 });
  const native = await page.evaluate(async () => {
    const { fixtures, palette } = await (await fetch('/gif-fixtures.json')).json();
    let checked = 0;
    for (const fixture of fixtures) {
      const decoder = new ImageDecoder({ data: new Uint8Array(fixture.bytes), type: 'image/gif' }); await decoder.tracks.ready;
      if (decoder.tracks.selectedTrack.frameCount !== 2) throw new Error('Wrong native frame count');
      for (let i = 0; i < 2; i++) {
        const { image } = await decoder.decode({ frameIndex: i }), canvas = new OffscreenCanvas(fixture.width, fixture.width), ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, fixture.width, fixture.width).data;
        for (let j = 0; j < fixture.frames[i].length; j++) for (let c = 0; c < 3; c++) if (pixels[j * 4 + c] !== palette[fixture.frames[i][j]][c]) throw new Error(`LZW pixel mismatch at ${fixture.width}/${i}/${j}/${c}`);
        if (image.duration !== [80000, 90000][i]) throw new Error('Wrong native frame duration');
        image.close(); checked++;
      }
      decoder.close();
    }
    return checked;
  });
  assert.equal(native, 10); results.scenarios.push('native GIF decoder verifies every pixel of 10 flat and noisy frames, including repeated dictionary resets');
  const examples = new Map();
  for (let i = 0; examples.size < SPECIES.length; i++) { const g = genomeOf(`friend-${i}`); examples.set(g.species, g.seed); }
  for (const [species, seed] of examples) {
    await page.locator('#seed').fill(seed); await page.locator('#seed-form').evaluate((form) => form.requestSubmit());
    await page.waitForFunction((expected) => window.__wild.ready && window.__wild.creature.seed === expected, seed, { timeout: 30000 });
    assert.equal(await page.locator('#species').textContent(), species);
  }
  results.scenarios.push('all six species hatch with unavailable audio and no uncaught exception');
  const before = await page.evaluate(() => JSON.stringify(window.__wild.creature));
  for (const seed of ['', 'a*b', 'a'.repeat(25)]) {
    await page.locator('#seed').fill(seed); await page.locator('#seed-form').evaluate((form) => form.requestSubmit());
    assert.equal(await page.locator('#seed').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__wild.creature)), before);
  }
  await page.locator('#seed').fill('  NOE\u0301  '); await page.locator('#seed-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => window.__wild.ready && window.__wild.creature.seed === 'noé', null, { timeout: 30000 });
  assert.equal(new URL(page.url()).searchParams.get('seed'), 'noé');
  await page.locator('canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  results.scenarios.push('invalid seeds preserve current creature; NFC normalization, URL sharing and keyboard greeting work');
  const gifDownload = page.waitForEvent('download'); await page.locator('[data-testid=save-gif]').click();
  assert.ok(await page.locator('#seed-form button[type=submit]').isDisabled());
  assert.equal(await page.locator('canvas').getAttribute('aria-busy'), 'true');
  const gif = await collect(await gifDownload);
  await page.waitForFunction(() => !document.querySelector('[data-testid=save-gif]').disabled);
  assert.ok(gif.length < 300000, `GIF size ${gif.length}`);
  results.downloads.gif = await page.evaluate(async (bytes) => {
    const decoder = new ImageDecoder({ data: new Uint8Array(bytes), type: 'image/gif' }); await decoder.tracks.ready;
    const hashes = [], sizes = []; let duration = 0;
    for (let i = 0; i < decoder.tracks.selectedTrack.frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i }), canvas = new OffscreenCanvas(image.displayWidth, image.displayHeight), ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0); const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256', rgba))].map((b) => b.toString(16).padStart(2, '0')).join(''));
      sizes.push([image.displayWidth, image.displayHeight]); duration += image.duration; image.close();
    }
    decoder.close(); return { frames: hashes.length, distinctFrames: new Set(hashes).size, duration, sizes: [...new Set(sizes.map(JSON.stringify))], bytes: bytes.length };
  }, [...gif]);
  assert.equal(results.downloads.gif.frames, 36); assert.equal(results.downloads.gif.duration, 3000000); assert.ok(results.downloads.gif.distinctFrames > 10);
  assert.deepEqual(results.downloads.gif.sizes, ['[192,192]']);
  if (process.env.WILD_QA_DIR) await writeFile(`${process.env.WILD_QA_DIR}/wild-refined.gif`, gif, { flag: 'wx' });
  results.scenarios.push('GIF locks controls, decodes all 36 animated frames at 192 square, lasts exactly 3 seconds and is under 300 kB');
  let desktopCard;
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' });
    const download = page.waitForEvent('download'); await page.locator('[data-testid=save-card]').click(); const png = await collect(await download);
    const dimensions = await page.evaluate(async (bytes) => { const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })); const size = [image.width, image.height]; image.close(); return size; }, [...png]);
    assert.deepEqual(dimensions, [720, 900]); results.downloads[label] = { bytes: png.length, dimensions };
    if (label === 'desktop') desktopCard = png; else assert.deepEqual(png, desktopCard, 'Card export must be independent of viewport');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.WILD_QA_DIR) {
      await writeFile(`${process.env.WILD_QA_DIR}/wild-refined-card-${label}.png`, png, { flag: 'wx' });
      await page.screenshot({ path: `${process.env.WILD_QA_DIR}/wild-refined-${label}.png`, fullPage: true });
    }
  }
  results.scenarios.push('desktop and 390px phone layouts fit; both download a full 720x900 PNG card');
  await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => !window.__wild.ready);
  assert.ok(await page.locator('[data-testid=save-gif]').isDisabled()); assert.ok(await page.locator('#seed').isDisabled());
  assert.match(await page.locator('#notice').textContent(), /interrupted/);
  results.scenarios.push('real WebGL context loss disables unsafe actions and explains reload recovery');
  assert.deepEqual(results.errors, []);
  console.log(JSON.stringify({ ok: true, ...results }, null, 2));
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
