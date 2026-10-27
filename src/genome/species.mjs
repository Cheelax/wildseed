// The species: each one a character with its own silhouette. A seed turns its knobs only inside these
// ranges, which keep every creature of the species appealing. `stats` weighs how its points are shared,
// `voice` is the pitch of its cry in Hz, `knobs` are the species' own traits, each drawn from the gene of
// its name, and `parts` groups them into what a child inherits whole: one parent's crest, the other's tail.
import { chance, int, num, pick } from "./kinds.mjs";

export const SPECIES = {
  // A round bird that is mostly face: a crest, a beak, wing nubs and a fan of tail feathers.
  pipkin: {
    stats: { hp: 3, attack: 2, defense: 2, speed: 4 },
    voice: 760,
    knobs: { crest: int(1, 3), crestLength: num(0.6, 1.3), beak: num(0.75, 1.2), wings: num(0.75, 1.2), tailFeathers: int(2, 4) },
    parts: { crest: ["crest", "crestLength"], beak: ["beak"], wings: ["wings"], tail: ["tailFeathers"] },
  },
  // A hopper with long ears, standing up, flopped down or out to the sides, and big feet.
  hopple: {
    stats: { hp: 3, attack: 2, defense: 2, speed: 5 },
    voice: 640,
    knobs: { ears: pick({ up: 2, lop: 2, side: 1 }), earLength: num(0.8, 1.35), feet: num(0.85, 1.25), tailPuff: num(0.8, 1.3) },
    parts: { ears: ["ears", "earLength"], feet: ["feet"], tail: ["tailPuff"] },
  },
  // A sturdy four-legged trotter with a long nose, a tail and a ridge along its back.
  trundle: {
    stats: { hp: 4, attack: 3, defense: 3, speed: 2 },
    voice: 380,
    knobs: {
      snout: num(0.6, 1.3),
      ears: pick(["round", "pointy", "leaf"]),
      legs: num(0.7, 1.15),
      tail: pick(["tuft", "curl", "fluff"]),
      ridge: pick({ none: 2, plates: 1, fur: 1 }),
    },
    parts: { nose: ["snout"], ears: ["ears"], legs: ["legs"], tail: ["tail"], ridge: ["ridge"] },
  },
  // A floating bell with a frilled skirt and tentacles that sway under it.
  drift: {
    stats: { hp: 2, attack: 3, defense: 2, speed: 4 },
    voice: 540,
    knobs: {
      dome: num(0.75, 1.2),
      tentacles: int(3, 6),
      tentacleLength: num(0.7, 1.3),
      curl: num(0, 1),
      frills: int(6, 10),
      antenna: pick(["none", "curl", "bulb"]),
    },
    parts: { bell: ["dome", "frills"], tentacles: ["tentacles", "tentacleLength", "curl"], antenna: ["antenna"] },
  },
  // A round hedgehog of spines with a soft face that pokes out in front.
  prickle: {
    stats: { hp: 3, attack: 2, defense: 5, speed: 2 },
    voice: 580,
    knobs: { spikes: int(16, 30), spikeLength: num(0.75, 1.3), spikeTip: pick(["sharp", "round"]), muzzle: num(0.7, 1.2), ears: num(0.7, 1.2) },
    parts: { spines: ["spikes", "spikeLength", "spikeTip"], muzzle: ["muzzle"], ears: ["ears"] },
  },
  // A dragon pup that sits like a dog: a fluffy mane, ram's horns, plates down its chest, wings too
  // small to fly and a long tail curled at its side.
  wyrmlet: {
    stats: { hp: 3, attack: 5, defense: 2, speed: 3 },
    voice: 330,
    knobs: {
      horns: pick(["nub", "curl", "branch"]),
      hornLength: num(0.7, 1.3),
      mane: num(0.8, 1.25),
      wings: num(0.75, 1.3),
      tail: num(0.8, 1.3),
      tailTip: pick(["spade", "tuft", "leaf", "orb"]),
      spines: int(0, 5),
    },
    parts: { horns: ["horns", "hornLength"], mane: ["mane"], wings: ["wings"], tail: ["tail", "tailTip"], spines: ["spines"] },
  },
  // A caterpillar of round segments that rears its head up in an S.
  inchling: {
    stats: { hp: 4, attack: 2, defense: 3, speed: 2 },
    voice: 660,
    knobs: { segments: int(4, 7), rise: num(0.45, 1), antennae: pick(["curl", "straight", "bulb"]), antennaLength: num(0.7, 1.3) },
    parts: { segments: ["segments"], neck: ["rise"], antennae: ["antennae", "antennaLength"] },
  },
  // A slow walker under a dome of a shell, its head out in front on a short neck.
  domeback: {
    stats: { hp: 4, attack: 2, defense: 5, speed: 1 },
    voice: 280,
    knobs: { shell: num(0.75, 1.2), shellPattern: pick(["plates", "rings", "spots"]), neck: num(0.6, 1.2), head: num(0.85, 1.2) },
    parts: { shell: ["shell", "shellPattern"], neck: ["neck"], head: ["head"] },
  },
  // A squat frog: its eyes up on two domes, a wide grin, a throat that swells when it sings.
  toadle: {
    stats: { hp: 4, attack: 3, defense: 2, speed: 3 },
    voice: 300,
    knobs: { domes: num(0.85, 1.25), throat: num(0.75, 1.3), legs: num(0.85, 1.2) },
    parts: { domes: ["domes"], throat: ["throat"], legs: ["legs"] },
  },
  // A fluffy moth that hovers on two pairs of wings, a ruff around its neck, feathered antennae.
  flutterling: {
    stats: { hp: 2, attack: 3, defense: 2, speed: 5 },
    voice: 820,
    knobs: {
      wings: num(0.85, 1.2),
      wingShape: pick(["round", "pointed", "swallowtail"]),
      antennae: pick(["feather", "club"]),
      fluff: num(0.85, 1.25),
      eyespots: chance(0.6),
    },
    parts: { wings: ["wings", "wingShape", "eyespots"], antennae: ["antennae"], ruff: ["fluff"] },
  },
};

/**
 * Heirlooms: parts a child can take from a parent of another species, each worn on the head of any
 * species that has no such keys of its own (a wyrmlet's horns on a hopple, a hopple's ears on a pipkin).
 * Each one is a part of the species it comes from, with that species' keys and ranges.
 */
export const HEIRLOOMS = { horns: "wyrmlet", ears: "hopple", crest: "pipkin", antennae: "inchling", antenna: "drift" };
