// genomeOf(lineage): the creature a word hatches, or the child a lineage names. Pure and deterministic;
// ARCHITECTURE.md, "The genome" and "Lineages".
//
// Every field draws from genes named after it (src/genome/genes.mjs), so a field never depends on the
// order in which the others are drawn, and later rounds can add genes without changing a creature.
import { AFFINITIES, RARE_ONE_IN, STATS } from "./rules.mjs";
import { cross } from "./cross.mjs";
import { parseLineage } from "./lineage.mjs";
import { genesOf } from "./genome/genes.mjs";
import { nameOf } from "./genome/names.mjs";
import { paletteOf } from "./genome/palette.mjs";
import { SPECIES } from "./genome/species.mjs";
import { share } from "./genome/stats.mjs";
import { traitsOf } from "./genome/traits.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { LineageError, lineageOf, lineageProblem, parseLineage, wordsOf } from "./lineage.mjs";
export { cross, SPECIES };

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

/** The genome of a lineage: a word's creature, or the child of a cross, whose parents are crossed first. */
export function genomeOf(text) {
  return hatch(parseLineage(text));
}

/** The creature of a lineage tree. */
const hatch = (node) => ("word" in node ? wordGenome(node.word) : cross(hatch(node.a), hatch(node.b), node.clutch));

/** Round 1's creature of a word (a normalized seed). */
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
    traits: traitsOf(species, affinity, gene),
  };
}

/**
 * Four stats from 10 to 100 that add up to the creature's total (175 to 250, 25 more when rare), shared by
 * the species' weights, each nudged by its own gene.
 */
function statsOf(profile, affinity, rare, gene) {
  const total = gene("total").int(175, 250) + (rare ? 25 : 0);
  return share(total, STATS.map((k) => (profile[k] + (LEAN[affinity] === k ? 1 : 0)) * gene(k).num(0.75, 1.25)));
}
