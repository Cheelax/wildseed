// Lineages: ARCHITECTURE.md, "Lineages". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generationsOf, lineageOf, lineageProblem, readLineage, wordsOf } from "../src/lineage.mjs";

test("a lineage has one written form: case, spaces, ×, #1 and the parents' order do not count", () => {
  for (const [written, forms] of [
    ["auri*thomas", ["thomas*auri", "Auri × Thomas", "  THOMAS * auri ", "thomas*auri#1", "auri * thomas # 1"]],
    ["auri*thomas#2", ["thomas*auri#2", "AURI × THOMAS #2"]],
    ["(auri*thomas)*noe", ["noe*(thomas*auri)", "NOE × ( THOMAS × AURI )"]],
    ["(a*b#2)*(c*d)", ["(d*c)*(b*a#2)"]],
    ["big blue*noé", ["noé * Big   Blue"]],
    ["кот*東京", ["東京*кот", "КОТ × 東京"]],
  ]) for (const form of forms) assert.equal(lineageOf(form), written, form);
});

test("a word reads as round 1 reads a seed", () => {
  assert.deepEqual(readLineage("  Thomas "), { word: "thomas" });
  assert.equal(lineageOf("noé"), "noé");
});

test("bad lineages are refused with a reason", () => {
  for (const bad of ["a**b", "*a", "a*", "a*b*c", "(a*b", "a*b)", "(a)", "(a)*b", "(a*b)", "((a*b))*c", "#2", "a#2", "a*b#0",
    "a*b#100", "a*b#02", "a*b#", "a*b#x", "a*b#2#3", "a*()", "a*🐸", `a*${"b".repeat(25)}`, "((((((a*b)*c)*d)*e)*f)*g)*h", ""]) {
    assert.ok(lineageProblem(bad), bad);
  }
});

test("6 generations and 120 characters at most, counted on the written form", () => {
  assert.equal(generationsOf(readLineage("(((((a*b)*c)*d)*e)*f)*g")), 6);
  const long = `((${"a".repeat(22)}*${"b".repeat(22)})*(${"c".repeat(22)}*${"d".repeat(22)}))*${"e".repeat(22)}`;
  assert.equal([...lineageOf(long)].length, 120);
  assert.equal(lineageProblem(long.replace(/ \*/g, "*")), null);
  assert.match(lineageProblem(long + "e"), /121 characters/);
});

test("the words of a lineage, in its written order", () => {
  assert.deepEqual(wordsOf(readLineage("noe × (thomas × auri) #2")), ["auri", "thomas", "noe"]);
});
