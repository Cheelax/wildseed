// cross(a, b, clutch): two genomes lay an egg. Pure and deterministic; ARCHITECTURE.md, "Crossing".
import { genomeOf } from "./genome.mjs";

/** A parent written as a lineage fragment: wrap children in parentheses. */
const side = (g) => (Array.isArray(g.parents) ? `(${g.seed})` : g.seed);

/**
 * Returns the child of two genomes, exactly `genomeOf` of their lineage.
 * Symmetric: cross(a, b, n) === cross(b, a, n). Pure: never mutates arguments, never draws at random.
 */
export function cross(a, b, clutch = 1) {
  const n = Number(clutch) || 1;
  return genomeOf(`${side(a)}*${side(b)}${n > 1 ? `#${n}` : ""}`);
}
