// A word's creature: round 1's genome, which never changes. ARCHITECTURE.md, "The genome".
//
// Every field draws from genes named after it (genes.mjs), so a field never depends on the order in which
// the others are drawn, and later rounds can add genes without changing a creature.
import { AFFINITIES, RARE_ONE_IN, STAT_RANGE, STATS } from "../rules.mjs";
import { draw, genesOf } from "./genes.mjs";
import { nameOf } from "./names.mjs";
import { paletteOf } from "./palette.mjs";
import { SPECIES } from "./species.mjs";

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

/** What an affinity can wear on its head or back. */
export const CHARMS = {
  moss: { none: 2, sprout: 1, leaf: 1, flower: 1, mushroom: 1 },
  stone: { none: 2, pebble: 1, crystal: 1, stack: 1 },
  spark: { none: 2, bolt: 1, orb: 1, star: 1 },
};

/**
 * The knobs every species has, each drawn from the seed's gene of its name like a species' own (species.mjs).
 * The charm draws from its affinity's CHARMS, and the voice's pitch from the species' voice and the size.
 */
export const KNOBS = {
  size: ["num", 0.88, 1.12],
  build: ["num", 0, 1],
  eyes: ["pick", { round: 3, tall: 2, gem: 2, sleepy: 1, button: 1 }],
  eyeSize: ["num", 0.85, 1.2],
  eyeGap: ["num", 0.85, 1.15],
  mouth: ["pick", ["smile", "cat", "open", "fang", "beam"]],
  cheeks: ["chance", 0.55],
  marking: ["pick", { none: 2, spots: 2, stripes: 2, patch: 1, mask: 1, socks: 1 }],
  mood: ["pick", ["bouncy", "sleepy", "curious", "shy", "proud"]],
  "voice.notes": ["int", 1, 3],
  "voice.contour": ["pick", ["rise", "fall", "hop", "trill"]],
  "voice.vowel": ["pick", ["a", "e", "i", "o", "u"]],
};

/** The genome of a word, a seed already normalized and checked (seed.mjs). */
export function wordGenome(seed) {
  const gene = genesOf(seed);
  const species = gene("species").pick(Object.keys(SPECIES));
  const affinity = gene("affinity").pick(AFFINITIES);
  const rare = gene("rare").chance(1 / RARE_ONE_IN);
  return {
    seed,
    name: nameOf(seed, affinity, gene("name")),
    species,
    affinity,
    rare,
    stats: statsOf(SPECIES[species].stats, affinity, rare, gene),
    palette: paletteOf(affinity, rare, gene("palette")),
    traits: traitsOf(SPECIES[species], affinity, gene),
  };
}

/**
 * Four stats from 10 to 100 that add up to the creature's total (175 to 250, 25 more when rare). The
 * points above 10 are shared one at a time by the species' weights, each nudged by its own gene.
 */
function statsOf(profile, affinity, rare, gene) {
  const total = gene("total").int(175, 250) + (rare ? 25 : 0);
  return shareStats(total, STATS.map((k) => (profile[k] + (LEAN[affinity] === k ? 1 : 0)) * gene(k).num(0.75, 1.25)));
}

/** Shares `total` points between the four stats by their weights: each starts at 10, none passes 100. */
export function shareStats(total, weight) {
  const [min, max] = STAT_RANGE;
  const points = STATS.map(() => min);
  for (let left = total - STATS.length * min; left > 0; left--) {
    // The next point goes to the stat with the most weight per point it already holds (D'Hondt).
    let best = -1;
    for (let i = 0; i < STATS.length; i++) {
      if (points[i] >= max) continue;
      if (best < 0 || weight[i] / (points[i] - min + 1) > weight[best] / (points[best] - min + 1)) best = i;
    }
    points[best]++;
  }
  return Object.fromEntries(STATS.map((k, i) => [k, points[i]]));
}

/** The knobs of the body and face: the ones every species has, then the species' own. */
export function traitsOf(species, affinity, gene) {
  const knob = (name, path = name) => draw(gene(name), KNOBS[path]);
  const size = knob("size");
  return {
    size,
    build: knob("build"),
    eyes: knob("eyes"),
    eyeSize: knob("eyeSize"),
    eyeGap: knob("eyeGap"),
    mouth: knob("mouth"),
    cheeks: knob("cheeks"),
    marking: knob("marking"),
    charm: gene("charm").pick(CHARMS[affinity]),
    mood: knob("mood"),
    voice: {
      pitch: Math.round((species.voice * gene("pitch").num(0.85, 1.2)) / size),
      notes: knob("notes", "voice.notes"),
      contour: knob("contour", "voice.contour"),
      vowel: knob("vowel", "voice.vowel"),
    },
    ...Object.fromEntries(Object.entries(species.knobs).map(([name, how]) => [name, draw(gene(name), how)])),
  };
}
