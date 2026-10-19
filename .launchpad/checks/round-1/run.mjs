// Round 1's checks: the hatch command on thousands of seeds, then the built page in headless Chromium.
// Run them yourself from the repository's root (after npm ci):
//   node .launchpad/checks/round-1/run.mjs
// What they test is in ARCHITECTURE.md ("Seeds", "The genome", "The command", "The page", "The look").
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { check, harness } from "./lib/harness.mjs";
import { entry, refuses, ROOT, succeeds, workspace } from "./lib/entry.mjs";
import { colourCount, decodePng } from "./lib/png.mjs";
import { parseGif } from "./lib/gif.mjs";

const { test, done } = harness();
const HERE = dirname(fileURLToPath(import.meta.url));

// The rules, held here: an entry may not change them by editing src/rules.mjs.
const AFFINITIES = ["moss", "stone", "spark"];
const STATS = ["hp", "attack", "defense", "speed"];
const STAT_MIN = 10, STAT_MAX = 100, TOTAL_MIN = 160, TOTAL_MAX = 280;
const MIN_SPECIES = 6, MIN_SHARE = 0.02;
const RARE_LOW = 1 / 100, RARE_HIGH = 1 / 40;
const PIXEL_MIN = 3, UNIFORM_SHARE = 0.95;
const GIF_MIN_FRAMES = 12, GIF_MAX_COLOURS = 64, CARD_MIN = 300;

const norm = (s) => s.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const show = (v) => JSON.stringify(v)?.slice(0, 300);

/** Seeds for the large samples: made-up words, all different. */
function sample(n, salt) {
  const C = "bdfgklmnprstvwz", V = "aeiou";
  return Array.from({ length: n }, (_, i) => {
    const j = i * 7 + salt;
    return C[j % 15] + V[(j >> 2) % 5] + C[(j >> 4) % 15] + V[(j >> 7) % 5] + i;
  });
}

const hatch = entry("node", ["bin/hatch.mjs"], { timeoutMs: 60_000, maxBytes: 8 * 1024 * 1024 });

/** Hatches `seeds` (1,000 per run at most) and returns the genomes, one per seed, in order. */
async function genomes(seeds, what) {
  const all = [];
  for (let i = 0; i < seeds.length; i += 1000) {
    const batch = seeds.slice(i, i + 1000);
    const r = await succeeds(hatch, batch, what);
    const lines = r.out.split("\n");
    if (lines.at(-1) === "") lines.pop();
    check(lines.length === batch.length, `${what}: ${batch.length} seeds gave ${lines.length} lines on stdout`);
    lines.forEach((line, j) => {
      let g;
      try {
        g = JSON.parse(line);
      } catch {
        throw new Error(`${what}: the line for ${JSON.stringify(batch[j])} is not JSON: ${line.slice(0, 200)}`);
      }
      all.push(g);
    });
  }
  return all;
}
const one = async (seed, what) => (await genomes([seed], what))[0];

/** Why a genome breaks ARCHITECTURE.md's format, or null. */
function problem(g, seed) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return "the genome is not an object";
  if (g.seed !== norm(seed)) return `seed is ${show(g.seed)}, expected ${show(norm(seed))}`;
  if (typeof g.name !== "string" || !/^\p{Lu}\p{Ll}{2,11}$/u.test(g.name)) return `name ${show(g.name)} is not 3 to 12 letters, the first uppercase`;
  if (typeof g.species !== "string" || !/^[a-z][a-z0-9-]{1,23}$/.test(g.species)) return `species ${show(g.species)} is not a valid id`;
  if (!AFFINITIES.includes(g.affinity)) return `affinity ${show(g.affinity)} is not moss, stone or spark`;
  if (typeof g.rare !== "boolean") return `rare ${show(g.rare)} is not a boolean`;
  if (!g.stats || typeof g.stats !== "object") return "stats is missing";
  let total = 0;
  for (const k of STATS) {
    const v = g.stats[k];
    if (!Number.isInteger(v) || v < STAT_MIN || v > STAT_MAX) return `stats.${k} is ${show(v)}, expected an integer from ${STAT_MIN} to ${STAT_MAX}`;
    total += v;
  }
  if (total < TOTAL_MIN || total > TOTAL_MAX) return `the stats add up to ${total}, expected ${TOTAL_MIN} to ${TOTAL_MAX}`;
  if (!Array.isArray(g.palette) || g.palette.length < 3 || g.palette.length > 8 || !g.palette.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)))
    return `palette ${show(g.palette)} is not 3 to 8 "#rrggbb" colors`;
  if (!g.traits || typeof g.traits !== "object" || Array.isArray(g.traits)) return "traits is not an object";
  return null;
}

