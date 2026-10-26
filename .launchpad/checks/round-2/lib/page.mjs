// Drives the built page through a crossing in headless Chromium and prints what it saw, as one JSON line on stdout.
// run.mjs starts it in a child process, as the entry's user: the page's code never runs in the check's.
//   node page.mjs <url> <outdir>
// Downloads are written to <outdir>; run.mjs reads and judges them.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const [url, outdir] = process.argv.slice(2);
const READY_MS = 120_000;

// What the probe opens and types, and the canonical lineages the page must then show (run.mjs holds the same).
const OPEN = "(thomas*auri#2)*noe", OPENED = "(auri*thomas#2)*noe";
const TYPE = "Thomas × Auri #3", TYPED = "auri*thomas#3";
const BAD = "(a*b";

// playwright-core comes from the base's lockfile: the gate installs it under /tools; locally, from the clone.
const where = ["/tools/node_modules", join(process.cwd(), "node_modules")].find((d) => existsSync(join(d, "playwright-core")));
if (!where) {
  console.error("playwright-core is not installed: run npm ci");
  process.exit(3);
}
const { chromium } = createRequire(join(where, "x.js"))("playwright-core");

const result = { errors: [], external: [], steps: {} };
const origin = new URL(url).origin;
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const wild = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__wild ?? null)));
const id = (name) => `[data-testid="${name}"]`;
/** Waits until the page is ready with the creature of `seed`. */
async function hatched(page, seed) {
  await page.waitForFunction((s) => {
    const w = window.__wild;
    return !!(w && w.ready === true && w.creature && w.creature.seed === s);
  }, seed, { timeout: READY_MS, polling: 250 });
  return wild(page);
}
/** The text of the element with test id `name` once it shows, or null if it never does. */
async function textOf(page, name, timeout = 15_000) {
  try {
    const el = page.locator(id(name)).first();
    await el.waitFor({ state: "visible", timeout });
    return await el.innerText({ timeout: 10_000 });
  } catch {
    return null;
  }
}
async function step(name, fn) {
  try {
    result.steps[name] = { ok: true, ...(await fn()) };
  } catch (e) {
    result.steps[name] = { ok: false, error: String(e?.message ?? e).split("\n")[0].slice(0, 400) };
  }
  return result.steps[name].ok;
}
function watch(page) {
  page.on("pageerror", (e) => result.errors.push(String(e.message ?? e).slice(0, 300)));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (["http:", "https:", "ws:", "wss:"].includes(u.protocol) && u.origin !== origin) result.external.push(r.url().slice(0, 200));
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  watch(page);

  await page.goto(`${url}?seed=${encodeURIComponent(OPEN)}`, { waitUntil: "load", timeout: 30_000 });
  const opened = await step("open", async () => {
    const w = await hatched(page, OPENED);
    return { wild: w, tree: await textOf(page, "family-tree"), card: await page.locator(id("creature-card")).innerText({ timeout: 10_000 }) };
  });
  if (!opened) result.steps.open.wild = await wild(page).catch(() => null);

  if (opened) {
    const typed = await step("type", async () => {
      await page.fill(id("seed-input"), TYPE);
      await page.press(id("seed-input"), "Enter");
      const w = await hatched(page, TYPED);
      return { wild: w, search: await page.evaluate(() => location.search), href: page.url(), card: await page.locator(id("creature-card")).innerText({ timeout: 10_000 }) };
    });

    if (typed) {
      await step("reopen", async () => {
        const again = await context.newPage();
        watch(again);
        try {
          await again.goto(result.steps.type.href, { waitUntil: "load", timeout: 30_000 });
          return { wild: await hatched(again, TYPED) };
        } finally {
          await again.close();
        }
      });

      await step("gif", async () => {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 180_000 }), page.click(id("save-gif"))]);
        await dl.saveAs(join(outdir, "child.gif"));
        return { seed: (await wild(page))?.creature?.seed ?? null };
      });

      await step("card", async () => {
        const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.click(id("save-card"))]);
        await dl.saveAs(join(outdir, "child.png"));
        return { seed: (await wild(page))?.creature?.seed ?? null };
      });
    }

    await step("bad", async () => {
      const before = (await wild(page))?.creature?.seed ?? null;
      await page.fill(id("seed-input"), BAD);
      await page.press(id("seed-input"), "Enter");
      await page.locator(id("seed-error")).waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForTimeout(1000);
      const w = await wild(page);
      return { before, after: w?.creature?.seed ?? null, message: (await page.locator(id("seed-error")).innerText()).trim() };
    });
  }
} catch (e) {
  result.fatal = String(e?.message ?? e).split("\n")[0].slice(0, 400);
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(result)}\n`);
