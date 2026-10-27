// The egg, decorated by affinity and tinted by the creature inside. It drops and wobbles; a jagged crack
// starts on the side facing you and runs around it in three knocks, branching, chips of shell flying.
// Then the cap pops off and the creature's head peeks out of the bottom; at last the bottom falls open
// in three pieces as the creature climbs out (see Stage: HATCH and the emergence).
import * as THREE from "three";
import { CLASS, PATTERN, flat, toon } from "./toon.js";
import { gem, mesh } from "./parts.js";
import { hash32, stream } from "../genome/genes.mjs";

const HEIGHT = 1.3;
const TAU = Math.PI * 2;
/** The middle height of the break, where the creature's head comes out. */
export const RIM = HEIGHT * 0.56;
/** The angle of the side that faces the camera: the crack starts there. */
const FRONT = 0.4;

/** Egg patterns by affinity; the creature inside lends the egg its colors. */
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

const onShell = (a, y, lift = 0) => new THREE.Vector3(Math.sin(a) * (radiusAt(y) + lift), y, Math.cos(a) * (radiusAt(y) + lift));

/**
 * Where the egg breaks: a jagged line of nine teeth of uneven widths and heights, the same for a seed
 * every time. Returns the teeth's angles and the line's height at any angle.
 */
function breakLine(seed) {
  const r = stream(hash32(`crack\u0000${seed}`));
  const teeth = Array.from({ length: 9 }, (_, i) => [((i + 0.15 + 0.7 * r()) / 9) * TAU, RIM + (i % 2 ? 1 : -1) * (0.05 + 0.1 * r())]);
  const heightAt = (a) => {
    a = ((a % TAU) + TAU) % TAU;
    const k = teeth.findIndex(([at]) => at > a);
    const [a1, y1] = teeth[k < 0 ? 0 : k];
    const [a0, y0] = teeth[k <= 0 ? teeth.length - 1 : k - 1];
    const f = (((a - a0) % TAU) + TAU) % TAU / ((((a1 - a0) % TAU) + TAU) % TAU);
    return y0 + (y1 - y0) * f;
  };
  return { teeth: teeth.map(([a]) => a), heightAt };
}

/** The angles from a0 to a1: evenly spaced, and every tooth between them, so the edges stay sharp. */
function anglesFrom(a0, a1, teeth, step = TAU / 96) {
  const out = [];
  for (let a = a0; a < a1; a += step) out.push(a);
  for (const t of teeth) for (const k of [-1, 0, 1]) if (t + k * TAU > a0 && t + k * TAU < a1) out.push(t + k * TAU);
  return [...out, a1].sort((x, y) => x - y);
}

