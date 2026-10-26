// Lineages: a child's seed is its family tree, so a link carries the whole family. ARCHITECTURE.md, "Lineages".
//
//   lineage = word | cross
//   cross   = parent "*" parent [ "#" clutch ]
//   parent  = word | "(" cross ")"
//
// A word is a round 1 seed. "×" reads as "*", spaces around the signs do not count, "#1" is the first egg.
import { CLUTCH_MAX, GENERATIONS_MAX, LINEAGE_MAX } from "./rules.mjs";
import { normalizeSeed, SeedError, seedProblem } from "./seed.mjs";

export class LineageError extends SeedError {}

const SIGNS = "*#()";

/** The signs * # ( ) and the words between them; × is *, and text of spaces only is dropped. */
function tokenize(text) {
  const tokens = [];
  let word = "";
  const flush = () => {
    if (word.trim()) tokens.push({ word });
    word = "";
  };
  for (const ch of String(text).normalize("NFC").replace(/×/g, "*")) {
    if (SIGNS.includes(ch)) {
      flush();
      tokens.push({ sign: ch });
    } else word += ch;
  }
  flush();
  return tokens;
}

/**
 * Reads a lineage into a tree: { word } for a word, { a, b, clutch } for a cross. Throws a LineageError that
 * says what is wrong, in a sentence.
 */
export function parseLineage(text) {
  const tokens = tokenize(text);
  let at = 0;
  const next = () => tokens[at];
  const sign = (s) => next()?.sign === s;
  const fail = (why) => {
    throw new LineageError(why);
  };

  const word = () => {
    const t = next();
    if (!t) fail(at ? "a parent is missing at the end" : "type a word, or two parents joined by *");
    if (t.sign) fail(`a parent is missing before “${t.sign}”`);
    at++;
    const seed = normalizeSeed(t.word);
    const problem = seedProblem(seed);
    if (problem) fail(problem);
    return { word: seed };
  };

  const parent = () => {
    if (!sign("(")) return word();
    at++;
    if (sign(")")) fail("“()” holds nothing: parentheses wrap a cross of two parents");
    const child = cross({ inside: true });
    if (!sign(")")) fail("a “(” is never closed");
    at++;
    return child;
  };

  const cross = ({ inside = false } = {}) => {
    const a = parent();
    if (!sign("*")) {
      if (sign("#")) fail("only a cross lays eggs: #n comes after two parents, as in a*b#2");
      if (inside) fail("parentheses wrap a cross of two parents, once: write a, or (a*b)");
      if (!("word" in a)) fail("parentheses wrap a parent, not the whole lineage: write a*b, not (a*b)");
      fail("a cross is two parents joined by *");
    }
    at++;
    const b = parent();
    let clutch = 1;
    if (sign("#")) {
      at++;
      const n = next()?.word?.trim() ?? "";
      if (!/^[1-9][0-9]*$/.test(n) || Number(n) > CLUTCH_MAX) fail(`#n is the couple's n-th egg, from 1 to ${CLUTCH_MAX}, with no leading zero`);
      at++;
      clutch = Number(n);
    }
    return { a, b, clutch };
  };

  const tree = tokens.some((t) => t.sign) ? cross() : word();
  if (at < tokens.length) {
    const t = next();
    if (t.sign === "*") fail("a cross has two parents: write (a*b)*c, not a*b*c");
    if (t.sign === ")") fail("a “)” closes nothing");
    if (t.sign === "#") fail("an egg has one number");
    fail(`“${t.word.trim()}” follows a parent with no * between them`);
  }
  const generations = generationsOf(tree);
  if (generations > GENERATIONS_MAX) fail(`a lineage goes back ${GENERATIONS_MAX} generations at most, this one ${generations}`);
  const length = [...writeLineage(tree)].length;
  if (length > LINEAGE_MAX) fail(`a lineage has ${LINEAGE_MAX} characters at most once written, this one has ${length}`);
  return tree;
}

/** How many generations a tree spans: 0 for a word, 1 for a child of two words. */
export const generationsOf = (n) => ("word" in n ? 0 : 1 + Math.max(generationsOf(n.a), generationsOf(n.b)));

/** A parent as a cross writes it: a word as it is, a child in parentheses. */
const asParent = (n) => ("word" in n ? n.word : `(${writeLineage(n)})`);

/** The two parents of a cross in the order its written form puts them. */
export function parentsInOrder(n) {
  return asParent(n.a) <= asParent(n.b) ? [n.a, n.b] : [n.b, n.a];
}

/** A lineage's one written form: each cross's parents in JavaScript's default sort order, #1 left out. */
export function writeLineage(n) {
  if ("word" in n) return n.word;
  const [x, y] = parentsInOrder(n).map(asParent);
  return `${x}*${y}${n.clutch > 1 ? `#${n.clutch}` : ""}`;
}

/** A lineage's written form, or a LineageError. */
export const lineageOf = (text) => writeLineage(parseLineage(text));

/** Why a text is not a lineage, in a sentence, or null when it is one. */
export function lineageProblem(text) {
  try {
    parseLineage(text);
    return null;
  } catch (e) {
    if (e instanceof SeedError) return e.message;
    throw e;
  }
}

/** The words of a lineage, in the order its written form has them. */
export function wordsOf(text) {
  const words = [];
  const walk = (n) => ("word" in n ? words.push(n.word) : parentsInOrder(n).forEach(walk));
  walk(parseLineage(text));
  return words;
}

/** The written lineage of the `clutch`-th egg of two parents, each a lineage itself (a word or a cross). */
export function crossLineage(a, b, clutch = 1) {
  const side = (text) => {
    const n = parseLineage(text);
    return "word" in n ? n.word : `(${writeLineage(n)})`;
  };
  return lineageOf(`${side(a)}*${side(b)}#${clutch}`);
}
