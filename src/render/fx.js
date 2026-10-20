// Little effects, drawn in art pixels: hearts when the creature is poked, a puff when it hatches, the
// stars around a rare one, z's over a napping one, motes drifting in the air. Each sprite is a point
// whose size is a whole number of art pixels, so its pixels stay square however the camera turns.
// Like the creature, every effect is a function of time.
import * as THREE from "three";
import { CLASS } from "./toon.js";
import { dispose } from "./dispose.js";

const SHAPES = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  star: ["..#..", ".###.", "#####", ".###.", "..#.."],
  sparkle: ["..#..", "..#..", "##.##", "..#..", "..#.."],
  puff: [".###.", "#####", "#####", "#####", ".###."],
  z: ["####", "..#.", ".#..", "####"],
};

const SPRITE_VERTEX = /* glsl */ `
uniform float uSize;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize;
}`;
const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 uColor;
uniform vec2 uShape;
uniform float uScale;
uniform float uSize;
void main() {
  vec2 cell = floor(gl_PointCoord * uSize / uScale) - floor((uSize / uScale - uShape) / 2.0);
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uShape.x || cell.y >= uShape.y) discard;
  if (texture2D(map, (cell + 0.5) / uShape).a < 0.5) discard;
  gl_FragColor = vec4(uColor, ${CLASS.fx}.0 / 255.0);
}`;

/** A pixel shape as a texture, one texel per art pixel, top row first. */
function texture(rows) {
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && g.fillRect(x, y, 1, 1)));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  return t;
}

const textures = {};
const POINT = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
POINT.userData.shared = true;

/** A sprite of a shape, `scale` art pixels per texel. */
function sprite(shape, color, scale = 1) {
  textures[shape] ??= texture(SHAPES[shape]);
  const rows = SHAPES[shape];
  const w = rows[0].length, h = rows.length;
  const p = new THREE.Points(POINT, new THREE.ShaderMaterial({
    uniforms: {
      map: { value: textures[shape] },
      uColor: { value: new THREE.Color(color) },
      uShape: { value: new THREE.Vector2(w, h) },
      uScale: { value: scale },
      uSize: { value: Math.max(w, h) * scale },
    },
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
    depthWrite: false,
  }));
  p.frustumCulled = false;
  p.renderOrder = 10;
  return p;
}

const MOTE_VERTEX = /* glsl */ `
uniform float uTime;
attribute float aSpeed;
void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * aSpeed, 4.0) - 0.6;
  p.x += 0.2 * sin(uTime * 0.7 + position.z * 3.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 1.0;
}`;
const MOTE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, ${CLASS.fx}.0 / 255.0);
}`;

export class Fx {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.events = [];
  }

  /** Rebuilds the steady effects for a creature: motes in its affinity's color, stars if it is rare. */
  setup(genome, height, radius) {
    dispose(this.group);
    this.group.clear();
    this.events = [];
    this.height = height;
    this.radius = radius;
    const n = 26;
    const pos = new Float32Array(n * 3), speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = 1.2 + ((i * 37) % 23) / 10;
      pos.set([Math.cos(a) * r, ((i * 53) % 40) / 10, Math.sin(a) * r], i * 3);
      speed[i] = 0.12 + ((i * 17) % 10) / 50;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    const mote = { moss: "#f4ffd2", stone: "#ffffff", spark: "#fff3a0" }[genome.affinity];
    this.motes = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(mote) } },
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
      depthWrite: false,
    }));
    this.motes.frustumCulled = false;
    this.group.add(this.motes);
    this.zs = [0, 1, 2].map((i) => sprite("z", "#ffffff", i === 2 ? 2 : 1));
    this.stars = [];
    if (genome.rare) for (let i = 0; i < 8; i++) this.stars.push(sprite(i % 2 ? "sparkle" : "star", i % 3 ? "#ffe27a" : "#ffffff"));
    this.group.add(...this.zs, ...this.stars);
  }

  /** Something happened at time t0 at a point: "hearts" when poked, "puff" when hatched. */
  burst(kind, t0, at) {
    const parts = [];
    const n = kind === "puff" ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const s = kind === "puff"
        ? sprite(i % 3 ? "puff" : "sparkle", i % 3 ? "#ffffff" : "#fff4b8", i % 3 ? 2 : 1)
        : sprite(i % 2 ? "sparkle" : "heart", i % 2 ? "#fff4b8" : "#ff6f91", i % 2 ? 1 : 2);
      const a = (i / n) * Math.PI * 2 + 0.4;
      s.userData.dir = new THREE.Vector3(Math.cos(a), kind === "puff" ? 0.3 + (i % 3) * 0.35 : 1.2 + (i % 2) * 0.5, Math.sin(a));
      this.group.add(s);
      parts.push(s);
    }
    this.events.push({ kind, t0, at: at.clone(), parts });
  }

  /** Poses every effect at time t, `doing` what the creature does now. */
  pose(t, center, doing = {}) {
    if (this.motes) this.motes.material.uniforms.uTime.value = t;
    this.zs.forEach((z, i) => {
      const k = ((doing.s ?? 0) * 2.6 + i / 3) % 1;
      z.visible = doing.habit === "nap" && doing.s > 0.15 && doing.s < 0.95;
      z.position.set(center.x + 0.3 + 0.5 * k, this.height * 0.85 + 0.9 * k, center.z + 0.2);
    });
    this.stars.forEach((s, i) => {
      const a = t * 0.45 + (i / this.stars.length) * Math.PI * 2;
      const r = this.radius + 0.35;
      s.position.set(center.x + Math.cos(a) * r, center.y + 0.7 * Math.sin(a * 1.7 + i), center.z + Math.sin(a) * r);
      s.visible = Math.sin(t * 3 + i * 1.9) > -0.3;
    });
    for (const e of this.events) {
      const age = t - e.t0;
      const life = e.kind === "puff" ? 0.65 : 1.2;
      e.parts.forEach((s, i) => {
        s.visible = age >= 0 && age < life;
        if (!s.visible) return;
        const d = s.userData.dir;
        const k = e.kind === "puff" ? 2.2 * age - 1.2 * age * age : 0.9 * age;
        s.position.set(e.at.x + d.x * k, e.at.y + d.y * k + (e.kind === "puff" ? 0 : 0.2 * Math.sin(age * 6 + i)), e.at.z + d.z * k);
      });
    }
    for (const e of this.events.filter((e) => t - e.t0 > 1.5)) {
      for (const s of e.parts) {
        this.group.remove(s);
        s.material.dispose();
      }
    }
    this.events = this.events.filter((e) => t - e.t0 <= 1.5);
  }
}
