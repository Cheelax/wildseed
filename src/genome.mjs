// genomeOf(lineage): the creature a seed hatches. Pure and deterministic; ARCHITECTURE.md, "The genome"
// and "Lineages". A word hatches the creature round 1 gave it; a cross hatches its parents' child.
//
// Every field of a word's genome draws from genes named after it (src/genome/genes.mjs), so a field never
// depends on the order in which the others are drawn, and later rounds can add genes without changing a
// creature.
import { AFFINITIES, RARE_ONE_IN, STATS } from "./rules.mjs";
import { readLineage } from "./lineage.mjs";
import { cross } from "./cross.mjs";
import { genesOf } from "./genome/genes.mjs";
import { nameOf } from "./genome/names.mjs";
import { paletteOf } from "./genome/palette.mjs";
import { SPECIES } from "./genome/species.mjs";
import { RARE_BONUS, TOTAL, share } from "./genome/stats.mjs";
import { drawTraits, traitSpecs } from "./genome/traits.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { canonical, LineageError, readLineage } from "./lineage.mjs";
export { SPECIES };

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

/** The genome of a lineage, a word or a cross. Throws a LineageError that says what is wrong with a bad one. */
export function genomeOf(text) {
  return hatch(readLineage(text));
}

const hatch = (tree) => ("word" in tree ? wordGenome(tree.word) : cross(hatch(tree.a), hatch(tree.b), tree.clutch));

/** A word's creature, as round 1 hatched it. */
function wordGenome(seed) {
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
    traits: drawTraits(traitSpecs(species, affinity), gene),
  };
}

/**
 * Four stats from 10 to 100 that add up to the creature's total (175 to 250, 25 more when rare), shared
 * by the species' weights, each nudged by its own gene; the affinity leans one stat.
 */
function statsOf(profile, affinity, rare, gene) {
  const total = gene("total").int(...TOTAL) + (rare ? RARE_BONUS : 0);
  return share(total, STATS.map((k) => (profile[k] + (LEAN[affinity] === k ? 1 : 0)) * gene(k).num(0.75, 1.25)));
}
