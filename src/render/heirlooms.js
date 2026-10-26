// Heirlooms on screen: the part of another species a child carries (src/genome/heirlooms.mjs), built from the
// traits that shape it and set in its slot on the child's body, at the anchors each species' rig names. A part
// grows from its origin: +y away from the body, -z toward the back.
import * as THREE from "three";
import { cone, dome, ellipsoid, joint, plate, tube } from "./parts.js";
import { toon } from "./toon.js";
import { SHELL_PATTERN } from "./species/domeback.js";
import { LOWER, UPPER } from "./species/flutterling.js";
import { SPADE } from "./species/wyrmlet.js";
import { partOf } from "../genome/heirlooms.mjs";

/** A pair of something, one on each side: `make(side)` returns the joint for that side. */
function pair(make) {
  const g = joint();
  for (const side of [-1, 1]) g.add(make(side));
  return g;
}

/** A ring of `n` tufts of radius `r` around an anchor: frills, a mane, a ruff. Leaves the front open when `open`. */
function ring(material, n, r, size, { open = 0 } = {}) {
  const g = joint();
  for (let i = 0; i < n; i++) {
    const a = open + ((Math.PI * 2 - 2 * open) * (i + 0.5)) / n; // 0 is the front
    g.add(ellipsoid(material, size, { at: [Math.sin(a) * r, 0.03 * (i % 2), Math.cos(a) * r], rot: [0.25, a, 0] }));
  }
  return g;
}

