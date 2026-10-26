// Round 2's reading of lineages, held by the checks: the canonical form of a lineage, its parents and its depth,
// written from the round's brief. The entry's code never runs here: run.mjs compares what the entry prints with what
// this file reads.
//
//   lineage = word | cross        cross = parent "*" parent [ "#" clutch ]        parent = word | "(" cross ")"
//
// A word is a round 1 seed. "×" reads as "*", spaces around "*", "#", "(" and ")" do not count, "#1" is the first egg
// and is left out, and the two parents of every cross are written in JavaScript's default sort order.

export const WORD_MAX = 24;
export const LINEAGE_MAX = 120;
export const DEPTH_MAX = 6;
const WORD = /^[\p{L}\p{M}\p{N} '-]+$/u;

/** A round 1 seed: NFC, lowercase, trimmed, every run of whitespace one space. */
export const norm = (s) => s.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");

/** The tokens of a lineage: "*", "#", "(", ")" and the text between them (text of spaces only dropped). */
function tokens(text) {
  const out = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push({ text: buf });
    buf = "";
  };
  for (const ch of text.normalize("NFC").toLowerCase().replace(/×/g, "*")) {
    if ("*#()".includes(ch)) {
      flush();
      out.push({ op: ch });
    } else buf += ch;
  }
  flush();
  return out;
}

/** Reads a lineage into { word } or { a, b, clutch }. Throws a sentence when the text is not a lineage. */
export function parse(text) {
  const t = tokens(String(text));
  let i = 0;
  const word = () => {
    const tok = t[i++];
    if (!tok || !("text" in tok)) throw new Error("a word is missing");
    const w = norm(tok.text);
    if ([...w].length > WORD_MAX) throw new Error(`the word ${JSON.stringify(w)} is longer than ${WORD_MAX} characters`);
    if (!WORD.test(w)) throw new Error(`the word ${JSON.stringify(w)} holds a character a seed cannot`);
    return { word: w };
  };
  const parent = () => {
    if (t[i]?.op !== "(") return word();
    i++;
    const c = cross();
    if (t[i++]?.op !== ")") throw new Error("a parenthesis is not closed");
    return c;
  };
  const cross = () => {
    const a = parent();
    if (t[i++]?.op !== "*") throw new Error("a cross is two parents joined by *");
    const b = parent();
    let clutch = 1;
    if (t[i]?.op === "#") {
      i++;
      const tok = t[i++];
      const digits = tok && "text" in tok ? tok.text.trim() : "";
      if (!/^[1-9][0-9]?$/.test(digits)) throw new Error("# is followed by a clutch from 1 to 99");
      clutch = Number(digits);
    }
    return { a, b, clutch };
  };
  if (!t.length) throw new Error("an empty lineage");
  const node = t.some((x) => "op" in x) ? cross() : word();
  if (i < t.length) throw new Error(`${JSON.stringify(t[i].op ?? t[i].text)} after the end of the lineage`);
  if (depth(node) > DEPTH_MAX) throw new Error(`more than ${DEPTH_MAX} generations`);
  if ([...write(node)].length > LINEAGE_MAX) throw new Error(`longer than ${LINEAGE_MAX} characters once written`);
  return node;
}

export const depth = (n) => ("word" in n ? 0 : 1 + Math.max(depth(n.a), depth(n.b)));
const asParent = (n) => ("word" in n ? n.word : `(${write(n)})`);
const order = (x, y) => (asParent(x) < asParent(y) ? -1 : asParent(x) > asParent(y) ? 1 : 0);

/** The canonical form of a parsed lineage. */
export function write(n) {
  if ("word" in n) return n.word;
  const [x, y] = [n.a, n.b].sort(order).map(asParent);
  return `${x}*${y}${n.clutch > 1 ? `#${n.clutch}` : ""}`;
}
/** The canonical form of a lineage's text, or null when the text is not a lineage. */
export function canonical(text) {
  try {
    return write(parse(text));
  } catch {
    return null;
  }
}
/** A child's `parents`: its two parents' canonical lineages, in canonical order (null for a word). */
export function parentsOf(text) {
  const n = parse(text);
  return "word" in n ? null : [n.a, n.b].sort(order).map(write);
}
/** A child's clutch (null for a word). */
export const clutchOf = (text) => parse(text).clutch ?? null;
/** Every word of a lineage, in the order written. */
export function wordsOf(text) {
  const out = [];
  const walk = (n) => ("word" in n ? out.push(n.word) : (walk(n.a), walk(n.b)));
  walk(parse(text));
  return out;
}
/** The same lineage written with the two parents of every cross swapped, and spaces around the signs: the same child. */
export function mirror(text) {
  const flip = (n) => ("word" in n ? n.word : `${side(n.b)} * ${side(n.a)}${n.clutch > 1 ? ` # ${n.clutch}` : ""}`);
  const side = (n) => ("word" in n ? n.word : `( ${flip(n)} )`);
  return flip(parse(text));
}
