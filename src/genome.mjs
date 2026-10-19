import { AFFINITIES, SEED_MAX, SEED_PATTERN, STATS } from './rules.mjs';

// Version 1 is permanent: new rounds may add fields, but must retain this mapping.
export const SPECIES = ['spriglet', 'craggle', 'flutterseed', 'mushling', 'bloomkin', 'embercurl'];

export function normalizeSeed(value) {
  if (typeof value !== 'string') throw new Error('A seed must be a word or a short phrase.');
  const seed = value.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!seed) throw new Error(`Seed ${JSON.stringify(value)} is empty. Try a name or a word.`);
  if ([...seed].length > SEED_MAX) throw new Error(`Seed ${JSON.stringify(value)} is too long: use at most ${SEED_MAX} characters.`);
  if (!SEED_PATTERN.test(seed)) throw new Error(`Seed ${JSON.stringify(value)} contains unsupported characters. Use letters, numbers, spaces, - or '.`);
  return seed;
}

// Integer arithmetic, independent of locale, clock, process and argument order.
export function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function stream(seed, channel) {
  let state = hash32(`wildseed:1:${channel}:${seed}`);
  return (n) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

const PALETTES = {
  moss: [
    ['#243b35', '#497d54', '#87b96a', '#d4e6a0', '#f6edc8', '#e79c88', '#182d2b', '#bce4d0'],
    ['#29473e', '#539b88', '#9bd0b0', '#deedbe', '#fff2d4', '#ecb581', '#1c3033', '#a3cb71'],
    ['#4a354a', '#a36681', '#d09bba', '#ead3c3', '#fff0cf', '#a9c681', '#2b2839', '#ddb774'],
  ],
  stone: [
    ['#354153', '#657b91', '#a7bdc5', '#dce3cc', '#fff1cd', '#df947c', '#252e40', '#9db09a'],
    ['#54423e', '#a77e6c', '#d4b69b', '#ead6bb', '#fff2d0', '#a4c8ad', '#332e37', '#dca47e'],
    ['#443c65', '#8179ac', '#bcb1db', '#e4d6df', '#fff0d6', '#dca48b', '#2d2b49', '#a5d5c9'],
  ],
  spark: [
    ['#663c39', '#bd644f', '#ed9b60', '#f6d394', '#fff1cb', '#a6c5ad', '#3b2b35', '#e6afbe'],
    ['#574d35', '#b3984b', '#e4c86d', '#f5e4a6', '#fff2d7', '#df8b74', '#332f35', '#b9ce9d'],
    ['#593d60', '#a873ad', '#daa5d0', '#f0d2d5', '#fff0ce', '#b4cd9c', '#34283e', '#efac8d'],
  ],
};
const START = ['b', 'br', 'c', 'd', 'f', 'fl', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'];
const VOWEL = ['a', 'e', 'i', 'o', 'u', 'ae', 'oo'];
const END = ['ba', 'bi', 'bo', 'da', 'di', 'do', 'fa', 'fi', 'ga', 'gi', 'la', 'li', 'lo', 'ma', 'mi', 'mo', 'na', 'ni', 'no', 'ra', 'ri', 'ro', 'sa', 'si', 'ta', 'ti', 'va', 'vi'];

export function genomeOf(input) {
  const seed = normalizeSeed(input);
  const identity = stream(seed, 'identity'), names = stream(seed, 'name'), body = stream(seed, 'body');
  const species = SPECIES[identity(SPECIES.length)];
  const affinity = AFFINITIES[identity(AFFINITIES.length)];
  const rare = stream(seed, 'rare')(64) === 0;
  const rawName = START[names(START.length)] + VOWEL[names(VOWEL.length)] + END[names(END.length)] + END[names(END.length)];
  const name = rawName[0].toUpperCase() + rawName.slice(1);
  const points = stream(seed, 'stats');
  const values = [30, 30, 30, 30];
  const total = 180 + points(91);
  for (let i = 120; i < total; i++) {
    let k = points(4);
    while (values[k] >= 100) k = (k + 1) % 4;
    values[k]++;
  }
  const palette = [...PALETTES[affinity][stream(seed, 'palette')(3)]];
  if (rare) {
    palette[1] = '#b58943'; palette[2] = '#ebca78'; palette[3] = '#fff0b4'; palette[5] = '#a7dfd2';
  }
  const range = (min, max) => (min + body(max - min + 1)) / 1000;
  return {
    seed, name, species, affinity, rare,
    stats: Object.fromEntries(STATS.map((k, i) => [k, values[i]])),
    palette,
    traits: {
      version: 1,
      width: range(820, 1190), height: range(870, 1170), head: range(900, 1170),
      ears: range(760, 1320), tail: range(780, 1260), eyes: range(850, 1150),
      markings: body(4), ornament: body(3), phase: body(6283) / 1000,
      temperament: ['bashful', 'bouncy', 'curious', 'dreamy'][body(4)],
      voice: { note: 48 + body(25), shape: body(3), rhythm: 2 + body(3) },
    },
  };
}
