// Crossing: ARCHITECTURE.md, "Lineages". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cross } from "../src/cross.mjs";
import { genomeOf } from "../src/genome.mjs";
import { originsOf } from "../src/family.mjs";
import { splitName } from "../src/genome/names.mjs";
import { COLORS_NEAR, MUTATION_ONE_IN, RARE_CHILD_ONE_IN, SIBLINGS_DIFFER, TAKES_AFTER_BOTH } from "../src/rules.mjs";

/** Every value of an object by its dotted path. */
function leaves(v, prefix = "", out = new Map()) {
  for (const [k, x] of Object.entries(v)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, p, out);
    else out.set(p, x);
  }
  return out;
}
const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);

const words = Array.from({ length: 12000 }, (_, i) => `kin${i}`);
const families = Array.from({ length: 6000 }, (_, i) => {
  const a = genomeOf(words[2 * i]), b = genomeOf(words[2 * i + 1]);
  return { a, b, child: genomeOf(`${a.seed}*${b.seed}`) };
});

test("cross(a, b, n) is genomeOf(their lineage), whichever order, and never touches its arguments", () => {
  const freeze = (v) => (v && typeof v === "object" ? Object.freeze(Object.values(v).forEach(freeze) ?? v) : v);
  const pairs = [["thomas", "auri", 1], ["auri*thomas", "noe", 3], ["moss", "moss", 1], ["(auri*thomas)*noe", "auri*thomas#2", 2]];
  for (const [x, y, n] of pairs) {
    const a = freeze(genomeOf(x)), b = freeze(genomeOf(y));
    const child = cross(a, b, n);
    assert.deepEqual(child, cross(b, a, n));
    const side = (s) => (s.includes("*") ? `(${s})` : s);
    assert.deepEqual(child, genomeOf(`${side(x)}*${side(y)}#${n}`));
  }
  assert.deepEqual(cross(genomeOf("a"), genomeOf("b")), cross(genomeOf("a"), genomeOf("b"), 1));
});

test("crossing draws nothing at random and reads no clock", () => {
  const random = Math.random, now = Date.now;
  Math.random = Date.now = () => assert.fail("a crossing is pure");
  try {
    cross(genomeOf("thomas"), genomeOf("auri"), 7);
  } finally {
    Object.assign(Math, { random });
    Date.now = now;
  }
});

test("a child's species, affinity and traits come from its parents, or are listed as mutations", () => {
  for (const { a, b, child } of families) {
    assert.ok([a.species, b.species].includes(child.species));
    assert.ok([a.affinity, b.affinity].includes(child.affinity));
    const mutated = new Set(child.mutations);
    const [at, bt] = [leaves(a.traits), leaves(b.traits)];
    for (const [path, v] of leaves(child.traits)) {
      if (mutated.has(path)) continue;
      const from = [at, bt].filter((t) => t.has(path)).map((t) => t.get(path));
      const numbers = from.filter((x) => typeof x === "number");
      if (typeof v === "number") assert.ok(v >= Math.min(...numbers) && v <= Math.max(...numbers), `${child.seed} ${path}`);
      else assert.ok(from.some((x) => same(x, v)), `${child.seed} ${path}`);
    }
  }
});

test(`about one trait in ${MUTATION_ONE_IN} mutates, and about one child of two common parents in ${RARE_CHILD_ONE_IN[0]} is rare`, () => {
  let traits = 0, mutations = 0;
  for (const { child } of families) {
    traits += leaves(child.traits).size;
    mutations += child.mutations.length;
  }
  assert.ok(Math.abs(traits / mutations - MUTATION_ONE_IN) < 8, `1 in ${traits / mutations}`);
  const common = families.filter(({ a, b }) => !a.rare && !b.rare);
  const share = common.filter(({ child }) => child.rare).length / common.length;
  assert.ok(share > 1 / 100 && share < 1 / 40, `rare share ${share}`);
});

test("children take after both parents: a part from each, colors near theirs, and siblings that differ", () => {
  const sides = families.map(({ a, b, child }) => {
    const from = originsOf(child, a, b).map((o) => o.from);
    return { a: from.includes("a") || from.includes("blend"), b: from.includes("b") || from.includes("blend") };
  });
  assert.ok(sides.filter((s) => s.a && s.b).length >= TAKES_AFTER_BOTH * families.length);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const gap = (p, q) => p.reduce((sum, c, i) => sum + Math.hypot(...rgb(c).map((x, j) => x - rgb(q[i])[j])), 0);
  const plain = families.filter(({ a, b, child }) => !a.rare && !b.rare && !child.rare);
  const near = plain.filter((f, i) => {
    const o = plain[(i + 1) % plain.length];
    return Math.min(gap(f.child.palette, f.a.palette), gap(f.child.palette, f.b.palette)) < Math.min(gap(f.child.palette, o.a.palette), gap(f.child.palette, o.b.palette));
  });
  assert.ok(near.length >= COLORS_NEAR * plain.length, `${near.length} of ${plain.length}`);
  const couples = families.slice(0, 300).map(({ child }) => child.seed);
  const differ = couples.reduce((n, seed) => n + new Set([1, 2, 3, 4].map((k) => JSON.stringify(genomeOf(`${seed}#${k}`).traits))).size, 0);
  assert.ok(differ >= SIBLINGS_DIFFER * 4 * couples.length);
});

test("a child's name is the front of one parent's name and the ending of the other's", () => {
  for (const { a, b, child } of families.slice(0, 500)) {
    const [front] = splitName(child.name);
    const fronts = [a, b].map((p) => splitName(p.name)[0]);
    assert.ok(fronts.some((f) => f.startsWith(front.slice(0, -1)) || front.startsWith(f.slice(0, -1))), `${a.name} × ${b.name} = ${child.name}`);
    assert.ok(![a.name, b.name].includes(child.name));
  }
});

test("the family tree says where each part came from, and a mutation is new", () => {
  const child = families.find(({ child }) => child.mutations.length);
  const origins = originsOf(child.child, child.a, child.b);
  assert.ok(origins.some((o) => o.from === "new"));
  assert.deepEqual(origins.slice(0, 3).map((o) => o.part), ["species", "affinity", "colors"]);
});

test("a child of a child: grandchildren hatch, up to six generations", () => {
  const g = genomeOf("(((((a*b)*c)*d)*e)*f)*g");
  assert.equal(g.parents[0], "((((a*b)*c)*d)*e)*f");
  assert.throws(() => cross(genomeOf("(((((a*b)*c)*d)*e)*f)*g"), genomeOf("h")), /6 generations/);
});
