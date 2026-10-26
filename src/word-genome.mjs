// genomeOf(seed): the creature a seed hatches. Pure and deterministic; ARCHITECTURE.md, "The genome".
//
// Every field draws from genes named after it (src/genome/genes.mjs), so a field never depends on the
// order in which the others are drawn, and later rounds can add genes without changing a creature.
import { AFFINITIES, RARE_ONE_IN, STAT_RANGE, STATS } from "./rules.mjs";
import { parseSeed } from "./seed.mjs";
import { genesOf } from "./genome/genes.mjs";
import { nameOf } from "./genome/names.mjs";
import { paletteOf } from "./genome/palette.mjs";
import { SPECIES } from "./genome/species.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { SPECIES };

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

/** What an affinity can wear on its head or back. */
const CHARMS = {
  moss: { none: 2, sprout: 1, leaf: 1, flower: 1, mushroom: 1 },
  stone: { none: 2, pebble: 1, crystal: 1, stack: 1 },
  spark: { none: 2, bolt: 1, orb: 1, star: 1 },
};

export function wordGenome(text) {
  const seed = parseSeed(text);
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
  const [min, max] = STAT_RANGE;
  const total = gene("total").int(175, 250) + (rare ? 25 : 0);
  const weight = STATS.map((k) => (profile[k] + (LEAN[affinity] === k ? 1 : 0)) * gene(k).num(0.75, 1.25));
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
  const size = gene("size").num(0.88, 1.12);
  return {
    size,
    build: gene("build").num(0, 1),
    eyes: gene("eyes").pick({ round: 3, tall: 2, gem: 2, sleepy: 1, button: 1 }),
    eyeSize: gene("eyeSize").num(0.85, 1.2),
    eyeGap: gene("eyeGap").num(0.85, 1.15),
    mouth: gene("mouth").pick(["smile", "cat", "open", "fang", "beam"]),
    cheeks: gene("cheeks").chance(0.55),
    marking: gene("marking").pick({ none: 2, spots: 2, stripes: 2, patch: 1, mask: 1, socks: 1 }),
    charm: gene("charm").pick(CHARMS[affinity]),
    mood: gene("mood").pick(["bouncy", "sleepy", "curious", "shy", "proud"]),
    voice: {
      pitch: Math.round((species.voice * gene("pitch").num(0.85, 1.2)) / size),
      notes: gene("notes").int(1, 3),
      contour: gene("contour").pick(["rise", "fall", "hop", "trill"]),
      vowel: gene("vowel").pick(["a", "e", "i", "o", "u"]),
    },
    ...species.knobs(gene),
  };
}
