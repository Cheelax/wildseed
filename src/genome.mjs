// genomeOf(seed): the creature a seed or lineage hatches. Pure and deterministic; ARCHITECTURE.md.
//
// Every field draws from genes named after it (src/genome/genes.mjs), so a field never depends on the
// order in which the others are drawn, and later rounds can add genes without changing a creature.
import { AFFINITIES, RARE_ONE_IN, STAT_RANGE, STATS, MUTATION_ONE_IN } from "./rules.mjs";
import { parseSeed, SeedError } from "./seed.mjs";
import { genesOf } from "./genome/genes.mjs";
import { nameOf } from "./genome/names.mjs";
import { paletteOf } from "./genome/palette.mjs";
import { SPECIES } from "./genome/species.mjs";
import { LineageError, parse, write, parentsOf, clutchOf } from "./lineage.mjs";

export { normalizeSeed, parseSeed, seedProblem, SeedError } from "./seed.mjs";
export { lineageProblem, LineageError, canonical, wordsOf } from "./lineage.mjs";
export { SPECIES };

/** Each affinity leans one stat: moss is hardy, stone is tough, spark is quick. */
const LEAN = { moss: "hp", stone: "defense", spark: "speed" };

/** What an affinity can wear on its head or back. */
const CHARMS = {
  moss: { none: 2, sprout: 1, leaf: 1, flower: 1, mushroom: 1 },
  stone: { none: 2, pebble: 1, crystal: 1, stack: 1 },
  spark: { none: 2, bolt: 1, orb: 1, star: 1 },
};

const EPSILON = 1e-9;
const round2 = (x) => Math.round(x * 100) / 100;

/** Every leaf of an object by its dotted path; arrays are values, not walked. */
function leaves(v, prefix = "", out = new Map()) {
  for (const [k, x] of Object.entries(v ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, p, out);
    else out.set(p, x);
  }
  return out;
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts.at(-1)] = value;
}

