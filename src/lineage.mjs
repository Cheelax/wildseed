// Lineages: a child's seed is its family tree. ARCHITECTURE.md, "Lineages".
import { SEED_MAX, SEED_PATTERN } from "./rules.mjs";

export const LINEAGE_MAX = 120;
export const DEPTH_MAX = 6;

/** A round 1 seed: NFC, lowercase, trimmed, every run of whitespace one space. */
export const norm = (s) => String(s).normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");

function tokens(text) {
  const out = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push({ text: buf });
    buf = "";
  };
  for (const ch of String(text).normalize("NFC").toLowerCase().replace(/×/g, "*")) {
    if ("*#()".includes(ch)) {
      flush();
      out.push({ op: ch });
    } else buf += ch;
  }
  flush();
  return out;
}

export class LineageError extends Error {}

/** Reads a lineage into { word } or { a, b, clutch }. */
export function parse(text) {
  const t = tokens(text);
  let i = 0;
  const word = () => {
    const tok = t[i++];
    if (!tok || !("text" in tok)) throw new LineageError("a word is missing");
    const w = norm(tok.text);
    if ([...w].length > SEED_MAX) {
      throw new LineageError(`the word ${JSON.stringify(w)} is longer than ${SEED_MAX} characters`);
    }
    if (!SEED_PATTERN.test(w)) {
      const bad = [...w].find((ch) => !SEED_PATTERN.test(ch));
      throw new LineageError(
        bad === undefined
          ? `the word ${JSON.stringify(w)} holds a character a seed cannot`
          : `“${bad}” cannot be part of a seed: letters, digits, spaces, hyphens and apostrophes only`,
      );
    }
    if (w === "") throw new LineageError("a word is missing");
    return { word: w };
  };
  const parent = () => {
    if (t[i]?.op !== "(") return word();
    i++;
    const c = cross();
    if (t[i++]?.op !== ")") throw new LineageError("a parenthesis is not closed");
    return c;
  };
  const cross = () => {
    const a = parent();
    if (t[i++]?.op !== "*") throw new LineageError("a cross is two parents joined by *");
    const b = parent();
    let clutch = 1;
    if (t[i]?.op === "#") {
      i++;
      const tok = t[i++];
      const digits = tok && "text" in tok ? tok.text.trim() : "";
      if (!/^[1-9][0-9]?$/.test(digits)) throw new LineageError("# is followed by a clutch from 1 to 99");
      clutch = Number(digits);
    }
    return { a, b, clutch };
  };
  if (!t.length) throw new LineageError("an empty lineage");
  const node = t.some((x) => "op" in x) ? cross() : word();
  if (i < t.length) throw new LineageError(`${JSON.stringify(t[i].op ?? t[i].text)} after the end of the lineage`);
  if (depth(node) > DEPTH_MAX) throw new LineageError(`more than ${DEPTH_MAX} generations`);
  if ([...write(node)].length > LINEAGE_MAX) throw new LineageError(`longer than ${LINEAGE_MAX} characters once written`);
  return node;
}

export const depth = (n) => ("word" in n ? 0 : 1 + Math.max(depth(n.a), depth(n.b)));
const asParent = (n) => ("word" in n ? n.word : `(${write(n)})`);
const order = (x, y) => (asParent(x) < asParent(y) ? -1 : asParent(x) > asParent(y) ? 1 : 0);

export function write(n) {
  if ("word" in n) return n.word;
  const [x, y] = [n.a, n.b].sort(order).map(asParent);
  return `${x}*${y}${n.clutch > 1 ? `#${n.clutch}` : ""}`;
}

export function canonical(text) {
  try {
    return write(parse(text));
  } catch {
    return null;
  }
}

export function parentsOf(nodeOrText) {
  const n = typeof nodeOrText === "string" ? parse(nodeOrText) : nodeOrText;
  return "word" in n ? null : [n.a, n.b].sort(order).map(write);
}

export function clutchOf(nodeOrText) {
  const n = typeof nodeOrText === "string" ? parse(nodeOrText) : nodeOrText;
  return "word" in n ? null : n.clutch;
}

export function wordsOf(text) {
  const out = [];
  const walk = (n) => ("word" in n ? out.push(n.word) : (walk(n.a), walk(n.b)));
  walk(parse(text));
  return out;
}

/** Why a lineage text is refused, or null when it is good. */
export function lineageProblem(text) {
  try {
    parse(text);
    return null;
  } catch (e) {
    return e.message;
  }
}
