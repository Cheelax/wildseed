// The egg: two halves of a shell that meet along a zigzag, decorated by affinity. It drops, wobbles,
// cracks along the zigzag, then pops: the halves fly off, shards scatter, and the creature is out.
import * as THREE from "three";
import { CLASS, PATTERN, flat, toon } from "./toon.js";
import { gem, mesh } from "./parts.js";

const HEIGHT = 1.3;
const TEETH = 7;

/** Egg colors and patterns by affinity. */
const LOOKS = {
  moss: { shell: "#f3efd6", mark: "#8fca72", pattern: { pattern: PATTERN.spots, scale: 3.2, cut: 0.3, offset: 5.1 } },
  stone: { shell: "#dcd6ce", mark: "#9c8fa8", pattern: { pattern: PATTERN.rings, scale: 5, cut: 0.22, offset: 0.06 } },
  spark: { shell: "#fff1c4", mark: "#ffa63d", pattern: { pattern: PATTERN.zigzag, scale: 9, cut: 0.07, offset: 0.42 } },
};
const STARLIT = { shell: "#3a3d78", mark: "#ffd66b", pattern: { pattern: PATTERN.spots, scale: 4.2, cut: 0.16, offset: 2.3 } };

/** The egg's radius at height y (0 at the bottom, HEIGHT at the top): wider below the middle. */
function radiusAt(y) {
  const u = (y / HEIGHT) * 2 - 1;
  return 0.56 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.16 * u) + (u < -0.97 ? 0.04 : 0);
}

/** Where the halves meet, at angle a around the egg. */
const cutAt = (a) => HEIGHT * 0.56 + 0.1 * (Math.abs(((a / (Math.PI * 2)) * TEETH) % 1 - 0.5) * 2 - 0.5);

/** One half of the shell, as a grid running around the egg and up from `from(a)` to `to(a)`. */
function half(material, from, to) {
  const around = 56, up = 14;
  const pos = [], idx = [];
  for (let i = 0; i <= around; i++) {
    const a = (i / around) * Math.PI * 2;
    for (let j = 0; j <= up; j++) {
      const y = from(a) + (to(a) - from(a)) * (j / up);
      const r = radiusAt(y);
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  }
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < up; j++) {
      const p = i * (up + 1) + j, q = p + up + 1;
      idx.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, material);
}

/** The crack, a dark line along the zigzag that grows around the egg. */
function crackLine(material) {
  const pts = [];
  for (let i = 0; i <= TEETH * 2; i++) {
    const a = (i / (TEETH * 2)) * Math.PI * 2 + Math.PI / TEETH / 2;
    const y = cutAt(a);
    const r = radiusAt(y) + 0.012;
    pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0);
  const g = new THREE.TubeGeometry(curve, TEETH * 8, 0.022, 4, true);
  const m = new THREE.Mesh(g, material);
  m.userData.count = g.index.count;
  return m;
}

export class Egg {
  constructor(genome) {
    const look = genome.rare ? STARLIT : LOOKS[genome.affinity];
    this.material = toon(look.shell, { mark: { color: look.mark, ...look.pattern }, cls: CLASS.egg, side: THREE.DoubleSide });
    this.root = new THREE.Group();
    this.wobble = new THREE.Group();
    this.root.add(this.wobble);
    this.bottom = half(this.material, () => 0, cutAt);
    this.top = half(this.material, cutAt, () => HEIGHT);
    this.crack = crackLine(flat(new THREE.Color(look.mark).multiplyScalar(0.35), CLASS.egg));
    this.wobble.add(this.bottom, this.top, this.crack);
    this.shards = [];
    for (let i = 0; i < 9; i++) {
      const s = gem(this.material, [0.09, 0.06, 0.03]);
      const a = (i / 9) * Math.PI * 2 + 0.3;
      s.userData.velocity = new THREE.Vector3(Math.sin(a) * 2.4, 2.6 + (i % 3) * 0.8, Math.cos(a) * 2.4);
      s.userData.spin = new THREE.Vector3(3 + i, 5 - i * 0.5, 2);
      s.userData.size = s.scale.clone();
      s.visible = false;
      this.root.add(s);
      this.shards.push(s);
    }
  }

  /**
   * Poses the egg at `t` seconds into the hatch (see Stage.HATCH): it drops, wobbles harder as it
   * cracks, and at `pop` breaks open. Returns false once nothing of it is left to see.
   */
  pose(t, { drop = 0.32, pop = 1.3 } = {}) {
    const { root, wobble, top, bottom } = this;
    if (t < drop) {
      const s = t / drop;
      root.position.y = 2.4 * (1 - s * s);
      wobble.scale.set(1, 1, 1);
    } else {
      root.position.y = 0;
      const land = t - drop;
      const squash = land < 0.18 ? 0.14 * Math.sin((land / 0.18) * Math.PI) : 0;
      wobble.scale.set(1 + squash, 1 - squash, 1 + squash);
    }
    const shaking = t > drop + 0.15 && t < pop;
    const k = Math.max(0, (t - drop - 0.15) / (pop - drop - 0.15));
    wobble.rotation.z = shaking ? 0.2 * k * Math.sin((t - drop) * 26) : 0;
    wobble.rotation.x = shaking ? 0.08 * k * Math.sin((t - drop) * 19) : 0;
    const cracked = Math.min(1, Math.floor(k * 4) / 3);
    this.crack.visible = cracked > 0 && t < pop;
    this.crack.geometry.setDrawRange(0, Math.floor((cracked * this.crack.userData.count) / 6) * 6);

    const after = t - pop;
    const open = after >= 0;
    top.visible = bottom.visible = true;
    if (open) {
      const fade = Math.max(0, 1 - after / 0.55);
      top.position.set(-0.9 * after, 2.6 * after - 3 * after * after + 0.05, 0.2 * after);
      top.rotation.set(0, 0, 3 * after);
      bottom.position.set(0.5 * after, -0.6 * after * after, 0.25 * after);
      bottom.rotation.set(0, 0, -1.5 * after);
      top.scale.setScalar(fade);
      bottom.scale.setScalar(fade);
      top.visible = bottom.visible = fade > 0;
    } else {
      top.position.set(0, 0, 0);
      bottom.position.set(0, 0, 0);
      top.rotation.set(0, 0, 0);
      bottom.rotation.set(0, 0, 0);
      top.scale.setScalar(1);
      bottom.scale.setScalar(1);
    }
    for (const s of this.shards) {
      s.visible = open && after < 0.7;
      if (!s.visible) continue;
      const v = s.userData.velocity;
      s.position.set(v.x * after, HEIGHT * 0.55 + v.y * after - 4.5 * after * after, v.z * after);
      s.rotation.set(s.userData.spin.x * after, s.userData.spin.y * after, s.userData.spin.z * after);
      s.scale.copy(s.userData.size).multiplyScalar(Math.max(0.01, 1 - after / 0.7));
    }
    return !open || after < 0.7;
  }
}
