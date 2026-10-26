// Hopple: a hopper with a big head, long ears (up, flopped or out to the sides) and big feet.
import { ellipsoid, face, joint, onSurface } from "../parts.js";

const EARS = { up: [-0.12, 0.2], lop: [0.35, 2.25], side: [0, 1.2] };

export function hopple(g, m) {
  const t = g.traits;
  const body = joint();
  body.add(ellipsoid(m.torso, [0.58 + 0.1 * t.build, 0.55, 0.54], { at: [0, 0.58, 0] }));

  const radii = [0.6, 0.54, 0.54];
  const head = joint([0, 1.28, 0.06]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const f = face(radii, t, m.colors, { eyeLevel: 0.06, mouthLevel: -0.36 });
  head.add(f.group);
  const muzzle = onSurface(radii, 0, -0.2, -0.02);
  muzzle.add(ellipsoid(m.belly, [0.2, 0.13, 0.1]));
  muzzle.add(ellipsoid(m.nose, [0.06, 0.045, 0.05], { at: [0, 0.08, 0.08] }));
  head.add(muzzle);

  const wiggles = [], flaps = [];
  const [tilt, out] = EARS[t.ears];
  const L = t.earLength;
  for (const side of [-1, 1]) {
    const ear = joint([side * 0.22, 0.38, -0.06], [tilt, 0, -side * out]);
    ear.add(ellipsoid(m.plain, [0.12, 0.36 * L, 0.07], { at: [0, 0.34 * L, 0] }));
    ear.add(ellipsoid(m.accent, [0.065, 0.27 * L, 0.04], { at: [0, 0.34 * L, 0.04] }));
    head.add(ear);
    wiggles.push({ obj: ear, axis: "z", amp: 0.07, speed: 2.4, phase: side });
    flaps.push({ obj: ear, axis: "x", amp: -0.5 });
  }

  for (const side of [-1, 1]) {
    body.add(ellipsoid(m.limb, [0.16, 0.08, 0.28 * t.feet], { at: [side * 0.3, 0.07, 0.2] }));
    body.add(ellipsoid(m.limb, [0.1, 0.13, 0.1], { at: [side * 0.22, 0.56, 0.44] }));
  }
  const tail = joint([0, 0.36, -0.52]);
  tail.add(ellipsoid(m.belly, [0.17 * t.tailPuff, 0.16 * t.tailPuff, 0.15 * t.tailPuff]));
  body.add(tail);
  wiggles.push({ obj: tail, axis: "y", amp: 0.25, speed: 5, phase: 0 });

  return {
    body, head, wiggles, flaps,
    face: { eyes: f.eyes, happy: f.happy, irises: f.irises, mouth: f.mouth },
    top: { at: [0, radii[1] - 0.04, 0], r: radii[0] },
    charmAt: t.ears === "up" ? { parent: head, at: [0, 0.47, 0.12], rot: [0.2, 0, 0] } : { parent: head, at: [0, 0.49, 0], rot: [0, 0, 0] },
    height: 1.24 + (t.ears === "up" ? 0.5 + 0.7 * L : 0.6),
  };
}
