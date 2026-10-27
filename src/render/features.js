// Features worn on the head, each built here once: a wyrmlet's horns, a hopple's ears, a pipkin's crest,
// an inchling's antennae and a drift's antenna. Its species builds each one with them, and a child of
// another species wears one as an heirloom (heirlooms.js), at the size `k` of its own head (1 is the
// species' own size). What moves is pushed to `wiggles` and `flaps`, as the species builders do.
import { cone, ellipsoid, joint, tube } from "./parts.js";

/** A wyrmlet's two horns, nubs, curls or branches, `spread` to each side of `at`, leaning `out`. */
export function horns(head, t, m, { at, spread, out, k = 1 }) {
  const H = t.hornLength * 1.25 * k;
  for (const side of [-1, 1]) {
    const horn = joint([at[0] + side * spread, at[1], at[2]], [-0.15, 0, -side * out]);
    if (t.horns === "nub") horn.add(cone(m.detail, 0.08 * k, 0.2 * H));
    else if (t.horns === "curl") horn.add(tube(m.detail, [[0, 0, 0], [side * 0.05 * k, 0.15 * H, -0.04 * k], [side * 0.14 * k, 0.2 * H, -0.16 * H], [side * 0.19 * k, 0.07 * H, -0.22 * H], [side * 0.15 * k, -0.05 * H, -0.13 * H]], 0.075 * k, 0.03 * k, { segments: 14 }));
    else {
      horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03 * k, 0.3 * H, -0.04 * k]], 0.06 * k, 0.025 * k, { segments: 8 }));
      horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08 * k, 0.2 * H, 0.02 * k], [side * 0.12 * k, 0.24 * H, 0.04 * k]], 0.035 * k, 0.02 * k, { segments: 6 }));
    }
    head.add(horn);
  }
  return 0.2 * H;
}

/** How a hopple's ears stand: up, flopped down or out to the sides (tilt back, turn out). */
const EARS = { up: [-0.12, 0.2], lop: [0.35, 2.25], side: [0, 1.2] };

/** A hopple's two long ears, `spread` to each side of `at`, turned out `splay` more than its kind. */
export function ears(head, t, m, { at, spread, splay = 0, k = 1, wiggles, flaps }) {
  const [tilt, out] = EARS[t.ears];
  const L = t.earLength * k;
  for (const side of [-1, 1]) {
    const ear = joint([at[0] + side * spread, at[1], at[2]], [tilt, 0, -side * (out + splay)]);
    ear.add(ellipsoid(m.plain, [0.12 * k, 0.36 * L, 0.07 * k], { at: [0, 0.34 * L, 0] }));
    ear.add(ellipsoid(m.accent, [0.065 * k, 0.27 * L, 0.04 * k], { at: [0, 0.34 * L, 0.04 * k] }));
    head.add(ear);
    wiggles.push({ obj: ear, axis: "z", amp: 0.07, speed: 2.4, phase: side });
    flaps.push({ obj: ear, axis: "x", amp: -0.5 });
  }
  return t.ears === "up" ? 0.5 + 0.7 * L : 0.6 * k;
}

/** A pipkin's crest: one to three feathers fanning up from `at`. */
export function crest(head, t, m, { at, k = 1, wiggles }) {
  const group = joint(at);
  for (let i = 0; i < t.crest; i++) {
    const spread = (i - (t.crest - 1) / 2) * 0.42;
    const feather = joint([spread * 0.12 * k, 0, 0], [-0.35, 0, -spread]);
    feather.add(ellipsoid(m.accent, [0.07 * k, 0.24 * t.crestLength * k, 0.05 * k], { at: [0, 0.2 * t.crestLength * k, 0] }));
    group.add(feather);
    wiggles.push({ obj: feather, axis: "x", amp: 0.08, speed: 3.1, phase: i });
  }
  head.add(group);
  return 0.2 * t.crestLength * k + 0.2 * k;
}

/** An inchling's two antennae, curled, straight or with bulbs, `spread` to each side of `at`. */
export function antennae(head, t, m, { at, spread, k = 1, wiggles, flaps }) {
  const A = t.antennaLength * k;
  for (const side of [-1, 1]) {
    const ant = joint([at[0] + side * spread, at[1], at[2]], [0, 0, -side * 0.35]);
    if (t.antennae === "curl") ant.add(tube(m.detail, [[0, 0, 0], [0, 0.22 * A, 0], [side * 0.08 * k, 0.32 * A, 0], [side * 0.14 * k, 0.26 * A, 0], [side * 0.08 * k, 0.22 * A, 0]], 0.03 * k, 0.025 * k, { segments: 12 }));
    else {
      ant.add(tube(m.detail, [[0, 0, 0], [0, 0.18 * A, 0.02 * k], [0, 0.3 * A, 0.05 * k]], 0.028 * k, 0.022 * k, { segments: 8 }));
      ant.add(ellipsoid(t.antennae === "bulb" ? m.accent : m.detail, [0.06 * k, 0.06 * k, 0.06 * k], { at: [0, 0.32 * A, 0.06 * k] }));
    }
    head.add(ant);
    wiggles.push({ obj: ant, axis: "z", amp: 0.14, speed: 3.4, phase: side * 0.7 });
    flaps.push({ obj: ant, axis: "z", amp: side * 0.5 });
  }
  return 0.4 * k + 0.3 * A;
}

/** A drift's antenna on top of its head, a curl or a bulb on a stalk ("none" wears none). */
export function antenna(head, t, m, { at, k = 1, wiggles }) {
  if (t.antenna === "none") return 0;
  const top = joint(at);
  if (t.antenna === "curl") top.add(tube(m.accent, [[0, 0, 0], [0.02 * k, 0.18 * k, 0], [0.14 * k, 0.28 * k, 0], [0.18 * k, 0.18 * k, 0], [0.1 * k, 0.16 * k, 0]], 0.045 * k, 0.035 * k, { segments: 14 }));
  else {
    top.add(tube(m.plain, [[0, 0, 0], [0.03 * k, 0.14 * k, 0], [0.08 * k, 0.22 * k, 0]], 0.04 * k, 0.03 * k, { segments: 8 }));
    top.add(ellipsoid(m.accent, [0.09 * k, 0.09 * k, 0.09 * k], { at: [0.09 * k, 0.27 * k, 0] }));
  }
  head.add(top);
  wiggles.push({ obj: top, axis: "z", amp: 0.15, speed: 3, phase: 0 });
  return 0.3 * k;
}
