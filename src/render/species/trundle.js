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

  const S = t.snout;
  const snoutRadii = [0.18, 0.15, 0.2 + 0.12 * S];
  const snout = joint([0, -0.1, 0.3 + 0.08 * S], [0.15, 0, 0]);
  snout.add(ellipsoid(m.belly, snoutRadii));
  snout.add(ellipsoid(m.nose, [0.08, 0.06, 0.06], { at: [0, 0.03, snoutRadii[2] - 0.01] }));
  const mo = mouth(snoutRadii, t, m.colors, { level: -0.55, size: e.radius * 0.55 });
  snout.add(mo.group);
  head.add(snout);

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const ear = joint([side * 0.26, 0.3, -0.04], [0, 0, -side * 0.5]);
    if (t.ears === "pointy") ear.add(cone(m.plain, 0.11, 0.26));
    else if (t.ears === "leaf") ear.add(ellipsoid(m.plain, [0.1, 0.2, 0.04], { at: [0, 0.16, 0], rot: [0, 0, -side * 0.7] }));
    else ear.add(ellipsoid(m.plain, [0.14, 0.14, 0.05], { at: [0, 0.08, 0] }));
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
    charmAt: { parent: body, at: [0, y + 0.42, -0.25], rot: [0, 0, 0] },
    height: y + 0.75,
  };
}
