import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { genomeOf, normalizeSeed, SPECIES } from '../src/genome.mjs';
import { readJournal, writeJournal } from '../src/storage.mjs';
import { encodeGif, paletteOf } from '../src/gif.mjs';

test('Unicode normalization and length count code points, with the specified operation order', () => {
  for (const [a, b] of [['  THOMAS\n', 'thomas'], ['Noe\u0301', 'noé'], ['big\t \nblue', 'big blue'], ['ÉTÉ', 'été']]) assert.deepEqual(genomeOf(a), genomeOf(b));
  for (const value of ['東京', 'кот', 'مرحبا', "o'brien", 'x-1', '𐐨'.repeat(24)]) assert.equal(genomeOf(value).seed, normalizeSeed(value));
  for (const value of ['', ' ', 'a*b', '(a)', 'x#2', '🐸', 'a'.repeat(25), '𐐨'.repeat(25), null, 123]) assert.throws(() => genomeOf(value));
});

test('genome objects are independent and neither argument order nor mutation changes a seed', () => {
  const first = genomeOf('moss'), expected = structuredClone(first);
  first.palette[0] = '#000000'; first.stats.hp = 0; first.traits.voice.note = 0;
  genomeOf('pebble'); assert.deepEqual(genomeOf('moss'), expected);
  assert.equal(genomeOf('moss').traits.version, 1);
});

test('ten thousand unrelated names obey all ranges and distribution limits', () => {
  const counts = new Map(), affinities = new Set(), names = new Set(), bodies = new Set(); let rare = 0;
  for (let i = 0; i < 10000; i++) {
    const g = genomeOf(`garden ${i}`);
    counts.set(g.species, (counts.get(g.species) || 0) + 1); affinities.add(g.affinity); rare += Number(g.rare);
    assert.match(g.name, /^\p{Lu}\p{Ll}{2,11}$/u); assert.match(g.species, /^[a-z][a-z0-9-]{1,23}$/);
    assert.ok(g.palette.length >= 3 && g.palette.length <= 8); for (const color of g.palette) assert.match(color, /^#[0-9a-f]{6}$/);
    const values = Object.values(g.stats); assert.equal(values.length, 4);
    for (const v of values) assert.ok(Number.isInteger(v) && v >= 10 && v <= 100);
    const total = values.reduce((a, b) => a + b, 0); assert.ok(total >= 160 && total <= 280);
    if (i < 2000) { names.add(g.name); const { seed, ...body } = g; bodies.add(JSON.stringify(body)); }
  }
  assert.equal(counts.size, SPECIES.length); for (const count of counts.values()) assert.ok(count >= 200);
  assert.equal(affinities.size, 3); assert.ok(rare >= 100 && rare <= 250, `rare=${rare}`);
  assert.ok(names.size >= 500); assert.ok(bodies.size >= 1980);
});

const cli = (args, env = {}) => spawnSync(process.execPath, ['bin/hatch.mjs', ...args], { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 8 * 1024 * 1024 });
test('CLI validates the entire batch atomically and names the bad input', () => {
  for (const args of [[], [''], ['moss', 'a*b'], ['a'.repeat(25)], ['🐸']]) {
    const r = cli(args); if (r.error) throw r.error; assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.ok(r.stderr.trim());
    if (args.length) assert.ok(r.stderr.includes(JSON.stringify(args.at(-1))));
  }
});
test('CLI bytes agree across processes, locale, timezone and single/batch runs', () => {
  const seeds = ['moss', 'pebble', '東京', 'noé'];
  const a = cli(seeds, { LANG: 'tr_TR.UTF-8', TZ: 'Asia/Tokyo' });
  const b = cli(seeds, { LANG: 'C', TZ: 'UTC' });
  if (a.error || b.error) throw a.error || b.error;
  assert.equal(a.status, 0); assert.equal(a.stderr, ''); assert.equal(a.stdout, b.stdout);
  assert.equal(a.stdout, seeds.map((s) => JSON.stringify(genomeOf(s))).join('\n') + '\n');
  assert.equal(cli(['pebble']).stdout.trim(), a.stdout.trim().split('\n')[1]);
});
test('a thousand CLI seeds finish without truncation', () => {
  const r = cli(Array.from({ length: 1000 }, (_, i) => `seed ${i}`));
  if (r.error) throw r.error;
  assert.equal(r.status, 0); assert.equal(r.stdout.trim().split('\n').length, 1000);
});

test('version-one reference genomes retain their bytes for future rounds', () => {
  const bytes = JSON.stringify(['moss', 'pebble', 'hotpod', 'a', '東京', 'noé'].map(genomeOf));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '5cc69ba6e437c12264ef730767e6bcf25c6bf9754b678d25056d721db233ebd4');
});

