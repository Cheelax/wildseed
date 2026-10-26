// Pipkin: a round bird that is mostly face. A crest on top, a beak, wing nubs and a fan of tail feathers.
import { cone, ellipsoid, eyes, cheeks, joint } from "../parts.js";

export function pipkin(g, m) {
  const t = g.traits;
  const R = 0.78 + 0.12 * t.build;
  const ball = [R, 0.84, R * 0.94];
  const body = joint();
  const head = joint([0, 0.9, 0]);
  body.add(head);
  head.add(ellipsoid(m.torso, ball));

  const e = eyes(ball, t, m.colors, { level: 0.24, scale: 1.05 });
  head.add(e.group, cheeks(ball, t, m.colors, e, 0.24));

  // The beak is the mouth: it opens when the bird cries.
  const beakAt = joint([0, 0.06, ball[2] - 0.03]);
  const upper = cone(m.detail, 0.11 * t.beak, 0.2 * t.beak, { rot: [Math.PI / 2, 0, 0] });
  const lower = joint([0, -0.03, 0]);
  lower.add(cone(m.detail, 0.08 * t.beak, 0.13 * t.beak, { rot: [Math.PI / 2 + 0.3, 0, 0] }));
  beakAt.add(upper, lower);
  head.add(beakAt);

  const wiggles = [], flaps = [];
  const crest = joint([0, ball[1] - 0.06, -0.08]);
  for (let i = 0; i < t.crest; i++) {
    const spread = (i - (t.crest - 1) / 2) * 0.42;
    const feather = joint([spread * 0.12, 0, 0], [-0.35, 0, -spread]);
    feather.add(ellipsoid(m.accent, [0.07, 0.24 * t.crestLength, 0.05], { at: [0, 0.2 * t.crestLength, 0] }));
    crest.add(feather);
    wiggles.push({ obj: feather, axis: "x", amp: 0.08, speed: 3.1, phase: i });
  }
  head.add(crest);

  for (const side of [-1, 1]) {
    const wing = joint([side * R * 0.92, 0.86, -0.02], [0, 0, side * 0.2]);
    wing.add(ellipsoid(m.body, [0.1, 0.3 * t.wings, 0.22 * t.wings], { at: [side * 0.04, -0.16 * t.wings, 0] }));
    body.add(wing);
    flaps.push({ obj: wing, axis: "z", amp: side * 0.9 });
    wiggles.push({ obj: wing, axis: "z", amp: side * 0.05, speed: 2.2, phase: 0 });
  }

  const tail = joint([0, 0.6, -R * 0.84]);
  for (let i = 0; i < t.tailFeathers; i++) {
    const spread = (i - (t.tailFeathers - 1) / 2) * 0.36;
    const feather = joint([0, 0, 0], [-0.95, 0, spread]);
    feather.add(ellipsoid(m.accent, [0.06, 0.2, 0.045], { at: [0, 0.17, 0] }));
    tail.add(feather);
  }
  body.add(tail);
  wiggles.push({ obj: tail, axis: "y", amp: 0.18, speed: 4.2, phase: 0.5 });

  for (const side of [-1, 1]) body.add(ellipsoid(m.detail, [0.12, 0.05, 0.17], { at: [side * 0.27, 0.05, 0.24] }));

  return {
    body, head, wiggles, flaps,
    face: { eyes: e.open, happy: e.happy, irises: e.irises, mouth: { idle: null, open: null, jaw: lower } },
    anchors: {
      top: { parent: head, at: [0, ball[1] - 0.05, -0.06] },
      back: { parent: head, at: [0, ball[1] * 0.55, -R * 0.72], rot: [-0.9, 0, 0] },
      rear: { parent: body, at: [0, 0.6, -R * 0.84] },
      neck: { parent: head, at: [0, -0.42, 0], r: R * 0.84 },
    },
    charmAt: t.crest > 1 ? null : { parent: head, at: [0.18, ball[1] - 0.07, 0.05], rot: [0, 0, -0.35] },
    height: 0.9 + ball[1] + 0.2 * t.crestLength,
  };
}
