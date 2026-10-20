// The stage: a floating island in an affinity's sky, a sun that casts pixel shadows, the egg, the
// creature and their effects. frame(t) poses all of it at t seconds after the hatch began: the page
// calls it every frame, the GIF calls it at the times it records.
import * as THREE from "three";
import { Creature } from "./creature.js";
import { Egg } from "./egg.js";
import { Fx } from "./fx.js";
import { CLASS, PATTERN, tick, toon } from "./toon.js";
import { cone, cylinder, ellipsoid, gem, mesh } from "./parts.js";
import { hash32, stream } from "../genome/genes.mjs";

/** The hatch, in seconds: the egg lands, shakes and cracks, pops; the creature is out and ready. */
export const HATCH = { drop: 0.32, pop: 1.3, ready: 1.85 };

/**
 * Puts a camera where it sees a sphere of `radius` around `center`, `margin` times over, from a little
 * to the right and above. Returns its distance.
 */
export function aim(camera, center, radius, margin, { azimuth = 0.4, elevation = 0.2 } = {}) {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const d = (radius * margin) / Math.sin(Math.min(vfov, hfov) / 2);
  camera.position.set(center.x + d * Math.sin(azimuth) * Math.cos(elevation), center.y + d * Math.sin(elevation), center.z + d * Math.cos(azimuth) * Math.cos(elevation));
  camera.lookAt(center);
  return d;
}

/** Each affinity's ground, sky (top band first) and outline inks. */
const WORLDS = {
  moss: { grass: "#8fd06e", dirt: "#b47d55", rock: "#8c6a55", sky: ["#8fd3ea", "#a9def0", "#c4e9ef", "#ddf3ea"], ink: "#24331f", decor: ["tuft", "flower", "mushroom", "tuft", "bush"] },
  stone: { grass: "#c9c6b8", dirt: "#9b908a", rock: "#7d7270", sky: ["#a7b2e2", "#bac3ea", "#ccd2ef", "#dfe1f2"], ink: "#2a2633", decor: ["pebble", "rock", "pebble", "crystal", "cairn"] },
  spark: { grass: "#e4cd6b", dirt: "#c98a52", rock: "#a8694a", sky: ["#f7a98f", "#f9bf98", "#fbd4a6", "#fde6bd"], ink: "#3a2416", decor: ["crystal", "tuft", "flower", "crystal", "rock"] },
};

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 60);
    this.sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.8);
    this.sun.position.set(-3.5, 7, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512);
    Object.assign(this.sun.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 20 });
    this.sun.shadow.bias = -0.002;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target, new THREE.AmbientLight(0xffffff, Math.PI * 0.3));
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.fx = new Fx(this.scene);
    this.center = new THREE.Vector3(0, 1, 0);
  }

  /** Builds the island, the egg and the creature of a genome, ready to hatch from t = 0. */
  set(genome) {
    this.genome = genome;
    this.world.clear();
    const look = WORLDS[genome.affinity];
    this.world.add(island(look, genome.seed));
    this.egg = new Egg(genome);
    this.creature = new Creature(genome);
    this.world.add(this.egg.root, this.creature.root);
    // Its size at rest, for the cameras: a sphere around the creature, egg and pop included.
    this.creature.pose(0);
    const box = new THREE.Box3().setFromObject(this.creature.root);
    box.union(new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.6), new THREE.Vector3(0.6, 1.3, 0.6)));
    this.bounds = box.getBoundingSphere(new THREE.Sphere());
    this.center.set(0, this.bounds.center.y, 0);
    this.fx.setup(genome, this.creature.height);
    this.fx.burst("puff", HATCH.pop, new THREE.Vector3(0, 0.6, 0));
    this.colors = {
      sky: look.sky,
      ink: { ground: look.ink, decor: look.ink, creature: genome.palette[5], egg: genome.rare ? "#14122e" : "#3b3328" },
    };
    this.pokes = [];
  }

  /** Remembers that the creature was poked at time t: it jumps, laughs and hearts float up. */
  poke(t) {
    this.pokes.push(t);
    this.fx.burst("hearts", t, new THREE.Vector3(0, this.creature.height * 0.9, 0.3));
  }

  /** Poses everything at t seconds after the hatch began. `look` steers the creature's eyes. */
  frame(t, { look = null, crying = false } = {}) {
    tick(t);
    const { egg, creature } = this;
    const eggVisible = egg.pose(t, HATCH);
    egg.root.visible = eggVisible;
    const out = t >= HATCH.pop;
    creature.root.visible = out;
    if (out) {
      const s = Math.min(1, (t - HATCH.pop) / (HATCH.ready - HATCH.pop));
      const pop = s < 1 ? 1 - Math.cos(s * Math.PI * 2.5) * Math.exp(-4 * s) : 1;
      creature.root.scale.setScalar(Math.max(0.05, pop));
      creature.root.position.y = s < 1 ? 0.6 * Math.sin(s * Math.PI) : 0;
      const past = this.pokes.filter((p) => p <= t);
      const react = past.length ? t - past.at(-1) : Infinity;
      this.doing = creature.pose(t - HATCH.pop, { look, react, pokes: past.length - 1, crying: crying || (s > 0.2 && s < 0.9) });
    } else this.doing = { habit: null, s: 0 };
    this.fx.pose(t, this.camera, this.center, this.doing);
  }
}

