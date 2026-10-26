// The stage: a floating island in an affinity's sky, a sun that casts pixel shadows, the egg, the
// creature and their effects. frame(t) poses all of it at t seconds after the hatch began: the page
// calls it every frame, the GIF calls it at the times it records.
import * as THREE from "three";
import { Creature } from "./creature.js";
import { Egg, RIM } from "./egg.js";
import { Fx } from "./fx.js";
import { MEET, Meeting } from "./meeting.js";
import { CLASS, PATTERN, ramp, tick, toon } from "./toon.js";
import { Shadows } from "./shadow.js";
import { cone, cylinder, ellipsoid, gem, hueGap, mesh } from "./parts.js";
import { hash32, stream } from "../genome/genes.mjs";
import { dispose } from "./dispose.js";

/**
 * The hatch, in seconds: the egg lands, cracks three times as it shakes, its cap pops off and the head
 * peeks out (open), the shell falls apart as the creature climbs out (burst), and it is ready.
 */
export const HATCH = { drop: 0.32, cracks: [0.62, 0.86, 1.08], open: 1.28, burst: 1.84, ready: 2.45 };

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

/** The four bands of an affinity's sky, top first. */
export const skyOf = (affinity) => WORLDS[affinity].sky;

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 60);
    this.sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.8);
    this.sun.position.set(-3.5, 7, 5);
    this.shadows = new Shadows(this.sun.position, 2.3);
    this.scene.add(this.sun, this.sun.target, new THREE.AmbientLight(0xffffff, Math.PI * 0.3));
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.fx = new Fx(this.scene);
    this.center = new THREE.Vector3(0, 1, 0);
  }

  /**
   * Builds the island, the egg and the creature of a genome, ready to hatch from t = 0. With `parents`, they
   * first meet and lay the egg (meeting.js); `quick` starts with the creature out, for a page that just
   * opened: a smile at once, with a little hop.
   */
  set(genome, { parents = null, quick = false } = {}) {
    this.genome = genome;
    dispose(this.world);
    this.world.clear();
    const look = { ...WORLDS[genome.affinity], grass: groundFor(WORLDS[genome.affinity].grass, genome.palette[0]) };
    this.world.add(island(look, genome.seed));
    this.egg = new Egg(genome);
    this.creature = new Creature(genome);
    this.world.add(this.egg.root, this.creature.root);
    this.meeting = parents ? new Meeting(parents) : null;
    if (this.meeting) this.world.add(this.meeting.root);
    // The hatch's own clock starts at `start` once `lead` seconds of meeting are over.
    this.lead = this.meeting ? MEET.lead : 0;
    this.quick = quick && !this.meeting;
    this.start = this.meeting ? HATCH.drop + 0.2 : this.quick ? HATCH.ready + 0.15 : 0;
    const at = (h) => this.lead + h - this.start;
    this.timing = {
      cracks: HATCH.cracks.filter((c) => c >= this.start).map(at),
      open: HATCH.open >= this.start ? at(HATCH.open) : null,
      burst: at(HATCH.burst),
      ready: at(HATCH.ready),
    };
    // What happens, for the page to tell: when the parents meet, the egg is laid, it hatches, the child is out.
    this.cues = this.meeting
      ? [[0, "meet"], [MEET.lay, "lay"], [this.lead + 0.3, "hatch"], [this.timing.burst + 0.15, "out"], [this.timing.ready + 2.2, null]]
      : [];
    // What of the creature is still in its shell is not drawn: everything below this plane.
    this.shell = new THREE.Plane(new THREE.Vector3(0, 1, 0), 10);
    this.creature.root.traverse((o) => {
      for (const m of [o.material ?? []].flat()) m.clippingPlanes = [this.shell];
    });
    // The parents keep all of themselves, but through the same shaders as their child: no new ones to build.
    const keep = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100);
    this.meeting?.root.traverse((o) => {
      for (const m of [o.material ?? []].flat()) m.clippingPlanes = [keep];
    });
    // Everything casts its shadow on the island; the creature's only once it is out of the egg.
    this.shadows.color = ramp(look.grass)[1];
    this.shadows.cast(this.world);
    this.creatureShadows = [];
    this.creature.root.traverse((o) => o.userData.shadow && this.creatureShadows.push(o));
    // Its size at rest, for the cameras: a sphere around the creature, egg and pop included.
    this.creature.pose(0);
    const box = new THREE.Box3().setFromObject(this.creature.root);
    // While it peeks out of the egg it is small enough to fit in the shell, its head above the rim.
    const size = box.getSize(new THREE.Vector3());
    const small = THREE.MathUtils.clamp(0.95 / Math.max(size.x, size.z), 0.35, 0.7);
    this.emerge = { small, low: RIM - 0.9 * box.max.y * small, high: RIM - 0.55 * box.max.y * small };
    box.union(new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.6), new THREE.Vector3(0.6, 1.3, 0.6)));
    this.bounds = box.getBoundingSphere(new THREE.Sphere());
    this.fx.setup(genome, this.creature.height, this.bounds.radius);
    if (this.meeting) {
      // The family needs room: the parents come from the island's edges and watch from either side.
      this.bounds.radius = Math.max(this.bounds.radius, 2.4);
      this.bounds.center.y = Math.max(this.bounds.center.y, 0.95);
      this.fx.burst("hearts", MEET.arrive + 0.05, new THREE.Vector3(0, 1.3, 0));
    }
    this.center.set(0, this.bounds.center.y, 0);
    if (this.timing.open !== null) this.fx.burst("sparkles", this.timing.open, new THREE.Vector3(0, RIM + 0.3, 0));
    this.fx.burst("puff", this.timing.burst, new THREE.Vector3(0, RIM * 0.7, 0));
    // A child with a mutation comes out in a second burst of sparkles: something new.
    if (genome.mutations?.length && this.timing.burst > 0) this.fx.burst("sparkles", this.timing.burst + 0.35, new THREE.Vector3(0, this.creature.height * 0.8, 0.2));
    this.colors = {
      sky: look.sky,
      ink: { ground: look.ink, decor: look.ink, creature: genome.palette[5], egg: genome.rare ? "#14122e" : "#3b3328" },
    };
    this.pokes = [];
  }

  /** Frees everything this stage holds on the GPU. */
  dispose() {
    dispose(this.world);
    dispose(this.fx.group);
    this.shadows.material.dispose();
  }

  /** Remembers that the creature was poked at time t: it jumps, laughs and hearts float up. */
  poke(t) {
    this.pokes.push(t);
    this.fx.burst("hearts", t, new THREE.Vector3(0, this.creature.height * 0.9, 0.3));
  }

  /** The same for one of the parents watching it. */
  pokeParent(i, t) {
    const p = this.meeting.parents[i];
    this.meeting.poke(i, t);
    this.fx.burst("hearts", t, p.root.position.clone().setY(p.height * 0.9));
  }

  /** The hatch's own clock at stage time t: it waits at `start` while the parents meet. */
  hatchTime(t) {
    return this.start + Math.max(0, t - this.lead);
  }

  /** Poses everything at t seconds after the hatch (or the meeting) began. `look` steers the creature's eyes. */
  frame(stageTime, { look = null, crying = false } = {}) {
    tick(stageTime);
    const t = this.hatchTime(stageTime);
    const { egg, creature } = this;
    egg.root.visible = egg.pose(t, HATCH);
    if (this.meeting) {
      // The egg pops out between the parents, overshooting a little, then sits until the meeting is over.
      const k = Math.min(1, (stageTime - MEET.lay) / 0.3);
      egg.root.visible &&= k >= 0;
      egg.root.scale.setScalar(Math.max(0.001, 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2));
      this.meeting.pose(stageTime, this.timing.burst);
    }
    const { open, burst, ready } = HATCH;
    creature.root.visible = t >= open;
    for (const s of this.creatureShadows) s.visible = t >= burst;
    if (t >= open) {
      const { small, low, high } = this.emerge;
      let scale = 1, y = 0, cries = false, shellAt = -10;
      if (t < burst) {
        // The cap is off: only its head is out, pushing up, wriggling, looking around.
        const s = (t - open) / (burst - open);
        scale = small;
        y = low + (high - low) * (1 - (1 - s) ** 3) + 0.015 * Math.sin(t * 38) * (1 - s);
        shellAt = RIM - 0.1;
      } else if (t < ready) {
        // The shell falls open: the body shows from the top down as the pieces fall away, and the
        // creature grows to its full size and hops out.
        const s = (t - burst) / (ready - burst);
        const g = s * s * (3 - 2 * s);
        scale = small + (1 - small) * g + 0.07 * Math.sin(Math.PI * s);
        y = high * (1 - g) + 0.3 * Math.sin(Math.PI * s);
        shellAt = RIM - 0.1 - (RIM + 0.6) * Math.min(1, s / 0.55);
        cries = s > 0.1 && s < 0.8;
      }
      if (this.quick && stageTime < 0.4) {
        // Out at once: it pops up from a squat.
        const k = stageTime / 0.4 - 1;
        scale *= 0.8 + 0.2 * (1 + 2.7 * k ** 3 + 1.7 * k ** 2);
      }
      this.shell.constant = -shellAt;
      creature.root.scale.setScalar(scale);
      creature.root.position.y = y;
      const past = this.pokes.filter((p) => p <= stageTime);
      const react = past.length ? stageTime - past.at(-1) : Infinity;
      this.doing = creature.pose(t - open, { look, react, pokes: past.length - 1, crying: crying || cries });
    } else this.doing = { habit: null, s: 0 };
    this.fx.pose(stageTime, this.center, this.doing);
  }

  /**
   * After frame(): this frame also draws, far under the island, what this stage has not drawn yet but may,
   * the egg and a sprite. A GPU in software builds what it draws the first time it draws it, which takes a
   * while: better once the creature is out (the page calls it then) than in the next hatch or the first poke.
   */
  warm() {
    this.egg.root.visible = true;
    this.egg.root.position.y = -60;
    this.fx.warm();
  }
}

