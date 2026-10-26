// Species traits share one generator for words and fresh mutations.
/** What an affinity can wear on its head or back. */
const CHARMS = {
  moss: { none: 2, sprout: 1, leaf: 1, flower: 1, mushroom: 1 },
  stone: { none: 2, pebble: 1, crystal: 1, stack: 1 },
  spark: { none: 2, bolt: 1, orb: 1, star: 1 },
};

/** The knobs of the body and face: the ones every species has, then the species' own. */
export function traitsOf(species, affinity, gene) {
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