/* ---------------- the command ---------------- */

const FIXED = ["moss", "pebble", "noé", "東京", "o'brien"];

await test("the same seed prints the same genome in two runs", async () => {
  const a = await succeeds(hatch, FIXED, "the first run");
  const b = await succeeds(hatch, FIXED, "the second run");
  check(a.out.split("\n").filter(Boolean).length === FIXED.length, `${FIXED.length} seeds gave ${a.out.split("\n").filter(Boolean).length} lines`);
  check(a.out === b.out, `two runs on ${show(FIXED)} printed different bytes`);
  const solo = await one("pebble", "pebble alone");
  const inBatch = JSON.parse(a.out.split("\n")[1]);
  check(same(solo, inBatch), "pebble alone and pebble among other seeds gave different genomes");
});

let big = null;
async function bigSample() {
  big ??= (async () => {
    const seeds = sample(10_000, 3);
    return { seeds, genomes: await genomes(seeds, "hatching 10,000 seeds") };
  })();
  return big;
}

await test("every genome has the required fields, inside the rules' ranges", async () => {
  const { seeds, genomes: gs } = await bigSample();
  for (let i = 0; i < 2000; i++) {
    const p = problem(gs[i], seeds[i]);
    check(!p, `${show(seeds[i])}: ${p}`);
  }
});

await test("different seeds hatch different creatures", async () => {
  const { genomes: gs } = await bigSample();
  const bodies = new Set(gs.slice(0, 2000).map(({ seed, ...rest }) => JSON.stringify(canon(rest))));
  check(bodies.size >= 1980, `2,000 seeds gave only ${bodies.size} different genomes (seed field left out)`);
  const names = new Set(gs.slice(0, 2000).map((g) => g.name));
  check(names.size >= 500, `2,000 seeds gave only ${names.size} different names`);
});

await test("over 10,000 seeds: at least six species, each 2 % or more, all three affinities, and about one rare creature in 64", async () => {
  const { seeds, genomes: gs } = await bigSample();
  gs.forEach((g, i) => {
    const p = problem(g, seeds[i]);
    check(!p, `${show(seeds[i])}: ${p}`);
  });
  const count = (key) => gs.reduce((m, g) => m.set(g[key], (m.get(g[key]) ?? 0) + 1), new Map());
  const species = count("species");
  check(species.size >= MIN_SPECIES, `${species.size} species: ${show([...species.keys()])}, expected ${MIN_SPECIES} or more`);
  for (const [s, n] of species) check(n / gs.length >= MIN_SHARE, `species ${s} hatched ${n} times in 10,000 (${((100 * n) / gs.length).toFixed(1)} %), expected 2 % or more`);
  const affinities = count("affinity");
  for (const a of AFFINITIES) check(affinities.get(a) > 0, `no ${a} creature in 10,000 seeds`);
  const rare = gs.filter((g) => g.rare).length;
  check(rare >= RARE_LOW * gs.length && rare <= RARE_HIGH * gs.length, `${rare} rare creatures in 10,000 seeds, expected 100 to 250 (about one in 64)`);
});