/** Each part: (traits, materials, anchor) → { group, wiggles, flaps }. */
const BUILD = {
  crest(t, m) {
    const g = joint(), wiggles = [];
    for (let i = 0; i < t.crest; i++) {
      const spread = (i - (t.crest - 1) / 2) * 0.42;
      const feather = joint([spread * 0.12, 0, 0], [-0.35, 0, -spread]);
      feather.add(ellipsoid(m.accent, [0.07, 0.24 * t.crestLength, 0.05], { at: [0, 0.2 * t.crestLength, 0] }));
      g.add(feather);
      wiggles.push({ obj: feather, axis: "x", amp: 0.08, speed: 3.1, phase: i });
    }
    return { group: g, wiggles };
  },
  longEars(t, m) {
    const L = t.earLength, wiggles = [], flaps = [];
    const g = pair((side) => {
      const ear = joint([side * 0.18, -0.04, -0.02], [-0.12, 0, -side * 0.22]);
      ear.add(ellipsoid(m.plain, [0.1, 0.3 * L, 0.06], { at: [0, 0.28 * L, 0] }));
      ear.add(ellipsoid(m.accent, [0.055, 0.22 * L, 0.035], { at: [0, 0.28 * L, 0.035] }));
      wiggles.push({ obj: ear, axis: "z", amp: 0.07, speed: 2.4, phase: side });
      flaps.push({ obj: ear, axis: "x", amp: -0.5 });
      return ear;
    });
    return { group: g, wiggles, flaps };
  },
  antenna(t, m) {
    const g = joint();
    if (t.antenna === "curl") g.add(tube(m.accent, [[0, 0, 0], [0.02, 0.18, 0], [0.14, 0.28, 0], [0.18, 0.18, 0], [0.1, 0.16, 0]], 0.045, 0.035, { segments: 14 }));
    else if (t.antenna === "bulb") {
      g.add(tube(m.plain, [[0, 0, 0], [0.03, 0.14, 0], [0.08, 0.22, 0]], 0.04, 0.03, { segments: 8 }));
      g.add(ellipsoid(m.accent, [0.09, 0.09, 0.09], { at: [0.09, 0.27, 0] }));
    }
    return { group: g, wiggles: [{ obj: g, axis: "z", amp: 0.15, speed: 3, phase: 0 }] };
  },
  horns(t, m) {
    const H = t.hornLength * 1.1;
    const g = pair((side) => {
      const horn = joint([side * 0.19, -0.04, -0.02], [-0.15, 0, -side * 0.4]);
      if (t.horns === "nub") horn.add(cone(m.detail, 0.08, 0.2 * H));
      else if (t.horns === "curl") horn.add(tube(m.detail, [[0, 0, 0], [side * 0.05, 0.15 * H, -0.04], [side * 0.14, 0.2 * H, -0.16 * H], [side * 0.19, 0.07 * H, -0.22 * H], [side * 0.15, -0.05 * H, -0.13 * H]], 0.075, 0.03, { segments: 14 }));
      else {
        horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03, 0.3 * H, -0.04]], 0.06, 0.025, { segments: 8 }));
        horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08, 0.2 * H, 0.02], [side * 0.12, 0.24 * H, 0.04]], 0.035, 0.02, { segments: 6 }));
      }
      return horn;
    });
    return { group: g };
  },
  feelers(t, m) {
    const A = t.antennaLength, wiggles = [];
    const g = pair((side) => {
      const ant = joint([side * 0.14, -0.02, 0], [0, 0, -side * 0.35]);
      ant.add(tube(m.detail, [[0, 0, 0], [0, 0.18 * A, 0.02], [0, 0.3 * A, 0.05]], 0.028, 0.022, { segments: 8 }));
      ant.add(ellipsoid(m.accent, [0.06, 0.06, 0.06], { at: [0, 0.32 * A, 0.06] }));
      wiggles.push({ obj: ant, axis: "z", amp: 0.14, speed: 3.4, phase: side * 0.7 });
      return ant;
    });
    return { group: g, wiggles };
  },
  ridge(t, m) {
    const g = joint();
    if (t.ridge === "none") return { group: g };
    for (let i = 0; i < 4; i++) {
      const z = 0.2 - i * 0.2, y = -0.05 * i * i * 0.3;
      if (t.ridge === "plates") g.add(cone(m.detail, 0.08, 0.16, { at: [0, y, z], rot: [-0.2, 0, 0], scale: [0.08, 0.16, 0.03] }));
      else g.add(ellipsoid(m.accent, [0.07, 0.1, 0.12], { at: [0, y + 0.03, z], rot: [-0.5, 0, 0] }));
    }
    return { group: g };
  },
  spikes(t, m) {
    const g = joint();
    const n = Math.min(14, Math.max(8, Math.round(t.spikes / 2)));
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      // A patch of spines on a golden-angle spiral, leaning out and back.
      const k = Math.sqrt((i + 0.5) / n), a = i * 2.39996;
      const dir = new THREE.Vector3(Math.cos(a) * k * 0.8, 1, Math.sin(a) * k * 0.8 - 0.35).normalize();
      const L = 0.24 * t.spikeLength;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(a) * k * 0.3, -0.1 * k * k, Math.sin(a) * k * 0.3);
      holder.quaternion.setFromUnitVectors(up, dir);
      holder.add(t.spikeTip === "round" ? ellipsoid(m.detail, [0.065, L * 0.6, 0.065], { at: [0, L * 0.4, 0] }) : cone(m.detail, 0.075, L));
      g.add(holder);
    }
    return { group: g };
  },
  shell(t, m) {
    const g = joint();
    const S = 0.36 * t.shell;
    const shell = toon(m.colors.accent, { mark: { color: m.colors.detail, ...SHELL_PATTERN[t.shellPattern] } });
    g.add(dome(shell, [0.44, S, 0.48], { at: [0, -0.12, -0.04] }));
    return { group: g };
  },
  mothWings(t, m) {
    const wiggles = [], flaps = [];
    const g = pair((side) => {
      const wing = joint([side * 0.08, 0, 0], [0.1, side * 0.28, -side * 0.18]);
      for (const [shape, y, scale] of [[UPPER[t.wingShape], 0.04, 0.8], [LOWER[t.wingShape], -0.02, 0.7]]) {
        const w = plate(m.accent, shape, 0.03);
        w.scale.set(side * scale, scale, 1);
        w.position.y = y;
        wing.add(w);
      }
      if (t.eyespots) {
        const spot = joint([side * 0.4, 0.16, 0.02]);
        spot.add(ellipsoid(m.belly, [0.08, 0.08, 0.02]), ellipsoid(m.body, [0.04, 0.04, 0.025]));
        wing.add(spot);
      }
      wiggles.push({ obj: wing, axis: "y", amp: side * 0.28, speed: 5.5, phase: 0 });
      flaps.push({ obj: wing, axis: "y", amp: side * -0.6 });
      return wing;
    });
    return { group: g, wiggles, flaps };
  },
  tailFeathers(t, m) {
    const g = joint();
    for (let i = 0; i < t.tailFeathers; i++) {
      const spread = (i - (t.tailFeathers - 1) / 2) * 0.36;
      const feather = joint([0, 0, 0], [-0.95, 0, spread]);
      feather.add(ellipsoid(m.accent, [0.06, 0.2, 0.045], { at: [0, 0.17, 0] }));
      g.add(feather);
    }
    return { group: g, wiggles: [{ obj: g, axis: "y", amp: 0.18, speed: 4.2, phase: 0.5 }] };
  },
  tailPuff(t, m) {
    const g = joint();
    const P = t.tailPuff;
    g.add(ellipsoid(m.belly, [0.15 * P, 0.14 * P, 0.13 * P], { at: [0, 0, -0.04] }));
    return { group: g, wiggles: [{ obj: g, axis: "y", amp: 0.25, speed: 5, phase: 0 }] };
  },
  dragonTail(t, m) {
    const g = joint();
    const path = [[0, 0, 0], [0, 0.04, -0.22], [0, 0.18, -0.36], [0, 0.36, -0.34]];
    g.add(tube(m.plain, path, 0.08, 0.04, { segments: 12 }));
    const tip = joint(path.at(-1), [-0.5, 0, 0]);
    if (t.tailTip === "spade") tip.add(plate(m.accent, SPADE.map(([x, y]) => [x * 0.8, y * 0.8]), 0.04));
    else if (t.tailTip === "tuft") for (let k = 0; k < 3; k++) tip.add(ellipsoid(m.accent, [0.07, 0.11, 0.07], { at: [0, 0.07, 0.03 * k], rot: [0.5 + 0.3 * k, 0, (k - 1) * 0.5] }));
    else if (t.tailTip === "leaf") tip.add(ellipsoid(m.accent, [0.08, 0.16, 0.03], { at: [0, 0.11, 0] }));
    else tip.add(ellipsoid(m.accent, [0.08, 0.08, 0.08], { at: [0, 0.05, 0] }));
    g.add(tip);
    return { group: g, wiggles: [{ obj: g, axis: "y", amp: 0.3, speed: 3.2, phase: 0 }] };
  },
  frills(t, m, anchor) {
    return { group: ring(m.accent, t.frills, anchor.r, [0.12, 0.07, 0.1]) };
  },
  mane(t, m, anchor) {
    const M = t.mane;
    return { group: ring(m.accent, 9, anchor.r, [0.15 * M, 0.18 * M, 0.13 * M], { open: 0.9 }) };
  },
  ruff(t, m, anchor) {
    const F = t.fluff;
    return { group: ring(m.belly, 9, anchor.r, [0.12 * F, 0.1 * F, 0.12 * F], { open: 0.5 }) };
  },
};

/**
 * Builds a child's heirlooms onto its rig, one per slot (a slot two heirlooms share shows the first), and
 * returns what moves.
 */
export function graft(rig, genome, materials) {
  const wiggles = [], flaps = [];
  const used = new Set();
  for (const h of genome.heirlooms ?? []) {
    const { slot } = partOf(h);
    const anchor = rig.anchors?.[slot];
    if (!anchor || used.has(slot)) continue;
    used.add(slot);
    const part = BUILD[h.part](genome.traits, materials, anchor);
    part.group.position.set(...anchor.at);
    if (anchor.rot) part.group.rotation.set(...anchor.rot);
    anchor.parent.add(part.group);
    wiggles.push(...(part.wiggles ?? []));
    flaps.push(...(part.flaps ?? []));
  }
  return { wiggles, flaps };
}
