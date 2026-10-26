// Lineages and crossing: ARCHITECTURE.md, "Lineages". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cross } from "../src/cross.mjs";
import { familyOf, originsOf } from "../src/family.mjs";
import { genomeOf } from "../src/genome.mjs";
import { crossLineage, lineageOf, lineageProblem, wordsOf } from "../src/lineage.mjs";
import { CLUTCH_MAX, GENERATIONS_MAX, LINEAGE_MAX, MUTATION_ONE_IN } from "../src/rules.mjs";

test("a lineage has one written form: case, spaces, ×, #1 and the parents' order do not count", () => {
  for (const text of ["thomas*auri", "Auri × Thomas", "thomas*auri#1", "  AURI * THOMAS # 1 "]) assert.equal(lineageOf(text), "auri*thomas");
  assert.equal(lineageOf("noe*(thomas*auri)"), "(auri*thomas)*noe");
  assert.equal(lineageOf("(c*d)*(b*a#2)"), "(a*b#2)*(c*d)");
  assert.equal(lineageOf("big   blue*Noé"), "big blue*noé");
  assert.equal(crossLineage("noe", "Thomas × Auri", 3), "(auri*thomas)*noe#3");
  assert.deepEqual(wordsOf("noe*(thomas*auri)"), ["auri", "thomas", "noe"]);
});

test("a bad lineage is refused with a reason", () => {
  const bad = ["a**b", "*a", "a*", "a*b*c", "(a*b", "a*b)", "(a)", "(a)*b", "(a*b)", "((a*b))*c", "#2", "a#2", "a*b#0",
    `a*b#${CLUTCH_MAX + 1}`, "a*b#02", "a*b#", "a*b#x", "a*b#2#3", "a*()", "a*🐸", `a*${"x".repeat(25)}`];
  for (const text of bad) assert.ok(lineageProblem(text), text);
  let deep = "a";
  for (let i = 0; i <= GENERATIONS_MAX; i++) deep = `(${deep}*b${i})`;
  assert.match(lineageProblem(deep.slice(1, -1)), /generations/);
  const long = (n) => `((${"a".repeat(22)}*${"b".repeat(22)})*(${"c".repeat(22)}*${"d".repeat(22)}))*${"e".repeat(n)}`;
  assert.equal([...lineageOf(long(22))].length, LINEAGE_MAX);
  assert.match(lineageProblem(long(23)), new RegExp(`${LINEAGE_MAX} characters`));
});

test("cross() is the command's child, pure and symmetric", () => {
  const [a, b] = ["thomas*auri", "noe"].map(genomeOf);
  const before = JSON.stringify([a, b]);
  const child = cross(a, b, 2);
  assert.deepEqual(child, genomeOf("(auri*thomas)*noe#2"));
  assert.deepEqual(cross(b, a, 2), child);
  assert.deepEqual(cross(a, b), cross(a, b, 1));
  assert.equal(JSON.stringify([a, b]), before);
  assert.deepEqual(child.parents, ["auri*thomas", "noe"]);
  assert.equal(child.clutch, 2);
});

test("a child takes after its parents: its species, affinity and traits come from them, or mutated", () => {
  let traits = 0, mutations = 0, both = 0;
  for (let i = 0; i < 600; i++) {
    const [x, y] = [`left${i}`, `right${i}`].map(genomeOf);
    const c = cross(x, y);
    assert.ok([x.species, y.species].includes(c.species));
    assert.ok([x.affinity, y.affinity].includes(c.affinity));
    const own = [x, y].filter((p) => p.species === c.species);
    for (const p of own) for (const k of Object.keys(p.traits)) assert.ok(k in c.traits, `${c.seed} lacks ${k}`);
    for (const [k, v] of Object.entries(c.traits)) {
      if (c.mutations.includes(k) || typeof v === "object") continue;
      const from = [x, y].filter((p) => k in p.traits).map((p) => p.traits[k]);
      const numbers = from.filter((n) => typeof n === "number");
      if (typeof v === "number") assert.ok(v >= Math.min(...numbers) && v <= Math.max(...numbers), `${c.seed}: ${k}`);
      else assert.ok(from.includes(v), `${c.seed}: ${k} is ${v}, its parents' ${from}`);
    }
    const origins = originsOf(c, [x, y]).map((o) => o.from);
    if (origins.includes(0) && origins.includes(1)) both++;
    traits += JSON.stringify(c.traits).split(",").length;
    mutations += c.mutations.length;
  }
  const rate = mutations / traits;
  assert.ok(rate > 1 / (MUTATION_ONE_IN * 1.6) && rate < 1.6 / MUTATION_ONE_IN, `1 trait in ${1 / rate} mutates`);
  assert.ok(both > 0.9 * 600, `${both} of 600 children take after both parents`);
});

test("a child of two species can carry a part of the other one, and its own children keep it", () => {
  const children = Array.from({ length: 200 }, (_, i) => genomeOf(`left${i}*right${i}`));
  const carrier = children.find((c) => c.heirlooms.length);
  assert.ok(carrier, "no child carries a heirloom");
  const grandchild = genomeOf(`(${carrier.seed})*(${carrier.seed}#2)`);
  if (grandchild.species === carrier.species) for (const h of carrier.heirlooms) assert.ok(grandchild.heirlooms.some((k) => k.part === h.part), h.part);
});

test("the family of a grandchild names its parents and grandparents", () => {
  const { parents, grandparents } = familyOf(genomeOf("(thomas*auri#2)*noe"));
  assert.deepEqual(parents.map((p) => p.seed), ["auri*thomas#2", "noe"]);
  assert.deepEqual(grandparents[0].map((g) => g.seed), ["auri", "thomas"]);
  assert.equal(grandparents[1], null);
});
