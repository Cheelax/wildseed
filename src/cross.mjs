// cross(a, b, clutch): two creatures lay an egg, and this is the child that hatches from it. ARCHITECTURE.md,
// "Lineages". Pure: every choice is drawn from genes of the child's lineage, so the same two parents and
// the same egg number always hatch the same child, whichever order the parents come in.
//
// A child takes its species from one parent and its affinity from one parent. Its body is inherited part
// by part (one parent's ears, the other's tail), its coat is one parent's colors tinted by the other's,
// its name joins the front of one parent's name to the ending of the other's, and now and then a part
// mutates. genomeOf(lineage) hatches every child through here.
import { CLUTCH_MAX, MUTATION_ONE_IN, RARE_CHILD_ONE_IN, STATS } from "./rules.mjs";
import { isCross, readLineage, writeCross } from "./lineage.mjs";
import { genesOf } from "./genome/genes.mjs";
import { crossName } from "./genome/names.mjs";
import { crossPalette } from "./genome/palette.mjs";
import { RARE_BONUS, TOTAL, share, totalOf } from "./genome/stats.mjs";
import { at, partsOf, traitSpecs } from "./genome/traits.mjs";

/** The child of genomes `a` and `b` (as genomeOf returns them) from their egg number `clutch`, 1 to 99. */
export function cross(a, b, clutch = 1) {
  if (!Number.isInteger(clutch) || clutch < 1 || clutch > CLUTCH_MAX) throw new RangeError(`an egg's number is a whole number from 1 to ${CLUTCH_MAX}, not ${clutch}`);
  const seed = writeCross(a.seed, b.seed, clutch);
  readLineage(seed); // refuses a child of more than 6 generations, or one written in more than 120 characters
  // The parents in the order its seed writes them: the same child whichever order they come in.
  const written = (g) => (isCross(g.seed) ? `(${g.seed})` : g.seed);
  const [x, y] = written(a) <= written(b) ? [a, b] : [b, a];
  const gene = genesOf(seed);
  const either = (name) => (gene(name).chance(0.5) ? y : x);

  const { species } = either("species");
  const { affinity } = either("affinity");
  const rare = gene("rare").chance(1 / RARE_CHILD_ONE_IN[[x, y].filter((p) => p.rare).length]);
  const front = either("namer");
  const { traits, mutations } = inherit(x, y, species, affinity, gene);
  return {
    seed,
    name: crossName(front, front === x ? y : x, affinity, gene("name")),
    species,
    affinity,
    rare,
    stats: crossStats(x, y, rare, gene),
    palette: crossPalette(x, y, rare, gene("palette")),
    traits,
    parents: [x.seed, y.seed],
    clutch,
    mutations,
  };
}

/**
 * The child's traits, part by part. Each part comes whole from one parent, or, one time in five, with its
 * numbers blended from both; one part in 50 mutates, drawn afresh inside its species' ranges. A parent's
 * part that a child of its species cannot have (a trundle's ears on a hopple) is not passed on, and a
 * number from another species is brought inside the child's own range.
 */
function inherit(x, y, species, affinity, gene) {
  const specs = traitSpecs(species, affinity);
  const traits = { voice: {} };
  const mutations = [];
  for (const [part, paths] of Object.entries(partsOf(species))) {
    const d = gene(`part ${part}`);
    const mutant = d.chance(1 / MUTATION_ONE_IN);
    const way = d.pick({ x: 2, y: 2, blend: 1 });
    const t = d.next();
    for (const path of paths) {
      const spec = at(specs, path);
      const value = mutant ? spec.draw(gene(`mutant ${path}`), traits) : passOn(spec, at(x.traits, path), at(y.traits, path), way, t);
      if (mutant) mutations.push(path);
      const keys = path.split(".");
      keys.slice(0, -1).reduce((o, k) => o[k], traits)[keys.at(-1)] = value;
    }
  }
  return { traits: inOrder(specs, traits), mutations };
}

/** What a part's trait passes on: x's value, y's, or a blend of their numbers, as far as the child can hold it. */
function passOn(spec, vx, vy, way, t) {
  const usable = (v) => v !== undefined && (spec.holds(v) || (spec.clamp !== undefined && typeof v === "number"));
  const fit = (v) => (spec.clamp ? spec.clamp(v) : v);
  if (!usable(vx)) return fit(vy);
  if (!usable(vy)) return fit(vx);
  if (way === "x") return fit(vx);
  if (way === "y") return fit(vy);
  return spec.blend ? fit(spec.blend(vx, vy, t)) : t < 0.5 ? vx : vy;
}

/** `traits` with its keys in the order of `specs`, the order a genome lists them in. */
function inOrder(specs, traits) {
  return Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, typeof s.draw === "function" ? traits[k] : inOrder(s, traits[k])]));
}

/** The child's stats: its parents' totals averaged and nudged (more when it is rare), shared in their proportions. */
function crossStats(x, y, rare, gene) {
  const plain = (p) => totalOf(p.stats) - (p.rare ? RARE_BONUS : 0);
  const total = Math.min(TOTAL[1], Math.max(TOTAL[0], Math.round((plain(x) + plain(y)) / 2) + gene("total").int(-10, 10)));
  const weight = STATS.map((k) => (x.stats[k] + y.stats[k] - 18) * gene(k).num(0.85, 1.15));
  return share(total + (rare ? RARE_BONUS : 0), weight);
}
