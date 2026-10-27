// Lineages: a child's seed is its family tree, so a link carries the whole family. ARCHITECTURE.md,
// "Lineages".
//
//   lineage = word | cross        cross = parent "*" parent [ "#" clutch ]        parent = word | "(" cross ")"
//
// readLineage(text) reads a lineage into a tree, { word } for a round 1 seed or { a, b, clutch } for a
// cross, and writeLineage(tree) writes it back in its one written form: the two parents of every cross in
// JavaScript's default sort order, "#1" left out.
import { CLUTCH_MAX, GENERATIONS_MAX, LINEAGE_MAX } from "./rules.mjs";
import { normalizeSeed, seedProblem } from "./seed.mjs";

export class LineageError extends Error {}

const SIGNS = "*#()";
const isSign = (token) => token.length === 1 && SIGNS.includes(token);

/** The signs of a lineage ("×" read as "*") and the text between them, spaces only dropped. */
function tokens(text) {
  const out = [];
  let word = "";
  for (const ch of String(text).normalize("NFC").replace(/×/g, "*")) {
    if (!SIGNS.includes(ch)) {
      word += ch;
      continue;
    }
    if (word.trim()) out.push(word);
    out.push(ch);
    word = "";
  }
  if (word.trim()) out.push(word);
  return out;
}

/** Reads a lineage into its tree, or throws a LineageError that says what is wrong, in a sentence. */
export function readLineage(text) {
  const list = tokens(text);
  let i = 0;
  const fail = (why) => {
    throw new LineageError(why);
  };

  function word() {
    const token = list[i];
    if (token === undefined || isSign(token)) fail("a parent is missing: a cross is two parents joined by *");
    i++;
    const seed = normalizeSeed(token);
    const problem = seedProblem(seed);
    if (problem) fail(list.length > 1 ? `“${seed}”: ${problem}` : problem);
    return { word: seed };
  }

  let open = 0; // parentheses opened and not yet closed

  function parent() {
    if (list[i] !== "(") return word();
    i++;
    open++;
    const child = cross();
    if (list[i] !== ")") fail("a parenthesis is opened and never closed");
    i++;
    open--;
    return child;
  }

  function cross() {
    const a = parent();
    if (list[i] !== "*") {
      const next = list[i];
      if (next === "#") fail("only a cross lays numbered eggs: write a*b#2");
      if (next === ")" && !open) fail("a parenthesis is closed and was never opened");
      if (next === ")") fail("word" in a ? "parentheses hold a child of two parents, never a single word" : "a parent takes one pair of parentheses");
      fail(next === undefined && !("word" in a) ? "a whole lineage needs no parentheses: write a*b" : "a cross is two parents joined by *");
    }
    i++;
    const b = parent();
    return { a, b, clutch: list[i] === "#" ? clutch() : 1 };
  }

  function clutch() {
    i++;
    const digits = (list[i++] ?? "").trim();
    if (!/^[1-9][0-9]?$/.test(digits)) fail(`# is followed by the egg's number, from 1 to ${CLUTCH_MAX}, with no leading zero`);
    return Number(digits);
  }

  if (!list.length) fail("a seed needs at least one letter or digit");
  const tree = list.some(isSign) ? cross() : word();
  if (i < list.length) {
    const next = list[i];
    fail(next === "*" ? "a cross has two parents: write (a*b)*c for a child of three" : next === ")" ? "a parenthesis is closed and was never opened" : next === "#" ? "an egg has one number" : `“${next}” comes after the end of the lineage`);
  }
  const depth = generations(tree);
  if (depth > GENERATIONS_MAX) fail(`a lineage goes back ${GENERATIONS_MAX} generations at most, this one ${depth}`);
  const length = [...writeLineage(tree)].length;
  if (length > LINEAGE_MAX) fail(`a lineage is written in ${LINEAGE_MAX} characters at most, this one takes ${length}`);
  return tree;
}

/** How many generations a tree goes back: 0 for a word, 1 for a child of two words. */
export const generations = (tree) => ("word" in tree ? 0 : 1 + Math.max(generations(tree.a), generations(tree.b)));

/** Whether a written lineage is a cross (a child), not a word. */
export const isCross = (seed) => seed.includes("*");

/** The written form of the cross of two written lineages: a child's seed, from its parents' seeds. */
export function writeCross(a, b, clutch = 1) {
  const [x, y] = [a, b].map((s) => (isCross(s) ? `(${s})` : s)).sort();
  return `${x}*${y}${clutch > 1 ? `#${clutch}` : ""}`;
}

/** The one written form of a tree. */
export function writeLineage(tree) {
  return "word" in tree ? tree.word : writeCross(writeLineage(tree.a), writeLineage(tree.b), tree.clutch);
}

/** The one written form of a lineage's text (throws a LineageError when the text is not a lineage). */
export const canonical = (text) => writeLineage(readLineage(text));

/** Every word of a written lineage, in the order written ("(auri*thomas)*noe": auri, thomas, noe). */
export function wordsOf(seed) {
  const words = [];
  const walk = (tree) => ("word" in tree ? words.push(tree.word) : (walk(tree.a), walk(tree.b)));
  walk(readLineage(seed));
  return words;
}
