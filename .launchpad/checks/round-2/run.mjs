// Round 2's checks: two seeds cross into a child whose seed is its lineage. The hatch command on thousands of children,
// cross() in a child process, then the built page in headless Chromium.
// Run them yourself from the repository's root (after npm ci):
//   node .launchpad/checks/round-2/run.mjs
// What they test is round 2's brief: lineages, the child's genome, inheritance, the command and the page. Round 1's
// checks run next to these; round-1-genomes.jsonl holds round 1's winner's genomes, which never change.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { check, harness } from "./lib/harness.mjs";
import { entry, input, refuses, ROOT, succeeds, workspace } from "./lib/entry.mjs";
import { canonical, clutchOf, mirror, parentsOf, wordsOf } from "./lib/lineage.mjs";
import { colourCount, decodePng } from "../round-1/lib/png.mjs";
import { parseGif } from "../round-1/lib/gif.mjs";

const { test, done } = harness();
const HERE = dirname(fileURLToPath(import.meta.url));

// The rules, held here: round 1's ranges, and round 2's numbers from its brief (a trait mutates 1 time in 50).
const AFFINITIES = ["moss", "stone", "spark"];
const STATS = ["hp", "attack", "defense", "speed"];
const STAT_MIN = 10, STAT_MAX = 100, TOTAL_MIN = 160, TOTAL_MAX = 280;
const RARE_LOW = 1 / 100, RARE_HIGH = 1 / 40;
const MUTATION_LOW = 1 / 80, MUTATION_HIGH = 1 / 30;
const MIX_SHARE = 0.7, COLOR_SHARE = 0.8, SIBLING_SHARE = 0.95;
const GIF_MIN_FRAMES = 12, GIF_MAX_COLOURS = 64, CARD_MIN = 300;
const EPSILON = 1e-9;
// What the page probe opens and types (lib/page.mjs holds the same).
const OPENED = "(auri*thomas#2)*noe", TYPED = "auri*thomas#3";

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

/** Every value of an object by its dotted path; arrays are values, not paths. */
function leaves(v, prefix = "", out = new Map()) {
  for (const [k, x] of Object.entries(v ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, p, out);
    else out.set(p, x);
  }
  return out;
}
const equal = (p, q) => (typeof p === "number" && typeof q === "number" ? Math.abs(p - q) <= EPSILON : JSON.stringify(p) === JSON.stringify(q));

const hatch = entry("node", ["bin/hatch.mjs"], { timeoutMs: 60_000, maxBytes: 16 * 1024 * 1024 });

/** Hatches `seeds` (1,000 per run at most) and returns the genomes, one per seed, in order. */
async function genomes(seeds, what) {
  const all = [];
  for (let i = 0; i < seeds.length; i += 1000) {
    const batch = seeds.slice(i, i + 1000);
    const r = await hatch(batch);
    const args = batch.length > 3 ? `${batch.slice(0, 3).map((s) => JSON.stringify(s)).join(" ")} and ${batch.length - 3} more` : batch.map((s) => JSON.stringify(s)).join(" ");
    if (r.code !== 0) throw new Error(`${what}: node bin/hatch.mjs ${args} exited with ${r.code ?? r.signal}${r.err.trim() ? `: ${r.err.trim().slice(0, 300)}` : ""}`);
    const lines = r.out.split("\n");
    if (lines.at(-1) === "") lines.pop();
    check(lines.length === batch.length, `${what}: ${batch.length} seeds gave ${lines.length} lines on stdout`);
    lines.forEach((line, j) => {
      try {
        all.push(JSON.parse(line));
      } catch {
        throw new Error(`${what}: the line for ${JSON.stringify(batch[j])} is not JSON: ${line.slice(0, 200)}`);
      }
    });
  }
  return all;
}
const one = async (seed, what) => (await genomes([seed], what))[0];