/** A piece of shell over `angles`, from height from(a) up to to(a). */
function piece(material, angles, from, to) {
  const up = 12;
  const pos = [], idx = [];
  for (const a of angles) {
    for (let j = 0; j <= up; j++) {
      const p = onShell(a, from(a) + (to(a) - from(a)) * (j / up));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < angles.length - 1; i++) {
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

/** A dark crack along points on the shell, revealed from its start as it grows. */
function crack(material, points, radius = 0.02) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
  const segments = points.length * 3;
  const g = new THREE.TubeGeometry(path, segments, radius, 4, false);
  const m = new THREE.Mesh(g, material);
  m.userData.segments = segments;
  m.visible = false;
  return m;
}

/** Shows the first `f` of a crack, from 0 (none) to 1 (all of it). */
function grow(line, f) {
  line.visible = f > 0;
  line.geometry.setDrawRange(0, Math.round(f * line.userData.segments) * 4 * 6);
}

/**
 * The egg's colors: its affinity's shell tinted by the creature's belly and marked in its body color; a child's
 * egg is tinted by one parent and marked in the other's color.
 */
function lookOf(genome, parents) {
  if (genome.rare) return STARLIT;
  const [tint, mark] = parents ? [parents[0].palette[0], parents[1].palette[0]] : [genome.palette[1], genome.palette[0]];
  const shell = new THREE.Color(LOOKS[genome.affinity].shell).lerp(new THREE.Color(tint), parents ? 0.35 : 0.5);
  return { ...LOOKS[genome.affinity], shell: `#${shell.getHexString()}`, mark };
}

export class Egg {
  constructor(genome, { parents = null } = {}) {
    const look = lookOf(genome, parents);
    this.material = toon(look.shell, { mark: { color: look.mark, ...look.pattern }, cls: CLASS.egg, side: THREE.DoubleSide });
    const dark = flat(new THREE.Color(look.mark).lerp(new THREE.Color("#2a1e18"), 0.7), CLASS.egg);
    const r = stream(hash32(`shell\u0000${genome.seed}`));
    const { teeth, heightAt } = breakLine(genome.seed);

    this.root = new THREE.Group();
    this.wobble = new THREE.Group();
    this.root.add(this.wobble);
    // The cap turns about its own middle as it flies off.
    this.cap = new THREE.Group();
    this.cap.position.set(0, RIM + 0.25, 0);
    const top = piece(this.material, anglesFrom(0, TAU, teeth), heightAt, () => HEIGHT);
    top.position.set(0, -(RIM + 0.25), 0);
    this.cap.add(top);
    this.wobble.add(this.cap);
    // The bottom, in three pieces that fall open outward, each from a hinge at its foot.
    this.petals = [0, 1, 2].map((k) => {
      const a0 = FRONT + Math.PI / 3 + (k * TAU) / 3, a1 = a0 + TAU / 3, mid = (a0 + a1) / 2;
      const hinge = new THREE.Group();
      hinge.position.set(Math.sin(mid) * 0.3, 0.04, Math.cos(mid) * 0.3);
      const shell = piece(this.material, anglesFrom(a0, a1, teeth), () => 0.002, heightAt);
      shell.position.copy(hinge.position).negate();
      hinge.add(shell);
      hinge.userData.axis = new THREE.Vector3(Math.cos(mid), 0, -Math.sin(mid));
      this.wobble.add(hinge);
      return hinge;
    });

    // The crack: from the front, both ways around, then a few short branches up and down.
    const along = (from, to) => anglesFrom(Math.min(from, to), Math.max(from, to), teeth, 0.06).map((a) => onShell(a, heightAt(a), 0.012));
    const left = along(FRONT, FRONT + Math.PI);
    const right = along(FRONT - Math.PI, FRONT).reverse();
    this.cracks = [crack(dark, left), crack(dark, right)];
    this.branches = [-0.5, 0.35, -1.2, 1.0].map((da, i) => {
      const a = FRONT + da + 0.15 * r();
      const y = heightAt(a), dir = i % 2 ? 1 : -1;
      return crack(dark, [onShell(a, y, 0.012), onShell(a + 0.06, y + dir * 0.07, 0.012), onShell(a - 0.02, y + dir * 0.13, 0.012)], 0.016);
    });
    this.wobble.add(...this.cracks, ...this.branches);

    // Chips knocked off by each crack, and the crumbs when it falls open.
    this.chips = [];
    for (let i = 0; i < 12; i++) {
      const s = gem(this.material, i < 3 ? [0.045, 0.035, 0.02] : [0.07, 0.05, 0.025]);
      const a = i < 3 ? FRONT + (i - 1) * 0.5 : (i / 9) * TAU;
      s.userData.from = i < 3 ? onShell(a, heightAt(a), 0.02) : new THREE.Vector3(0, RIM * 0.8, 0);
      s.userData.velocity = new THREE.Vector3(Math.sin(a) * (i < 3 ? 1.2 : 2.2), i < 3 ? 1.4 : 1.8 + (i % 3) * 0.6, Math.cos(a) * (i < 3 ? 1.2 : 2.2));
      s.userData.spin = new THREE.Vector3(3 + i, 5 - i * 0.5, 2);
      s.userData.size = s.scale.clone();
      s.visible = false;
      this.root.add(s);
      this.chips.push(s);
    }
  }

  /**
   * Poses the egg at `t` seconds into the hatch: it drops (or, `laid` by two parents, pops up out of the
   * ground between them), wobbles harder as it cracks at each of `cracks`, loses its cap at `open` and falls
   * apart at `burst`. Returns false once nothing is left.
   */
  pose(t, { drop, cracks, open, burst }, { laid = false } = {}) {
    const { root, wobble, cap } = this;
    if (t < drop && laid) {
      // It swells up from nothing, a little past its size, and settles.
      const s = t / drop;
      root.position.y = 0;
      wobble.scale.setScalar(Math.max(0.001, s * (1 + 0.5 * (1 - s))));
    } else if (t < drop) {
      const s = t / drop;
      root.position.y = 2.4 * (1 - s * s);
      wobble.scale.set(1, 1, 1);
    } else {
      root.position.y = 0;
      const land = t - drop;
      const squash = land < 0.18 ? 0.14 * Math.sin((land / 0.18) * Math.PI) : 0;
      wobble.scale.set(1 + squash, 1 - squash, 1 + squash);
    }
    // It shakes harder as it cracks, with a jolt at every knock, and stills once the cap is off.
    const knocks = cracks.filter((c) => t >= c).length;
    const sinceKnock = knocks ? t - cracks[knocks - 1] : Infinity;
    const shaking = t > drop + 0.12 && t < open;
    const k = 0.35 + 0.22 * knocks + (sinceKnock < 0.12 ? 0.6 : 0);
    wobble.rotation.z = shaking ? 0.11 * k * Math.sin((t - drop) * 24) : 0;
    wobble.rotation.x = shaking ? 0.05 * k * Math.sin((t - drop) * 17) : 0;
    const reach = [0, 0.3, 0.62, 1][knocks];
    for (const line of this.cracks) grow(line, t < burst ? reach : 0);
    this.branches.forEach((b, i) => grow(b, t < burst && knocks > Math.min(2, i) ? Math.min(1, (t - cracks[Math.min(2, i)]) / 0.1) : 0));

    const a = t - open;
    cap.visible = a < 0.7;
    if (a >= 0) {
      const fade = Math.max(0, 1 - Math.max(0, a - 0.3) / 0.35);
      cap.position.set(-0.7 * a, RIM + 0.25 + 2 * a - 2.6 * a * a, -0.35 * a);
      cap.rotation.set(-1.4 * a, 0, 3.2 * a);
      cap.scale.setScalar(Math.max(0.001, fade));
    } else {
      cap.position.set(0, RIM + 0.25, 0);
      cap.rotation.set(0, 0, 0);
      cap.scale.setScalar(1);
    }

    const b = t - burst;
    for (const hinge of this.petals) {
      hinge.visible = b < 0.65;
      const tip = b >= 0 ? 1.7 * Math.min(1, b / 0.32) ** 2 : 0;
      hinge.quaternion.setFromAxisAngle(hinge.userData.axis, tip);
      hinge.scale.setScalar(Math.max(0.001, 1 - Math.max(0, b - 0.25) / 0.4));
    }

    this.chips.forEach((s, i) => {
      const t0 = i < 3 ? cracks[i] : burst;
      const age = t - t0;
      s.visible = age >= 0 && age < 0.6;
      if (!s.visible) return;
      const v = s.userData.velocity, from = s.userData.from;
      s.position.set(from.x + v.x * age, from.y + v.y * age - 5 * age * age, from.z + v.z * age);
      s.rotation.set(s.userData.spin.x * age, s.userData.spin.y * age, s.userData.spin.z * age);
      s.scale.copy(s.userData.size).multiplyScalar(Math.max(0.01, 1 - age / 0.6));
    });
    return a < 0.7 || b < 0.65;
  }
}
