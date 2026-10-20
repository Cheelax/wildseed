// The parts creatures are built from: ellipsoids, capsules, cones, tapered tubes, and the face kit
// (eyes, mouths, cheeks) and charms every species shares.
import * as THREE from "three";
import { CLASS, PATTERN, flat, toon } from "./toon.js";

const SPHERE = new THREE.SphereGeometry(1, 22, 16);
const HEMISPHERE = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const CONE = new THREE.ConeGeometry(1, 1, 14, 1);
const CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
const OCTAHEDRON = new THREE.OctahedronGeometry(1, 0);
CONE.translate(0, 0.5, 0); // cones grow up from their base
CYLINDER.translate(0, 0.5, 0);
for (const g of [SPHERE, HEMISPHERE, CONE, CYLINDER, OCTAHEDRON]) g.userData.shared = true;

/** A mesh that casts a shadow, placed with optional position, rotation (Euler XYZ) and scale. */
export function mesh(geometry, material, { at, rot, scale } = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (at) m.position.set(...at);
  if (rot) m.rotation.set(...rot);
  if (scale) typeof scale === "number" ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = true;
  return m;
}

export const ellipsoid = (material, [rx, ry, rz], options = {}) => mesh(SPHERE, material, { ...options, scale: [rx, ry, rz] });
export const dome = (material, [rx, ry, rz], options = {}) => mesh(HEMISPHERE, material, { ...options, scale: [rx, ry, rz] });
export const cone = (material, radius, height, options = {}) => mesh(CONE, material, { scale: [radius, height, radius], ...options });
export const cylinder = (material, radius, height, options = {}) => mesh(CYLINDER, material, { scale: [radius, height, radius], ...options });
export const gem = (material, [rx, ry, rz], options = {}) => mesh(OCTAHEDRON, material, { ...options, scale: [rx, ry, rz] });

/** A group whose origin is a joint: its children hang from there, and it turns around it. */
export function joint(at = [0, 0, 0], rot = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...at);
  g.rotation.set(...rot);
  return g;
}

/** A tube along `points` whose radius goes from r0 to r1: tails, tentacles, antennae, horns. */
export function tube(material, points, r0, r1, { radial = 8, segments = 16 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
      pos.push(c.x + r * n.x, c.y + r * n.y, c.z + r * n.z);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1); // counter-clockwise seen from outside
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  const m = mesh(g, material);
  m.add(ellipsoid(material, [r1, r1, r1], { at: points.at(-1) })); // a round end
  return m;
}

/** A flat 2D shape (wing, bolt, star) given a thickness, facing +z. */
export function plate(material, outline, depth) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return mesh(g, material);
}

/** The point at `yaw` and `pitch` (radians from the front, +z) on an ellipsoid, and its normal. */
export function surface([rx, ry, rz], yaw, pitch) {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const k = 1 / Math.hypot(d.x / rx, d.y / ry, d.z / rz);
  const point = d.multiplyScalar(k);
  const normal = new THREE.Vector3(point.x / (rx * rx), point.y / (ry * ry), point.z / (rz * rz)).normalize();
  return { point, normal };
}

const FORWARD = new THREE.Vector3(0, 0, 1);
/** A group on an ellipsoid's surface, its +z along the surface's normal: where a face part sits. */
export function onSurface(radii, yaw, pitch, lift = 0) {
  const { point, normal } = surface(radii, yaw, pitch);
  const g = new THREE.Group();
  g.position.copy(point).addScaledVector(normal, lift);
  g.quaternion.setFromUnitVectors(FORWARD, normal);
  return g;
}

/** An arc of a tube in the xy plane, `span` radians centered on the bottom: a smile, a closed eye. */
export function arc(material, radius, thickness, span = Math.PI) {
  const g = new THREE.TorusGeometry(radius, thickness, 5, 12, span);
  g.rotateZ(-Math.PI / 2 - span / 2);
  return mesh(g, material);
}

/**
 * One eye of a style and radius: the dark of it, which rolls toward what the creature looks at, its
 * highlights, which stay where the light is, and a squeezed, happy version shown while it laughs.
 */