/** Why a genome breaks the format (round 1's fields, and a child's parents, clutch and mutations), or null. */
function problem(g, text) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return "the genome is not an object";
  const want = canonical(text);
  if (g.seed !== want) return `seed is ${show(g.seed)}, expected the lineage written ${show(want)}`;
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
  const parents = parentsOf(text);
  if (!parents) return null;
  if (!same(g.parents, parents)) return `parents is ${show(g.parents)}, expected ${show(parents)}`;
  if (g.clutch !== clutchOf(text)) return `clutch is ${show(g.clutch)}, expected ${clutchOf(text)}`;
  if (!Array.isArray(g.mutations) || !g.mutations.every((m) => typeof m === "string") || new Set(g.mutations).size !== g.mutations.length)
    return `mutations ${show(g.mutations)} is not a list of distinct trait paths`;
  const paths = leaves(g.traits);
  const unknown = g.mutations.find((m) => !paths.has(m));
  if (unknown !== undefined) return `mutations lists ${show(unknown)}, which is not a path of the child's traits (${show([...paths.keys()])})`;
  return null;
}

/** Why child `c` does not come from parents `a` and `b` (species, affinity, traits), as sentences. */
function strayed(c, a, b) {
  const out = [];
  if (c.species !== a.species && c.species !== b.species) out.push(`species ${show(c.species)} is neither parent's (${a.species}, ${b.species})`);
  if (c.affinity !== a.affinity && c.affinity !== b.affinity) out.push(`affinity ${show(c.affinity)} is neither parent's (${a.affinity}, ${b.affinity})`);
  const ct = leaves(c.traits), at = leaves(a.traits), bt = leaves(b.traits);
  for (const [p, pt] of [[a, at], [b, bt]]) {
    if (p.species !== c.species) continue;
    const missing = [...pt.keys()].filter((k) => !ct.has(k));
    if (missing.length) out.push(`it is a ${c.species} like its parent ${show(p.seed)} but lacks its traits ${show(missing)}`);
  }
  const mutated = new Set(c.mutations ?? []);
  for (const [k, v] of ct) {
    if (mutated.has(k)) continue;
    const from = [at, bt].filter((t) => t.has(k)).map((t) => t.get(k));
    if (!from.length) {
      out.push(`traits.${k} is in neither parent and not listed in mutations`);
      continue;
    }
    const nums = from.filter((x) => typeof x === "number");
    if (typeof v === "number" && nums.length) {
      const lo = Math.min(...nums), hi = Math.max(...nums);
      if (v < lo - EPSILON || v > hi + EPSILON) out.push(`traits.${k} is ${v}, outside its parents' ${lo} to ${hi}, and not listed in mutations`);
    } else if (!from.some((x) => equal(x, v))) out.push(`traits.${k} is ${show(v)}, neither parent's (${from.map(show).join(", ")}), and not listed in mutations`);
  }
  return out;
}

