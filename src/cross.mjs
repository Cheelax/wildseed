// Inheritance has no rendering, storage, random global state, or clock dependencies.
import { genesOf } from "./genome/genes.mjs";
import { SPECIES } from "./genome/species.mjs";
import { stemOf } from "./genome/names.mjs";
import { wordGenome, traitsOf } from "./word-genome.mjs";
import { joinParents, parseLineage, parentText } from "./lineage.mjs";
import { MUTATION_ONE_IN, RARE_ONE_IN, STATS } from "./rules.mjs";

export function genomeFromNode(node) {
  return node.parents ? inherit(node, node.parents.map(genomeFromNode)) : wordGenome(node.seed);
}

/** Pure, symmetric crossing. The canonical order governs every gene and source label. */
export function cross(a, b, clutch = 1) {
  const nodes = [parseLineage(a.seed), parseLineage(b.seed)];
  const node = joinParents(...nodes, clutch);
  const parents = parentText(nodes[0]) <= parentText(nodes[1]) ? [a, b] : [b, a];
  return inherit(node, parents);
}

export function traitLeaves(value, prefix = "", out = {}) {
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (v && typeof v === "object" && !Array.isArray(v)) traitLeaves(v, path, out);
    else out[path] = v;
  }
  return out;
}
function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  for (const k of keys) object = object[k] ??= {};
  object[last] = value;
}
const mix = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function inherit(node, [a, b]) {
  const gene = genesOf(`cross:${node.seed}`);
  const body = gene("species").pick([a, b]);
  const species = body.species;
  const affinity = gene("affinity").pick([a.affinity, b.affinity]);
  const rare = gene("rare").chance(a.rare || b.rare ? 1 / 4 : 1 / RARE_ONE_IN);
  // Draw mutations from exactly the original species' authored ranges, never arbitrary noise.
  const fresh = traitLeaves(traitsOf(SPECIES[species], affinity, (key) => gene(`new:${key}`)));
  const at = traitLeaves(a.traits), bt = traitLeaves(b.traits);
  const traits = {}, origins = {}, mutations = [];
  const shape = traitLeaves(body.traits);
  for (const [path, baseline] of Object.entries(shape)) {
    const die = gene(`trait:${path}`);
    let value, source;
    if (die.chance(1 / MUTATION_ONE_IN)) {
      value = fresh[path] ?? baseline;
      source = "mutation";
      mutations.push(path);
    } else {
      // Different species sometimes use the same word for different kinds of knob (ears, tail).
      const candidates = [at[path], bt[path]].map((v, i) => ({ v, i })).filter(({ v }) => typeof v === typeof baseline);
      const picked = die.pick(candidates);
      value = picked.v;
      source = picked.i;
      if (candidates.length === 2 && typeof baseline === "number" && !Number.isInteger(fresh[path])) {
        value = Math.round(mix(at[path], bt[path], die.num(0.2, 0.8)) * 100) / 100;
        value = Math.max(Math.min(at[path], bt[path]), Math.min(Math.max(at[path], bt[path]), value));
        source = at[path] === bt[path] ? "both" : "blend";
      } else if (at[path] === bt[path]) source = "both";
    }
    setPath(traits, path, value);
    origins[path] = source;
  }
  const balance = gene("colors").num(0.12, 0.28);
  const reverse = gene("color-parent").chance(0.5);
  const palette = a.palette.map((c, i) => {
    const x = rgb(c), y = rgb(b.palette[i]);
    // One family color leads; the other warms or cools it. Accents use the reciprocal blend.
    const t = (i === 2) !== reverse ? 1 - balance : balance;
    return "#" + x.map((v, j) => Math.round(mix(v, y[j], t)).toString(16).padStart(2, "0")).join("");
  });
  const t = gene("stats").num(0.25, 0.75);
  const stats = Object.fromEntries(STATS.map((k) => [k, Math.round(mix(a.stats[k], b.stats[k], t))]));
  // One shared weight keeps the total inside its parents' legal totals (rounding corrected at edges).
  let total = Object.values(stats).reduce((x, y) => x + y, 0);
  while (total > 280) { for (const k of STATS) if (total > 280 && stats[k] > 10) { stats[k]--; total--; } }
  while (total < 160) { for (const k of STATS) if (total < 160 && stats[k] < 100) { stats[k]++; total++; } }
  const stems = [a, b].map((p) => stemOf(p.name.toLowerCase()).slice(0, 5));
  const ending = ["", "i", "o", "el", "en", "ie"][(node.clutch - 1) % 6];
  const name = (stems[0] + stems[1] + ending).slice(0, 12).padEnd(3, "i");
  return {
    seed: node.seed, name: name[0].toUpperCase() + name.slice(1), species, affinity, rare,
    stats, palette, traits, parents: [a.seed, b.seed], clutch: node.clutch, mutations, origins,
  };
}
