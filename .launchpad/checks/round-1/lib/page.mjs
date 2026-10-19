// Drives the built page in headless Chromium and prints what it saw, as one JSON line on stdout.
// run.mjs starts it in a child process, as the entry's user: the page's code never runs in the check's.
//   node page.mjs <url> <main|subpath> <outdir>
// Screenshots and downloads are written to <outdir>; run.mjs reads and judges them.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const [url, scenario, outdir] = process.argv.slice(2);
const READY_MS = 120_000;

// playwright-core comes from the base's lockfile: the gate installs it under /tools; locally, from the clone.
const where = ["/tools/node_modules", join(process.cwd(), "node_modules")].find((d) => existsSync(join(d, "playwright-core")));
if (!where) {
  console.error("playwright-core is not installed: run npm ci");
  process.exit(3);
}
const { chromium } = createRequire(join(where, "x.js"))("playwright-core");

const result = { errors: [], external: [], failed: [], steps: {} };
const origin = new URL(url).origin;
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const wild = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__wild ?? null)));
const id = (name) => `[data-testid="${name}"]`;
/** Waits until the page is ready with the creature of `seed` (or, with `notSeed`, any other seed's). */
async function hatched(page, { seed, notSeed } = {}) {
  await page.waitForFunction(
    ([s, n]) => {
      const w = window.__wild;
      return !!(w && w.ready === true && w.creature && (s === undefined || w.creature.seed === s) && (n === undefined || w.creature.seed !== n));
    },
    [seed, notSeed],
    { timeout: READY_MS, polling: 250 },
  );
  return wild(page);
}
async function step(name, fn) {
  try {
    result.steps[name] = { ok: true, ...(await fn()) };
  } catch (e) {
    result.steps[name] = { ok: false, error: String(e?.message ?? e).split("\n")[0].slice(0, 400) };
  }
  return result.steps[name].ok;
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e.message ?? e).slice(0, 300)));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (["http:", "https:", "ws:", "wss:"].includes(u.protocol) && u.origin !== origin) result.external.push(r.url().slice(0, 200));
  });
  page.on("response", (r) => {
    if (r.status() >= 400) result.failed.push(`${r.status()} ${r.url().slice(0, 200)}`);
  });

  if (scenario === "subpath") {
    await page.goto(`${url}?seed=thomas`, { waitUntil: "load", timeout: 30_000 });
    await step("load", async () => ({ wild: await hatched(page, { seed: "thomas" }) }));
  }

  if (scenario === "main") {
    await page.goto(`${url}?seed=moss`, { waitUntil: "load", timeout: 30_000 });
    const loaded = await step("load", async () => {
      const w = await hatched(page, { seed: "moss" });
      await page.waitForTimeout(1500);
      await page.locator(id("scene")).screenshot({ path: join(outdir, "scene-moss.png"), timeout: 30_000 });
      return { wild: w, card: await page.locator(id("creature-card")).innerText({ timeout: 10_000 }) };
    });
    if (!loaded) result.steps.load.wild = await wild(page).catch(() => null);

    if (loaded) {
      await step("type", async () => {
        await page.fill(id("seed-input"), "  Pebble ");
        await page.press(id("seed-input"), "Enter");
        const w = await hatched(page, { seed: "pebble" });
        await page.waitForTimeout(1500);
        await page.locator(id("scene")).screenshot({ path: join(outdir, "scene-pebble.png"), timeout: 30_000 });
        return { wild: w, search: await page.evaluate(() => location.search), card: await page.locator(id("creature-card")).innerText({ timeout: 10_000 }) };
      });

      await step("bad", async () => {
        const before = (await wild(page))?.creature?.seed ?? null;
        await page.fill(id("seed-input"), "a*b");
        await page.press(id("seed-input"), "Enter");
        await page.locator(id("seed-error")).waitFor({ state: "visible", timeout: 15_000 });
        await page.waitForTimeout(1000);
        const w = await wild(page);
        return { before, after: w?.creature?.seed ?? null, ready: w?.ready ?? null, message: (await page.locator(id("seed-error")).innerText()).trim() };
      });

      await step("random", async () => {
        const before = (await wild(page))?.creature?.seed ?? null;
        await page.click(id("random"));
        return { before, wild: await hatched(page, { notSeed: before }) };
      });

      await step("gif", async () => {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 180_000 }), page.click(id("save-gif"))]);
        await dl.saveAs(join(outdir, "creature.gif"));
        return { name: dl.suggestedFilename() };
      });

      await step("card", async () => {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.click(id("save-card"))]);
        await dl.saveAs(join(outdir, "creature.png"));
        return { name: dl.suggestedFilename() };
      });
    }
  }
} catch (e) {
  result.fatal = String(e?.message ?? e).split("\n")[0].slice(0, 400);
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(result)}\n`);
