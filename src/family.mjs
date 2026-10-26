// A child's family, read from its genome alone: its parents and grandparents, and where each of its parts
// came from. Pure, like the genome: the page's family tree and the tree's picture are both drawn from it.
import { genomeOf } from "./genome.mjs";
import { at, partsOf } from "./genome/traits.mjs";

/** A creature and its ancestors, `depth` generations back: { genome, parents: [a, b] or null }. */
export function familyOf(genome, depth = 2) {
  const parents = depth > 0 && genome.parents ? genome.parents.map((seed) => familyOf(genomeOf(seed), depth - 1)) : null;
  return { genome, parents };
}

const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);

/** Whose a value is: "a", "b", "both" when the parents share it, or "blend" when it is neither's. */
function whose(v, x, y) {
  if (same(v, x)) return same(v, y) ? "both" : "a";
  return same(v, y) ? "b" : "blend";
}

/** One part's origin from its traits' origins: one parent's, both parents', or a blend of the two. */
function merge(origins) {
  const has = (o) => origins.includes(o);
  if (has("blend") || (has("a") && has("b"))) return "blend";
  return has("a") ? "a" : has("b") ? "b" : "both";
}

/**
 * Where each part of `child` came from, its parents being `a` and `b` in the order of child.parents:
 * [{ part, from }], from "a" or "b" (one parent's), "both" (the parents share it), "blend" (its numbers lie
 * between theirs) or "new" (it mutated). Species, affinity and colors come first, then the body, part by part.
 */
export function originsOf(child, a, b) {
  const mutated = new Set(child.mutations);
  const out = [
    { part: "species", from: whose(child.species, a.species, b.species) },
    { part: "affinity", from: whose(child.affinity, a.affinity, b.affinity) },
    { part: "colors", from: child.rare && !a.rare && !b.rare ? "new" : coat(child, a, b) },
  ];
  for (const [part, paths] of Object.entries(partsOf(child.species))) {
    const from = paths.some((p) => mutated.has(p)) ? "new" : merge(paths.map((p) => whose(at(child.traits, p), at(a.traits, p), at(b.traits, p))));
    out.push({ part, from });
  }
  return out;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const gap = (p, q) => Math.hypot(...rgb(p).map((v, i) => v - rgb(q)[i]));

/** Whose coat a child wears: the parent whose body color is nearer its own (it is tinted by the other's). */
function coat(child, a, b) {
  const [body] = child.palette;
  if (a.palette[0] === b.palette[0]) return "both";
  return gap(body, a.palette[0]) <= gap(body, b.palette[0]) ? "a" : "b";
}
