// Heredity: how a child takes its traits from its two parents. ARCHITECTURE.md, "Crossing".
//
// The child has the body of one parent (its species) and every trait of that parent. Where the other parent
// has the same kind of trait, the child takes it from either, a group at a time: one parent's ears, the
// other's tail, its mother's eyes and its father's song, sizes in between. A parent of another species can
// also pass on a part the child's body has no place of its own for: horns, wings, a tail. Then each trait
// mutates now and then, drawn afresh inside the ranges that keep a species appealing.
import { MUTATION_ONE_IN } from "../rules.mjs";
import { draw, fits } from "./genes.mjs";
import { SPECIES } from "./species.mjs";
import { CHARMS, traitsOf } from "./word.mjs";

/** Traits that come together: a child takes a whole group from one parent. Any other trait is a group of its own. */
const GROUPS = [
  ["eyes", "eyeSize", "eyeGap"],
  ["voice.notes", "voice.contour", "voice.vowel"],
  ["crest", "crestLength"],
  ["ears", "earLength"],
  ["horns", "hornLength"],
  ["antennae", "antennaLength"],
  ["wings", "wingShape"],
  ["tail", "tailTip", "spines"],
  ["tentacles", "tentacleLength", "curl"],
  ["spikes", "spikeLength", "spikeTip"],
  ["shell", "shellPattern"],
];
export const groupOf = (path) => GROUPS.find((g) => g.includes(path)) ?? [path];

/**
 * The places on a body where a part sits, and the traits that make the parts. A child of two species takes
 * the other parent's part for a place where its own body has nothing, half the time.
 */
export const SLOTS = {
  crown: ["crest", "crestLength", "horns", "hornLength", "antennae", "antennaLength", "antenna"],
  ears: ["ears", "earLength"],
  back: ["wings", "wingShape", "ridge"],
  tail: ["tail", "tailTip", "spines", "tailFeathers", "tailPuff"],
};
/** A pipkin's wings are nubs on a round bird: nothing another body could wear. */
const KEPT = { pipkin: ["back"] };

/** The knobs that could draw each trait: the ones every species has (word.mjs), then each species' own. */
const COMMON = {
  size: ["num", 0.88, 1.12], build: ["num", 0, 1], eyes: ["pick", ["round", "tall", "gem", "sleepy", "button"]],
  eyeSize: ["num", 0.85, 1.2], eyeGap: ["num", 0.85, 1.15], mouth: ["pick", ["smile", "cat", "open", "fang", "beam"]],
  cheeks: ["chance", 0.55], marking: ["pick", ["none", "spots", "stripes", "patch", "mask", "socks"]],
  charm: ["pick", [...new Set(Object.values(CHARMS).flatMap(Object.keys))]],
  mood: ["pick", ["bouncy", "sleepy", "curious", "shy", "proud"]], "voice.pitch": ["int", 200, 1100],
  "voice.notes": ["int", 1, 3], "voice.contour": ["pick", ["rise", "fall", "hop", "trill"]], "voice.vowel": ["pick", ["a", "e", "i", "o", "u"]],
};
const KNOBS = new Map(Object.entries(COMMON).map(([path, knob]) => [path, [knob]]));
for (const { knobs } of Object.values(SPECIES)) for (const [k, knob] of Object.entries(knobs)) KNOBS.set(k, [...(KNOBS.get(k) ?? []), knob]);

/** Whether two values are the same kind of trait, one knob could draw both: a hopple's "lop" ears and a trundle's "round" ones are not. */
const alike = (path, v, w) => (KNOBS.get(path) ?? []).some((knob) => fits(knob, v) && fits(knob, w));

/** Every value of an object by its dotted path ("voice.pitch"), in order. */
export function leaves(object, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, path, out);
    else out.set(path, v);
  }
  return out;
}

/** The object back from its paths. */
function nest(paths) {
  const out = {};
  for (const [path, v] of paths) {
    const keys = path.split(".");
    let at = out;
    for (const k of keys.slice(0, -1)) at = at[k] ??= {};
    at[keys.at(-1)] = v;
  }
  return out;
}

/** Whether a place of a body holds a part that shows (a drift's antenna "none" does not). */
const holds = (traits, slot) => SLOTS[slot].some((k) => traits.has(k) && traits.get(k) !== "none");

const round2 = (x) => Math.round(x * 100) / 100;

