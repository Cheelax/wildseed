// One public entry point for words and recursively inherited creatures.
import { parseLineage } from "./lineage.mjs";
import { genomeFromNode } from "./cross.mjs";
export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { SPECIES } from "./genome/species.mjs";
export function genomeOf(text) { return genomeFromNode(parseLineage(text)); }