export function eye(style, r, colors) {
  const dark = flat(colors.eyeDark);
  const white = flat("#ffffff");
  const open = new THREE.Group();
  const iris = new THREE.Group();
  iris.userData.reach = r * 0.16;
  open.add(iris);
  if (style === "gem") {
    iris.add(ellipsoid(dark, [r, r * 1.15, r * 0.42]));
    iris.add(ellipsoid(flat(colors.iris), [r * 0.74, r * 0.88, r * 0.46], { at: [0, -r * 0.06, r * 0.04] }));
    iris.add(ellipsoid(dark, [r * 0.4, r * 0.5, r * 0.5], { at: [0, -r * 0.06, r * 0.08] }));
  } else if (style === "tall") {
    iris.add(ellipsoid(dark, [r * 0.72, r * 1.3, r * 0.42]));
  } else if (style === "sleepy") {
    iris.add(ellipsoid(dark, [r * 1.05, r * 0.62, r * 0.4], { at: [0, -r * 0.2, 0] }));
  } else if (style === "button") {
    iris.add(ellipsoid(dark, [r * 0.62, r * 0.66, r * 0.4]));
  } else {
    iris.add(ellipsoid(dark, [r, r * 1.08, r * 0.42]));
  }
  // The light comes from the upper left: one big highlight there, a small one across.
  const big = style === "button" ? 0.3 : 0.36;
  open.add(ellipsoid(white, [r * big, r * big, r * 0.3], { at: [-r * (style === "tall" ? 0.24 : 0.32), r * (style === "sleepy" ? 0.0 : 0.36), r * 0.32] }));
  if (style !== "button" && style !== "sleepy") open.add(ellipsoid(white, [r * 0.15, r * 0.15, r * 0.3], { at: [r * 0.3, -r * 0.34, r * 0.32] }));
  const closed = arc(dark, r * 0.7, r * 0.2, Math.PI * 0.9);
  closed.rotation.z = Math.PI; // ∩: a happy, squeezed eye
  closed.visible = false;
  for (const o of [open, closed]) o.traverse((c) => (c.castShadow = false));
  return { open, closed, iris };
}

/** A pair of eyes on the front of a head ellipsoid of radii `head`, `level` radians up. */
export function eyes(head, traits, colors, { level = 0.12, scale = 1 } = {}) {
  const group = new THREE.Group();
  const r = Math.min(head[0], head[1]) * 0.29 * traits.eyeSize * scale;
  const yaw = 0.42 * traits.eyeGap * Math.min(1.3, 0.56 / head[0]);
  const open = [], happy = [], irises = [];
  for (const side of [-1, 1]) {
    const socket = onSurface(head, side * yaw, level, r * 0.08);
    const e = eye(traits.eyes, r, colors);
    socket.add(e.open, e.closed);
    group.add(socket);
    open.push(e.open);
    happy.push(e.closed);
    irises.push(e.iris);
  }
  return { group, open, happy, irises, radius: r, yaw };
}

/** The mouth, at `level` radians on the front of the ellipsoid `on`: its idle shape and an open one. */
export function mouth(on, traits, colors, { level = -0.2, size = 0.07 } = {}) {
  const m = size;
  const group = onSurface(on, 0, level, m * 0.15);
  const idle = new THREE.Group(), open = new THREE.Group();
  const lips = flat(colors.mouth);
  const tongue = flat(colors.tongue);
  const white = flat("#ffffff");
  if (traits.mouth === "cat") {
    idle.add(arc(lips, m * 0.55, m * 0.2), arc(lips, m * 0.55, m * 0.2));
    idle.children[0].position.x = -m * 0.52;
    idle.children[1].position.x = m * 0.52;
  } else if (traits.mouth === "open") {
    idle.add(ellipsoid(lips, [m * 0.6, m * 0.55, m * 0.3]), ellipsoid(tongue, [m * 0.42, m * 0.22, m * 0.3], { at: [0, -m * 0.28, m * 0.06] }));
  } else if (traits.mouth === "beam") {
    idle.add(ellipsoid(lips, [m * 1.05, m * 0.62, m * 0.3], { at: [0, -m * 0.1, 0] }), ellipsoid(tongue, [m * 0.6, m * 0.24, m * 0.3], { at: [0, -m * 0.42, m * 0.06] }));
  } else {
    idle.add(arc(lips, m * 0.8, m * 0.24, Math.PI * 0.85));
    if (traits.mouth === "fang") idle.add(cone(white, m * 0.24, m * 0.5, { at: [m * 0.42, -m * 0.6, m * 0.12], rot: [0, 0, Math.PI] }));
  }
  open.add(ellipsoid(lips, [m * 0.75, m * 0.8, m * 0.3]), ellipsoid(tongue, [m * 0.5, m * 0.3, m * 0.3], { at: [0, -m * 0.4, m * 0.06] }));
  open.visible = false;
  group.add(idle, open);
  group.traverse((o) => (o.castShadow = false));
  return { group, idle, open };
}

