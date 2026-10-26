// A word or a binary cross. Parentheses belong only to parents that are crosses.
import { parseSeed, SeedError } from './seed.mjs';
import { MAX_GENERATIONS, MAX_LINEAGE_LENGTH, CLUTCH_MIN, CLUTCH_MAX } from './rules.mjs';

export const parentForm = (node) => 'word' in node ? node.word : `(${writtenForm(node)})`;
export function writtenForm(node) {
  if ('word' in node) return node.word;
  return [parentForm(node.a), parentForm(node.b)].sort().join('*') + (node.clutch > 1 ? `#${node.clutch}` : '');
}
export const generations = (node) => 'word' in node ? 0 : 1 + Math.max(generations(node.a), generations(node.b));

export function parseLineage(text) {
  const source = String(text).replaceAll('×', '*');
  let pos = 0;
  const fail = (reason) => { throw new SeedError(reason); };
  const spaces = () => { while (/\s/u.test(source[pos] ?? '') && pos < source.length) pos++; };
  function parent(depth) {
    spaces();
    if (depth > MAX_GENERATIONS) fail(`a lineage has at most ${MAX_GENERATIONS} generations`);
    if (source[pos] === '(') {
      pos++;
      const node = lineage(depth + 1);
      if ('word' in node) fail('parentheses must contain a cross');
      spaces();
      if (source[pos++] !== ')') fail('a crossed parent needs a closing parenthesis');
      return node;
    }
    const start = pos;
    while (pos < source.length && !'*#()'.includes(source[pos])) pos++;
    return { word: parseSeed(source.slice(start, pos)) };
  }
  function lineage(depth) {
    const a = parent(depth);
    spaces();
    if (source[pos] !== '*') {
      if ('a' in a) fail('parentheses may wrap a crossed parent only');
      return a;
    }
    pos++;
    const b = parent(depth);
    let clutch = CLUTCH_MIN;
    spaces();
    if (source[pos] === '#') {
      pos++;
      spaces();
      const match = /^[0-9]+/.exec(source.slice(pos));
      if (!match || !/^[1-9][0-9]?$/.test(match[0])) fail(`an egg number is ${CLUTCH_MIN} to ${CLUTCH_MAX}, with no leading zero`);
      clutch = Number(match[0]);
      pos += match[0].length;
    }
    const parents = [a, b].sort((x, y) => parentForm(x) < parentForm(y) ? -1 : parentForm(x) > parentForm(y) ? 1 : 0);
    return { a: parents[0], b: parents[1], clutch };
  }
  const node = lineage(0);
  spaces();
  if (pos !== source.length) fail('cross exactly two parents; wrap a crossed parent in parentheses');
  if (generations(node) > MAX_GENERATIONS) fail(`a lineage has at most ${MAX_GENERATIONS} generations`);
  if (writtenForm(node).length > MAX_LINEAGE_LENGTH) fail(`a written lineage has at most ${MAX_LINEAGE_LENGTH} characters`);
  return node;
}

export function lineageProblem(text) {
  try { parseLineage(text); return null; } catch (e) { return e.message; }
}
