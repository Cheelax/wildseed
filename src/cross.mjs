// Crossing: two creatures lay an egg, and cross(a, b, clutch) is the child that hatches from their
// `clutch`-th egg. ARCHITECTURE.md, "Crossing".
//
// The child is exactly genomeOf(its lineage): genome.mjs hatches a lineage by crossing its parents here. It is
// pure and symmetric: the parents are first put in the order the child's seed writes them, and every choice
// is drawn from the child's own genes (genes.mjs), so cross(a, b, n) and cross(b, a, n) are one child on every
// machine. Nothing here reads the clock or calls Math.random, and the parents are never changed.
import { RARE_ONE_IN, STATS } from "./rules.mjs";
import { genesOf } from "./genome/genes.mjs";
import { inherit } from "./genome/heredity.mjs";
import { childName } from "./genome/names.mjs";
import { childPalette } from "./genome/palette.mjs";
import { shareStats } from "./genome/word.mjs";
import { crossLineage, lineageOf } from "./lineage.mjs";

/** A parent as the child's seed writes it: a child in parentheses. */
const asParent = (seed) => (seed.includes("*") ? `(${seed})` : seed);

/** The child of genomes `a` and `b`, from their egg number `clutch` (1 to 99). */
export function cross(a, b, clutch = 1) {
  const seed = crossLineage(a.seed, b.seed, clutch);
  const [x, y] = asParent(lineageOf(a.seed)) <= asParent(lineageOf(b.seed)) ? [a, b] : [b, a];
  const gene = genesOf(seed);

  // Its body is one parent's, and its affinity one parent's, not always the same one.
  const [main, other] = gene("body").chance(0.5) ? [y, x] : [x, y];
  const affinity = (gene("affinity").chance(0.5) ? y : x).affinity;
  const rare = gene("rare").chance(rareOdds(x, y));
  const { traits, mutations } = inherit(main, other, affinity, gene);
  return {
    seed,
    name: childName(x.name, y.name, gene("name")),
    species: main.species,
    affinity,
    rare,
    stats: statsOf(x, y, rare, gene),
    palette: childPalette(main, other, affinity, rare, gene("palette")),
    traits,
    parents: [lineageOf(x.seed), lineageOf(y.seed)],
    clutch,
    mutations,
  };
}

/** A child of two common parents is rare 1 time in 64; each rare parent makes it four times likelier. */
const rareOdds = (x, y) => (4 ** (Number(x.rare) + Number(y.rare))) / RARE_ONE_IN;

/**
 * Stats near the parents': a total between theirs (175 to 250, 25 more when rare), shared like the average of
 * their stats, each share nudged by the child's own genes.
 */
function statsOf(x, y, rare, gene) {
  const plain = (g) => Object.values(g.stats).reduce((sum, v) => sum + v, 0) - (g.rare ? 25 : 0);
  const total = Math.min(250, Math.max(175, Math.round((plain(x) + plain(y)) / 2) + gene("total").int(-10, 10)));
  const weights = STATS.map((k) => ((x.stats[k] + y.stats[k]) / 2 - 9) * gene(k).num(0.85, 1.15));
  return shareStats(total + (rare ? 25 : 0), weights);
}
