// Flutterling: a fluffy moth that hovers on two pairs of wings, a ruff around its neck and feathered
// antennae on its head. Its wings can carry eyespots.
import { ellipsoid, face, joint, plate, tube } from "../parts.js";

/** Wing outlines, the root at the origin, spreading to +x. */
export const UPPER = {
  round: [[0, 0], [0.22, 0.3], [0.5, 0.44], [0.74, 0.4], [0.84, 0.22], [0.74, 0.04], [0.48, -0.06], [0.2, -0.05]],
  pointed: [[0, 0], [0.26, 0.32], [0.62, 0.46], [0.9, 0.5], [0.72, 0.2], [0.5, 0.02], [0.2, -0.05]],
  swallowtail: [[0, 0], [0.22, 0.3], [0.5, 0.42], [0.76, 0.36], [0.8, 0.16], [0.6, 0.0], [0.2, -0.05]],
};
export const LOWER = {
  round: [[0, 0], [0.3, 0.02], [0.5, -0.12], [0.48, -0.32], [0.3, -0.38], [0.12, -0.25]],
  pointed: [[0, 0], [0.32, 0.02], [0.54, -0.16], [0.4, -0.36], [0.18, -0.3]],
  swallowtail: [[0, 0], [0.3, 0.02], [0.46, -0.15], [0.42, -0.3], [0.56, -0.64], [0.34, -0.44], [0.1, -0.25]],
};

export function flutterling(g, m) {
  const t = g.traits;
  const c = m.colors;
  const B = 0.4 + 0.06 * t.build;
  const body = joint();
  body.add(ellipsoid(m.torso, [B, B * 1.12, B * 0.95], { at: [0, 0.72, -0.04] }));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    body.add(ellipsoid(m.belly, [0.13 * t.fluff, 0.11 * t.fluff, 0.13 * t.fluff], { at: [Math.sin(a) * 0.32, 1.1, Math.cos(a) * 0.28 + 0.02] }));
  }
  for (const side of [-1, 1]) for (const z of [0.18, -0.12]) body.add(tube(m.detail, [[side * 0.16, 0.42, z], [side * 0.22, 0.24, z + 0.04], [side * 0.2, 0.1, z + 0.06]], 0.03, 0.025, { segments: 6 }));

  const radii = [0.42, 0.4, 0.4];
  const head = joint([0, 1.4, 0.08]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const f = face(radii, t, c, { eyeLevel: 0.08, mouthLevel: -0.36 });
  head.add(f.group);

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const ant = joint([side * 0.14, 0.34, -0.02], [-0.25, 0, -side * 0.3]);
    const pts = [[0, 0, 0], [side * 0.04, 0.2, 0], [side * 0.12, 0.36, -0.04], [side * 0.24, 0.44, -0.08]];
    ant.add(tube(m.detail, pts, 0.025, 0.02, { segments: 10 }));
    if (t.antennae === "feather") {
      for (let k = 1; k <= 4; k++) {
        const s = k / 5;
        ant.add(ellipsoid(m.accent, [0.03, 0.09 - 0.012 * k, 0.015], { at: [side * (0.03 + 0.22 * s * s), 0.1 + 0.36 * s, -0.02 - 0.06 * s], rot: [0, 0, side * 0.9] }));
        ant.add(ellipsoid(m.accent, [0.03, 0.09 - 0.012 * k, 0.015], { at: [side * (0.0 + 0.22 * s * s), 0.12 + 0.36 * s, -0.02 - 0.06 * s], rot: [0, 0, -side * 0.6] }));
      }
    } else ant.add(ellipsoid(m.accent, [0.07, 0.07, 0.07], { at: pts[3] }));
    head.add(ant);
    wiggles.push({ obj: ant, axis: "z", amp: 0.1, speed: 2.6, phase: side });
  }

  // Wings wide enough to frame the body from most sides: a moth is its wings.
  const W = t.wings * 1.35;
  for (const side of [-1, 1]) {
    const wing = joint([side * 0.16, 1.0, -0.22], [0.1, side * 0.28, -side * 0.18]);
    for (const [shape, y, scale] of [[UPPER[t.wingShape], 0.04, 1], [LOWER[t.wingShape], -0.02, 0.88]]) {
      const w = plate(m.accent, shape, 0.03);
      w.scale.set(side * W * scale, W * scale, 1);
      w.position.y = y;
      wing.add(w);
    }
    if (t.eyespots) {
      const spot = joint([side * 0.5 * W, 0.2 * W, 0.02]);
      spot.add(ellipsoid(m.belly, [0.1 * W, 0.1 * W, 0.02]), ellipsoid(m.body, [0.05 * W, 0.05 * W, 0.025]));
      wing.add(spot);
    }
    body.add(wing);
    wiggles.push({ obj: wing, axis: "y", amp: side * 0.28, speed: 5.5, phase: 0 });
    flaps.push({ obj: wing, axis: "y", amp: side * -0.6 });
  }

  return {
    body, head, wiggles, flaps, hover: 0.32,
    face: { eyes: f.eyes, happy: f.happy, irises: f.irises, mouth: f.mouth },
    anchors: {
      top: { parent: head, at: [0, 0.38, -0.06] },
      back: { parent: body, at: [0, 1.0, -0.36], rot: [-0.5, 0, 0] },
      rear: { parent: body, at: [0, 0.52, -0.42] },
      neck: { parent: body, at: [0, 1.1, 0.02], r: 0.34 },
    },
    charmAt: { parent: head, at: [0, 0.38, -0.16], rot: [-0.3, 0, 0] },
    height: 1.4 + 0.4 + 0.45,
  };
}
