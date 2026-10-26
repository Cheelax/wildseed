// Parts from another species: a child of two species can carry its other parent's horns, ears, wings or
// tail where its own body has none (genome/heredity.mjs, "SLOTS"). Each species says where those places
// are on its body (`places` in its rig); this file builds the part that sits there, in the creature's own
// colors, from the traits that came with it, the way the species they come from draws them.
import { cone, ellipsoid, joint, plate, tube } from "./parts.js";
import { SLOTS } from "../genome/heredity.mjs";
import { SPECIES } from "../genome/species.mjs";

const DRAGON_WING = [[0, 0], [0.18, 0.2], [0.42, 0.3], [0.62, 0.12], [0.5, 0.04], [0.42, -0.08], [0.3, 0.0], [0.2, -0.1], [0.08, -0.04]];
const MOTH_WING = {
  round: [[0, 0], [0.22, 0.3], [0.5, 0.44], [0.74, 0.4], [0.84, 0.22], [0.74, 0.04], [0.48, -0.06], [0.2, -0.05]],
  pointed: [[0, 0], [0.26, 0.32], [0.62, 0.46], [0.9, 0.5], [0.72, 0.2], [0.5, 0.02], [0.2, -0.05]],
  swallowtail: [[0, 0], [0.22, 0.3], [0.5, 0.42], [0.76, 0.36], [0.8, 0.16], [0.6, 0.0], [0.2, -0.05]],
};
const SPADE = [[0, -0.02], [0.12, 0.06], [0.1, 0.18], [0, 0.3], [-0.1, 0.18], [-0.12, 0.06]];
const HOPPLE_EARS = { up: [-0.12, 0.2], lop: [0.35, 2.25], side: [0, 1.2] };

/** Horns, a crest or antennae on top of the head, centered on the place. */
function crown(t, m, motion) {
  const g = joint();
  if (t.horns) {
    const H = t.hornLength * 1.25;
    for (const side of [-1, 1]) {
      const horn = joint([side * 0.2, -0.05, 0], [-0.15, 0, -side * 0.4]);
      if (t.horns === "nub") horn.add(cone(m.detail, 0.08, 0.2 * H));
      else if (t.horns === "curl") horn.add(tube(m.detail, [[0, 0, 0], [side * 0.05, 0.15 * H, -0.04], [side * 0.14, 0.2 * H, -0.16 * H], [side * 0.19, 0.07 * H, -0.22 * H], [side * 0.15, -0.05 * H, -0.13 * H]], 0.075, 0.03, { segments: 14 }));
      else {
        horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03, 0.3 * H, -0.04]], 0.06, 0.025, { segments: 8 }));
        horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08, 0.2 * H, 0.02], [side * 0.12, 0.24 * H, 0.04]], 0.035, 0.02, { segments: 6 }));
      }
      g.add(horn);
    }
  }
  if (t.crest) {
    for (let i = 0; i < t.crest; i++) {
      const spread = (i - (t.crest - 1) / 2) * 0.42;
      const feather = joint([spread * 0.12, -0.04, -0.04], [-0.35, 0, -spread]);
      feather.add(ellipsoid(m.accent, [0.07, 0.24 * t.crestLength, 0.05], { at: [0, 0.2 * t.crestLength, 0] }));
      g.add(feather);
      motion.wiggles.push({ obj: feather, axis: "x", amp: 0.08, speed: 3.1, phase: i });
    }
  }
  if (t.antennae) {
    const A = t.antennaLength ?? 1;
    for (const side of [-1, 1]) {
      const ant = joint([side * 0.15, -0.08, 0], [-0.1, 0, -side * 0.35]);
      if (t.antennae === "curl") ant.add(tube(m.detail, [[0, 0, 0], [0, 0.22 * A, 0], [side * 0.08, 0.32 * A, 0], [side * 0.14, 0.26 * A, 0], [side * 0.08, 0.22 * A, 0]], 0.03, 0.025, { segments: 12 }));
      else if (t.antennae === "feather" || t.antennae === "club") {
        const pts = [[0, 0, 0], [side * 0.04, 0.2, 0], [side * 0.12, 0.36, -0.04], [side * 0.24, 0.44, -0.08]];
        ant.add(tube(m.detail, pts, 0.025, 0.02, { segments: 10 }));
        if (t.antennae === "club") ant.add(ellipsoid(m.accent, [0.07, 0.07, 0.07], { at: pts[3] }));
        else for (let k = 1; k <= 4; k++) {
          const s = k / 5;
          ant.add(ellipsoid(m.accent, [0.03, 0.09 - 0.012 * k, 0.015], { at: [side * (0.03 + 0.22 * s * s), 0.1 + 0.36 * s, -0.02 - 0.06 * s], rot: [0, 0, side * 0.9] }));
        }
      } else {
        ant.add(tube(m.detail, [[0, 0, 0], [0, 0.18 * A, 0.02], [0, 0.3 * A, 0.05]], 0.028, 0.022, { segments: 8 }));
        ant.add(ellipsoid(t.antennae === "bulb" ? m.accent : m.detail, [0.06, 0.06, 0.06], { at: [0, 0.32 * A, 0.06] }));
      }
      g.add(ant);
      motion.wiggles.push({ obj: ant, axis: "z", amp: 0.14, speed: 3.4, phase: side * 0.7 });
    }
  }
  if (t.antenna === "curl" || t.antenna === "bulb") {
    const top = joint([0, -0.03, -0.02]);
    if (t.antenna === "curl") top.add(tube(m.accent, [[0, 0, 0], [0.02, 0.18, 0], [0.14, 0.28, 0], [0.18, 0.18, 0], [0.1, 0.16, 0]], 0.045, 0.035, { segments: 14 }));
    else {
      top.add(tube(m.plain, [[0, 0, 0], [0.03, 0.14, 0], [0.08, 0.22, 0]], 0.04, 0.03, { segments: 8 }));
      top.add(ellipsoid(m.accent, [0.09, 0.09, 0.09], { at: [0.09, 0.27, 0] }));
    }
    g.add(top);
    motion.wiggles.push({ obj: top, axis: "z", amp: 0.15, speed: 3, phase: 0 });
  }
  return g;
}

