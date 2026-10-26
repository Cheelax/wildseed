import { parseSeed, SeedError } from "./seed.mjs";
import { LINEAGE_MAX, GENERATIONS_MAX, CLUTCH_MAX } from "./rules.mjs";

/** A child is wrapped only when it occupies a parent slot. */
export const parentText = (node) => node.parents ? `(${node.seed})` : node.seed;

export function joinParents(left, right, clutch = 1) {
  if (!Number.isInteger(clutch) || clutch < 1 || clutch > CLUTCH_MAX)
    throw new SeedError(`An egg number must be an integer from 1 to ${CLUTCH_MAX}.`);
  const parents = [left, right].sort((a, b) => parentText(a) < parentText(b) ? -1 : parentText(a) > parentText(b) ? 1 : 0);
  const depth = 1 + Math.max(left.depth, right.depth);
  const seed = parents.map(parentText).join("*") + (clutch === 1 ? "" : `#${clutch}`);
  if (depth > GENERATIONS_MAX) throw new SeedError(`A family can have at most ${GENERATIONS_MAX} generations.`);
  if ([...seed].length > LINEAGE_MAX) throw new SeedError(`A written lineage can have at most ${LINEAGE_MAX} characters.`);
  return { seed, parents, clutch, depth };
}

/** Recursive descent over the grammar in ARCHITECTURE.md; no rewriting ambiguous expressions. */
export function parseLineage(value) {
  const text = String(value).normalize("NFC").replace(/×/g, "*");
  let at = 0;
  const spaces = () => { while (/\s/u.test(text[at] ?? "") && at < text.length) at++; };
  const take = (mark) => { spaces(); if (text[at] !== mark) return false; at++; return true; };
  function parent(level) {
    if (level > GENERATIONS_MAX) throw new SeedError(`A family can have at most ${GENERATIONS_MAX} generations.`);
    if (take("(")) {
      const node = expression(level + 1, true);
      if (!take(")")) throw new SeedError("Close the parent lineage with a right parenthesis.");
      return node;
    }
    spaces();
    const start = at;
    while (at < text.length && !"*#()".includes(text[at])) at++;
    return { seed: parseSeed(text.slice(start, at)), depth: 0 };
  }
  function expression(level, mustCross = false) {
    const left = parent(level);
    if (!take("*")) {
      if (mustCross || left.parents) throw new SeedError("Parentheses wrap a crossed parent only. Join two parents with *.");
      return left;
    }
    const right = parent(level);
    let clutch = 1;
    if (take("#")) {
      spaces();
      const begin = at;
      while (at < text.length && !"*#()".includes(text[at])) at++;
      const number = text.slice(begin, at).trim();
      if (!/^[1-9][0-9]?$/.test(number)) throw new SeedError("Use #1 to #99, with no leading zero, after two parents.");
      clutch = Number(number);
    }
    return joinParents(left, right, clutch);
  }
  const node = expression(0);
  spaces();
  if (at !== text.length) throw new SeedError(`Unexpected “${text[at]}”. Cross two parents; wrap a crossed parent in parentheses.`);
  return node;
}

export function lineageProblem(text) {
  try { parseLineage(text); return null; } catch (e) { return e.message; }
}