/** Blushing cheeks below and outside the eyes, when the creature has them. */
export function cheeks(head, traits, colors, eyePair, level = 0.12) {
  const group = new THREE.Group();
  if (!traits.cheeks) return group;
  const blush = flat(colors.blush);
  const r = eyePair.radius;
  for (const side of [-1, 1]) {
    const cheek = onSurface(head, side * (eyePair.yaw + 0.3), level - 0.2, r * 0.05);
    cheek.add(ellipsoid(blush, [r * 0.62, r * 0.36, r * 0.2]));
    group.add(cheek);
  }
  group.traverse((o) => (o.castShadow = false));
  return group;
}

/** A whole face on one head: eyes, mouth, cheeks. Returns what the animation moves. */
export function face(head, traits, colors, { eyeLevel = 0.12, mouthLevel = -0.2, scale = 1, withMouth = true } = {}) {
  const e = eyes(head, traits, colors, { level: eyeLevel, scale });
  const group = new THREE.Group();
  group.add(e.group, cheeks(head, traits, colors, e, eyeLevel));
  let m = null;
  if (withMouth) {
    m = mouth(head, traits, colors, { level: mouthLevel, size: e.radius * 0.62 });
    group.add(m.group);
  }
  return { group, eyes: e.open, happy: e.happy, irises: e.irises, mouth: m, radius: e.radius };
}

/** Hue distance in degrees between two colors. */
export function hueGap(a, b) {
  const [x, y] = [new THREE.Color(a).getHSL({}), new THREE.Color(b).getHSL({})];
  return Math.abs(((x.h - y.h + 1.5) % 1) - 0.5) * 360;
}

/** The colors of a creature's parts, from its palette. A bright eye that would melt into the body turns to its complement. */
export function colorsOf(genome) {
  const [body, belly, accent, detail, eye, ink] = genome.palette;
  const blushBase = new THREE.Color(accent).lerp(new THREE.Color("#ff7c96"), 0.65);
  const iris = new THREE.Color(eye);
  if (iris.getHSL({}).s > 0.4 && hueGap(eye, body) < 50) iris.offsetHSL(0.5, 0, 0);
  return {
    body, belly, accent, detail, ink,
    iris,
    eyeDark: genome.traits.eyes === "gem" ? new THREE.Color(ink).lerp(new THREE.Color("#000000"), 0.3) : iris,
    mouth: new THREE.Color(ink).lerp(new THREE.Color("#3a1020"), 0.4),
    tongue: "#ff6f8e",
    blush: blushBase,
  };
}

/** Materials of a creature: its body with its marking, belly, accent, detail. */
export function materialsOf(genome) {
  const c = colorsOf(genome);
  const { marking } = genome.traits;
  const stars = genome.rare ? 0.12 : 0;
  const markOf = (scale, front = 0.92) => {
    if (marking === "spots") return { color: c.accent, pattern: PATTERN.spots, scale: 2.6 * scale, cut: 0.3, offset: 3.7, front };
    if (marking === "stripes") return { color: c.accent, pattern: PATTERN.stripes, scale: 3.2 * scale, cut: 0.4, offset: 0.1 };
    if (marking === "patch") return { color: c.accent, pattern: PATTERN.patch, cut: 0.62, at: [0.55, 0.45, 0.55] };
    return null;
  };
  return {
    colors: c,
    body: toon(c.body, { mark: markOf(1), stars }),
    torso: toon(c.body, { mark: markOf(1), belly: { color: c.belly, nz: 0.42, top: 0.25 }, stars }),
    head: toon(c.body, {
      mark: marking === "mask" ? { color: c.accent, pattern: PATTERN.mask, cut: 0.2, at: [0, 0.12, 0] } : markOf(0.8, 0.35),
      stars,
    }),
    limb: toon(marking === "socks" ? c.accent : c.body, { stars }),
    plain: toon(c.body, { stars }),
    belly: toon(c.belly),
    accent: toon(c.accent),
    detail: toon(c.detail),
    shine: flat("#ffffff", CLASS.creature),
    nose: flat(new THREE.Color(c.ink).lerp(new THREE.Color("#ff8fa3"), 0.25), CLASS.face),
  };
}

