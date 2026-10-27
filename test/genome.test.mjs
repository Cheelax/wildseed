// The genome's promises: ARCHITECTURE.md, "Seeds" and "The genome". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { genomeOf, normalizeSeed, seedProblem, lineageProblem } from "../src/genome.mjs";
import { STAT_RANGE, TOTAL_RANGE } from "../src/rules.mjs";

const words = Array.from({ length: 4000 }, (_, i) => `word${i}`);
const genomes = words.map((w) => genomeOf(w));

test("the same seed hatches the same bytes", () => {
  assert.equal(JSON.stringify(genomeOf("thomas")), JSON.stringify(genomeOf("thomas")));
});

test("case, spaces and composed or decomposed accents do not change the creature", () => {
  assert.deepEqual(genomeOf("  Thomas "), genomeOf("thomas"));
  assert.deepEqual(genomeOf("big   blue"), genomeOf("big blue"));
  assert.deepEqual(genomeOf("noé"), genomeOf("noé"));
});

test("plain seeds are refused with a reason: empty, too long, or emoji", () => {
  for (const bad of ["", "   ", "a".repeat(25), "🐸"]) assert.ok(seedProblem(normalizeSeed(bad)), bad);
  for (const good of ["東京", "кот", "o'brien", "x-1", "a", "a".repeat(24)]) assert.equal(seedProblem(normalizeSeed(good)), null, good);
});

test("a*b is a lineage, not a plain seed; bad lineages are refused", () => {
  assert.ok(seedProblem(normalizeSeed("a*b")));
  assert.equal(lineageProblem("a*b"), null);
  assert.equal(genomeOf("a*b").seed, "a*b");
  assert.ok(lineageProblem("a**b"));
  assert.ok(lineageProblem("(a)"));
  assert.ok(lineageProblem("x#2"));
  assert.throws(() => genomeOf("a**b"), /./);
});

test("stats are integers from 10 to 100 that add up to 160 to 280", () => {
  for (const g of genomes) {
    const values = Object.values(g.stats);
    assert.ok(values.every((v) => Number.isInteger(v) && v >= STAT_RANGE[0] && v <= STAT_RANGE[1]));
    const total = values.reduce((a, b) => a + b);
    assert.ok(total >= TOTAL_RANGE[0] && total <= TOTAL_RANGE[1]);
  }
});

test("ten species, each about one creature in ten; all three affinities; about one in 64 rare", () => {
  const count = (f) => genomes.reduce((m, g) => m.set(f(g), (m.get(f(g)) ?? 0) + 1), new Map());
  const species = count((g) => g.species);
  assert.equal(species.size, 10);
  for (const n of species.values()) assert.ok(n / genomes.length > 0.07);
  assert.equal(count((g) => g.affinity).size, 3);
  const rare = genomes.filter((g) => g.rare).length / genomes.length;
  assert.ok(rare > 1 / 100 && rare < 1 / 40, `rare share ${rare}`);
});

test("names keep the first syllable of a Latin or Cyrillic word", () => {
  assert.match(genomeOf("thomas").name, /^Thom/);
  assert.match(genomeOf("moss").name, /^Mos/);
  assert.match(genomeOf("кот").name, /^Kot/);
  for (const g of genomes) assert.match(g.name, /^\p{Lu}\p{Ll}{2,11}$/u);
});

test("palettes are six #rrggbb colors: body, belly, accent, detail, eye, ink", () => {
  for (const g of genomes) assert.ok(g.palette.length === 6 && g.palette.every((c) => /^#[0-9a-f]{6}$/.test(c)));
});

test("a seed's creature never changes (round 1's genomes, kept in test/hatched.json)", async () => {
  const { default: kept } = await import("./hatched.json", { with: { type: "json" } });
  for (const g of kept) assert.deepEqual(genomeOf(g.seed), g);
});

test("crossing is symmetric and pure", async () => {
  const { cross } = await import("../src/cross.mjs");
  const a = genomeOf("thomas");
  const b = genomeOf("auri");
  const ab = cross(a, b, 1);
  const ba = cross(b, a, 1);
  assert.deepEqual(ab, ba);
  assert.deepEqual(ab, genomeOf("thomas*auri"));
  assert.equal(ab.seed, "auri*thomas");
});
