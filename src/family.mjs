// A child's family, as the page's family tree shows it: its parents and grandparents, and where each of its
// traits came from. Pure: it reads genomes and never changes them.
import { genomeOf } from "./genome.mjs";
import { partOf } from "./genome/heirlooms.mjs";

/** A creature with its parents and their parents, back to its grandparents (null where an ancestor is a word). */
export function familyOf(genome) {
  const up = (g) => (g.parents ? g.parents.map(genomeOf) : null);
  const parents = up(genome);
  return { child: genome, parents, grandparents: parents ? parents.map(up) : null };
}

/** What a trait is called on the page. */
const LABELS = {
  size: "size", build: "build", eyes: "eye shape", eyeSize: "eye size", eyeGap: "eye spacing", mouth: "mouth",
  cheeks: "cheeks", marking: "markings", charm: "charm", mood: "mood", "voice.pitch": "voice", "voice.notes": "song",
  "voice.contour": "song", "voice.vowel": "voice", earLength: "ears", tailPuff: "tail", tailFeathers: "tail",
  tailTip: "tail tip", crestLength: "crest", hornLength: "horns", antennaLength: "feelers", spikeLength: "spikes",
  spikeTip: "spikes", tentacleLength: "tentacles", shellPattern: "shell", wingShape: "wings", eyespots: "eyespots",
};
export const labelOf = (path) => LABELS[path] ?? path.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);

/** What a heirloom is called on the page: "a pipkin's crest". */
const PARTS = {
  crest: "crest", longEars: "long ears", tailPuff: "puff of a tail", ridge: "ridge", antenna: "antenna", frills: "frills",
  spikes: "spikes", horns: "horns", mane: "mane", dragonTail: "dragon tail", feelers: "feelers", shell: "shell",
  mothWings: "moth wings", tailFeathers: "tail feathers", ruff: "ruff",
};
export const heirloomName = (h) => `a ${h.species}'s ${PARTS[h.part]}`;

/**
 * Where a child's looks came from, given its two parents (in the order of `child.parents`): its body, its
 * affinity, every trait and its heirlooms, each `from` parent 0 or 1, "both" (they share it), "blend"
 * (between theirs) or "mutation". Traits of one label and one origin are listed once.
 */
export function originsOf(child, [a, b]) {
  const mutated = new Set(child.mutations ?? []);
  const fromWhich = (v, x, y) => (same(v, x) && same(v, y) ? "both" : same(v, x) ? 0 : same(v, y) ? 1 : "blend");
  const out = [{ label: `a ${child.species}'s body`, from: fromWhich(child.species, a.species, b.species) }];
  out.push({ label: `${child.affinity} affinity`, from: fromWhich(child.affinity, a.affinity, b.affinity) });
  for (const h of child.heirlooms ?? []) {
    const carrier = [a, b].findIndex((p) => p.species === h.species || (p.heirlooms ?? []).some((k) => k.species === h.species && k.part === h.part));
    out.push({ label: heirloomName(h), from: carrier, heirloom: true });
  }
  const carried = new Set((child.heirlooms ?? []).flatMap((h) => partOf(h).traits));
  const seen = new Set();
  for (const [path, v] of leaves(child.traits)) {
    if (carried.has(path) && !mutated.has(path)) continue; // its heirloom says where it came from
    const from = mutated.has(path) ? "mutation" : fromWhich(v, valueAt(a.traits, path), valueAt(b.traits, path));
    const label = labelOf(path);
    if (seen.has(`${label}\u0000${from}`)) continue;
    seen.add(`${label}\u0000${from}`);
    out.push({ label, from });
  }
  return out;
}

function leaves(v, prefix = "", out = []) {
  for (const [k, x] of Object.entries(v)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, path, out);
    else out.push([path, x]);
  }
  return out;
}
const valueAt = (v, path) => path.split(".").reduce((o, k) => o?.[k], v);
const same = (v, w) => v !== undefined && JSON.stringify(v) === JSON.stringify(w);
