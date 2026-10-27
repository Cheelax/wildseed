import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLineage, writtenForm } from '../src/lineage.mjs';
const canonical = s => writtenForm(parseLineage(s));

test('written forms sort parents inside first and omit the first egg number', () => {
  for (const [input, output] of [
    ['Thomas × Auri', 'auri*thomas'], ['thomas*auri#1', 'auri*thomas'],
    ['noe*(thomas*auri)', '(auri*thomas)*noe'], [' ( b * a # 2 ) * c # 99 ', '(a*b#2)*c#99'],
    [" BIG   Blue * noé", 'big blue*noé'], ['東京*кот', 'кот*東京'],
  ]) assert.equal(canonical(input), output);
});

test('refuses misplaced signs, parentheses, depth, length and egg numbers with reasons', () => {
  let deep = 'a*b';
  for (let n = 1; n < 6; n++) deep = `(${deep})*a`;
  assert.equal(canonical(deep), deep);
  const long = `((${'a'.repeat(22)}*${'b'.repeat(22)})*(${'c'.repeat(22)}*${'d'.repeat(22)}))*${'e'.repeat(22)}`;
  assert.equal(canonical(long).length, 120);
  for (const bad of ['(a)', '(a)*b', '(a*b)', '((a*b))*c', 'a*b*c', '#0', '#01', '#100',
    'a*b#0', 'a*b#01', 'a*b#100', 'a**b', '(a*b', 'a*b)', 'a#2', 'a*b#2#3', `(${deep})*a`, long + 'e']) {
    assert.throws(() => canonical(bad), e => e.message.length > 10, bad);
  }
});