await test("uppercase, surrounding spaces, repeated spaces and decomposed accents do not change the creature", async () => {
  const pairs = [["Thomas", "thomas"], ["  thomas  ", "thomas"], ["big   blue", "big blue"], ["noé", "noé"], ["ÉTÉ", "été"]];
  for (const [variant, plain] of pairs) {
    const [a, b] = await genomes([variant, plain], `${show(variant)} and ${show(plain)}`);
    check(a.seed === norm(plain), `${show(variant)} gave the seed ${show(a.seed)}, expected ${show(norm(plain))}`);
    check(same(a, b), `${show(variant)} and ${show(plain)} hatched different creatures`);
  }
});

await test("seeds in any script, with digits, spaces, hyphens and apostrophes, hatch", async () => {
  const seeds = ["東京", "кот", "مرحبا", "o'brien", "x-1", "a", "big blue", "abcdefghijklmnopqrstuvwx"];
  const gs = await genomes(seeds, `the seeds ${show(seeds)}`);
  gs.forEach((g, i) => {
    const p = problem(g, seeds[i]);
    check(!p, `${show(seeds[i])}: ${p}`);
  });
});

await test("a bad seed exits 2 with a reason on stderr and nothing on stdout", async () => {
  const cases = [[[], "no seed"], [[""], "an empty seed"], [["   "], "a seed of spaces"], [["abcdefghijklmnopqrstuvwxy"], "a 25-character seed"],
    [["a*b"], "a seed with *"], [["(a)"], "a seed with parentheses"], [["x#2"], "a seed with #"], [["🐸"], "an emoji"], [["moss", "a*b"], "a good seed then a bad one"]];
  for (const [args, what] of cases) {
    const r = await refuses(hatch, args, what);
    check(r.code === 2, `${what}: exited with ${r.code ?? r.signal}, expected 2`);
  }
});

/* ---------------- the page ---------------- */

const npm = entry("npm", ["run", "build"], { timeoutMs: 240_000 });
const probe = entry("node", [join(HERE, "lib", "page.mjs")], { timeoutMs: 420_000, env: process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {} });
const DIST = join(ROOT, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };

let built = null;
function build() {
  built ??= succeeds(npm, [], "npm run build").then(() => {
    check(existsSync(join(DIST, "index.html")), "npm run build wrote no dist/index.html");
  });
  return built;
}

/** Serves dist/ under `prefix` only, on the loopback. */
async function serve(prefix) {
  await build();
  const root = resolve(DIST);
  const http = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!pathname.startsWith(prefix)) return res.writeHead(404).end();
    let file = resolve(join(root, normalize(pathname.slice(prefix.length - 1))));
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  return { http, url: `http://127.0.0.1:${http.address().port}${prefix}` };
}

const servers = [];
const runs = {};
/** Runs a probe scenario once and returns what it saw. */
function page(scenario) {
  runs[scenario] ??= (async () => {
    const s = await serve(scenario === "subpath" ? "/sub/path/" : "/");
    servers.push(s);
    const r = await succeeds(probe, [s.url, scenario, workspace().scratch], `the page (${scenario})`);
    try {
      return JSON.parse(r.out.trim().split("\n").at(-1));
    } catch {
      throw new Error(`the page probe printed no result: ${r.out.slice(0, 200)} ${r.err.slice(-300)}`);
    }
  })();
  return runs[scenario];
}
/** The probe's step `name`, which must have succeeded. */
async function stepOf(name, scenario = "main") {
  const seen = await page(scenario);
  check(!seen.fatal, `the page probe stopped: ${seen.fatal}`);
  const st = seen.steps[name];
  if (name === "load") {
    check(st, "the page was never probed");
    check(st.ok, `window.__wild never became ready with the seed's creature (120 s): ${st.error}. __wild: ${show(st.wild)}; page errors: ${show(seen.errors)}`);
  } else {
    check(st, `this step never ran: the page did not load (${seen.steps.load?.error ?? "see the load test"})`);
    check(st.ok, st.error);
  }
  return st;
}
const scratch = (f) => join(workspace().scratch, f);

