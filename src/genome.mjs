// genomeOf(lineage): the creature a seed hatches. Pure and deterministic; ARCHITECTURE.md, "The genome" and
// "Lineages". A word hatches round 1's creature, which never changes (genome/word.mjs); a lineage hatches the
// child of its two parents, each hatched the same way, crossed by cross.mjs.
import { cross } from "./cross.mjs";
import { readLineage } from "./lineage.mjs";
import { wordGenome } from "./genome/word.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { LineageError, lineageOf, lineageProblem, readLineage, writeLineage, wordsOf } from "./lineage.mjs";
export { SPECIES } from "./genome/species.mjs";
export { cross };

/** The genome of a word or a lineage, written any way. Throws a SeedError that says why when it is neither. */
export function genomeOf(text) {
  return hatch(readLineage(text));
}

const hatch = (tree) => ("word" in tree ? wordGenome(tree.word) : cross(hatch(tree.a), hatch(tree.b), tree.clutch));