/** The floating island: a faceted disc of ground over a cone of rock, with decor seeded by the word. */
function island(look, seed) {
  const g = new THREE.Group();
  const grass = toon(look.grass, { cls: CLASS.ground, bands: [0.42, 0.6, 1.2] });
  const dirt = toon(look.dirt, { cls: CLASS.ground, mark: { color: look.rock, pattern: PATTERN.rings, scale: 6, cut: 0.25, offset: 0.1 } });
  const top = mesh(new THREE.CylinderGeometry(2.35, 2.2, 0.36, 11, 1), [dirt, grass, dirt], { at: [0, -0.18, 0] });
  top.receiveShadow = true;
  top.castShadow = false;
  const under = mesh(new THREE.ConeGeometry(2.2, 1.7, 11, 1), toon(look.rock, { cls: CLASS.ground }), { at: [0, -0.36 - 0.85, 0], rot: [Math.PI, 0, 0] });
  under.castShadow = false;
  g.add(top, under);

  const r = stream(hash32(`island\u0000${seed}`));
  const kinds = look.decor;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5 + 0.35;
    const d = 1.45 + r() * 0.6;
    if (Math.cos(a) > 0.82) continue; // keep the front clear
    const item = decor(kinds[i % kinds.length], r, look);
    item.position.set(Math.sin(a) * d, 0, Math.cos(a) * d);
    item.rotation.y = r() * Math.PI * 2;
    g.add(item);
  }
  for (let i = 0; i < 5; i++) g.add(cloud(r, i));
  g.traverse((o) => {
    if (o.isMesh && o !== top && o !== under) o.receiveShadow = true;
  });
  return g;
}

function decor(kind, r, look) {
  const g = new THREE.Group();
  const mat = (c) => toon(c, { cls: CLASS.decor });
  if (kind === "tuft") {
    const blade = mat(new THREE.Color(look.grass).multiplyScalar(0.82));
    for (let i = 0; i < 3; i++) g.add(cone(blade, 0.07, 0.28 + 0.1 * i, { at: [(i - 1) * 0.07, 0, (i % 2) * 0.05], rot: [0, 0, (i - 1) * 0.3] }));
  } else if (kind === "flower") {
    g.add(cylinder(mat("#5c9a43"), 0.02, 0.24));
    const petal = mat(["#ff8fb0", "#ffffff", "#ffd45e", "#b99bff"][Math.floor(r() * 4)]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(ellipsoid(petal, [0.06, 0.025, 0.045], { at: [Math.cos(a) * 0.07, 0.26, Math.sin(a) * 0.07], rot: [0, -a, 0] }));
    }
    g.add(ellipsoid(mat("#ffcf4a"), [0.04, 0.035, 0.04], { at: [0, 0.27, 0] }));
  } else if (kind === "mushroom") {
    g.add(cylinder(mat("#f3e8cf"), 0.05, 0.14));
    g.add(ellipsoid(toon("#e5564d", { cls: CLASS.decor, mark: { color: "#fff4e4", pattern: PATTERN.spots, scale: 4, cut: 0.3, offset: 2 } }), [0.15, 0.1, 0.15], { at: [0, 0.15, 0] }));
  } else if (kind === "bush") {
    const leaf = mat(new THREE.Color(look.grass).multiplyScalar(0.75));
    g.add(ellipsoid(leaf, [0.26, 0.2, 0.24], { at: [0, 0.14, 0] }), ellipsoid(leaf, [0.18, 0.15, 0.17], { at: [0.2, 0.1, 0.08] }));
  } else if (kind === "pebble") {
    g.add(ellipsoid(mat("#b6afa6"), [0.16, 0.08, 0.13], { at: [0, 0.04, 0] }), ellipsoid(mat("#a29a92"), [0.09, 0.06, 0.08], { at: [0.2, 0.03, 0.05] }));
  } else if (kind === "rock") {
    g.add(mesh(new THREE.DodecahedronGeometry(0.24, 0), mat(look.rock), { at: [0, 0.12, 0], scale: [1, 0.8, 0.9] }));
  } else if (kind === "crystal") {
    const c = mat(["#9de7ff", "#ffe07a", "#d2a8ff"][Math.floor(r() * 3)]);
    g.add(gem(c, [0.08, 0.26, 0.08], { at: [0, 0.18, 0] }), gem(c, [0.06, 0.16, 0.06], { at: [0.1, 0.1, 0.03], rot: [0, 0, -0.5] }));
  } else if (kind === "cairn") {
    g.add(ellipsoid(mat("#b8b0a6"), [0.16, 0.07, 0.15], { at: [0, 0.06, 0] }), ellipsoid(mat("#a59d94"), [0.12, 0.06, 0.11], { at: [0, 0.18, 0] }), ellipsoid(mat("#c2bbb2"), [0.08, 0.05, 0.07], { at: [0, 0.28, 0] }));
  }
  return g;
}

/** A cloud far out in the sky, farther than the camera ever goes: it passes as the camera turns. */
function cloud(r, i) {
  const white = toon("#ffffff", { cls: CLASS.fx, bands: [0.3, 0.55, 2] });
  const g = new THREE.Group();
  const a = (i / 5) * Math.PI * 2 + r() * 0.8;
  g.position.set(Math.sin(a) * 26, -3 + r() * 9, Math.cos(a) * 26);
  g.scale.setScalar(2.4 + r() * 1.2);
  for (let k = 0; k < 3; k++) {
    const p = ellipsoid(white, [0.7 - k * 0.15, 0.36 - k * 0.06, 0.45], { at: [(k - 1) * 0.6, k === 1 ? 0.18 : 0, 0] });
    p.castShadow = false;
    g.add(p);
  }
  g.lookAt(0, g.position.y, 0);
  return g;
}
