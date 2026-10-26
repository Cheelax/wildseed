// Heirlooms on the head: a part a child of two species takes from its other parent (a wyrmlet's horns, a
// hopple's ears, a pipkin's crest, an inchling's antennae, a drift's antenna), built the way that species
// builds it and sized to the head it now sits on. See src/genome/species.mjs, HEIRLOOMS.
import { cone, ellipsoid, joint, tube } from "./parts.js";
import { heirloomsOf } from "../genome/traits.mjs";

const EARS = { up: [-0.12, 0.2], lop: [0.35, 2.25], side: [0, 1.2] };

/** Each heirloom: built on `head` around `at` (the top of the head), `k` the head's size to a wyrmlet's. Returns how much taller it makes the creature. */
const BUILD = {
  horns(t, m, { head, at, k }) {
    const H = t.hornLength * 1.25 * k;
    for (const side of [-1, 1]) {
      const horn = joint([at[0] + side * 0.26 * k, at[1] - 0.05 * k, at[2] - 0.03], [-0.15, 0, -side * 0.5]);
      if (t.horns === "nub") horn.add(cone(m.detail, 0.08 * k, 0.2 * H));
      else if (t.horns === "curl") horn.add(tube(m.detail, [[0, 0, 0], [side * 0.05, 0.15 * H, -0.04], [side * 0.14, 0.2 * H, -0.16 * H], [side * 0.19, 0.07 * H, -0.22 * H], [side * 0.15, -0.05 * H, -0.13 * H]], 0.075 * k, 0.03 * k, { segments: 14 }));
      else {
        horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03, 0.3 * H, -0.04]], 0.06 * k, 0.025 * k, { segments: 8 }));
        horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08, 0.2 * H, 0.02], [side * 0.12, 0.24 * H, 0.04]], 0.035 * k, 0.02 * k, { segments: 6 }));
      }
      head.add(horn);
    }
    return 0.3 * H;
  },

  ears(t, m, { head, at, k, wiggles, flaps }) {
    const [tilt, out] = EARS[t.ears];
    const L = t.earLength * k;
    for (const side of [-1, 1]) {
      const ear = joint([at[0] + side * 0.24 * k, at[1] - 0.1 * k, at[2] - 0.06], [tilt, 0, -side * (out + 0.15)]);
      ear.add(ellipsoid(m.plain, [0.11 * k, 0.34 * L, 0.065 * k], { at: [0, 0.32 * L, 0] }));
      ear.add(ellipsoid(m.accent, [0.06 * k, 0.25 * L, 0.04 * k], { at: [0, 0.32 * L, 0.04 * k] }));
      head.add(ear);
      wiggles.push({ obj: ear, axis: "z", amp: 0.07, speed: 2.4, phase: side });
      flaps.push({ obj: ear, axis: "x", amp: -0.5 });
    }
    return t.ears === "up" ? 0.6 * L : 0.2 * k;
  },

  crest(t, m, { head, at, k, wiggles }) {
    const crest = joint([at[0], at[1] - 0.03, at[2] - 0.1 * k]);
    for (let i = 0; i < t.crest; i++) {
      const spread = (i - (t.crest - 1) / 2) * 0.42;
      const feather = joint([spread * 0.12 * k, 0, 0], [-0.35, 0, -spread]);
      feather.add(ellipsoid(m.accent, [0.07 * k, 0.24 * t.crestLength * k, 0.05 * k], { at: [0, 0.2 * t.crestLength * k, 0] }));
      crest.add(feather);
      wiggles.push({ obj: feather, axis: "x", amp: 0.08, speed: 3.1, phase: i });
    }
    head.add(crest);
    return 0.4 * t.crestLength * k;
  },

  antennae(t, m, { head, at, k, wiggles }) {
    const A = t.antennaLength * k;
    for (const side of [-1, 1]) {
      const ant = joint([at[0] + side * 0.18 * k, at[1] - 0.05 * k, at[2]], [0, 0, -side * 0.4]);
      if (t.antennae === "curl") ant.add(tube(m.detail, [[0, 0, 0], [0, 0.22 * A, 0], [side * 0.08 * A, 0.32 * A, 0], [side * 0.14 * A, 0.26 * A, 0], [side * 0.08 * A, 0.22 * A, 0]], 0.03 * k, 0.025 * k, { segments: 12 }));
      else {
        ant.add(tube(m.detail, [[0, 0, 0], [0, 0.18 * A, 0.02], [0, 0.3 * A, 0.05]], 0.028 * k, 0.022 * k, { segments: 8 }));
        ant.add(ellipsoid(t.antennae === "bulb" ? m.accent : m.detail, [0.06 * k, 0.06 * k, 0.06 * k], { at: [0, 0.32 * A, 0.06 * A] }));
      }
      head.add(ant);
      wiggles.push({ obj: ant, axis: "z", amp: 0.12, speed: 2.8, phase: side });
    }
    return 0.34 * A;
  },

  antenna(t, m, { head, at, k, wiggles }) {
    if (t.antenna === "none") return 0;
    const top = joint([at[0], at[1] - 0.02, at[2] - 0.06]);
    if (t.antenna === "curl") top.add(tube(m.accent, [[0, 0, 0], [0.02 * k, 0.18 * k, 0], [0.14 * k, 0.28 * k, 0], [0.18 * k, 0.18 * k, 0], [0.1 * k, 0.16 * k, 0]], 0.045 * k, 0.035 * k, { segments: 14 }));
    else {
      top.add(tube(m.plain, [[0, 0, 0], [0.03 * k, 0.14 * k, 0], [0.08 * k, 0.22 * k, 0]], 0.04 * k, 0.03 * k, { segments: 8 }));
      top.add(ellipsoid(m.accent, [0.09 * k, 0.09 * k, 0.09 * k], { at: [0.09 * k, 0.27 * k, 0] }));
    }
    head.add(top);
    wiggles.push({ obj: top, axis: "z", amp: 0.15, speed: 3, phase: 0 });
    return 0.32 * k;
  },
};

/** Puts on a creature's head every heirloom its genome wears; the rig grows to match. */
export function wearHeirlooms(rig, genome, m) {
  const k = rig.top.r / 0.48;
  for (const part of heirloomsOf(genome)) {
    rig.height += BUILD[part](genome.traits, m, { head: rig.head, at: rig.top.at, k, wiggles: rig.wiggles, flaps: rig.flaps });
  }
}
