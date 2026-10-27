// Trundle: a sturdy four-legged trotter with a long soft nose, a tail and a ridge along its back.
import { cone, cylinder, ellipsoid, eyes, cheeks, joint, mouth, tube } from "../parts.js";

export function trundle(g, m) {
  const t = g.traits;
  const legLength = 0.3 * t.legs;
  const y = legLength + 0.4;
  const body = joint();
  body.add(ellipsoid(m.torso, [0.5 + 0.1 * t.build, 0.44, 0.76], { at: [0, y, -0.05] }));

  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    body.add(cylinder(m.limb, 0.12, legLength + 0.12, { at: [x * 0.29, 0.04, z * 0.42 - 0.05] }));
    body.add(ellipsoid(m.limb, [0.14, 0.07, 0.16], { at: [x * 0.29, 0.06, z * 0.42 - 0.02] }));
  }

  const radii = [0.5, 0.47, 0.46];
  const head = joint([0, y + 0.3, 0.66]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const e = eyes(radii, t, m.colors, { level: 0.22 });
  head.add(e.group, cheeks(radii, t, m.colors, e, 0.22));

  // A soft snout that reaches forward and droops a little, like a tapir's, with a pad at its tip.
  const len = 0.3 + 0.3 * t.snout;
  const tip = [0, -0.2 - 0.07 * t.snout, 0.28 + len];
  head.add(tube(m.plain, [[0, -0.1, 0.24], [0, -0.13, 0.28 + len * 0.55], tip], 0.17, 0.115, { segments: 10 }));
  head.add(ellipsoid(m.nose, [0.1, 0.085, 0.05], { at: [tip[0], tip[1], tip[2] + 0.1], rot: [-0.25, 0, 0] }));
  const chin = joint([0, -0.24, 0.32]);
  const chinRadii = [0.16, 0.12, 0.16];
  chin.add(ellipsoid(m.belly, chinRadii));
  const mo = mouth(chinRadii, t, m.colors, { level: -0.1, size: e.radius * 0.5 });
  chin.add(mo.group);
  head.add(chin);
  for (let k = -1; k <= 1; k++) head.add(ellipsoid(m.accent, [0.07, 0.12, 0.07], { at: [k * 0.07, 0.46, 0.06 - Math.abs(k) * 0.04], rot: [0.4, 0, -k * 0.5] }));

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const ear = joint([side * 0.26, 0.3, -0.04], [0, 0, -side * 0.5]);
    if (t.ears === "pointy") ear.add(cone(m.plain, 0.13, 0.3));
    else if (t.ears === "leaf") ear.add(ellipsoid(m.plain, [0.12, 0.25, 0.045], { at: [0, 0.2, 0], rot: [0, 0, -side * 0.7] }));
    else ear.add(ellipsoid(m.plain, [0.17, 0.17, 0.05], { at: [0, 0.1, 0] }));
    ear.add(ellipsoid(m.accent, [0.06, 0.08, 0.03], { at: [0, 0.09, 0.03] }));
    head.add(ear);
    wiggles.push({ obj: ear, axis: "z", amp: 0.1, speed: 2.8, phase: side * 1.3 });
    flaps.push({ obj: ear, axis: "z", amp: side * 0.4 });
  }

  const tail = joint([0, y + 0.1, -0.78]);
  if (t.tail === "curl") tail.add(tube(m.plain, [[0, 0, 0], [0, 0.1, -0.15], [0, 0.28, -0.12], [0, 0.26, 0.0], [0, 0.16, -0.02]], 0.07, 0.04));
  else if (t.tail === "fluff") tail.add(ellipsoid(m.accent, [0.16, 0.26, 0.16], { at: [0, 0.18, -0.12], rot: [-0.6, 0, 0] }));
  else {
    tail.add(tube(m.plain, [[0, 0, 0], [0, 0.12, -0.14], [0, 0.18, -0.3]], 0.05, 0.035));
    tail.add(ellipsoid(m.accent, [0.09, 0.12, 0.09], { at: [0, 0.2, -0.36] }));
  }
  body.add(tail);
  wiggles.push({ obj: tail, axis: "y", amp: 0.35, speed: 5.5, phase: 0 });

  if (t.ridge !== "none") {
    for (let i = 0; i < 5; i++) {
      const z = 0.36 - i * 0.2;
      const top = y + 0.44 * Math.sqrt(Math.max(0, 1 - ((z + 0.05) / 0.76) ** 2)) - 0.04;
      if (t.ridge === "plates") body.add(cone(m.detail, 0.08, 0.16, { at: [0, top, z], rot: [-0.2, 0, 0], scale: [0.08, 0.16, 0.03] }));
      else body.add(ellipsoid(m.accent, [0.07, 0.1, 0.12], { at: [0, top + 0.03, z], rot: [-0.5, 0, 0] }));
    }
  }

  return {
    body, head, wiggles, flaps,
    face: { eyes: e.open, happy: e.happy, irises: e.irises, mouth: mo },
    anchors: {
      top: { parent: head, at: [0, 0.44, -0.04] },
      back: { parent: body, at: [0, y + 0.42, -0.1] },
      rear: { parent: body, at: [0, y + 0.1, -0.78] },
      neck: { parent: head, at: [0, -0.12, -0.32], r: 0.44, rot: [0.5, 0, 0] },
    },
    charmAt: { parent: body, at: [0, y + 0.42, -0.25], rot: [0, 0, 0] },
    height: y + 0.75,
  };
}
