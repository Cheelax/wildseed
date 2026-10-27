// Toadle: a squat frog with its eyes up on two domes, a wide grin, and a throat that swells when it sings.
import { ellipsoid, eye, cheeks, joint, mouth, onSurface } from "../parts.js";

export function toadle(g, m) {
  const t = g.traits;
  const W = 0.74 + 0.1 * t.build;
  const torso = [W, 0.46, 0.64];
  const body = joint();
  // A frog is all head: the whole squat body turns a little to look.
  const head = joint([0, 0.5, 0.04]);
  body.add(head);
  head.add(ellipsoid(m.torso, torso));

  const D = 0.21 * t.domes;
  const r = D * 0.62 * t.eyeSize;
  const open = [], happy = [], irises = [];
  for (const side of [-1, 1]) {
    const dome = joint([side * 0.3 * t.eyeGap, 0.36, 0.2]);
    dome.add(ellipsoid(m.head, [D, D * 0.95, D]));
    const socket = onSurface([D, D * 0.95, D], side * 0.28, 0.12, r * 0.08);
    const e = eye(t.eyes, r, m.colors);
    socket.add(e.open, e.closed);
    dome.add(socket);
    head.add(dome);
    open.push(e.open);
    happy.push(e.closed);
    irises.push(e.iris);
  }
  head.add(cheeks(torso, t, m.colors, { radius: r, yaw: 0.42 }, 0.1));
  const mo = mouth(torso, t, m.colors, { level: 0.02, size: 0.2 });
  head.add(mo.group);

  // The throat sac, under the grin: it breathes, and swells when the frog cries.
  const throat = joint([0, -0.2, torso[2] * 0.78]);
  throat.add(ellipsoid(m.belly, [0.22 * t.throat, 0.15 * t.throat, 0.14 * t.throat]));
  head.add(throat);

  const L = t.legs;
  for (const side of [-1, 1]) {
    body.add(ellipsoid(m.limb, [0.25 * L, 0.21 * L, 0.34 * L], { at: [side * (W - 0.06), 0.24, -0.14], rot: [0.3, 0, side * 0.2] }));
    body.add(ellipsoid(m.limb, [0.15, 0.05, 0.22 * L], { at: [side * (W + 0.02), 0.04, 0.14], rot: [0, -side * 0.35, 0] }));
    body.add(ellipsoid(m.limb, [0.08, 0.19, 0.08], { at: [side * 0.4, 0.17, 0.42] }));
    for (let k = -1; k <= 1; k++) body.add(ellipsoid(m.detail, [0.04, 0.03, 0.04], { at: [side * 0.4 + k * 0.06, 0.03, 0.54 - Math.abs(k) * 0.02] }));
  }

  return {
    body, head, wiggles: [], flaps: [], puffs: [throat],
    face: { eyes: open, happy, irises, mouth: mo },
    anchors: {
      top: { parent: head, at: [0, 0.42, -0.14] },
      back: { parent: head, at: [0, 0.38, -0.34], rot: [-0.5, 0, 0] },
      rear: { parent: head, at: [0, 0.08, -0.62] },
      neck: { parent: head, at: [0, -0.16, 0], r: W * 0.9, rot: [0.15, 0, 0] },
    },
    charmAt: { parent: head, at: [0, 0.44, -0.12], rot: [0, 0, 0] },
    height: 0.5 + 0.36 + D * 1.9,
  };
}
