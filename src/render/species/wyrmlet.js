// Wyrmlet: a dragon pup that sits like a dog, front legs straight, a fluffy mane around its head, ram's
// horns, plates down its chest, wings too small to fly, and a long tail curled at its side.
import { cone, ellipsoid, eyes, cheeks, joint, mouth, onSurface, plate, tube } from "../parts.js";

const WING = [[0, 0], [0.18, 0.2], [0.42, 0.3], [0.62, 0.12], [0.5, 0.04], [0.42, -0.08], [0.3, 0.0], [0.2, -0.1], [0.08, -0.04]];
export const SPADE = [[0, -0.02], [0.12, 0.06], [0.1, 0.18], [0, 0.3], [-0.1, 0.18], [-0.12, 0.06]];

export function wyrmlet(g, m) {
  const t = g.traits;
  const body = joint();

  // Sitting: the torso leans forward over the front legs, plates down its chest.
  const chest = [0.46 + 0.08 * t.build, 0.52, 0.44];
  const torso = joint([0, 0.6, -0.04], [0.3, 0, 0]);
  torso.add(ellipsoid(m.body, chest));
  for (let k = 0; k < 3; k++) {
    const at = onSurface(chest, 0, -0.42 + k * 0.32, -0.03);
    at.add(ellipsoid(m.belly, [0.25 - 0.03 * k, 0.08, 0.07]));
    torso.add(at);
  }
  body.add(torso);
  for (const side of [-1, 1]) {
    body.add(ellipsoid(m.limb, [0.17, 0.2, 0.26], { at: [side * 0.37, 0.22, -0.12] }));
    body.add(ellipsoid(m.limb, [0.12, 0.06, 0.18], { at: [side * 0.37, 0.05, 0.08] }));
    body.add(ellipsoid(m.limb, [0.085, 0.27, 0.09], { at: [side * 0.2, 0.3, 0.3] }));
    body.add(ellipsoid(m.limb, [0.1, 0.05, 0.13], { at: [side * 0.2, 0.04, 0.36] }));
    for (let k = -1; k <= 1; k++) body.add(ellipsoid(m.detail, [0.025, 0.022, 0.03], { at: [side * 0.2 + k * 0.05, 0.03, 0.48] }));
  }

  const radii = [0.5, 0.45, 0.46];
  const head = joint([0, 1.26, 0.2]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const e = eyes(radii, t, m.colors, { level: 0.2 });
  head.add(e.group, cheeks(radii, t, m.colors, e, 0.2));
  const snoutRadii = [0.24, 0.16, 0.19];
  const snout = joint([0, -0.14, 0.32]);
  snout.add(ellipsoid(m.plain, snoutRadii));
  for (const side of [-1, 1]) snout.add(ellipsoid(m.nose, [0.025, 0.02, 0.02], { at: [side * 0.07, 0.06, 0.17] }));
  const mo = mouth(snoutRadii, t, m.colors, { level: -0.4, size: e.radius * 0.6 });
  snout.add(mo.group);
  head.add(snout);

  // The mane: two rows of tufts around the back of the head, and a few down the neck.
  const M = t.mane;
  for (const [n, y, r, from, to] of [[9, -0.14, 0.56, 0.92, 2.08], [7, 0.14, 0.52, 0.98, 2.02], [4, 0.36, 0.36, 1.1, 1.9]]) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (from + ((to - from) * i) / (n - 1));
      head.add(ellipsoid(m.accent, [0.17 * M, 0.21 * M, 0.15 * M], { at: [Math.cos(a) * r, y + 0.04 * (i % 2), Math.sin(a) * r * 0.85 - 0.06], rot: [0.3, -a, 0] }));
    }
  }
  for (let k = 0; k < 3; k++) body.add(ellipsoid(m.accent, [0.12 * M, 0.15 * M, 0.12 * M], { at: [0, 1.02 - 0.16 * k, -0.24 - 0.1 * k] }));

  const H = t.hornLength * 1.25;
  for (const side of [-1, 1]) {
    const horn = joint([side * 0.2, 0.4, -0.02], [-0.15, 0, -side * 0.4]);
    if (t.horns === "nub") horn.add(cone(m.detail, 0.08, 0.2 * H));
    else if (t.horns === "curl") horn.add(tube(m.detail, [[0, 0, 0], [side * 0.05, 0.15 * H, -0.04], [side * 0.14, 0.2 * H, -0.16 * H], [side * 0.19, 0.07 * H, -0.22 * H], [side * 0.15, -0.05 * H, -0.13 * H]], 0.075, 0.03, { segments: 14 }));
    else {
      horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03, 0.3 * H, -0.04]], 0.06, 0.025, { segments: 8 }));
      horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08, 0.2 * H, 0.02], [side * 0.12, 0.24 * H, 0.04]], 0.035, 0.02, { segments: 6 }));
    }
    head.add(horn);
  }

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const wing = joint([side * 0.2, 1.0, -0.3], [0.1, side * 0.6, 0.35 * side]);
    const w = plate(m.accent, WING, 0.03);
    w.scale.set(side * t.wings * 1.15, t.wings * 1.15, 1);
    wing.add(w);
    body.add(wing);
    wiggles.push({ obj: wing, axis: "y", amp: side * 0.12, speed: 2.6, phase: 0 });
    flaps.push({ obj: wing, axis: "y", amp: side * -0.8 });
  }

  // The tail curls around its right side on the ground, like a sitting cat's.
  const T = t.tail;
  const tail = joint([0, 0, 0]);
  const path = [[0, 0.26, -0.4], [0.25 * T, 0.1, -0.62 * T], [0.62 * T, 0.08, -0.38 * T], [0.72 * T, 0.09, 0.02], [0.6 * T, 0.12, 0.3 * T]];
  tail.add(tube(m.plain, path, 0.14, 0.05, { segments: 18 }));
  const tip = joint(path.at(-1), [0, -0.6, 0]);
  if (t.tailTip === "spade") tip.add(plate(m.accent, SPADE, 0.04));
  else if (t.tailTip === "tuft") for (let k = 0; k < 3; k++) tip.add(ellipsoid(m.accent, [0.08, 0.13, 0.08], { at: [0, 0.08, 0.04 * k], rot: [0.5 + 0.3 * k, 0, (k - 1) * 0.5] }));
  else if (t.tailTip === "leaf") tip.add(ellipsoid(m.accent, [0.1, 0.2, 0.035], { at: [0, 0.14, 0] }));
  else tip.add(ellipsoid(m.accent, [0.1, 0.1, 0.1], { at: [0, 0.06, 0] }));
  tail.add(tip);
  for (let i = 0; i < t.spines; i++) {
    const p = path[1 + Math.min(2, Math.floor(i / 2))];
    tail.add(cone(m.accent, 0.05, 0.12, { at: [p[0] + 0.05 * (i % 2), p[1] + 0.1, p[2]], rot: [0, 0, 0.2] }));
  }
  body.add(tail);
  wiggles.push({ obj: tail, axis: "y", amp: 0.08, speed: 2.4, phase: 0 });

  return {
    body, head, wiggles, flaps,
    face: { eyes: e.open, happy: e.happy, irises: e.irises, mouth: mo },
    anchors: {
      top: { parent: head, at: [0, 0.44, 0] },
      back: { parent: body, at: [0, 1.0, -0.32], rot: [-0.4, 0, 0] },
      rear: { parent: body, at: [0, 0.26, -0.4] },
      neck: { parent: head, at: [0, -0.4, -0.06], r: 0.44 },
    },
    charmAt: { parent: head, at: [0, 0.42, 0.06], rot: [0.15, 0, 0] },
    height: 1.26 + 0.45 + 0.2 * H,
  };
}
