// Lineages: a child's seed is its lineage, so a link carries the whole family tree and nothing is stored
// anywhere. ARCHITECTURE.md, "Lineages".
//
//   lineage = word | cross        cross = parent "*" parent [ "#" clutch ]        parent = word | "(" cross ")"
//
// readLineage() reads a lineage, however it is written, into a tree: a word { word }, or a cross { a, b, clutch }
// whose two parents are trees too. writeLineage() writes a tree in its one written form: "*" with no spaces
// around it, the two parents of every cross in JavaScript's default sort order, and no "#1".
import { CLUTCH_MAX, GENERATIONS_MAX, LINEAGE_MAX } from "./rules.mjs";
import { parseSeed, SeedError } from "./seed.mjs";

/** Why a text is not a lineage, in a sentence. It is a SeedError: a bad word in a lineage is a bad seed. */
export class LineageError extends SeedError {}

const fail = (why) => {
  throw new LineageError(why);
};

/** A parent as the lineage writes it: a word as it is, a child in parentheses. */
const asParent = (tree) => ("word" in tree ? tree.word : `(${writeLineage(tree)})`);

/** The one written form of a lineage's tree. */
export function writeLineage(tree) {
  if ("word" in tree) return tree.word;
  const [x, y] = [asParent(tree.a), asParent(tree.b)].sort();
  return `${x}*${y}${tree.clutch > 1 ? `#${tree.clutch}` : ""}`;
}

/** A cross of two trees, its parents in their written order. */
function crossOf(a, b, clutch) {
  const [x, y] = asParent(a) <= asParent(b) ? [a, b] : [b, a];
  return { a: x, b: y, clutch };
}

/** How many generations a lineage holds: none for a word, one for a child of two words. */
export const generationsOf = (tree) => ("word" in tree ? 0 : 1 + Math.max(generationsOf(tree.a), generationsOf(tree.b)));

/** Every word of a lineage, in its written order. */
export const wordsOf = (tree) => ("word" in tree ? [tree.word] : [...wordsOf(tree.a), ...wordsOf(tree.b)]);

/** The tree, once it is checked against the limits on generations and length. */
function withinLimits(tree) {
  const generations = generationsOf(tree);
  if (generations > GENERATIONS_MAX) fail(`this lineage goes back ${generations} generations: ${GENERATIONS_MAX} at most`);
  const length = [...writeLineage(tree)].length;
  if (length > LINEAGE_MAX) fail(`written out, this lineage is ${length} characters long: ${LINEAGE_MAX} at most`);
  return tree;
}

/** The signs that join words into a lineage ("×" reads as "*"), and the text between them: { sign } or { text }. */
function tokensOf(text) {
  const tokens = [];
  let word = "";
  const endWord = () => {
    if (word.trim()) tokens.push({ text: word }); // spaces around a sign are no word
    word = "";
  };
  for (const ch of String(text).normalize("NFC").toLowerCase().replaceAll("×", "*")) {
    if ("*#()".includes(ch)) {
      endWord();
      tokens.push({ sign: ch });
    } else word += ch;
  }
  endWord();
  return tokens;
}

/** Reads a lineage, written any way, into its tree. Throws a SeedError that says what is wrong. */
export function readLineage(text) {
  const tokens = tokensOf(text);
  // With no sign, it is a word, read exactly as round 1 reads a seed.
  if (!tokens.some((t) => t.sign)) return { word: parseSeed(text) };

  let at = 0;
  const sign = () => tokens[at]?.sign;

  // parent = word | "(" cross ")"
  const parent = (where) => {
    const token = tokens[at];
    if (token?.text !== undefined) {
      at++;
      return { word: parseSeed(token.text) };
    }
    if (sign() === "#") fail("“#” and an egg's number come after a cross, like thomas*auri#2");
    if (sign() !== "(") fail(`a parent is missing ${where}`);
    at++;
    if (sign() === ")") fail("a pair of parentheses holds nothing");
    const child = cross();
    if (sign() !== ")") fail("a “(” is never closed");
    at++;
    return child;
  };

  // cross = parent "*" parent [ "#" clutch ]
  const cross = () => {
    const a = parent("before a “*”");
    if (sign() !== "*") {
      if (sign() === "#") fail("an egg's number comes after a cross, like thomas*auri#2, never after a word or a parenthesis");
      if (sign() === ")" && "word" in a) fail("parentheses wrap a cross, like (thomas*auri), never a word alone");
      if (sign() === ")") fail("a parent is in two pairs of parentheses: one pair is enough");
      if (sign() === undefined) fail("only a parent goes in parentheses, never a whole lineage: leave them out");
      fail("two parents are joined by “*”");
    }
    at++;
    const b = parent("after a “*”");
    let clutch = 1;
    if (sign() === "#") {
      at++;
      const digits = tokens[at++]?.text?.trim() ?? "";
      if (!/^[1-9][0-9]*$/.test(digits) || Number(digits) > CLUTCH_MAX) fail(`an egg's number, after “#”, is 1 to ${CLUTCH_MAX}, with no leading zero`);
      clutch = Number(digits);
    }
    return crossOf(a, b, clutch);
  };

  const tree = cross();
  if (at < tokens.length) {
    const extra = sign();
    if (extra === "*") fail("three parents need parentheses: write (thomas*auri)*noe");
    if (extra === "#") fail("a cross has one egg's number: one “#” is enough");
    if (extra === ")") fail("a “)” closes a parenthesis that was never opened");
    fail(`“${tokens[at].sign ?? tokens[at].text.trim()}” comes after the end of the lineage`);
  }
  return withinLimits(tree);
}

/** The written form of a lineage, however it is typed. Throws a SeedError when it is not one. */
export const lineageOf = (text) => writeLineage(readLineage(text));

/** Why a text is not a lineage, in a sentence, or null when it is one. */
export function lineageProblem(text) {
  try {
    readLineage(text);
    return null;
  } catch (e) {
    if (e instanceof SeedError) return e.message;
    throw e;
  }
}

/** The written lineage of the `clutch`-th egg of two lineages. Throws a LineageError when it would be too long. */
export function crossLineage(a, b, clutch = 1) {
  if (!Number.isInteger(clutch) || clutch < 1 || clutch > CLUTCH_MAX) fail(`an egg's number is 1 to ${CLUTCH_MAX}`);
  return writeLineage(withinLimits(crossOf(readLineage(a), readLineage(b), clutch)));
}
