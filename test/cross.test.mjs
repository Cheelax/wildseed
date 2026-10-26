import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cross } from '../src/cross.mjs';
import { genomeOf } from '../src/genome.mjs';

function leaves(value, prefix = '', out = {}) {
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (v && typeof v === 'object') leaves(v, path, out);
    else out[path] = v;
  }
  return out;
}

test('cross is symmetric, pure and exactly genomeOf for words and descendants', () => {
  for (const [x, y] of [['thomas', 'auri'], ['auri*thomas', 'noe'], ['moss', 'moss']]) {
    const a = genomeOf(x), b = genomeOf(y);
    const before = JSON.stringify([a, b]);
    for (const clutch of [1, 2, 99]) {
      const child = cross(a, b, clutch);
      assert.deepEqual(child, cross(b, a, clutch));
      assert.deepEqual(child, genomeOf(child.seed));
    }
    assert.equal(JSON.stringify([a, b]), before);
  }
});

test('traits come from a parent or are listed as mutations, with the species traits retained', () => {
  for (let n = 0; n < 250; n++) {
    const a = genomeOf(`first${n}`), b = genomeOf(`second${n}`), c = cross(a, b);
    const at = leaves(a.traits), bt = leaves(b.traits), ct = leaves(c.traits);
    assert.ok([a.species, b.species].includes(c.species));
    assert.deepEqual(Object.keys(ct), Object.keys(c.species === a.species ? at : bt));
    for (const [path, value] of Object.entries(ct)) {
      if (c.mutations.includes(path)) continue;
      assert.ok(value === at[path] || value === bt[path], path);
    }
    assert.equal(new Set(c.mutations).size, c.mutations.length);
  }
});

test('all 466 recorded word genomes keep identical bytes', () => {
  const lines = readFileSync(new URL('../.launchpad/checks/round-2/round-1-genomes.jsonl', import.meta.url), 'utf8').trim().split('\n');
  for (const line of lines) {
    const g = JSON.parse(line);
    assert.equal(JSON.stringify(genomeOf(g.seed)), JSON.stringify(g));
  }
});