/**
 * The island's ground, turned away from the creature's body color when the two are close, so that a
 * green creature never stands on grass of its own green.
 */
function groundFor(ground, body) {
  const c = new THREE.Color(ground);
  const b = new THREE.Color(body).getHSL({});
  const g = c.getHSL({});
  if (b.s > 0.25 && hueGap(ground, body) < 40) {
    // Away from the body, but staying a color grass can be (yellow-green to teal) when it can.
    const away = ((b.h - g.h + 1.5) % 1) - 0.5 > 0 ? -1 : 1;
    const grassy = (h) => h >= 60 / 360 && h <= 170 / 360;
    const turn = grassy(g.h + (away * 42) / 360) || !grassy(g.h - (away * 42) / 360) ? away : -away;
    c.offsetHSL((turn * 42) / 360, -0.05, 0);
  }
  if (Math.abs(c.getHSL({}).l - b.l) < 0.08) c.offsetHSL(0, 0, g.l > b.l ? 0.08 : -0.08);
  return `#${c.getHexString()}`;
}

/** The floating island: a faceted disc of ground over a cone of rock, with decor seeded by the word. */
function island(look, seed) {
  const g = new THREE.Group();
  const grass = toon(look.grass, { cls: CLASS.ground, bands: [0.42, 0.6, 1.2] });
  const dirt = toon(look.dirt, { cls: CLASS.ground, mark: { color: look.rock, pattern: PATTERN.rings, scale: 6, cut: 0.25, offset: 0.1 } });
  const top = mesh(new THREE.CylinderGeometry(2.35, 2.2, 0.36, 11, 1), [dirt, grass, dirt], { at: [0, -0.18, 0] });
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
  for (let i = 0; i < 3; i++) g.add(farIsland(r, i, look));
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

/** Another little island far off in the sky, hazy with distance: the world goes on out there. */
function farIsland(r, i, look) {
  const haze = (c) => toon(new THREE.Color(c).lerp(new THREE.Color(look.sky[2]), 0.5), { cls: CLASS.fx, bands: [0.42, 0.62, 1.2] });
  const g = new THREE.Group();
  const a = (i / 3) * Math.PI * 2 + 0.8 + r() * 1.2;
  const d = 16 + r() * 5;
  g.position.set(Math.sin(a) * d, -2.5 + r() * 4, Math.cos(a) * d);
  g.scale.setScalar(0.7 + r() * 0.6);
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.5, 0.3, 9, 1), [haze(look.dirt), haze(look.grass), haze(look.dirt)]));
  g.add(mesh(new THREE.ConeGeometry(1.5, 1.4, 9, 1), haze(look.rock), { at: [0, -0.85, 0], rot: [Math.PI, 0, 0] }));
  if (r() < 0.65) {
    g.add(cylinder(haze(look.dirt), 0.12, 0.7, { at: [0.3, 0.1, 0] }));
    g.add(cone(haze(new THREE.Color(look.grass).multiplyScalar(0.8)), 0.6, 1.3, { at: [0.3, 0.6, 0] }));
  } else g.add(mesh(new THREE.DodecahedronGeometry(0.5, 0), haze(look.rock), { at: [-0.3, 0.3, 0.2] }));
  g.traverse((o) => (o.castShadow = false));
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