/** Splits a screenshot into blocks of `p` pixels from its top-left corner: the share of one-color blocks. */
function artPixels(img, p) {
  let blocks = 0, uniform = 0;
  const { width: W, height: H, rgba } = img;
  for (let by = 0; by + p <= H; by += p) {
    for (let bx = 0; bx + p <= W; bx += p) {
      blocks++;
      const o = (by * W + bx) * 4;
      let flat = true;
      for (let y = 0; y < p && flat; y++) {
        for (let x = 0; x < p; x++) {
          const q = ((by + y) * W + bx + x) * 4;
          if (rgba[q] !== rgba[o] || rgba[q + 1] !== rgba[o + 1] || rgba[q + 2] !== rgba[o + 2]) { flat = false; break; }
        }
      }
      if (flat) uniform++;
    }
  }
  return { blocks, share: blocks ? uniform / blocks : 0 };
}

try {
  await test("the built page loads offline with no error and reports ready with webgl2 or webgpu", async () => {
    const st = await stepOf("load");
    const seen = await page("main");
    check(seen.errors.length === 0, `uncaught page errors: ${show(seen.errors)}`);
    check(["webgl2", "webgpu"].includes(st.wild.renderer), `window.__wild.renderer is ${show(st.wild.renderer)}, expected "webgl2" or "webgpu"`);
  });

  await test("?seed= opens that seed's creature, exactly the genome the command prints", async () => {
    const st = await stepOf("load");
    const want = await one("moss", "hatching moss");
    check(same(st.wild.creature, want), `window.__wild.creature for ?seed=moss is ${show(st.wild.creature)}, the command printed ${show(want)}`);
  });

  await test("typing a seed and pressing Enter hatches it and puts it in the address", async () => {
    const st = await stepOf("type");
    const want = await one("pebble", "hatching pebble");
    check(same(st.wild.creature, want), `after typing "  Pebble " and Enter, window.__wild.creature is ${show(st.wild.creature)}, the command printed ${show(want)}`);
    const inAddress = new URLSearchParams(st.search).get("seed");
    check(inAddress !== null && norm(inAddress) === "pebble", `the address's query is ${show(st.search)}, expected seed=pebble in it`);
  });

  await test("a bad seed typed in the page shows a reason and keeps the creature", async () => {
    const st = await stepOf("bad");
    check(st.message.length > 0, "the element with test id seed-error is empty");
    check(st.after === st.before, `the creature changed from ${show(st.before)} to ${show(st.after)} after typing "a*b"`);
  });

  await test("Random hatches another seed's creature, exactly the genome the command prints", async () => {
    const st = await stepOf("random");
    const seed = st.wild.creature.seed;
    check(seed !== st.before, "Random hatched the same seed again");
    const want = await one(seed, `hatching ${show(seed)}`);
    check(same(st.wild.creature, want), `Random gave ${show(st.wild.creature)}, the command printed ${show(want)} for its seed`);
  });

  await test("the card shows the creature's name, species, affinity and stats", async () => {
    const st = await stepOf("type");
    const g = st.wild.creature;
    const text = st.card.toLowerCase();
    check(text.includes(g.name.toLowerCase()), `the card does not show the name ${show(g.name)}: ${show(st.card)}`);
    check(text.includes(g.species) || text.includes(g.species.replace(/-/g, " ")), `the card does not show the species ${show(g.species)}: ${show(st.card)}`);
    check(text.includes(g.affinity), `the card does not show the affinity ${show(g.affinity)}: ${show(st.card)}`);
    const numbers = new Set((st.card.match(/\d+/g) ?? []).map(Number));
    for (const k of STATS) check(numbers.has(g.stats[k]), `the card does not show ${k} ${g.stats[k]}: ${show(st.card)}`);
  });

  await test("two seeds draw two different images", async () => {
    await stepOf("type");
    const a = decodePng(readFileSync(scratch("scene-moss.png")));
    const b = decodePng(readFileSync(scratch("scene-pebble.png")));
    check(a.width === b.width && a.height === b.height, `the scene changed size: ${a.width} × ${a.height}, then ${b.width} × ${b.height}`);
    let diff = 0;
    for (let i = 0; i < a.rgba.length; i += 4) {
      if (Math.abs(a.rgba[i] - b.rgba[i]) + Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) + Math.abs(a.rgba[i + 2] - b.rgba[i + 2]) > 24) diff++;
    }
    const share = diff / (a.width * a.height);
    check(share >= 0.01, `moss and pebble differ on ${(100 * share).toFixed(2)} % of the scene's pixels, expected 1 % or more`);
  });

  await test("the scene is drawn in art pixels of 3 CSS pixels or more", async () => {
    const st = await stepOf("load");
    const p = st.wild.pixel;
    check(Number.isInteger(p) && p >= PIXEL_MIN, `window.__wild.pixel is ${show(p)} at 1280 × 720, expected an integer, ${PIXEL_MIN} or more`);
    for (const f of ["scene-moss.png", "scene-pebble.png"]) {
      if (!existsSync(scratch(f))) continue;
      const img = decodePng(readFileSync(scratch(f)));
      check(img.width >= 20 * p && img.height >= 20 * p, `the scene is ${img.width} × ${img.height} pixels: too small to hold a creature`);
      const colors = colourCount(img);
      check(colors >= 8, `the scene shows ${colors} colors, expected 8 or more`);
      const { blocks, share } = artPixels(img, p);
      check(share >= UNIFORM_SHARE, `${(100 * share).toFixed(1)} % of the scene's ${blocks} blocks of ${p} × ${p} pixels are one color (${f}), expected ${100 * UNIFORM_SHARE} % or more: draw at low resolution and scale up without smoothing, aligned on the scene's top-left corner`);
    }
  });

  await test("Save GIF downloads an animated GIF: 12 frames or more, 64 colors at most, frames that differ", async () => {
    await stepOf("gif");
    const gif = parseGif(readFileSync(scratch("creature.gif")));
    check(gif.frames.length >= GIF_MIN_FRAMES, `the GIF has ${gif.frames.length} frames, expected ${GIF_MIN_FRAMES} or more`);
    check(gif.width >= 64 && gif.height >= 64, `the GIF is ${gif.width} × ${gif.height}, expected 64 × 64 or more`);
    const most = Math.max(...gif.frames.map((f) => f.colors));
    check(most > 0 && most <= GIF_MAX_COLOURS, `a frame uses a color table of ${most} colors, expected ${GIF_MAX_COLOURS} at most`);
    const distinct = new Set(gif.frames.map((f) => f.data.toString("base64"))).size;
    check(distinct >= 3, `only ${distinct} different frames in the GIF`);
  });

  await test("Save card downloads a PNG card of at least 300 × 300 pixels", async () => {
    await stepOf("card");
    const img = decodePng(readFileSync(scratch("creature.png")));
    check(img.width >= CARD_MIN && img.height >= CARD_MIN, `the card is ${img.width} × ${img.height}, expected ${CARD_MIN} × ${CARD_MIN} or more`);
    check(colourCount(img) >= 8, "the card holds fewer than 8 colors");
  });

  await test("the page requests nothing outside its own server", async () => {
    const seen = await page("main");
    await stepOf("load");
    const sub = await page("subpath");
    const external = [...seen.external, ...sub.external];
    check(external.length === 0, `requests outside the page's server: ${show(external.slice(0, 5))}`);
  });

  await test("the built page works under a sub-path", async () => {
    const st = await stepOf("load", "subpath");
    const seen = await page("subpath");
    check(seen.errors.length === 0, `uncaught page errors under /sub/path/: ${show(seen.errors)}`);
    check(seen.failed.length === 0, `failed requests under /sub/path/: ${show(seen.failed.slice(0, 5))}`);
    check(st.wild.creature.seed === "thomas", `under /sub/path/?seed=thomas the creature's seed is ${show(st.wild.creature.seed)}`);
  });
} finally {
  for (const s of servers) s.http.close();
}

done();
