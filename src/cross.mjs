// Crossing is data only: all choices are genes of the canonical child's seed.
import { genesOf } from './genome/genes.mjs';
import { SPECIES } from './genome/species.mjs';
import { traitsOf } from './genome/traits.mjs';
import { stemOf } from './genome/names.mjs';
import { blendPalette } from './genome/palette.mjs';
import { parseLineage, writtenForm } from './lineage.mjs';
import { CLUTCH_MIN, CLUTCH_MAX, MUTATION_ONE_IN, CHILD_RARE_ONE_IN, STATS } from './rules.mjs';

export function cross(a, b, clutch = CLUTCH_MIN) {
  if (!Number.isInteger(clutch) || clutch < CLUTCH_MIN || clutch > CLUTCH_MAX) throw new Error(`an egg number is ${CLUTCH_MIN} to ${CLUTCH_MAX}`);
  const side = (g) => g.parents ? `(${g.seed})` : g.seed;
  [a, b] = [a, b].sort((x, y) => side(x) < side(y) ? -1 : side(x) > side(y) ? 1 : 0);
  const seed = writtenForm(parseLineage(`${side(a)}*${side(b)}#${clutch}`));
  const gene = genesOf(seed);
  const species = gene('species').pick([a.species, b.species]);
  const affinity = gene('affinity').pick([a.affinity, b.affinity]);
  const mutations = [], inherited = {};
  const fresh = traitsOf(SPECIES[species], affinity, gene);
  const traits = inherit(fresh, a.traits, b.traits, gene, mutations, inherited);
  const mix = gene('stats').num(0.2, 0.8);
  const stats = Object.fromEntries(STATS.map(k => [k, Math.floor(a.stats[k] * mix + b.stats[k] * (1 - mix))]));
  const name = stemOf(a.name.toLowerCase()) + b.name.toLowerCase().slice(-gene('name').int(3, 5));
  return {
    seed, name: name[0].toUpperCase() + name.slice(1, 12), species, affinity,
    rare: gene('rare').chance(a.rare || b.rare ? 1 / 8 : 1 / CHILD_RARE_ONE_IN),
    stats, palette: blendPalette(a.palette, b.palette, gene('palette').num(0.35, 0.65)), traits,
    parents: [a.seed, b.seed], clutch, mutations, inherited,
  };
}

function inherit(fresh, a, b, gene, mutations, inherited, prefix = '') {
  return Object.fromEntries(Object.entries(fresh).map(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') return [key, inherit(value, a?.[key], b?.[key], gene, mutations, inherited, path)];
    if (gene(`mutation.${path}`).chance(1 / MUTATION_ONE_IN)) {
      mutations.push(path);
      inherited[path] = 'mutation';
      return [key, value];
    }
    const options = [['a', a?.[key]], ['b', b?.[key]]].filter(([, v]) => typeof v === typeof value);
    const [from, picked] = gene(`inherit.${path}`).pick(options);
    inherited[path] = from;
    return [key, picked];
  }));
}