test('journal repairs corrupt, foreign and invalid data without trusting stored genomes', () => {
  for (const raw of ['{', 'null', '{"version":2}', '42']) assert.deepEqual(readJournal({ getItem: () => raw }).recent, []);
  const stored = { version: 1, recent: ['moss', 'moss', 'a*b', null, 'NO'], favourites: ['noé'], muted: 'true', genome: { name: 'tampered' } };
  assert.deepEqual(readJournal({ getItem: () => JSON.stringify(stored) }), { version: 1, recent: ['moss'], favourites: ['noé'], muted: false });
  assert.equal(readJournal({ getItem: () => { throw Error('denied'); } }).muted, false);
  assert.equal(writeJournal({ setItem: () => { throw Error('quota'); } }, {}), false);
});
test('journal round-trips kept words, recent order and sound preference', () => {
  let text; const storage = { getItem: () => text, setItem: (key, value) => { text = value; } };
  const j = { version: 1, recent: ['moss', '東京'], favourites: ['東京'], muted: true };
  assert.equal(writeJournal(storage, j), true); assert.deepEqual(readJournal(storage), j);
});

// Independent GIF LZW decoder: verifies full images, not just headers/frame count.
function decodeGif(bytes) {
  let pos = 13 + 3 * 2 ** ((bytes[10] & 7) + 1); const frames = [];
  const blocks = () => { const output = []; while (bytes[pos]) { const n = bytes[pos++]; output.push(...bytes.slice(pos, pos + n)); pos += n; } pos++; return output; };
  while (bytes[pos] !== 0x3b) {
    const kind = bytes[pos++];
    if (kind === 0x21) { pos++; blocks(); continue; }
    assert.equal(kind, 0x2c); const flags = bytes[pos + 8]; pos += 9;
    if (flags & 0x80) pos += 3 * 2 ** ((flags & 7) + 1);
    const min = bytes[pos++], data = blocks(), clear = 1 << min, end = clear + 1;
    let table, size, bit = 0, previous = null; const pixels = [];
    const reset = () => { table = Array.from({ length: end + 1 }, (_, i) => i < clear ? [i] : []); size = min + 1; previous = null; };
    reset();
    while (bit + size <= data.length * 8) {
      let code = 0; for (let b = 0; b < size; b++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << b;
      if (code === clear) { reset(); continue; } if (code === end) break;
      const entry = table[code] || (code === table.length && previous ? [...previous, previous[0]] : null);
      assert.ok(entry, `invalid LZW code ${code}`); pixels.push(...entry);
      if (previous) { table.push([...previous, entry[0]]); if (table.length === 1 << size && size < 12) size++; }
      previous = entry;
    }
    frames.push(pixels);
  }
  return frames;
}
test('GIF decodes every pixel across clear-code, byte and sub-block boundaries', () => {
  const palette = Array.from({ length: 64 }, (_, i) => [i % 4 * 64, (i >> 2) % 4 * 64, (i >> 4) * 64]);
  const frames = Array.from({ length: 13 }, (_, f) => {
    const rgba = new Uint8ClampedArray(67 * 65 * 4);
    for (let p = 0; p < 67 * 65; p++) rgba.set([...palette[(p + f) % 64], 255], p * 4);
    return rgba;
  });
  const bytes = encodeGif(67, 65, frames, palette); const decoded = decodeGif(bytes);
  assert.equal(decoded.length, 13);
  decoded.forEach((pixels, f) => { assert.equal(pixels.length, 67 * 65); pixels.forEach((v, p) => assert.equal(v, (p + f) % 64)); });
});
test('GIF palette is bounded and malformed export inputs are rejected', () => {
  const palette = paletteOf([new Uint8ClampedArray(4 * 100).fill(128)]);
  assert.equal(palette.length, 64); assert.ok(palette.flat().every((v) => v >= 0 && v <= 255));
  assert.throws(() => encodeGif(0, 4, [], palette)); assert.throws(() => encodeGif(4, 4, [new Uint8Array(3)], palette));
});
