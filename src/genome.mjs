// genomeOf(seed): the creature a seed hatches. Pure and deterministic; ARCHITECTURE.md, "The genome".
//
// Every field draws from genes named after it (src/genome/genes.mjs), so a field never depends on the
// order in which the others are drawn, and later rounds can add genes without changing a creature.
import { AFFINITIES, RARE_ONE_IN, STAT_RANGE, STATS } from "./rules.mjs";
import { parseLineage, writtenForm } from "./lineage.mjs";
import { cross } from "./cross.mjs";
import { genesOf } from "./genome/genes.mjs";
import { nameOf } from "./genome/names.mjs";
import { paletteOf } from "./genome/palette.mjs";
import { traitsOf } from "./genome/traits.mjs";
import { SPECIES } from "./genome/species.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { SPECIES };

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

export function genomeOf(text) {
  const node = parseLineage(text);
  if ("a" in node) return cross(genomeOf(writtenForm(node.a)), genomeOf(writtenForm(node.b)), node.clutch);
  const seed = node.word;
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
