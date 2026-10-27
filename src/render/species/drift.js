// Drift: a floating bell with a frilled skirt and tentacles that sway under it.
import * as THREE from "three";
import { ellipsoid, face, joint, mesh, tube } from "../parts.js";
import { PATTERN, toon } from "../toon.js";

/** The bell, turned on a lathe: a dome that flares at the rim and tucks in underneath. */
function bell(material, R, h) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R * Math.sin(a) * (1 + 0.1 * (i / 12) ** 3), h * Math.cos(a)));
  }
  pts.push(new THREE.Vector2(R * 1.06, -0.06), new THREE.Vector2(R * 0.8, -0.1), new THREE.Vector2(0.001, -0.06));
  const g = new THREE.LatheGeometry(pts.reverse(), 24); // bottom to top, so its faces look outward
  g.computeVertexNormals();
  return mesh(g, material);
}

/** A jelly wears its marking as polka dots or as rings around the bell. */
function bellMaterial(g, c, h) {
  const marking = g.traits.marking;
  const mark = marking === "spots" || marking === "patch"
    ? { color: c.accent, pattern: PATTERN.spots, scale: 3, cut: 0.26, offset: 1.3 }
    : marking === "stripes" || marking === "mask"
      ? { color: c.accent, pattern: PATTERN.rings, scale: 2.4 / h, cut: 0.22, offset: 0.12 }
      : null;
  return toon(c.body, { mark, belly: { color: c.belly, nz: 0.5, top: h * 0.55, bottom: 0.05 }, stars: g.rare ? 0.12 : 0 });
}

export function drift(g, m) {
  const t = g.traits;
  const c = m.colors;
  const R = 0.7 + 0.08 * t.build;
  const h = 0.86 * t.dome;
  const body = joint();
  const head = joint([0, 0.95, 0]);
  body.add(head);
  head.add(bell(bellMaterial(g, c, h), R, h));
  const radii = [R * 1.02, h, R * 1.02];
  const f = face(radii, t, c, { eyeLevel: 0.3, mouthLevel: 0.06 });
  head.add(f.group);

  for (let i = 0; i < t.frills; i++) {
    const a = (i / t.frills) * Math.PI * 2;
    head.add(ellipsoid(m.accent, [0.14, 0.08, 0.12], { at: [Math.sin(a) * R * 0.98, -0.07, Math.cos(a) * R * 0.98], rot: [0, a, 0] }));
  }

  const wiggles = [], flaps = [];
  const L = 0.5 * t.tentacleLength;
  for (let i = 0; i < t.tentacles; i++) {
    const a = ((i + 0.5) / t.tentacles) * Math.PI * 2;
    const x = Math.sin(a) * R * 0.5, z = Math.cos(a) * R * 0.5;
    const arm = joint([x, -0.06, z]);
    // Each tentacle hangs, then curls up at its tip: more for a curly drift.
    const k = 0.1 + t.curl * 0.16;
    const out = [x / R, z / R];
    arm.add(tube(i % 2 ? m.belly : m.accent, [[0, 0, 0], [out[0] * 0.04, -L * 0.4, out[1] * 0.04], [out[0] * (0.1 + k * 0.4), -L * 0.85, out[1] * (0.1 + k * 0.4)], [out[0] * (0.16 + k), -L - k * 0.2, out[1] * (0.16 + k)], [out[0] * (0.2 + k * 1.3), -L + k * 0.35, out[1] * (0.2 + k * 1.3)]], 0.08, 0.04, { segments: 14 }));
    head.add(arm);
    wiggles.push({ obj: arm, axis: "x", amp: 0.22, speed: 2.2, phase: i * 1.7 });
    wiggles.push({ obj: arm, axis: "z", amp: 0.18, speed: 1.7, phase: i * 0.9 });
    flaps.push({ obj: arm, axis: "x", amp: 0.5 * (z > 0 ? -1 : 1) });
  }

  if (t.antenna !== "none") {
    const top = joint([0, h - 0.03, -0.05]);
    if (t.antenna === "curl") top.add(tube(m.accent, [[0, 0, 0], [0.02, 0.18, 0], [0.14, 0.28, 0], [0.18, 0.18, 0], [0.1, 0.16, 0]], 0.045, 0.035, { segments: 14 }));
    else {
      top.add(tube(m.plain, [[0, 0, 0], [0.03, 0.14, 0], [0.08, 0.22, 0]], 0.04, 0.03, { segments: 8 }));
      top.add(ellipsoid(m.accent, [0.09, 0.09, 0.09], { at: [0.09, 0.27, 0] }));
    }
    head.add(top);
    wiggles.push({ obj: top, axis: "z", amp: 0.15, speed: 3, phase: 0 });
  }

  return {
    body, head, wiggles, flaps, hover: 0.5,
    face: { eyes: f.eyes, happy: f.happy, irises: f.irises, mouth: f.mouth },
    anchors: {
      top: { parent: head, at: [0, h - 0.03, 0] },
      back: { parent: head, at: [0, h * 0.72, -R * 0.6], rot: [-0.8, 0, 0] },
      rear: { parent: head, at: [0, h * 0.2, -R * 0.98] },
      neck: { parent: head, at: [0, -0.07, 0], r: R * 0.98 },
    },
    charmAt: t.antenna === "none" ? { parent: head, at: [0, h - 0.03, 0], rot: [0, 0, 0] } : null,
    height: 0.95 + h + (t.antenna === "none" ? 0.1 : 0.3),
  };
}
