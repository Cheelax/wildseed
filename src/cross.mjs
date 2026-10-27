// cross(a, b, clutch): two creatures lay an egg, and out comes their child. ARCHITECTURE.md, "Lineages".
//
// The child's seed is its lineage, and every choice draws from the genes of that seed: the same couple and
// the same egg always hatch the same child, in every process. The parents are taken in the order the seed
// writes them, so which one is passed first does not matter. Nothing here touches the parents' genomes.
import { MUTATION_ONE_IN, RARE_CHILD_ONE_IN, STATS } from "./rules.mjs";
import { parseLineage, writeLineage } from "./lineage.mjs";
import { genesOf } from "./genome/genes.mjs";
import { OWN_SLOTS, heirloomsOf, partOf, partsToHandDown, sameHeirloom } from "./genome/heirlooms.mjs";
import { leaves, same, setAt, valueAt } from "./genome/paths.mjs";
import { childName } from "./genome/names.mjs";
import { childPalette } from "./genome/palette.mjs";
import { SPECIES } from "./genome/species.mjs";
import { share } from "./genome/stats.mjs";
import { commonTraits } from "./genome/traits.mjs";

/** A parent as its child's lineage writes it: a word as it is, a child in parentheses. */
const asParent = (g) => (g.parents ? `(${g.seed})` : g.seed);

/** The child of genomes `a` and `b` (words' or children's, as genomeOf returns them), from their egg `clutch`. */
export function cross(a, b, clutch = 1) {
  const lineage = parseLineage(`${asParent(a)}*${asParent(b)}#${clutch}`);
  const seed = writeLineage(lineage);
  const [x, y] = asParent(a) <= asParent(b) ? [a, b] : [b, a];
  const gene = genesOf(seed);
  const either = (name) => (gene(name).chance(0.5) ? y : x);

  const species = either("species").species;
  const affinity = either("affinity").affinity;
  const rare = gene("rare").chance(1 / RARE_CHILD_ONE_IN[[x, y].filter((p) => p.rare).length]);
  const heirlooms = heirloomsFor(species, x, y, gene("heirlooms"));
  const { traits, mutations } = inherit({ seed, species, affinity, heirlooms }, x, y, gene);
  return {
    seed,
    name: childName(x.name, y.name, gene("name")),
    species,
    affinity,
    rare,
    stats: statsOf(x, y, rare, gene),
    palette: childPalette(x.palette, y.palette, affinity, rare, gene("palette")),
    traits,
    parents: [x.seed, y.seed],
    clutch: lineage.clutch,
    mutations,
    heirlooms,
  };
}

/**
 * The parts of other species the child carries: every heirloom of its parents of its own species (it keeps all
 * their traits), and, when its other parent is of another species, one of that parent's parts, sometimes two,
 * in slots its body leaves free.
 */
function heirloomsFor(species, x, y, d) {
  const kept = [];
  for (const p of [x, y].filter((p) => p.species === species)) {
    for (const h of heirloomsOf(p)) if (!kept.some((k) => sameHeirloom(h, k))) kept.push(h);
  }
  const other = [x, y].find((p) => p.species !== species);
  if (!other) return kept;
  const taken = new Set([...OWN_SLOTS[species], ...kept.map((h) => partOf(h).slot)]);
  const offered = partsToHandDown(other)
    .filter((h) => h.species !== species && !taken.has(partOf(h).slot) && !kept.some((k) => sameHeirloom(h, k)));
  const added = [];
  for (let n = 0; n < 2 && offered.length && (n === 0 || d.chance(0.35)); n++) {
    const h = d.pick(offered);
    added.push(h);
    offered.splice(0, offered.length, ...offered.filter((o) => partOf(o).slot !== partOf(h).slot));
  }
  return [...kept, ...added];
}

/** Each species' own trait names. */
const KNOBS = Object.fromEntries(Object.entries(SPECIES).map(([id, s]) => [id, new Set(Object.keys(s.knobs(genesOf(""))))]));

/** What each trait of a creature is, by its dotted path: "common" to every species, or a species' own. */
function meanings(g) {
  const m = new Map();
  for (const [path] of leaves(g.traits)) m.set(path, KNOBS[g.species].has(path) ? g.species : "common");
  for (const h of heirloomsOf(g)) for (const t of partOf(h).traits) m.set(t, h.species);
  return m;
}

/**
 * The child's traits: those every species has, its species' own, then its heirlooms'. Each comes from a parent
 * that has it with the same meaning: from one of them, or, for a number, halfway between. Then each trait
 * mutates 1 time in MUTATION_ONE_IN, drawn afresh inside its species' ranges.
 */
function inherit({ seed, species, affinity, heirlooms }, x, y, gene) {
  const mx = meanings(x), my = meanings(y);
  const layout = new Map(); // every trait the child has, by path, and what it is
  for (const [m, p] of [[mx, x], [my, y]]) {
    if (p.species === species) for (const [path, what] of m) if (!layout.has(path)) layout.set(path, what);
  }
  for (const h of heirlooms) for (const t of partOf(h).traits) layout.set(t, h.species);

  const traits = {}, mutations = [];
  for (const [path, what] of layout) {
    const from = [[mx, x], [my, y]].filter(([m]) => m.get(path) === what).map(([, p]) => valueAt(p.traits, path));
    let value = from.length === 1 ? from[0] : pass(from[0], from[1], gene(`trait.${path}`));
    if (gene(`mutation.${path}`).chance(1 / MUTATION_ONE_IN)) {
      value = mutated(path, what, value, { seed, species, affinity });
      mutations.push(path);
    }
    setAt(traits, path, value);
  }
  return { traits, mutations };
}

/** One parent's value or the other's, or, for two numbers, halfway between them. */
function pass(v, w, d) {
  if (same(v, w)) return v;
  if (typeof v === "number" && typeof w === "number" && d.chance(0.2)) {
    const mid = (v + w) / 2;
    return Number.isInteger(v) && Number.isInteger(w) ? Math.round(mid) : Math.round(mid * 100) / 100;
  }
  return d.chance(0.5) ? v : w;
}

/** A trait drawn afresh, as a creature of the child's species and affinity would draw it, and never the old value. */
function mutated(path, what, old, { seed, species, affinity }) {
  let value = old;
  for (let attempt = 0; attempt < 8 && same(value, old); attempt++) {
    const gene = genesOf(`${seed}\u0000mutation ${attempt}`);
    value = valueAt(what === "common" ? commonTraits(species, affinity, gene) : SPECIES[what].knobs(gene), path);
  }
  return value;
}

/**
 * The child's stats: a total between its parents' (25 more when rare), shared by weights between theirs.
 */
function statsOf(x, y, rare, gene) {
  const base = (g) => STATS.reduce((sum, k) => sum + g.stats[k], 0) - (g.rare ? 25 : 0);
  const total = Math.round(base(x) + (base(y) - base(x)) * gene("total").num(0, 1));
  const weights = STATS.map((k) => x.stats[k] + (y.stats[k] - x.stats[k]) * gene(k).num(0.2, 0.8) - 9);
  return share(Math.min(250, Math.max(175, total)) + (rare ? 25 : 0), weights);
}
