// Lineages: ARCHITECTURE.md, "Lineages". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonical, generations, LineageError, readLineage, wordsOf, writeCross } from "../src/lineage.mjs";
import { GENERATIONS_MAX, LINEAGE_MAX } from "../src/rules.mjs";

test("a lineage has one written form: case, spaces, ×, #1 and the order of parents do not count", () => {
  const forms = {
    "auri*thomas": ["thomas*auri", "Auri × Thomas", "thomas*auri#1", "  THOMAS ×auri # 1 "],
    "auri*thomas#2": ["thomas*auri#2", "Thomas × Auri #2"],
    "(auri*thomas)*noe": ["noe*(thomas*auri)", "NOE × ( Thomas × Auri )"],
    "(a*b#2)*(c*d)": ["(d*c)*(b*a#2)"],
    "big blue*noé": ["noé * Big   Blue"],
    "a*a": ["A × a"],
    thomas: [" Thomas "],
  };
  for (const [written, texts] of Object.entries(forms)) for (const text of texts) assert.equal(canonical(text), written, text);
});

test("parents are sorted the way JavaScript sorts: a child in parentheses comes before a word", () => {
  assert.equal(writeCross("noe", "auri*thomas"), "(auri*thomas)*noe");
  assert.equal(writeCross("zed", "Ábel".toLowerCase()), "zed*ábel");
  assert.equal(writeCross("b", "a", 3), "a*b#3");
});

test("bad lineages are refused, each with a reason", () => {
  const bad = ["a**b", "*a", "a*", "a*b*c", "(a*b", "a*b)", "(a)", "(a)*b", "(a*b)", "((a*b))*c", "#2", "a#2", "a*b#0", "a*b#100",
    "a*b#02", "a*b#", "a*b#x", "a*b#2#3", "a*()", "a*🐸", `a*${"b".repeat(25)}`, "", "  "];
  for (const text of bad) {
    assert.throws(() => readLineage(text), LineageError, text);
    try {
      readLineage(text);
    } catch (e) {
      assert.ok(e.message.length > 10, `${text}: ${e.message}`);
    }
  }
});

test(`a lineage goes back ${GENERATIONS_MAX} generations and ${LINEAGE_MAX} characters at most`, () => {
  assert.equal(generations(readLineage("(((((a*b)*c)*d)*e)*f)*g")), 6);
  assert.throws(() => readLineage("((((((a*b)*c)*d)*e)*f)*g)*h"), /6 generations/);
  const w = (ch, n) => ch.repeat(n);
  const long = `((${w("a", 22)}*${w("b", 22)})*(${w("c", 22)}*${w("d", 22)}))*${w("e", 22)}`;
  assert.equal(canonical(long).length, 120);
  assert.throws(() => readLineage(`${long}e`), /120 characters/);
});

test("the words of a lineage, in the order it is written", () => {
  assert.deepEqual(wordsOf("(auri*thomas#2)*noe"), ["auri", "thomas", "noe"]);
  assert.deepEqual(wordsOf("moss"), ["moss"]);
});