/** The affinity charm a creature wears: a sprout, a crystal, a bolt… Grows up from its origin. */
export function charm(kind, mats) {
  const g = new THREE.Group();
  const leaf = toon("#7cc95a");
  const stem = toon("#5c9a43");
  if (kind === "sprout") {
    g.add(cylinder(stem, 0.025, 0.2));
    for (const s of [-1, 1]) g.add(ellipsoid(leaf, [0.12, 0.035, 0.07], { at: [s * 0.1, 0.22, 0], rot: [0, 0, s * 0.45] }));
  } else if (kind === "leaf") {
    g.add(cylinder(stem, 0.022, 0.12));
    g.add(ellipsoid(leaf, [0.16, 0.03, 0.26], { at: [0, 0.14, 0.04], rot: [0.35, 0, 0.2] }));
  } else if (kind === "flower") {
    g.add(cylinder(stem, 0.022, 0.16));
    const petal = mats.accent;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(ellipsoid(petal, [0.07, 0.03, 0.05], { at: [Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08], rot: [0, -a, 0] }));
    }
    g.add(ellipsoid(toon("#ffd75e"), [0.05, 0.04, 0.05], { at: [0, 0.19, 0] }));
  } else if (kind === "mushroom") {
    g.add(cylinder(toon("#f4ead2"), 0.045, 0.12));
    g.add(dome(toon("#e8574e", { mark: { color: "#fff6e8", pattern: PATTERN.spots, scale: 4, cut: 0.28, offset: 1 } }), [0.15, 0.11, 0.15], { at: [0, 0.1, 0] }));
  } else if (kind === "pebble") {
    g.add(ellipsoid(mats.detail, [0.13, 0.08, 0.11], { at: [0, 0.05, 0], rot: [0.2, 0.4, 0.1] }));
  } else if (kind === "crystal") {
    g.add(gem(mats.accent, [0.06, 0.2, 0.06], { at: [0, 0.14, 0] }));
    g.add(gem(mats.accent, [0.045, 0.13, 0.045], { at: [0.08, 0.08, 0.02], rot: [0, 0, -0.5] }));
    g.add(gem(mats.accent, [0.04, 0.11, 0.04], { at: [-0.07, 0.07, -0.02], rot: [0, 0, 0.55] }));
  } else if (kind === "stack") {
    g.add(ellipsoid(mats.detail, [0.13, 0.055, 0.12], { at: [0, 0.04, 0] }));
    g.add(ellipsoid(mats.accent, [0.1, 0.05, 0.09], { at: [0.01, 0.13, 0], rot: [0, 0, 0.12] }));
    g.add(ellipsoid(mats.detail, [0.065, 0.045, 0.06], { at: [-0.01, 0.21, 0] }));
  } else if (kind === "bolt") {
    const bolt = plate(mats.accent, [[-0.02, 0], [0.08, 0.16], [0.02, 0.16], [0.1, 0.32], [-0.06, 0.12], [0.0, 0.12], [-0.08, 0]], 0.05);
    g.add(bolt);
  } else if (kind === "orb") {
    g.add(tube(mats.detail, [[0, 0, 0], [0.03, 0.12, 0], [0.1, 0.2, 0], [0.16, 0.2, 0]], 0.022, 0.018, { segments: 10 }));
    g.add(ellipsoid(flat(mats.colors.accent, CLASS.creature), [0.075, 0.075, 0.075], { at: [0.18, 0.15, 0] }));
  } else if (kind === "star") {
    g.add(cylinder(mats.detail, 0.02, 0.14));
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 0.055 : 0.13;
      pts.push([Math.cos(a) * r, 0.24 + Math.sin(a) * r]);
    }
    g.add(plate(mats.accent, pts, 0.05));
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}