/** One ear, the right one (side 1) or the left (-1), standing up from the place. */
function ear(t, m, side, motion) {
  const e = joint();
  if (typeof t.ears === "number") {
    e.rotation.set(0, 0, -side * 0.5);
    e.add(ellipsoid(m.plain, [0.1 * t.ears, 0.12 * t.ears, 0.05], { at: [0, 0.07, 0] }));
    e.add(ellipsoid(m.accent, [0.05 * t.ears, 0.07 * t.ears, 0.03], { at: [0, 0.07, 0.03] }));
  } else if (t.ears in HOPPLE_EARS) {
    const [tilt, out] = HOPPLE_EARS[t.ears];
    const L = t.earLength ?? 1;
    e.rotation.set(tilt, 0, -side * out);
    e.add(ellipsoid(m.plain, [0.12, 0.36 * L, 0.07], { at: [0, 0.34 * L, 0] }));
    e.add(ellipsoid(m.accent, [0.065, 0.27 * L, 0.04], { at: [0, 0.34 * L, 0.04] }));
  } else {
    e.rotation.set(0, 0, -side * 0.5);
    if (t.ears === "pointy") e.add(cone(m.plain, 0.13, 0.3));
    else if (t.ears === "leaf") e.add(ellipsoid(m.plain, [0.12, 0.25, 0.045], { at: [0, 0.2, 0], rot: [0, 0, -side * 0.7] }));
    else e.add(ellipsoid(m.plain, [0.17, 0.17, 0.05], { at: [0, 0.1, 0] }));
    e.add(ellipsoid(m.accent, [0.06, 0.08, 0.03], { at: [0, 0.09, 0.03] }));
  }
  motion.wiggles.push({ obj: e, axis: "z", amp: 0.08, speed: 2.6, phase: side });
  motion.flaps.push({ obj: e, axis: "z", amp: side * 0.4 });
  return e;
}

/** Wings, a dragon's or a moth's, or a ridge along the back, centered on the place. */
function back(t, m, motion) {
  const g = joint();
  if (typeof t.wings === "number") {
    for (const side of [-1, 1]) {
      const wing = joint([side * 0.16, 0, 0]);
      if (t.wingShape) {
        // A moth's two pairs, smaller than on a moth's own body.
        const W = t.wings * 0.95;
        wing.rotation.set(0.1, side * 0.35, -side * 0.15);
        for (const [shape, y, s] of [[MOTH_WING[t.wingShape], 0.04, 1], [MOTH_WING[t.wingShape].map(([x, v]) => [x * 0.6, -v * 0.8]), -0.02, 0.9]]) {
          const w = plate(m.accent, shape, 0.03);
          w.scale.set(side * W * s, W * s, 1);
          w.position.y = y;
          wing.add(w);
        }
      } else {
        wing.rotation.set(0.1, side * 0.6, 0.35 * side);
        const w = plate(m.accent, DRAGON_WING, 0.03);
        w.scale.set(side * t.wings * 1.1, t.wings * 1.1, 1);
        wing.add(w);
      }
      g.add(wing);
      motion.wiggles.push({ obj: wing, axis: "y", amp: side * 0.15, speed: t.wingShape ? 5.5 : 2.6, phase: 0 });
      motion.flaps.push({ obj: wing, axis: "y", amp: side * -0.7 });
    }
  }
  if (t.ridge === "plates" || t.ridge === "fur") {
    for (let i = 0; i < 4; i++) {
      const at = [0, -0.05 * i * i, 0.12 - 0.2 * i];
      if (t.ridge === "plates") g.add(cone(m.detail, 0.08, 0.16, { at, rot: [-0.3, 0, 0], scale: [0.08, 0.16, 0.03] }));
      else g.add(ellipsoid(m.accent, [0.07, 0.1, 0.12], { at: [0, at[1] + 0.03, at[2]], rot: [-0.5, 0, 0] }));
    }
  }
  return g;
}

