// Heirlooms: a child of two species takes its body from one parent, and can carry a part of the other's:
// a hopple with a pipkin's crest, a trundle with a domeback's shell. Each part is a few of its species' traits,
// kept under the same names, so a child's traits still all come from a parent. A heirloom sits in a slot
// (on top of the head, on the back, at the rear, around the neck), and a slot holds one part.

/** The parts a species can hand down: the traits that shape each one, its slot, and when it shows at all. */
export const PARTS = {
  pipkin: {
    crest: { traits: ["crest", "crestLength"], slot: "top" },
    tailFeathers: { traits: ["tailFeathers"], slot: "rear" },
  },
  hopple: {
    longEars: { traits: ["earLength"], slot: "top" },
    tailPuff: { traits: ["tailPuff"], slot: "rear" },
  },
  trundle: {
    ridge: { traits: ["ridge"], slot: "back", shows: (t) => t.ridge !== "none" },
  },
  drift: {
    antenna: { traits: ["antenna"], slot: "top", shows: (t) => t.antenna !== "none" },
    frills: { traits: ["frills"], slot: "neck" },
  },
  prickle: {
    spikes: { traits: ["spikes", "spikeLength", "spikeTip"], slot: "back" },
  },
  wyrmlet: {
    horns: { traits: ["horns", "hornLength"], slot: "top" },
    mane: { traits: ["mane"], slot: "neck" },
    dragonTail: { traits: ["tailTip"], slot: "rear" },
  },
  inchling: {
    feelers: { traits: ["antennaLength"], slot: "top" },
  },
  domeback: {
    shell: { traits: ["shell", "shellPattern"], slot: "back" },
  },
  toadle: {},
  flutterling: {
    mothWings: { traits: ["wingShape", "eyespots"], slot: "back" },
    ruff: { traits: ["fluff"], slot: "neck" },
  },
};

/** The slots a species fills with its own parts: a heirloom never goes there. */
export const OWN_SLOTS = {
  pipkin: ["top", "rear"],
  hopple: ["top", "rear"],
  trundle: ["back", "rear"],
  drift: ["top", "neck"],
  prickle: ["back"],
  wyrmlet: ["top", "back", "rear", "neck"],
  inchling: ["top"],
  domeback: ["back"],
  toadle: [],
  flutterling: ["top", "back", "neck"],
};

/** A heirloom's description: { species, part }. */
export const partOf = ({ species, part }) => PARTS[species][part];

/** The heirlooms a creature carries: none for a word. */
export const heirloomsOf = (genome) => genome.heirlooms ?? [];

/** The parts a creature can hand down to a child of another species: its species' own, then its heirlooms. */
export function partsToHandDown(genome) {
  const own = Object.entries(PARTS[genome.species])
    .filter(([, p]) => !p.shows || p.shows(genome.traits))
    .map(([part]) => ({ species: genome.species, part }));
  return [...own, ...heirloomsOf(genome)];
}

export const sameHeirloom = (h, k) => h.species === k.species && h.part === k.part;
