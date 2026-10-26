// Domeback: a slow walker under a dome of a shell, its head out in front on a short neck.
import * as THREE from "three";
import { cone, dome, ellipsoid, face, joint, mesh, tube } from "../parts.js";
import { PATTERN, toon } from "../toon.js";

export const SHELL_PATTERN = {
  plates: { pattern: PATTERN.plates, scale: 3.2, cut: 0.5, offset: 0.4 },
  rings: { pattern: PATTERN.rings, scale: 4.5, cut: 0.28, offset: 0.1 },
  spots: { pattern: PATTERN.spots, scale: 3.4, cut: 0.32, offset: 2.1 },
};

export function domeback(g, m) {
  const t = g.traits;
  const c = m.colors;
  const body = joint();
  const S = 0.66 * t.shell;
  const shellAt = [0, 0.3, -0.1];
  const shellMat = toon(c.accent, { mark: { color: c.detail, ...SHELL_PATTERN[t.shellPattern] } });
  body.add(dome(shellMat, [0.84 + 0.06 * t.build, S, 0.94], { at: shellAt }));
  const rim = mesh(new THREE.TorusGeometry(0.86 + 0.06 * t.build, 0.075, 6, 28), m.belly, { at: shellAt, rot: [Math.PI / 2, 0, 0], scale: [1, 1.08, 1] });
  body.add(rim);
  body.add(ellipsoid(m.belly, [0.8, 0.14, 0.88], { at: [0, 0.3, -0.1] }));

  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) body.add(ellipsoid(m.limb, [0.16, 0.2, 0.16], { at: [x * 0.52, 0.16, z * 0.46 - 0.08] }));
  body.add(cone(m.plain, 0.08, 0.2, { at: [0, 0.26, -0.98], rot: [-1.8, 0, 0] }));

  const N = t.neck;
  const hs = 0.46 * t.head;
  const radii = [hs, hs * 0.92, hs];
  const headAt = [0, 0.5 + 0.12 * N, 0.8 + 0.2 * N];
  body.add(tube(m.plain, [[0, 0.32, 0.5], [0, 0.42 + 0.06 * N, 0.62 + 0.1 * N], [headAt[0], headAt[1] - 0.05, headAt[2] - 0.08]], 0.15, 0.14, { segments: 8 }));
  const head = joint(headAt);
  body.add(head);
  head.add(ellipsoid(m.head, radii));
  const f = face(radii, t, m.colors, { eyeLevel: 0.12, mouthLevel: -0.32 });
  head.add(f.group);

  const wiggles = [], flaps = [];
  flaps.push({ obj: head, axis: "x", amp: -0.25 });

  return {
    body, head, wiggles, flaps,
    face: { eyes: f.eyes, happy: f.happy, irises: f.irises, mouth: f.mouth },
    anchors: {
      top: { parent: head, at: [0, radii[1] * 0.92, -0.02] },
      back: { parent: body, at: [0, shellAt[1] + S - 0.04, shellAt[2]] },
      rear: { parent: body, at: [0, 0.3, -0.96] },
      neck: { parent: head, at: [0, -radii[1] * 0.72, -0.1], r: hs * 0.9 },
    },
    charmAt: { parent: body, at: [0, shellAt[1] + S - 0.02, shellAt[2]], rot: [0, 0, 0] },
    height: Math.max(shellAt[1] + S + 0.3, headAt[1] + hs),
  };
}
