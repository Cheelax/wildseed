// Drift: a floating bell with a frilled skirt and tentacles that sway under it.
import * as THREE from "three";
import { ellipsoid, face, joint, mesh, tube } from "../parts.js";

/** The bell, turned on a lathe: a dome that flares at the rim and tucks in underneath. */
function bell(material, R, h) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R * Math.sin(a) * (1 + 0.1 * (i / 12) ** 3), h * Math.cos(a)));
  }
  pts.push(new THREE.Vector2(R * 1.06, -0.06), new THREE.Vector2(R * 0.8, -0.1), new THREE.Vector2(0.001, -0.06));
  const g = new THREE.LatheGeometry(pts, 24);
  g.computeVertexNormals();
  return mesh(g, material);
}

export function drift(g, m) {
  const t = g.traits;
  const R = 0.66 + 0.08 * t.build;
  const h = 0.8 * t.dome;
  const body = joint();
  const head = joint([0, 0.78, 0]);
  body.add(head);
  head.add(bell(m.torso, R, h));
  const radii = [R * 1.02, h, R * 1.02];
  const f = face(radii, t, m.colors, { eyeLevel: 0.42, mouthLevel: 0.2, scale: 0.95 });
  head.add(f.group);

  for (let i = 0; i < t.frills; i++) {
    const a = (i / t.frills) * Math.PI * 2;
    head.add(ellipsoid(m.accent, [0.13, 0.08, 0.11], { at: [Math.sin(a) * R * 0.98, -0.07, Math.cos(a) * R * 0.98], rot: [0, a, 0] }));
  }

  const wiggles = [], flaps = [];
  const L = 0.55 * t.tentacleLength;
  for (let i = 0; i < t.tentacles; i++) {
    const a = ((i + 0.5) / t.tentacles) * Math.PI * 2;
    const x = Math.sin(a) * R * 0.45, z = Math.cos(a) * R * 0.45;
    const arm = joint([x, -0.06, z]);
    const c = t.curl * 0.16;
    arm.add(tube(i % 2 ? m.plain : m.accent, [[0, 0, 0], [x * 0.15, -L * 0.35, z * 0.15], [x * 0.3 + c, -L * 0.7, z * 0.3], [x * 0.2 + c * 1.6, -L + c * 0.6, z * 0.2]], 0.075, 0.035, { segments: 12 }));
    head.add(arm);
    wiggles.push({ obj: arm, axis: "x", amp: 0.2, speed: 2.2, phase: i * 1.7 });
    wiggles.push({ obj: arm, axis: "z", amp: 0.16, speed: 1.7, phase: i * 0.9 });
    flaps.push({ obj: arm, axis: "x", amp: 0.5 * (z > 0 ? -1 : 1) });
  }

  if (t.antenna !== "none") {
    const top = joint([0, h - 0.03, -0.05]);
    if (t.antenna === "curl") top.add(tube(m.accent, [[0, 0, 0], [0.02, 0.18, 0], [0.14, 0.28, 0], [0.18, 0.18, 0], [0.1, 0.16, 0]], 0.04, 0.03, { segments: 14 }));
    else {
      top.add(tube(m.plain, [[0, 0, 0], [0.03, 0.14, 0], [0.08, 0.22, 0]], 0.035, 0.025, { segments: 8 }));
      top.add(ellipsoid(m.accent, [0.08, 0.08, 0.08], { at: [0.09, 0.26, 0] }));
    }
    head.add(top);
    wiggles.push({ obj: top, axis: "z", amp: 0.15, speed: 3, phase: 0 });
  }

  return {
    body, head, wiggles, flaps, hover: 0.25,
    face: { eyes: f.eyes, happy: f.happy, mouth: f.mouth },
    charmAt: t.antenna === "none" ? { parent: head, at: [0, h - 0.03, 0], rot: [0, 0, 0] } : null,
    height: 0.78 + h + (t.antenna === "none" ? 0.1 : 0.3),
  };
}
