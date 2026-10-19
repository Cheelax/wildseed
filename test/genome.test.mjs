import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genomeOf, normalizeSeed, SPECIES } from '../src/genome.mjs';
import { encodeGif, quantize } from '../src/gif.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('normalization follows NFC, Unicode lowercasing and whitespace contract', () => {
  for (const [a, b] of [['  Moss ', 'moss'], ['noe\u0301', 'noé'], ['BIG\t blue', 'big blue'], ['ÉTÉ', 'été']]) assert.deepEqual(genomeOf(a), genomeOf(b));
  for (const seed of ['東京', "o'brien", 'x-1', 'مرحبا', 'a'.repeat(24)]) assert.equal(genomeOf(seed).seed, normalizeSeed(seed));
});

test('invalid values and reserved lineage characters are refused', () => {
  for (const seed of [null, 23, {}, '', '  ', 'a'.repeat(25), 'a*b', '(a)', 'x#2', '🐸', 'a/b', 'a\u0000b']) assert.throws(() => genomeOf(seed));
});

test('10000 seeds meet distribution, bounded anatomy, stats and JSON invariants', () => {
  const counts = new Map(), affinities = new Set(); let rare = 0;
  for (let i = 0; i < 10000; i++) {
    const g = genomeOf(`seed-${i}`); counts.set(g.species, (counts.get(g.species) ?? 0) + 1); affinities.add(g.affinity); rare += g.rare;
    assert.match(g.name, /^\p{Lu}\p{Ll}{2,11}$/u); assert.deepEqual(JSON.parse(JSON.stringify(g)), g);
    const values = Object.values(g.stats), total = values.reduce((a, b) => a + b, 0);
    assert.ok(values.every((n) => Number.isInteger(n) && n >= 10 && n <= 100)); assert.ok(total >= 160 && total <= 280);
    assert.ok(g.palette.length >= 3 && g.palette.length <= 8); g.palette.forEach((color) => assert.match(color, /^#[a-f0-9]{6}$/));
    assert.ok(g.traits.body >= 85 && g.traits.body <= 115); assert.ok(g.traits.ears >= 80 && g.traits.ears <= 120);
  }
  assert.deepEqual([...counts.keys()].sort(), [...SPECIES].sort());
  for (const count of counts.values()) assert.ok(count >= 200);
  assert.equal(affinities.size, 3); assert.ok(rare >= 100 && rare <= 250);
});

test('v1 moss fixture protects permanent creatures from call-order drift', () => {
  assert.deepEqual(genomeOf('moss'), { version: 1, seed: 'moss', name: 'Zamori', species: 'sproutling', affinity: 'moss', rare: false,
    stats: { hp: 53, attack: 62, defense: 42, speed: 65 }, palette: ['#152b28', '#3d6b50', '#80b877', '#d5e9a5', '#faf2d2', '#e49a75'],
    traits: { body: 87, ears: 95, tail: 96, eyes: 1, marking: 3, crest: 1, voice: 4, signature: '315f190c' } });
});

test('2000 words have more than 900 generated names, independently of the seed field', () => {
  const names = new Set(Array.from({ length: 2000 }, (_, i) => genomeOf(`name-${i}`).name));
  assert.ok(names.size > 900, `${names.size} distinct names`);
});

test('separate processes print identical genomes and batch errors emit no partial stdout', () => {
  const args = ['bin/hatch.mjs', 'moss', 'daniel', '東京'];
  const a = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LANG: 'C' } });
  const b = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, TZ: 'Pacific/Auckland', LANG: 'tr_TR.UTF-8' } });
  assert.equal(a.status, 0); assert.equal(a.stdout, b.stdout); assert.equal(a.stdout.trim().split('\n').length, 3);
  for (const seeds of [[], ['moss', 'a*b']]) {
    const r = spawnSync(process.execPath, ['bin/hatch.mjs', ...seeds], { encoding: 'utf8' });
    assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.ok(r.stderr.length > 0);
  }
});

test('quantizer uses a complete 64-color cube and clamps exact channel endpoints', () => {
  const rgba = new Uint8ClampedArray(64 * 4);
  for (let i = 0; i < 64; i++) { rgba.set([85 * (i >>> 4), 85 * (i >>> 2 & 3), 85 * (i & 3), 255], i * 4); }
  assert.deepEqual([...quantize(rgba)], Array.from({ length: 64 }, (_, i) => i));
});

test('GIF is a deterministic GIF89a with dimensions, frames and palette; rejects malformed frames', () => {
  const frames = [new Uint8Array(64).fill(1), new Uint8Array(64).fill(45)];
  const bytes = encodeGif(frames, 8, 8);
  assert.equal(Buffer.from(bytes.subarray(0, 6)).toString(), 'GIF89a');
  assert.equal(bytes[6], 8); assert.equal(bytes[8], 8); assert.equal(bytes.at(-1), 0x3b);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(encodeGif(frames, 8, 8)).digest('hex'));
  for (const [f, w, h] of [[[], 8, 8], [[new Uint8Array(1)], 8, 8], [frames, 0, 8], [[new Uint8Array(64).fill(64)], 8, 8]]) assert.throws(() => encodeGif(f, w, h));
});