function hexLerp(a, b, t) {
  const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const ch = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** A display name that sounds like both parents, 3–12 letters. */
function childName(a, b, gene) {
  const clean = (s) => [...s.toLowerCase()].filter((c) => /\p{Ll}/u.test(c)).join("");
  let left = clean(a.name);
  let right = clean(b.name);
  if (!left) left = "kit";
  if (!right) right = "ling";
  const takeL = gene("nameL").int(2, Math.min(5, left.length));
  const takeR = gene("nameR").int(2, Math.min(5, right.length));
  let raw = left.slice(0, takeL) + right.slice(-takeR);
  if (raw.length < 3) raw = (left + right).slice(0, 3);
  if (raw.length > 12) raw = raw.slice(0, 12);
  while (raw.length < 3) raw += "a";
  return raw[0].toUpperCase() + raw.slice(1);
}

/** Mutate a trait value inside a loose appealing range. */
function mutateValue(path, fromA, fromB, gene) {
  const samples = [fromA, fromB].filter((v) => v !== undefined);
  const example = samples.find((v) => v !== undefined);
  if (typeof example === "number") {
    const nums = samples.filter((v) => typeof v === "number");
    const mid = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0.5;
    const span = nums.length > 1 ? Math.max(0.08, Math.abs(nums[0] - nums[1]) * 1.5) : 0.2;
    return round2(mid + (gene(`mut:${path}`).num(-1, 1) * span));
  }
  if (typeof example === "boolean") return gene(`mut:${path}`).chance(0.5);
  if (typeof example === "string") {
    const opts = [...new Set(samples.filter((v) => typeof v === "string"))];
    if (opts.length >= 2) return gene(`mut:${path}`).pick(opts);
    // Nudge a string enum by flipping among a small built-in set when both parents match.
    const pools = {
      eyes: ["round", "tall", "gem", "sleepy", "button"],
      mouth: ["smile", "cat", "open", "fang", "beam"],
      marking: ["none", "spots", "stripes", "patch", "mask", "socks"],
      mood: ["bouncy", "sleepy", "curious", "shy", "proud"],
      "voice.contour": ["rise", "fall", "hop", "trill"],
      "voice.vowel": ["a", "e", "i", "o", "u"],
      charm: ["none", "sprout", "leaf", "flower", "mushroom", "pebble", "crystal", "stack", "bolt", "orb", "star"],
    };
    const pool = pools[path] ?? pools[path.split(".").pop()] ?? opts;
    return gene(`mut:${path}`).pick(pool);
  }
  return example;
}

function inheritTraits(a, b, species, gene) {
  const at = leaves(a.traits);
  const bt = leaves(b.traits);
  const paths = new Set([...at.keys(), ...bt.keys()]);
  // Same-species parent: every one of its trait paths must be present.
  if (a.species === species) for (const k of at.keys()) paths.add(k);
  if (b.species === species) for (const k of bt.keys()) paths.add(k);

  const traits = {};
  const mutations = [];
  for (const path of [...paths].sort()) {
    const va = at.get(path);
    const vb = bt.get(path);
    if (gene(`mut?${path}`).chance(1 / MUTATION_ONE_IN)) {
      mutations.push(path);
      setPath(traits, path, mutateValue(path, va, vb, gene));
      continue;
    }
    const from = [va, vb].filter((v) => v !== undefined);
    if (!from.length) continue;
    if (from.length === 1) {
      setPath(traits, path, from[0]);
      continue;
    }
    if (typeof va === "number" && typeof vb === "number") {
      const pick = gene(`num:${path}`).pick({ a: 2, b: 2, blend: 3 });
      const value =
        pick === "a" ? va : pick === "b" ? vb : round2(va + (vb - va) * gene(`blend:${path}`).num(0.25, 0.75));
      setPath(traits, path, value);
    } else {
      setPath(traits, path, gene(`pick:${path}`).chance(0.5) ? va : vb);
    }
  }
  return { traits, mutations };
}

function inheritStats(a, b, rare, gene) {
  const [min, max] = STAT_RANGE;
  const out = {};
  for (const k of STATS) {
    const blend = a.stats[k] + (b.stats[k] - a.stats[k]) * gene(`stat:${k}`).num(0.3, 0.7);
    out[k] = Math.round(blend + gene(`statJ:${k}`).num(-4, 4));
    out[k] = Math.max(min, Math.min(max, out[k]));
  }
  let total = STATS.reduce((s, k) => s + out[k], 0);
  const want = Math.round((a.stats.hp + b.stats.hp + a.stats.attack + b.stats.attack + a.stats.defense + b.stats.defense + a.stats.speed + b.stats.speed) / 2) + (rare ? 8 : 0);
  const target = Math.max(160, Math.min(280, want));
  let guard = 0;
  while (total < target && guard++ < 500) {
    const k = STATS[gene(`fixUp:${guard}`).int(0, 3)];
    if (out[k] < max) {
      out[k]++;
      total++;
    }
  }
  while (total > target && guard++ < 1000) {
    const k = STATS[gene(`fixDown:${guard}`).int(0, 3)];
    if (out[k] > min) {
      out[k]--;
      total--;
    }
  }
  return out;
}

function inheritPalette(a, b, affinity, rare, gene) {
  const n = Math.max(a.palette.length, b.palette.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const ca = a.palette[i] ?? a.palette.at(-1);
    const cb = b.palette[i] ?? b.palette.at(-1);
    const t = gene(`pal:${i}`).num(0.25, 0.75);
    out.push(hexLerp(ca, cb, t));
  }
  // Keep length in 3..8; fall back to affinity palette size 6 when odd.
  if (out.length < 3) return paletteOf(affinity, rare, gene("palette"));
  return out.slice(0, Math.min(8, Math.max(3, out.length)));
}

function wordGenome(seed) {
  const gene = genesOf(seed);
  const species = gene("species").pick(Object.keys(SPECIES));
  const affinity = gene("affinity").pick(AFFINITIES);
  const rare = gene("rare").chance(1 / RARE_ONE_IN);
  return {
    seed,
    name: nameOf(seed, affinity, gene("name")),
    species,
    affinity,
    rare,
    stats: statsOf(SPECIES[species].stats, affinity, rare, gene),
    palette: paletteOf(affinity, rare, gene("palette")),
    traits: traitsOf(SPECIES[species], affinity, gene),
  };
}

function childGenome(node, seed) {
  const parentSeeds = parentsOf(node);
  const a = genomeOf(parentSeeds[0]);
  const b = genomeOf(parentSeeds[1]);
  const gene = genesOf(seed);
  const species = gene("species").pick([a.species, b.species]);
  const affinity = gene("affinity").pick([a.affinity, b.affinity]);
  let rare;
  if (!a.rare && !b.rare) rare = gene("rare").chance(1 / RARE_ONE_IN);
  else if (a.rare && b.rare) rare = gene("rare").chance(0.55);
  else rare = gene("rare").chance(0.22);

  const { traits, mutations } = inheritTraits(a, b, species, gene);
  return {
    seed,
    name: childName(a, b, gene),
    species,
    affinity,
    rare,
    stats: inheritStats(a, b, rare, gene),
    palette: inheritPalette(a, b, affinity, rare, gene),
    traits,
    parents: parentSeeds,
    clutch: clutchOf(node),
    mutations,
  };
}

export function genomeOf(text) {
  let node;
  try {
    node = parse(text);
  } catch (e) {
    if (e instanceof LineageError) throw e;
    throw e;
  }
  const seed = write(node);
  if ("word" in node) return wordGenome(seed);
  return childGenome(node, seed);
}

/**
 * Four stats from 10 to 100 that add up to the creature's total (175 to 250, 25 more when rare). The
 * points above 10 are shared one at a time by the species' weights, each nudged by its own gene.
 */
function statsOf(profile, affinity, rare, gene) {
  const [min, max] = STAT_RANGE;
  const total = gene("total").int(175, 250) + (rare ? 25 : 0);
  const weight = STATS.map((k) => (profile[k] + (LEAN[affinity] === k ? 1 : 0)) * gene(k).num(0.75, 1.25));
  const points = STATS.map(() => min);
  for (let left = total - STATS.length * min; left > 0; left--) {
    let best = -1;
    for (let i = 0; i < STATS.length; i++) {
      if (points[i] >= max) continue;
      if (best < 0 || weight[i] / (points[i] - min + 1) > weight[best] / (points[best] - min + 1)) best = i;
    }
    points[best]++;
  }
  return Object.fromEntries(STATS.map((k, i) => [k, points[i]]));
}

/** The knobs of the body and face: the ones every species has, then the species' own. */
function traitsOf(species, affinity, gene) {
  const size = gene("size").num(0.88, 1.12);
  return {
    size,
    build: gene("build").num(0, 1),
    eyes: gene("eyes").pick({ round: 3, tall: 2, gem: 2, sleepy: 1, button: 1 }),
    eyeSize: gene("eyeSize").num(0.85, 1.2),
    eyeGap: gene("eyeGap").num(0.85, 1.15),
    mouth: gene("mouth").pick(["smile", "cat", "open", "fang", "beam"]),
    cheeks: gene("cheeks").chance(0.55),
    marking: gene("marking").pick({ none: 2, spots: 2, stripes: 2, patch: 1, mask: 1, socks: 1 }),
    charm: gene("charm").pick(CHARMS[affinity]),
    mood: gene("mood").pick(["bouncy", "sleepy", "curious", "shy", "proud"]),
    voice: {
      pitch: Math.round((species.voice * gene("pitch").num(0.85, 1.2)) / size),
      notes: gene("notes").int(1, 3),
      contour: gene("contour").pick(["rise", "fall", "hop", "trill"]),
      vowel: gene("vowel").pick(["a", "e", "i", "o", "u"]),
    },
    ...species.knobs(gene),
  };
}

// Silence unused import warning style: SeedError re-exported for callers that catch hatch errors.
void SeedError;
void EPSILON;
