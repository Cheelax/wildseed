// Inchling: a caterpillar of round segments that rears its head up in an S.
import { cone, ellipsoid, face, joint } from "../parts.js";
import { antennae } from "../features.js";

export function inchling(g, m) {
  const t = g.traits;
  const n = t.segments;
  const body = joint();
  const wiggles = [], flaps = [];
  const striped = t.marking === "stripes";
  let last = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const s = i / n;
    const r = 0.22 + 0.13 * s + 0.04 * t.build;
    const lift = t.rise * 0.75 * Math.max(0, (s - 0.45) / 0.55) ** 1.6;
    const at = [0.1 * Math.sin(s * 5), r + lift, -0.85 + s * 1.25];
    const seg = joint(at);
    seg.add(ellipsoid(striped && i % 2 ? m.accent : m.plain, [r, r * 0.95, r * 0.9]));
    if (t.marking === "spots") for (const side of [-1, 1]) seg.add(ellipsoid(m.accent, [r * 0.22, r * 0.18, r * 0.22], { at: [side * r * 0.45, r * 0.78, 0] }));
    if (lift < 0.15) for (const side of [-1, 1]) seg.add(ellipsoid(m.belly, [r * 0.22, r * 0.16, r * 0.24], { at: [side * r * 0.55, -r * 0.82, r * 0.1] }));
    body.add(seg);
    wiggles.push({ obj: seg, axis: "y", amp: 0.04, speed: 3, phase: i * 0.8, move: true });
    last = at;
  }
  body.add(cone(m.detail, 0.08, 0.18, { at: [0, 0.2, -1.0], rot: [-1.9, 0, 0] }));

  const radii = [0.48, 0.45, 0.45];
  const head = joint([last[0], last[1] + 0.3 + 0.1 * t.rise, last[2] + 0.22]);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const f = face(radii, t, m.colors, { eyeLevel: 0.12, mouthLevel: -0.3 });
  head.add(f.group);

  const A = t.antennaLength;
  antennae(head, t, m, { at: [0, 0.33, -0.02], spread: 0.16, wiggles, flaps });

  return {
    body, head, wiggles, flaps,
    face: { eyes: f.eyes, happy: f.happy, irises: f.irises, mouth: f.mouth },
    top: { at: [0, radii[1] - 0.03, 0], r: radii[0] },
    charmAt: { parent: body, at: [0.1 * Math.sin(5 * 0.15), 0.6, -0.65], rot: [0, 0, 0] },
    height: head.position.y + 0.4 + 0.3 * A,
  };
}
