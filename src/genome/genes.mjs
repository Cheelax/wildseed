// Genes: every part of a genome draws its numbers from its own stream, named after it. Adding a gene
// never moves the others, so later rounds can grow a genome (children, moves, levels) without
// repainting a creature that already exists. Integer arithmetic only, so every machine agrees.

/** FNV-1a over the code points of `text`, finished with murmur3's mixer: a 32-bit hash. */
export function hash32(text) {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: a stream of numbers in [0, 1) from a 32-bit state. */
export function stream(state) {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

/** A die over one stream: numbers rounded to two decimals, integers, picks and chances. */
export function die(next) {
  return {
    next,
    num: (min, max) => round2(min + (max - min) * next()),
    int: (min, max) => min + Math.floor((max - min + 1) * next()),
    chance: (p) => next() < p,
    /** An item of a list, or a key of { item: weight }. */
    pick(choices) {
      if (Array.isArray(choices)) return choices[Math.floor(choices.length * next())];
      const entries = Object.entries(choices);
      let x = next() * entries.reduce((sum, [, w]) => sum + w, 0);
      for (const [item, w] of entries) if ((x -= w) < 0) return item;
      return entries.at(-1)[0];
    },
  };
}

/** A seed's genes: gene("eyes") is the die of the gene "eyes", the same for that seed everywhere. */
export function genesOf(seed) {
  return (name) => die(stream(hash32(`${name}\u0000${seed}`)));
}
