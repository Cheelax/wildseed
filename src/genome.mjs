import { SEED_MAX, SEED_PATTERN, AFFINITIES, STATS, RARE_ONE_IN } from './rules.mjs';

export const SPECIES = ['bellfin', 'bramblebun', 'lanternmoth', 'pebblepup', 'sproutling', 'tumbletoad'];
const palettes = {
  moss: ['#152b28', '#3d6b50', '#80b877', '#d5e9a5', '#faf2d2', '#e49a75'],
  stone: ['#26253c', '#585b7d', '#929cba', '#d3d6dc', '#fff0d4', '#e9ac9e'],
  spark: ['#342244', '#975d79', '#e5a171', '#f5d590', '#fff4d9', '#e9838d'],
};

export function normalizeSeed(seed) {
  if (typeof seed !== 'string') throw new TypeError('seed must be a word or short phrase');
  const normalized = seed.normalize('NFC').toLowerCase().trim().replace(/\s+/gu, ' ');
  if (![...normalized].length || [...normalized].length > SEED_MAX || !SEED_PATTERN.test(normalized)) {
    throw new Error(`Invalid seed ${JSON.stringify(seed)}: use 1–24 letters, marks, digits, spaces, hyphens or apostrophes`);
  }
  return normalized;
}

/** Genome version 1 is a permanent mapping. New rounds may append fields, never reinterpret these. */
export function genomeOf(seed) {
  const normalized = normalizeSeed(seed);
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(`wildseed/v1:${normalized}`)) { hash = Math.imul(hash ^ byte, 16777619) >>> 0; }
  let state = hash;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return (n ^ n >>> 14) >>> 0;
  };
  const species = SPECIES[next() % SPECIES.length], affinity = AFFINITIES[next() % AFFINITIES.length];
  const rare = next() % RARE_ONE_IN === 0;
  const starts = ['Lu', 'Mo', 'Bri', 'Pe', 'Ta', 'Fi', 'No', 'Wim', 'O', 'Za', 'Clo', 'Tu'];
  const ends = ['mble', 'flet', 'nook', 'belle', 'tini', 'lo', 'spri', 'mori', 'puff', 'dle', 'vi', 'nna'];
  const name = starts[next() % starts.length] + ends[next() % ends.length];
  const stats = Object.fromEntries(STATS.map((key) => [key, 40 + next() % 26]));
  const palette = [...palettes[affinity]];
  if (rare) { palette[1] = '#9569bd'; palette[2] = '#d7a6f3'; palette[3] = '#ffdb82'; }
  return { version: 1, seed: normalized, name, species, affinity, rare, stats, palette,
    traits: { body: 85 + next() % 31, ears: 80 + next() % 41, tail: 80 + next() % 41,
      eyes: next() % 3, marking: next() % 4, crest: 1 + next() % 3, voice: next() % 12, signature: hash.toString(16).padStart(8, '0') } };
}