/** The traits a child shares with its parents where they differ: how many it took from `a`, from `b` (a blend counts for both). */
function sides(c, a, b) {
  const ct = leaves(c.traits), at = leaves(a.traits), bt = leaves(b.traits);
  const mutated = new Set(c.mutations ?? []);
  let fromA = 0, fromB = 0, differing = 0;
  for (const [k, v] of ct) {
    if (mutated.has(k) || !at.has(k) || !bt.has(k)) continue;
    const x = at.get(k), y = bt.get(k);
    if (equal(x, y)) continue;
    differing++;
    if (equal(v, x)) fromA++;
    else if (equal(v, y)) fromB++;
    else if ([v, x, y].every((n) => typeof n === "number")) fromA++, fromB++;
  }
  return { fromA, fromB, differing };
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** The mean distance between two palettes' colors, place by place, in RGB. */
function gap(p, q) {
  const n = Math.min(p.length, q.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.hypot(...rgb(p[i]).map((x, j) => x - rgb(q[i])[j]));
  return sum / n;
}

/* ---------------- the command ---------------- */

const LINEAGES = ["thomas*auri", "auri*thomas#2", "(thomas*auri)*noe", "(thomas*auri#2)*(moss*pebble)", "東京*кот", "a*a", "((noe*aleks)*(thomas*auri))*hotpod"];

await test("a child's genome is the same in two runs, and the same whichever order its parents are written in", async () => {
  const a = await succeeds(hatch, LINEAGES, "the first run");
  const b = await succeeds(hatch, LINEAGES, "the second run");
  const lines = a.out.split("\n").filter(Boolean);
  check(lines.length === LINEAGES.length, `${LINEAGES.length} lineages gave ${lines.length} lines`);
  check(a.out === b.out, `two runs on ${show(LINEAGES)} printed different bytes`);
  const first = lines.map((l) => JSON.parse(l));
  const mirrored = await genomes(LINEAGES.map(mirror), "the same lineages, every pair of parents swapped");
  LINEAGES.forEach((t, i) => check(same(first[i], mirrored[i]), `${show(t)} and ${show(mirror(t))} hatched different children`));
  const solo = await one(LINEAGES[2], "a grandchild alone");
  check(same(solo, first[2]), `${LINEAGES[2]} alone and among other lineages gave different genomes`);
});

const PAIRS = [["thomas", "auri", 1], ["auri", "thomas", 2], ["auri*thomas", "noe", 1], ["noe", "auri*thomas", 3], ["auri*thomas", "moss*pebble", 1], ["moss", "moss", 1], ["東京", "a", 5], ["(auri*thomas)*noe", "auri*thomas#2", 1]];
const crossProbe = entry("node", [join(HERE, "lib", "cross.mjs")], { timeoutMs: 60_000, maxBytes: 8 * 1024 * 1024 });

await test("cross(a, b, clutch) in src/cross.mjs is pure and symmetric, and returns the command's child", async () => {
  const texts = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];
  const parents = new Map((await genomes(texts, "hatching the parents")).map((g, i) => [texts[i], g]));
  const side = (t) => (parentsOf(t) ? `(${t})` : t);
  const lineages = PAIRS.map(([a, b, n]) => `${side(a)}*${side(b)}${n > 1 ? `#${n}` : ""}`);
  const children = await genomes(lineages, "hatching their children");
  const r = await succeeds(crossProbe, [input(PAIRS.map(([a, b, n]) => ({ a: parents.get(a), b: parents.get(b), clutch: n })))], "calling cross()");
  let seen;
  try {
    seen = JSON.parse(r.out.trim().split("\n").at(-1));
  } catch {
    throw new Error(`the cross probe printed no result: ${r.out.slice(0, 200)} ${r.err.slice(-300)}`);
  }
  check(!seen.fatal, `src/cross.mjs: ${seen.fatal}`);
  check(Array.isArray(seen.results) && seen.results.length === PAIRS.length, `the cross probe answered ${show(seen)}`);
  seen.results.forEach((x, i) => {
    const [a, b, n] = PAIRS[i];
    const call = `cross(${a}, ${b}, ${n})`;
    check(!x.error, `${call} threw: ${x.error}`);
    check(same(x.ab, children[i]), `${call} returned ${show(x.ab)}, the command printed ${show(children[i])} for ${lineages[i]}`);
    check(same(x.ba, x.ab), `cross(${b}, ${a}, ${n}) and ${call} returned different children`);
    if (n === 1) check(same(x.plain, x.ab), `cross(${a}, ${b}) with no clutch differs from ${call}`);
  });
});

const FORMS = [
  ["auri*thomas", ["thomas*auri", "auri*thomas", "Thomas * Auri", "  AURI×THOMAS ", "thomas*auri#1", "auri * thomas # 1"]],
  ["auri*thomas#2", ["thomas*auri#2", "AURI × THOMAS #2"]],
  ["(auri*thomas)*noe", ["(thomas*auri)*noe", "noe*(auri*thomas)", "NOE × ( THOMAS × AURI )"]],
  ["(a*b#2)*(c*d)", ["(b*a#2)*(d*c)", "(c*d)*(a*b#2)"]],
  ["big blue*noé", ["big   blue*noé", "noé * Big Blue"]],
  ["кот*東京", ["東京*кот", "КОТ × 東京"]],
];

await test("lineages have one written form: case, spaces, ×, #1 and the parents' order do not change the child", async () => {
  for (const [want, variants] of FORMS) {
    const gs = await genomes(variants, `the lineages ${show(variants)}`);
    gs.forEach((g, i) => {
      check(g.seed === want, `${show(variants[i])} gave the seed ${show(g.seed)}, expected ${show(want)}`);
      check(same(g, gs[0]), `${show(variants[i])} and ${show(variants[0])} hatched different children`);
    });
    check(same(gs[0].parents, parentsOf(want)), `${want}: parents is ${show(gs[0].parents)}, expected ${show(parentsOf(want))}`);
    check(gs[0].clutch === clutchOf(want), `${want}: clutch is ${show(gs[0].clutch)}, expected ${clutchOf(want)}`);
  }
});

let big = null;
/** 10,000 children of made-up words, then 1,000 grandchildren and 300 great-grandchildren, each with its parents' genomes. */
function bigSample() {
  big ??= (async () => {
    const words = sample(20_000, 11);
    const wordGenomes = await genomes(words, "hatching 20,000 words");
    const kids = Array.from({ length: 10_000 }, (_, i) => `${words[2 * i]}${i % 3 ? "*" : " × "}${words[2 * i + 1]}`);
    const kidGenomes = await genomes(kids, "hatching 10,000 children");
    const more = sample(1000, 23);
    const moreGenomes = await genomes(more, "hatching 1,000 more words");
    const grand = more.map((w, i) => (i % 2 ? `${w}*(${kids[i]})` : `(${kids[i]})*${w}`));
    const grandGenomes = await genomes(grand, "hatching 1,000 grandchildren");
    const great = Array.from({ length: 300 }, (_, i) => `(${grand[i]})*(${kids[1000 + i]})`);
    const greatGenomes = await genomes(great, "hatching 300 great-grandchildren");
    const families = [
      ...kids.map((text, i) => ({ text, child: kidGenomes[i], a: wordGenomes[2 * i], b: wordGenomes[2 * i + 1] })),
      ...grand.map((text, i) => ({ text, child: grandGenomes[i], a: kidGenomes[i], b: moreGenomes[i] })),
      ...great.map((text, i) => ({ text, child: greatGenomes[i], a: grandGenomes[i], b: kidGenomes[1000 + i] })),
    ];
    return { kids: families.slice(0, 10_000), families };
  })();
  return big;
}
/** Checks every family, reporting the first few that fail, with how many did. */
function each(families, why, what) {
  const bad = [];
  for (const f of families) {
    const w = why(f);
    if (w && (!Array.isArray(w) || w.length)) bad.push(`${show(f.text)}: ${[w].flat().join("; ")}`);
  }
  check(!bad.length, `${bad.length} of ${families.length} ${what}:\n${bad.slice(0, 5).join("\n")}`);
}

await test("every child has round 1's fields inside the rules' ranges, plus its parents, its clutch and its mutations", async () => {
  const { families } = await bigSample();
  each(families, (f) => problem(f.child, f.text), "children break the format");
});

await test("over 11,300 children: species, affinity and every trait come from a parent, or are listed as mutations", async () => {
  const { families } = await bigSample();
  each(families, (f) => strayed(f.child, f.a, f.b), "children have something that comes from no parent");
});

await test("over 10,000 children: about one trait in 50 mutates, and about one child of two common parents in 64 is rare", async () => {
  const { kids } = await bigSample();
  let traits = 0, mutations = 0;
  for (const { child } of kids) {
    traits += leaves(child.traits).size;
    mutations += Array.isArray(child.mutations) ? child.mutations.length : 0;
  }
  const rate = mutations / traits;
  check(rate >= MUTATION_LOW && rate <= MUTATION_HIGH, `${mutations} mutations in ${traits} traits of 10,000 children (1 in ${(1 / rate).toFixed(1)}), expected about 1 in 50 (1 in 80 to 1 in 30)`);
  const common = kids.filter((f) => !f.a.rare && !f.b.rare);
  const rare = common.filter((f) => f.child.rare).length;
  check(rare >= RARE_LOW * common.length && rare <= RARE_HIGH * common.length,
    `${rare} rare children of ${common.length} with two common parents, expected ${Math.ceil(RARE_LOW * common.length)} to ${Math.floor(RARE_HIGH * common.length)} (about one in 64)`);
});

await test("children take after both parents: traits from each side, colors near their parents', and siblings that differ", async () => {
  const { kids, families } = await bigSample();
  const mixed = families.map((f) => sides(f.child, f.a, f.b)).filter((s) => s.differing >= 4);
  const both = mixed.filter((s) => s.fromA > 0 && s.fromB > 0).length;
  check(both >= MIX_SHARE * mixed.length, `${both} of ${mixed.length} children take a trait from each parent (where their parents differ in 4 traits or more), expected ${100 * MIX_SHARE} % or more: one parent's ears, the other's tail`);

  const plain = kids.filter((f) => !f.child.rare && !f.a.rare && !f.b.rare);
  let near = 0;
  plain.forEach((f, i) => {
    const o = plain[(i + 1) % plain.length];
    const family = Math.min(gap(f.child.palette, f.a.palette), gap(f.child.palette, f.b.palette));
    const strangers = Math.min(gap(f.child.palette, o.a.palette), gap(f.child.palette, o.b.palette));
    if (family < strangers) near++;
  });
  check(near >= COLOR_SHARE * plain.length, `${near} of ${plain.length} common children have colors nearer their parents' than another couple's, expected ${100 * COLOR_SHARE} % or more: a blend of their parents' colors`);

  const couples = kids.slice(0, 500).map((f) => f.text);
  const later = await genomes(couples.flatMap((t) => [2, 3, 4].map((n) => `${t}#${n}`)), "hatching 1,500 younger siblings");
  let distinct = 0;
  couples.forEach((t, i) => {
    const clutch = [kids[i].child, ...later.slice(3 * i, 3 * i + 3)];
    distinct += new Set(clutch.map((g) => JSON.stringify(canon(g.traits)))).size;
    clutch.forEach((g, n) => check(!problem(g, `${t}#${n + 1}`), `${t}#${n + 1}: ${problem(g, `${t}#${n + 1}`)}`));
  });
  check(distinct >= SIBLING_SHARE * 4 * couples.length, `500 couples' first four eggs hatched ${distinct} different sets of traits out of 2,000, expected ${100 * SIBLING_SHARE} % or more`);
});

const w = (ch, n) => ch.repeat(n);
const LONG = `((${w("a", 22)}*${w("b", 22)})*(${w("c", 22)}*${w("d", 22)}))*${w("e", 22)}`;
const TOO_LONG = `((${w("a", 22)}*${w("b", 22)})*(${w("c", 22)}*${w("d", 22)}))*${w("e", 23)}`;

await test("lineages of 6 generations and 120 characters hatch, and so does a word crossed with itself", async () => {
  check([...LONG].length === 120 && canonical(LONG)?.length === 120, "the check's own 120-character lineage is wrong");
  const spaced = LONG.replace(/([*()])/g, " $1 ");
  const cases = ["(((((a*b)*c)*d)*e)*f)*g", LONG, spaced, "a*a", "o'brien*x-1", "big blue*noé", "thomas*auri#99", "(a*b#2)*(a*b#3)"];
  const gs = await genomes(cases, `the lineages ${show(cases)}`);
  gs.forEach((g, i) => {
    const p = problem(g, cases[i]);
    check(!p, `${show(cases[i])}: ${p}`);
  });
});

await test("a bad lineage exits 2 with a reason on stderr and nothing on stdout", async () => {
  await succeeds(hatch, ["thomas*auri", "(thomas*auri)*noe"], "two good lineages");
  const cases = [[["a**b"], "two * in a row"], [["*a"], "a cross with no first parent"], [["a*"], "a cross with no second parent"],
    [["a*b*c"], "three parents with no parentheses"], [["(a*b"], "an unclosed parenthesis"], [["a*b)"], "a parenthesis never opened"],
    [["(a)"], "a word in parentheses"], [["(a*b)"], "a whole lineage in parentheses"], [["((a*b))*c"], "a parent in two pairs of parentheses"],
    [["#2"], "a clutch with no cross"], [["a#2"], "a clutch on a word"], [["a*b#0"], "clutch 0"], [["a*b#100"], "clutch 100"],
    [["a*b#02"], "a clutch with a leading zero"], [["a*b#"], "# with no clutch"], [["a*b#x"], "a clutch that is not a number"],
    [["a*b#2#3"], "two clutches"], [["a*()"], "empty parentheses"], [["a*🐸"], "a parent that is not a seed"],
    [["a*abcdefghijklmnopqrstuvwxy"], "a parent of 25 characters"], [["((((((a*b)*c)*d)*e)*f)*g)*h"], "7 generations"],
    [[TOO_LONG], "121 characters once written"], [["moss", "thomas*auri", "a**b"], "good lineages then a bad one"]];
  for (const [args, what] of cases) {
    const r = await refuses(hatch, args, what);
    check(r.code === 2, `${what}: exited with ${r.code ?? r.signal}, expected 2`);
  }
});

await test("plain seeds keep their creature: the round 1 winner's 466 recorded genomes are unchanged", async () => {
  const recorded = readFileSync(join(HERE, "round-1-genomes.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  check(recorded.length === 466, `round-1-genomes.jsonl holds ${recorded.length} genomes`);
  const now = await genomes(recorded.map((g) => g.seed), `hatching the ${recorded.length} recorded seeds`);
  const changed = [];
  recorded.forEach((g, i) => {
    const after = leaves(now[i]);
    for (const [k, v] of leaves(g)) if (!after.has(k) || !equal(after.get(k), v)) changed.push(`${show(g.seed)}: ${k} was ${show(v)}, is now ${show(after.get(k))}`);
  });
  check(!changed.length, `${changed.length} fields changed (a seed never changes its creature; new fields are fine):\n${changed.slice(0, 5).join("\n")}`);
});

/* ---------------- the page ---------------- */

const npm = entry("npm", ["run", "build"], { timeoutMs: 240_000 });
const probe = entry("node", [join(HERE, "lib", "page.mjs")], { timeoutMs: 480_000, env: process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {} });
const DIST = join(ROOT, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };

/** Builds the page and serves dist/ on the loopback. */
async function serve() {
  await succeeds(npm, [], "npm run build");
  check(existsSync(join(DIST, "index.html")), "npm run build wrote no dist/index.html");
  const root = resolve(DIST);
  const http = createServer((req, res) => {
    let file = resolve(join(root, normalize(decodeURIComponent(new URL(req.url, "http://x").pathname))));
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  return { http, url: `http://127.0.0.1:${http.address().port}/` };
}

let server = null;
let run = null;
/** Runs the page probe once and returns what it saw. */
function page() {
  run ??= (async () => {
    server = await serve();
    const r = await succeeds(probe, [server.url, workspace().scratch], "the page");
    try {
      return JSON.parse(r.out.trim().split("\n").at(-1));
    } catch {
      throw new Error(`the page probe printed no result: ${r.out.slice(0, 200)} ${r.err.slice(-300)}`);
    }
  })();
  return run;
}
/** The probe's step `name`, which must have succeeded. */
async function stepOf(name) {
  const seen = await page();
  check(!seen.fatal, `the page probe stopped: ${seen.fatal}`);
  const st = seen.steps[name];
  if (name === "open") {
    check(st, "the page was never probed");
    check(st.ok, `?seed=${encodeURIComponent("(thomas*auri#2)*noe")} never became ready with the child ${OPENED} (120 s): ${st.error}. __wild: ${show(st.wild)}; page errors: ${show(seen.errors)}`);
  } else {
    check(st, `this step never ran: ${seen.steps.open?.ok === false ? `the child never opened (${seen.steps.open.error})` : "the step before it failed"}`);
    check(st.ok, st.error);
  }
  return st;
}
const scratch = (f) => join(workspace().scratch, f);

/** The card's text shows the genome's name, species, affinity and stats: the problems, as sentences. */
function cardMisses(card, g) {
  const text = card.toLowerCase();
  const out = [];
  if (!text.includes(g.name.toLowerCase())) out.push(`the name ${show(g.name)}`);
  if (!text.includes(g.species) && !text.includes(g.species.replace(/-/g, " "))) out.push(`the species ${show(g.species)}`);
  if (!text.includes(g.affinity)) out.push(`the affinity ${show(g.affinity)}`);
  const numbers = new Set((card.match(/\d+/g) ?? []).map(Number));
  for (const k of STATS) if (!numbers.has(g.stats[k])) out.push(`${k} ${g.stats[k]}`);
  return out;
}

try {
  await test("?seed= opens a child, exactly the genome the command prints, and its family tree names its parents and grandparents", async () => {
    const st = await stepOf("open");
    const seen = await page();
    check(seen.errors.length === 0, `uncaught page errors: ${show(seen.errors)}`);
    const family = await genomes([OPENED, "auri*thomas#2", "noe", "auri", "thomas"], "hatching the child and its ancestors");
    check(same(st.wild.creature, family[0]), `window.__wild.creature for ?seed=${OPENED} is ${show(st.wild.creature)}, the command printed ${show(family[0])}`);
    check(st.tree !== null, "no visible element with test id family-tree while a child is shown");
    const tree = st.tree.toLowerCase();
    const missing = family.filter((g) => !tree.includes(g.name.toLowerCase())).map((g) => `${g.name} (${g.seed})`);
    check(!missing.length, `the family tree does not name ${missing.join(", ")}: ${show(st.tree)}`);
  });

  await test("typing a cross and pressing Enter hatches the child, and the address it writes opens that child again", async () => {
    const st = await stepOf("type");
    const want = await one(TYPED, `hatching ${TYPED}`);
    check(same(st.wild.creature, want), `after typing "Thomas × Auri #3" and Enter, window.__wild.creature is ${show(st.wild.creature)}, the command printed ${show(want)}`);
    const inAddress = new URLSearchParams(st.search).get("seed");
    check(inAddress !== null && canonical(inAddress) === TYPED, `the address's query is ${show(st.search)}, expected a seed that reads as ${TYPED} (is # written %23?)`);
    const again = await stepOf("reopen");
    check(same(again.wild.creature, want), `opening ${show(st.href)} again showed ${show(again.wild.creature)}`);
  });

  await test("a bad lineage typed in the page shows a reason and keeps the creature", async () => {
    const st = await stepOf("bad");
    check(st.message.length > 0, "the element with test id seed-error is empty");
    check(st.after === st.before, `the creature changed from ${show(st.before)} to ${show(st.after)} after typing "(a*b"`);
  });

  await test("the card shows a child's name, species, affinity, stats and the words of its lineage", async () => {
    const st = await stepOf("type");
    const g = st.wild.creature;
    const missing = cardMisses(st.card, g);
    for (const word of wordsOf(TYPED)) if (!st.card.toLowerCase().includes(word)) missing.push(`the parent ${show(word)}`);
    check(!missing.length, `the card of ${TYPED} does not show ${missing.join(", ")}: ${show(st.card)}`);
  });

  await test("Save GIF downloads a child's animated GIF", async () => {
    const st = await stepOf("gif");
    check(st.seed === TYPED, `the page showed ${show(st.seed)} when Save GIF was pressed, expected ${TYPED}`);
    const gif = parseGif(readFileSync(scratch("child.gif")));
    check(gif.frames.length >= GIF_MIN_FRAMES, `the GIF has ${gif.frames.length} frames, expected ${GIF_MIN_FRAMES} or more`);
    check(gif.width >= 64 && gif.height >= 64, `the GIF is ${gif.width} × ${gif.height}, expected 64 × 64 or more`);
    const most = Math.max(...gif.frames.map((f) => f.colors));
    check(most > 0 && most <= GIF_MAX_COLOURS, `a frame uses a color table of ${most} colors, expected ${GIF_MAX_COLOURS} at most`);
    const distinct = new Set(gif.frames.map((f) => f.data.toString("base64"))).size;
    check(distinct >= 3, `only ${distinct} different frames in the GIF`);
  });

  await test("Save card downloads a child's PNG card", async () => {
    const st = await stepOf("card");
    check(st.seed === TYPED, `the page showed ${show(st.seed)} when Save card was pressed, expected ${TYPED}`);
    const img = decodePng(readFileSync(scratch("child.png")));
    check(img.width >= CARD_MIN && img.height >= CARD_MIN, `the card is ${img.width} × ${img.height}, expected ${CARD_MIN} × ${CARD_MIN} or more`);
    check(colourCount(img) >= 8, "the card holds fewer than 8 colors");
  });
} finally {
  server?.http.close();
}

done();
