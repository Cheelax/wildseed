// The species: each one a character with its own silhouette. A seed turns its knobs only inside these
// ranges, which keep every creature of the species appealing. `stats` weighs how its points are shared,
// `voice` is the pitch of its cry in Hz, `knobs` reads the seed's genes into the species' own traits.

export const SPECIES = {
  // A round bird that is mostly face: a crest, a beak, wing nubs and a fan of tail feathers.
  pipkin: {
    stats: { hp: 3, attack: 2, defense: 2, speed: 4 },
    voice: 760,
    knobs: (g) => ({
      crest: g("crest").int(1, 3),
      crestLength: g("crestLength").num(0.6, 1.3),
      beak: g("beak").num(0.75, 1.2),
      wings: g("wings").num(0.75, 1.2),
      tailFeathers: g("tailFeathers").int(2, 4),
    }),
  },
  // A hopper with long ears, standing up, flopped down or out to the sides, and big feet.
  hopple: {
    stats: { hp: 3, attack: 2, defense: 2, speed: 5 },
    voice: 640,
    knobs: (g) => ({
      ears: g("ears").pick({ up: 2, lop: 2, side: 1 }),
      earLength: g("earLength").num(0.8, 1.35),
      feet: g("feet").num(0.85, 1.25),
      tailPuff: g("tailPuff").num(0.8, 1.3),
    }),
  },
  // A sturdy four-legged trotter with a long nose, a tail and a ridge along its back.
  trundle: {
    stats: { hp: 4, attack: 3, defense: 3, speed: 2 },
    voice: 380,
    knobs: (g) => ({
      snout: g("snout").num(0.6, 1.3),
      ears: g("ears").pick(["round", "pointy", "leaf"]),
      legs: g("legs").num(0.7, 1.15),
      tail: g("tail").pick(["tuft", "curl", "fluff"]),
      ridge: g("ridge").pick({ none: 2, plates: 1, fur: 1 }),
    }),
  },
  // A floating bell with a frilled skirt and tentacles that sway under it.
  drift: {
    stats: { hp: 2, attack: 3, defense: 2, speed: 4 },
    voice: 540,
    knobs: (g) => ({
      dome: g("dome").num(0.75, 1.2),
      tentacles: g("tentacles").int(3, 6),
      tentacleLength: g("tentacleLength").num(0.7, 1.3),
      curl: g("curl").num(0, 1),
      frills: g("frills").int(6, 10),
      antenna: g("antenna").pick(["none", "curl", "bulb"]),
    }),
  },
  // A round hedgehog of spines with a soft face that pokes out in front.
  prickle: {
    stats: { hp: 3, attack: 2, defense: 5, speed: 2 },
    voice: 580,
    knobs: (g) => ({
      spikes: g("spikes").int(16, 30),
      spikeLength: g("spikeLength").num(0.75, 1.3),
      spikeTip: g("spikeTip").pick(["sharp", "round"]),
      muzzle: g("muzzle").num(0.7, 1.2),
      ears: g("ears").num(0.7, 1.2),
    }),
  },
  // A dragon pup that sits like a dog: a fluffy mane, ram's horns, plates down its chest, wings too
  // small to fly and a long tail curled at its side.
  wyrmlet: {
    stats: { hp: 3, attack: 5, defense: 2, speed: 3 },
    voice: 330,
    knobs: (g) => ({
      horns: g("horns").pick(["nub", "curl", "branch"]),
      hornLength: g("hornLength").num(0.7, 1.3),
      mane: g("mane").num(0.8, 1.25),
      wings: g("wings").num(0.75, 1.3),
      tail: g("tail").num(0.8, 1.3),
      tailTip: g("tailTip").pick(["spade", "tuft", "leaf", "orb"]),
      spines: g("spines").int(0, 5),
    }),
  },
  // A caterpillar of round segments that rears its head up in an S.
  inchling: {
    stats: { hp: 4, attack: 2, defense: 3, speed: 2 },
    voice: 660,
    knobs: (g) => ({
      segments: g("segments").int(4, 7),
      rise: g("rise").num(0.45, 1),
      antennae: g("antennae").pick(["curl", "straight", "bulb"]),
      antennaLength: g("antennaLength").num(0.7, 1.3),
    }),
  },
  // A slow walker under a dome of a shell, its head out in front on a short neck.
  domeback: {
    stats: { hp: 4, attack: 2, defense: 5, speed: 1 },
    voice: 280,
    knobs: (g) => ({
      shell: g("shell").num(0.75, 1.2),
      shellPattern: g("shellPattern").pick(["plates", "rings", "spots"]),
      neck: g("neck").num(0.6, 1.2),
      head: g("head").num(0.85, 1.2),
    }),
  },
  // A squat frog: its eyes up on two domes, a wide grin, a throat that swells when it sings.
  toadle: {
    stats: { hp: 4, attack: 3, defense: 2, speed: 3 },
    voice: 300,
    knobs: (g) => ({
      domes: g("domes").num(0.85, 1.25),
      throat: g("throat").num(0.75, 1.3),
      legs: g("legs").num(0.85, 1.2),
    }),
  },
  // A fluffy moth that hovers on two pairs of wings, a ruff around its neck, feathered antennae.
  flutterling: {
    stats: { hp: 2, attack: 3, defense: 2, speed: 5 },
    voice: 820,
    knobs: (g) => ({
      wings: g("wings").num(0.85, 1.2),
      wingShape: g("wingShape").pick(["round", "pointed", "swallowtail"]),
      antennae: g("antennae").pick(["feather", "club"]),
      fluff: g("fluff").num(0.85, 1.25),
      eyespots: g("eyespots").chance(0.6),
    }),
  },
};