/** A number between two parents' numbers: one of them, or a blend (whole numbers stay whole). */
function between(v, w, d) {
  const t = d.pick([0, 1, d.num(0.2, 0.8)]);
  const x = v + (w - v) * t;
  return Number.isInteger(v) && Number.isInteger(w) ? Math.round(x) : round2(x);
}

/**
 * The traits of a child whose body is `main`'s, its other parent `other`, with its `affinity` and genes:
 * { traits, mutations }.
 */
export function inherit(main, other, affinity, gene) {
  const mine = leaves(main.traits), theirs = leaves(other.traits);
  const child = new Map(mine);

  // Where both parents have a trait of the same kind, the child takes it, with its group, from either.
  for (const path of mine.keys()) {
    const group = groupOf(path).filter((p) => mine.has(p));
    if (path !== group[0]) continue;
    if (!group.every((p) => theirs.has(p) && alike(p, mine.get(p), theirs.get(p)))) continue;
    const v = mine.get(path), w = theirs.get(path);
    if (group.length === 1 && typeof v === "number") child.set(path, between(v, w, gene(`blend.${path}`)));
    else if (gene(`from.${path}`).chance(0.5)) for (const p of group) child.set(p, theirs.get(p));
  }

  // The other parent's own traits: all of them from a parent of the same species, else a part now and then.
  if (main.species === other.species) {
    for (const [path, w] of theirs) if (!child.has(path)) child.set(path, w);
  } else {
    for (const slot of Object.keys(SLOTS)) {
      if (holds(mine, slot) || !holds(theirs, slot) || KEPT[other.species]?.includes(slot)) continue;
      if (!gene(`part.${slot}`).chance(0.5)) continue;
      for (const k of SLOTS[slot]) if (theirs.has(k) && !child.has(k)) child.set(k, theirs.get(k));
    }
  }

  // Now and then a trait mutates: drawn afresh, unlike either parent's.
  const mutations = [];
  for (const [path, value] of child) {
    if (!gene(`mutation.${path}`).chance(1 / MUTATION_ONE_IN)) continue;
    const fresh = mutant(path, value, [mine.get(path), theirs.get(path)], main.species, affinity, gene);
    if (fresh === undefined) continue;
    child.set(path, fresh);
    mutations.push(path);
  }
  return { traits: nest(child), mutations };
}

/**
 * A fresh value for a trait, unlike its parents' (a number outside theirs where it can be), drawn the way the
 * species draws it, or the species the part comes from. Undefined when eight draws find none.
 */
function mutant(path, value, parents, species, affinity, gene) {
  const known = parents.filter((p) => p !== undefined);
  const nums = known.filter((p) => typeof p === "number");
  const own = path in COMMON || path in SPECIES[species].knobs;
  const knob = KNOBS.get(path)?.find((k) => fits(k, value));
  for (let attempt = 0; attempt < 8; attempt++) {
    const fresh = (name) => gene(`fresh${attempt}.${name}`);
    const v = own ? leaves(traitsOf(SPECIES[species], affinity, fresh)).get(path) : draw(fresh(path), knob);
    if (v === undefined) return undefined;
    const unlike = typeof v === "number" && nums.length ? v < Math.min(...nums) || v > Math.max(...nums) : !known.includes(v);
    if (unlike) return v;
  }
  return undefined;
}

/**
 * Where each trait of a child came from, by group: "a" or "b" (its parents, in the order its seed writes
 * them), "both" where they agree, "blend" for a number in between, "mutation". [{ paths, from }].
 */
export function heritageOf(child, a, b) {
  const c = leaves(child.traits), x = leaves(a.traits), y = leaves(b.traits);
  const mutated = new Set(child.mutations ?? []);
  const out = [];
  const seen = new Set();
  const same = (p, q) => p !== undefined && JSON.stringify(p) === JSON.stringify(q);
  for (const path of c.keys()) {
    if (seen.has(path)) continue;
    const paths = groupOf(path).filter((p) => c.has(p));
    paths.forEach((p) => seen.add(p));
    let from;
    if (paths.some((p) => mutated.has(p))) from = "mutation";
    else if (paths.every((p) => same(x.get(p), c.get(p)) && same(y.get(p), c.get(p)))) from = "both";
    else if (paths.every((p) => same(x.get(p), c.get(p)))) from = "a";
    else if (paths.every((p) => same(y.get(p), c.get(p)))) from = "b";
    else from = "blend";
    out.push({ paths, from });
  }
  return out;
}
