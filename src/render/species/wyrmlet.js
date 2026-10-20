// Wyrmlet: a small dragon. Horns, wings too small to fly, and a long tail with a tip of its own.
import { cone, ellipsoid, eyes, cheeks, joint, mouth, plate, tube } from "../parts.js";

const WING = [[0, 0], [0.18, 0.2], [0.42, 0.3], [0.62, 0.12], [0.5, 0.04], [0.42, -0.08], [0.3, 0.0], [0.2, -0.1], [0.08, -0.04]];
const SPADE = [[0, -0.02], [0.12, 0.06], [0.1, 0.18], [0, 0.3], [-0.1, 0.18], [-0.12, 0.06]];

export function wyrmlet(g, m) {
  const t = g.traits;
  const body = joint();
  body.add(ellipsoid(m.torso, [0.48 + 0.1 * t.build, 0.58, 0.46], { at: [0, 0.72, 0] }));
  for (const side of [-1, 1]) {
    body.add(ellipsoid(m.limb, [0.16, 0.2, 0.2], { at: [side * 0.27, 0.18, 0.08] }));
    body.add(ellipsoid(m.detail, [0.1, 0.05, 0.08], { at: [side * 0.27, 0.04, 0.27] }));
    body.add(ellipsoid(m.limb, [0.08, 0.17, 0.08], { at: [side * 0.36, 0.8, 0.26], rot: [0.5, 0, -side * 0.5] }));
  }

  const radii = [0.52, 0.47, 0.48];
  const head = joint([0, 1.42, 0.06]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const e = eyes(radii, t, m.colors, { level: 0.2 });
  head.add(e.group, cheeks(radii, t, m.colors, e, 0.2));
  const snoutRadii = [0.26, 0.17, 0.2];
  const snout = joint([0, -0.13, 0.3]);
  snout.add(ellipsoid(m.belly, snoutRadii));
  for (const side of [-1, 1]) snout.add(ellipsoid(m.nose, [0.025, 0.02, 0.02], { at: [side * 0.07, 0.07, 0.18] }));
  const mo = mouth(snoutRadii, t, m.colors, { level: -0.35, size: e.radius * 0.6 });
  snout.add(mo.group);
  head.add(snout);

  const H = t.hornLength;
  for (const side of [-1, 1]) {
    const horn = joint([side * 0.2, 0.33, -0.1], [-0.3, 0, -side * 0.35]);
    if (t.horns === "nub") horn.add(cone(m.detail, 0.075, 0.18 * H));
    else if (t.horns === "curve") horn.add(tube(m.detail, [[0, 0, 0], [0, 0.14 * H, -0.02], [0, 0.24 * H, -0.12 * H], [0, 0.26 * H, -0.24 * H]], 0.07, 0.025, { segments: 10 }));
    else {
      horn.add(tube(m.detail, [[0, 0, 0], [0, 0.16 * H, 0], [side * 0.03, 0.3 * H, -0.04]], 0.06, 0.025, { segments: 8 }));
      horn.add(tube(m.detail, [[0, 0.12 * H, 0], [side * 0.08, 0.2 * H, 0.02], [side * 0.12, 0.24 * H, 0.04]], 0.035, 0.02, { segments: 6 }));
    }
    head.add(horn);
  }

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const wing = joint([side * 0.18, 1.0, -0.32], [0.1, side * 0.55, 0.25 * side]);
    const w = plate(m.accent, WING, 0.03);
    w.scale.set(side * t.wings, t.wings, 1);
    wing.add(w);
    body.add(wing);
    wiggles.push({ obj: wing, axis: "y", amp: side * 0.12, speed: 2.6, phase: 0 });
    flaps.push({ obj: wing, axis: "y", amp: side * -0.8 });
  }

  const T = t.tail;
  const tail = joint([0, 0.36, -0.32]);
  const end = [0.5 * T, 0.5, -0.95 * T];
  tail.add(tube(m.plain, [[0, 0, 0], [0.08, -0.12, -0.36 * T], [0.3 * T, -0.1, -0.78 * T], end], 0.16, 0.05, { segments: 16 }));
  const tip = joint([end[0], end[1] - 0.36 + 0.04, end[2]], [0.3, 0.6, 0]);
  if (t.tailTip === "spade") tip.add(plate(m.accent, SPADE, 0.04));
  else if (t.tailTip === "flame") tip.add(cone(m.accent, 0.11, 0.3));
  else if (t.tailTip === "leaf") tip.add(ellipsoid(m.accent, [0.1, 0.2, 0.035], { at: [0, 0.14, 0] }));
  else tip.add(ellipsoid(m.accent, [0.1, 0.1, 0.1], { at: [0, 0.06, 0] }));
  tail.add(tip);
  body.add(tail);
  wiggles.push({ obj: tail, axis: "y", amp: 0.22, speed: 2.4, phase: 0 });

  for (let i = 0; i < t.spines; i++) {
    const a = 0.5 + i * 0.32;
    body.add(cone(m.accent, 0.06, 0.13, { at: [0, 0.72 + Math.cos(a) * 0.58, -Math.sin(a) * 0.46], rot: [-a, 0, 0] }));
  }

  return {
    body, head, wiggles, flaps,
    face: { eyes: e.open, happy: e.happy, irises: e.irises, mouth: mo },
    charmAt: { parent: head, at: [0, 0.4, 0.08], rot: [0.15, 0, 0] },
    height: 1.38 + 0.42 + 0.2 * H,
  };
}
