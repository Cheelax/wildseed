// A creature's traits: the knobs every species has, then its species' own (species.mjs). The spec of a
// creature's traits is a tree shaped like the traits themselves, each leaf a kind (kinds.mjs) drawn from
// the gene of its name. Round 1 draws a word's traits from it; crossing reads it to keep a child's traits
// inside its species' ranges.
import { chance, int, num, pick } from "./kinds.mjs";
import { HEIRLOOMS, SPECIES } from "./species.mjs";

/** What an affinity can wear on its head or back. A child may wear a charm of its other parent's affinity. */
const CHARMS = {
  moss: { none: 2, sprout: 1, leaf: 1, flower: 1, mushroom: 1 },
  stone: { none: 2, pebble: 1, crystal: 1, stack: 1 },
  spark: { none: 2, bolt: 1, orb: 1, star: 1 },
};
const ANY_CHARM = new Set(Object.values(CHARMS).flatMap(Object.keys));

/** The keys of an heirloom part, and their specs, from the species it comes from. */
const heirloomSpecs = (part) => {
  const { knobs, parts } = SPECIES[HEIRLOOMS[part]];
  return Object.fromEntries(parts[part].map((k) => [k, knobs[k]]));
};

/** The heirlooms a creature of `species` can wear: those none of whose keys it has of its own. */
export function wearable(species) {
  const own = SPECIES[species].knobs;
  return Object.keys(HEIRLOOMS).filter((part) => HEIRLOOMS[part] !== species && SPECIES[HEIRLOOMS[part]].parts[part].every((k) => !(k in own)));
}

/** The heirlooms a genome wears: the wearable parts whose keys are all in its traits. */
export const heirloomsOf = (genome) => wearable(genome.species).filter((part) => SPECIES[HEIRLOOMS[part]].parts[part].every((k) => k in genome.traits));

/**
 * The spec of the traits of a creature of `species` and `affinity`, in the order a genome lists them, with
 * the `heirlooms` it wears last.
 */
export function traitSpecs(species, affinity, heirlooms = []) {
  const { voice, knobs } = SPECIES[species];
  return {
    size: num(0.88, 1.12),
    build: num(0, 1),
    eyes: pick({ round: 3, tall: 2, gem: 2, sleepy: 1, button: 1 }),
    eyeSize: num(0.85, 1.2),
    eyeGap: num(0.85, 1.15),
    mouth: pick(["smile", "cat", "open", "fang", "beam"]),
    cheeks: chance(0.55),
    marking: pick({ none: 2, spots: 2, stripes: 2, patch: 1, mask: 1, socks: 1 }),
    charm: { ...pick(CHARMS[affinity]), holds: (v) => ANY_CHARM.has(v) },
    mood: pick(["bouncy", "sleepy", "curious", "shy", "proud"]),
    voice: {
      // Bigger bodies sing lower: the pitch, in Hz, follows the size drawn before it.
      pitch: { ...int(100, 2000), draw: (d, traits) => Math.round((voice * d.num(0.85, 1.2)) / traits.size) },
      notes: int(1, 3),
      contour: pick(["rise", "fall", "hop", "trill"]),
      vowel: pick(["a", "e", "i", "o", "u"]),
    },
    ...knobs,
    ...Object.assign({}, ...heirlooms.map(heirloomSpecs)),
  };
}

/** What a child inherits whole, part by part: every creature's parts, then its species' own and its heirlooms. */
export function partsOf(species, heirlooms = []) {
  return {
    body: ["size", "build"],
    eyes: ["eyes", "eyeSize", "eyeGap"],
    mouth: ["mouth"],
    cheeks: ["cheeks"],
    markings: ["marking"],
    charm: ["charm"],
    mood: ["mood"],
    voice: ["voice.pitch", "voice.notes", "voice.contour", "voice.vowel"],
    ...SPECIES[species].parts,
    ...Object.fromEntries(heirlooms.map((part) => [part, SPECIES[HEIRLOOMS[part]].parts[part]])),
  };
}

const isKind = (spec) => typeof spec.draw === "function";

/** Draws a word's traits from its genes, each from the gene named after it, as round 1 did. */
export function drawTraits(specs, gene, traits = {}, into = traits) {
  for (const [name, spec] of Object.entries(specs)) {
    into[name] = isKind(spec) ? spec.draw(gene(name), traits) : drawTraits(spec, gene, traits, {});
  }
  return into;
}

/** The value at a dotted path ("voice.pitch") of an object, or undefined. */
export const at = (object, path) => path.split(".").reduce((o, k) => o?.[k], object);
