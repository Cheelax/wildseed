// The kinds of trait a genome holds. Each kind draws a value from a gene's die (exactly as round 1 drew
// it), knows which values belong to it, and blends two parents' values. Crossing and mutating read these,
// so a child's trait always stays inside the ranges its species was designed with.

/** A number from min to max, two decimals. Two parents' numbers blend to one between them. */
export const num = (min, max) => ({
  draw: (d) => d.num(min, max),
  holds: (v) => typeof v === "number" && v >= min && v <= max,
  blend: (x, y, t) => Math.round((x + (y - x) * t) * 100) / 100,
  clamp: (v) => Math.min(max, Math.max(min, v)),
});

/** A whole number from min to max. */
export const int = (min, max) => ({
  draw: (d) => d.int(min, max),
  holds: (v) => Number.isInteger(v) && v >= min && v <= max,
  blend: (x, y, t) => Math.round(x + (y - x) * t),
  clamp: (v) => Math.min(max, Math.max(min, v)),
});

/** One of a list, or one key of { item: weight }. Two parents' picks do not blend: one wins. */
export const pick = (choices) => {
  const values = Array.isArray(choices) ? choices : Object.keys(choices);
  return { draw: (d) => d.pick(choices), holds: (v) => values.includes(v) };
};

/** Yes or no, yes with probability p. */
export const chance = (p) => ({ draw: (d) => d.chance(p), holds: (v) => typeof v === "boolean" });
