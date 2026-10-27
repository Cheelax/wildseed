// Crossing: ARCHITECTURE.md, "Crossing". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cross, genomeOf } from "../src/genome.mjs";
import { heritageOf, leaves } from "../src/genome/heredity.mjs";
import { COLOR_SHARE, MIX_SHARE, MUTATION_ONE_IN, RARE_ONE_IN, SIBLING_SHARE } from "../src/rules.mjs";

const words = Array.from({ length: 6000 }, (_, i) => `kin${i}`);
const families = Array.from({ length: 3000 }, (_, i) => {
  const [a, b] = [genomeOf(words[2 * i]), genomeOf(words[2 * i + 1])];
  return { a, b, child: genomeOf(`${a.seed}*${b.seed}`) };
});

test("a child is genomeOf its lineage, the same whichever order its parents come in, and its parents are untouched", () => {
  const a = genomeOf("thomas*auri"), b = genomeOf("noe");
  const before = JSON.stringify([a, b]);
  assert.deepEqual(cross(a, b, 2), genomeOf("(thomas*auri)*noe#2"));
  assert.deepEqual(cross(b, a, 2), cross(a, b, 2));
  assert.deepEqual(cross(a, b), cross(a, b, 1));
  assert.equal(JSON.stringify([a, b]), before);
});

test("a child's parents, clutch and mutations", () => {
  const g = genomeOf("noe*(thomas*auri)#3");
  assert.deepEqual(g.parents, ["auri*thomas", "noe"]);
  assert.equal(g.clutch, 3);
  assert.ok(Array.isArray(g.mutations));
});

test("species, affinity and every trait come from a parent, or are listed as mutations", () => {
  for (const { a, b, child } of families) {
    assert.ok([a.species, b.species].includes(child.species));
    assert.ok([a.affinity, b.affinity].includes(child.affinity));
    const c = leaves(child.traits), x = leaves(a.traits), y = leaves(b.traits);
    for (const [path, v] of c) {
      if (child.mutations.includes(path)) continue;
      const from = [x, y].filter((t) => t.has(path)).map((t) => t.get(path));
      assert.ok(from.length, `${child.seed}: ${path} comes from no parent`);
      if (typeof v === "number" && from.every((f) => typeof f === "number")) assert.ok(v >= Math.min(...from) && v <= Math.max(...from), `${child.seed}: ${path}`);
      else assert.ok(from.some((f) => JSON.stringify(f) === JSON.stringify(v)), `${child.seed}: ${path}`);
    }
    for (const p of [a, b]) if (p.species === child.species) for (const path of leaves(p.traits).keys()) assert.ok(c.has(path), `${child.seed} lacks ${path}`);
  }
});

test("about one trait in 50 mutates, and about one child of two common parents in 64 is rare", () => {
  const traits = families.reduce((n, f) => n + leaves(f.child.traits).size, 0);
  const mutations = families.reduce((n, f) => n + f.child.mutations.length, 0);
  assert.ok(Math.abs(traits / mutations - MUTATION_ONE_IN) < 12, `1 in ${traits / mutations}`);
  const common = families.filter((f) => !f.a.rare && !f.b.rare);
  const rare = common.filter((f) => f.child.rare).length;
  assert.ok(rare > common.length / (RARE_ONE_IN * 1.6) && rare < common.length / (RARE_ONE_IN / 1.6), `${rare} of ${common.length}`);
});

test("children take after both parents, colors near theirs, and siblings differ", () => {
  const mixed = families.map(({ a, b, child }) => heritageOf(child, a, b)).filter((h) => h.filter((g) => g.from !== "both").length >= 4);
  const both = mixed.filter((h) => h.some((g) => g.from === "a" || g.from === "blend") && h.some((g) => g.from === "b" || g.from === "blend"));
  assert.ok(both.length >= MIX_SHARE * mixed.length);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const gap = (p, q) => p.reduce((s, c, i) => s + Math.hypot(...rgb(c).map((v, j) => v - rgb(q[i])[j])), 0) / p.length;
  const plain = families.filter((f) => !f.child.rare);
  const near = plain.filter((f, i) => {
    const o = plain[(i + 1) % plain.length];
    return Math.min(gap(f.child.palette, f.a.palette), gap(f.child.palette, f.b.palette)) < Math.min(gap(f.child.palette, o.a.palette), gap(f.child.palette, o.b.palette));
  });
  assert.ok(near.length >= COLOR_SHARE * plain.length);
  let distinct = 0;
  for (const { child } of families.slice(0, 200)) distinct += new Set([1, 2, 3, 4].map((n) => JSON.stringify(genomeOf(`${child.seed}#${n}`).traits))).size;
  assert.ok(distinct >= SIBLING_SHARE * 800);
});

test("a cross that would be too long to write is refused", () => {
  const deep = genomeOf("(((((a*b)*c)*d)*e)*f)*g");
  assert.throws(() => cross(deep, genomeOf("h")), /7 generations/);
});