/** A tail at the back of the body, growing out backward (-z) from the place. */
function tail(t, m, motion) {
  const g = joint();
  if (typeof t.tail === "number") {
    // A dragon's tail, raised in a curl, with its tip and its spines.
    const T = t.tail;
    const path = [[0, 0, 0], [0, 0.02, -0.25 * T], [0.06, 0.18 * T, -0.48 * T], [0.1, 0.42 * T, -0.46 * T], [0.08, 0.52 * T, -0.3 * T]];
    g.add(tube(m.plain, path, 0.12, 0.045, { segments: 16 }));
    const tip = joint(path.at(-1), [0.4, 0, 0]);
    if (t.tailTip === "spade") tip.add(plate(m.accent, SPADE, 0.04));
    else if (t.tailTip === "tuft") for (let k = 0; k < 3; k++) tip.add(ellipsoid(m.accent, [0.08, 0.13, 0.08], { at: [0, 0.08, 0.04 * k], rot: [0.5 + 0.3 * k, 0, (k - 1) * 0.5] }));
    else if (t.tailTip === "leaf") tip.add(ellipsoid(m.accent, [0.1, 0.2, 0.035], { at: [0, 0.14, 0] }));
    else tip.add(ellipsoid(m.accent, [0.1, 0.1, 0.1], { at: [0, 0.06, 0] }));
    g.add(tip);
    for (let i = 0; i < (t.spines ?? 0); i++) {
      const p = path[1 + Math.min(2, Math.floor(i / 2))];
      g.add(cone(m.accent, 0.045, 0.11, { at: [p[0], p[1] + 0.08, p[2] - 0.03 * (i % 2)], rot: [-0.4, 0, 0] }));
    }
  } else if (t.tail === "curl") g.add(tube(m.plain, [[0, 0, 0], [0, 0.1, -0.15], [0, 0.28, -0.12], [0, 0.26, 0.0], [0, 0.16, -0.02]], 0.07, 0.04));
  else if (t.tail === "fluff") g.add(ellipsoid(m.accent, [0.16, 0.26, 0.16], { at: [0, 0.18, -0.12], rot: [-0.6, 0, 0] }));
  else if (t.tail === "tuft") {
    g.add(tube(m.plain, [[0, 0, 0], [0, 0.12, -0.14], [0, 0.18, -0.3]], 0.05, 0.035));
    g.add(ellipsoid(m.accent, [0.09, 0.12, 0.09], { at: [0, 0.2, -0.36] }));
  } else if (t.tailFeathers) {
    for (let i = 0; i < t.tailFeathers; i++) {
      const spread = (i - (t.tailFeathers - 1) / 2) * 0.36;
      const feather = joint([0, 0, 0], [-0.95, 0, spread]);
      feather.add(ellipsoid(m.accent, [0.06, 0.2, 0.045], { at: [0, 0.17, 0] }));
      g.add(feather);
    }
  } else if (t.tailPuff) g.add(ellipsoid(m.belly, [0.17 * t.tailPuff, 0.16 * t.tailPuff, 0.15 * t.tailPuff], { at: [0, 0, -0.06] }));
  motion.wiggles.push({ obj: g, axis: "y", amp: 0.2, speed: 4, phase: 0 });
  return g;
}

/** The traits of a genome that its species does not draw itself: parts from another species, by place. */
export function graftsOf(genome) {
  const own = SPECIES[genome.species].knobs;
  const out = {};
  for (const [slot, keys] of Object.entries(SLOTS)) {
    const theirs = keys.filter((k) => k in genome.traits && !(k in own));
    if (theirs.some((k) => genome.traits[k] !== "none")) out[slot] = Object.fromEntries(theirs.map((k) => [k, genome.traits[k]]));
  }
  return out;
}

/** Adds the parts from another species to a built rig, where its species puts them. Returns the places used. */
export function graft(rig, genome, m) {
  const grafts = graftsOf(genome);
  for (const [slot, traits] of Object.entries(grafts)) {
    const place = rig.places?.[slot];
    if (!place) continue;
    const motion = { wiggles: rig.wiggles, flaps: rig.flaps };
    if (slot === "ears") {
      for (const side of [-1, 1]) {
        const at = joint([side * place.at[0], place.at[1], place.at[2]]);
        at.scale.setScalar(place.size ?? 1);
        at.add(ear(traits, m, side, motion));
        place.parent.add(at);
      }
      continue;
    }
    const at = joint(place.at, place.rot ?? [0, 0, 0]);
    at.scale.setScalar(place.size ?? 1);
    at.add(slot === "crown" ? crown(traits, m, motion) : slot === "back" ? back(traits, m, motion) : tail(traits, m, motion));
    place.parent.add(at);
  }
  return Object.keys(grafts);
}
