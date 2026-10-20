// Prickle: a round hedgehog of spines with a soft face that pokes out in front.
import * as THREE from "three";
import { cone, ellipsoid, face, joint, onSurface } from "../parts.js";

const UP = new THREE.Vector3(0, 1, 0);

export function prickle(g, m) {
  const t = g.traits;
  const back = [0.68 + 0.08 * t.build, 0.6, 0.7];
  const body = joint();
  const ball = joint([0, 0.62, -0.08]);
  ball.add(ellipsoid(m.body, back));
  body.add(ball);

  // Spines on a golden-angle spiral, kept to the back and the top.
  const n = t.spikes * 2;
  const spine = t.spikeTip === "round" ? null : m.detail;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (dir.z > 0.3 || dir.y < -0.3) continue;
    const at = new THREE.Vector3(dir.x * back[0], dir.y * back[1], dir.z * back[2]).multiplyScalar(0.86);
    const normal = new THREE.Vector3(at.x / back[0] ** 2, at.y / back[1] ** 2, at.z / back[2] ** 2).normalize();
    const L = 0.3 * t.spikeLength;
    const s = spine
      ? cone(spine, 0.085, L)
      : ellipsoid(m.detail, [0.075, L * 0.6, 0.075], { at: [0, L * 0.4, 0] });
    const holder = new THREE.Group();
    holder.position.copy(at);
    holder.quaternion.setFromUnitVectors(UP, normal);
    holder.add(s);
    ball.add(holder);
  }

  const radii = [0.5, 0.46, 0.4];
  const head = joint([0, 0.6, 0.4]);
  body.add(head);
  head.add(ellipsoid(m.belly, radii));
  const f = face(radii, t, m.colors, { eyeLevel: 0.2, mouthLevel: -0.42 });
  head.add(f.group);
  const muzzle = onSurface(radii, 0, -0.12, -0.04);
  muzzle.add(ellipsoid(m.belly, [0.14, 0.11, 0.1 + 0.08 * t.muzzle], { at: [0, 0, 0.04] }));
  muzzle.add(ellipsoid(m.nose, [0.065, 0.05, 0.05], { at: [0, 0.03, 0.12 + 0.08 * t.muzzle] }));
  head.add(muzzle);

  const wiggles = [], flaps = [];
  for (const side of [-1, 1]) {
    const ear = joint([side * 0.3, 0.32, -0.08], [0, 0, -side * 0.5]);
    ear.add(ellipsoid(m.plain, [0.1 * t.ears, 0.12 * t.ears, 0.05], { at: [0, 0.07, 0] }));
    ear.add(ellipsoid(m.accent, [0.05 * t.ears, 0.07 * t.ears, 0.03], { at: [0, 0.07, 0.03] }));
    head.add(ear);
    wiggles.push({ obj: ear, axis: "z", amp: 0.12, speed: 3, phase: side });
    flaps.push({ obj: ear, axis: "z", amp: side * 0.5 });
  }
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) body.add(ellipsoid(m.limb, [0.11, 0.07, 0.15], { at: [x * 0.3, 0.06, z * 0.3 + 0.06] }));
  flaps.push({ obj: ball, axis: "x", amp: -0.12 });

  return {
    body, head, wiggles, flaps,
    face: { eyes: f.eyes, happy: f.happy, mouth: f.mouth },
    charmAt: { parent: ball, at: [0, back[1] + 0.18 * t.spikeLength, -0.1], rot: [0, 0, 0] },
    height: 0.62 + back[1] + 0.25 * t.spikeLength,
  };
}
