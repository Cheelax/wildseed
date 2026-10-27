// Palettes: six colors chosen inside families that keep each affinity recognizable and every creature
// appealing. The order is the renderer's: body, belly, accent, detail, eye, ink.

/** Families of body colors, in HSL ranges: hue in degrees, saturation and lightness in %. */
const BODY = {
  moss: [
    { h: [88, 130], s: [38, 55], l: [50, 62] }, // leaf
    { h: [140, 172], s: [30, 48], l: [52, 64] }, // sage and teal
    { h: [60, 84], s: [45, 60], l: [52, 62] }, // lime and olive
    { h: [24, 40], s: [35, 50], l: [52, 60] }, // bark
  ],
  stone: [
    { h: [200, 232], s: [14, 28], l: [60, 70] }, // slate
    { h: [20, 44], s: [16, 30], l: [62, 72] }, // sandstone
    { h: [250, 290], s: [14, 26], l: [62, 72] }, // lavender grey
    { h: [8, 20], s: [30, 42], l: [58, 66] }, // clay
  ],
  spark: [
    { h: [42, 54], s: [85, 95], l: [58, 66] }, // sunshine
    { h: [18, 32], s: [80, 92], l: [58, 64] }, // tangerine
    { h: [185, 200], s: [70, 85], l: [56, 64] }, // electric blue
    { h: [310, 338], s: [62, 78], l: [64, 72] }, // fuchsia
  ],
};

/** Accents: markings, crests, ear insides, tail tips. A spark accent is the body's complement. */
const ACCENT = {
  moss: [
    { h: [340, 380], s: [60, 75], l: [68, 76] }, // blossom
    { h: [44, 56], s: [80, 90], l: [62, 70] }, // buttercup
    { h: [100, 150], s: [40, 55], l: [32, 40] }, // deep forest
  ],
  stone: [
    { h: [265, 290], s: [50, 65], l: [62, 70] }, // amethyst
    { h: [170, 190], s: [50, 65], l: [56, 64] }, // aquamarine
    { h: [32, 44], s: [70, 80], l: [58, 66] }, // amber
  ],
  spark: [{ h: [160, 200], s: [70, 85], l: [58, 68], relative: true }],
};

/** Horns, beaks, claws and spikes. */
const DETAIL = [
  { h: [38, 50], s: [40, 60], l: [84, 90] }, // ivory
  { h: [0, 0], s: [15, 25], l: [28, 36], relative: true }, // charcoal, in the body's hue
  { h: [38, 46], s: [70, 85], l: [58, 64] }, // gold
];

/** Rare creatures are starlit: a night-sky body, gold accents. */
const STARLIT = {
  body: { h: [228, 262], s: [45, 60], l: [26, 34] },
  belly: { h: [250, 280], s: [35, 50], l: [64, 74] },
  accent: { h: [42, 50], s: [85, 95], l: [62, 68] },
  detail: { h: [180, 200], s: [60, 75], l: [78, 86] },
};

/** "#rrggbb" from HSL, with plain arithmetic only. */
export function hex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** A color drawn from a family, `hue` added to relative families. */
function draw(d, family, hue = 0) {
  const h = d.int(...family.h) + (family.relative ? hue : 0);
  return { h, s: d.int(...family.s), l: d.int(...family.l) };
}

const css = ({ h, s, l }) => hex(h, s, l);

/** The six colors of a creature, from its gene "palette". */
export function paletteOf(affinity, rare, d) {
  const body = rare ? draw(d, STARLIT.body) : draw(d, d.pick(BODY[affinity]));
  const belly = rare ? draw(d, STARLIT.belly) : { h: body.h + 8, s: Math.round(body.s * 0.45), l: d.int(86, 92) };
  const accent = rare ? draw(d, STARLIT.accent) : draw(d, d.pick(ACCENT[affinity]), body.h);
  const detail = rare ? draw(d, STARLIT.detail) : draw(d, d.pick(DETAIL), body.h);
  const eye = rare ? { h: 46, s: 90, l: 60 } : d.chance(0.3) ? { h: accent.h, s: 70, l: 40 } : { h: body.h, s: 30, l: d.int(12, 18) };
  const ink = { h: body.h + 10, s: d.int(30, 45), l: d.int(9, 13) };
  return [body, belly, accent, detail, eye, ink].map(css);
}

/** The color between two "#rrggbb" colors, `t` of the way from the first. */
function mix(c, d, t) {
  const channel = (i) => {
    const [x, y] = [c, d].map((h) => parseInt(h.slice(i, i + 2), 16));
    return Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * A child's six colors: its body and belly are its body's parent's colors blended toward the other's, it
 * mostly wears the other parent's accent, and either's horns and eyes. A rare child is starlit.
 */
export function childPalette(main, other, affinity, rare, d) {
  if (rare) return paletteOf(affinity, true, d);
  const [body, belly, accent, detail, eye, ink] = main.palette;
  const [oBody, oBelly, oAccent, oDetail, oEye, oInk] = other.palette;
  const t = d.num(0.25, 0.5);
  return [
    mix(body, oBody, t),
    mix(belly, oBelly, t),
    d.chance(0.7) ? oAccent : accent,
    d.chance(0.5) ? oDetail : detail,
    d.chance(0.5) ? oEye : eye,
    mix(ink, oInk, t),
  ];
}
