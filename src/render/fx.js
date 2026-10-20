// Little effects, drawn in art pixels: hearts when the creature is poked, a puff when it hatches, the
// stars around a rare one, motes drifting in the air. Each is a function of time, like the creature.
import * as THREE from "three";
import { CLASS } from "./toon.js";

const SHAPES = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  star: ["..#..", ".###.", "#####", ".###.", "..#.."],
  sparkle: ["..#..", "..#..", "##.##", "..#..", "..#.."],
  puff: [".###.", "#####", "#####", "#####", ".###."],
};

const SPRITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  if (texture2D(map, vUv).a < 0.5) discard;
  gl_FragColor = vec4(uColor, ${CLASS.fx}.0 / 255.0);
}`;

/** A pixel shape as a texture, one texel per art pixel. */
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
  return t;
}

const textures = {};
function sprite(shape, color, pixel) {
  textures[shape] ??= texture(SHAPES[shape]);
  const rows = SHAPES[shape];
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(rows[0].length * pixel, rows.length * pixel),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: textures[shape] }, uColor: { value: new THREE.Color(color) } },
      vertexShader: SPRITE_VERTEX,
      fragmentShader: SPRITE_FRAGMENT,
      depthWrite: false,
    }),
  );
  m.renderOrder = 10;
  return m;
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
    this.pixel = 0.035;
  }

  /** Rebuilds the steady effects for a creature: motes in its affinity's color, stars if it is rare. */
  setup(genome, height) {
    this.group.clear();
    this.events = [];
    this.height = height;
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
    this.stars = [];
    if (genome.rare) {
      for (let i = 0; i < 7; i++) {
        const s = sprite(i % 2 ? "sparkle" : "star", i % 3 ? "#ffe27a" : "#ffffff", this.pixel * 2);
        this.stars.push(s);
        this.group.add(s);
      }
    }
  }

  /** Something happened at time t0 at a point: "hearts" when poked, "puff" when hatched. */
  burst(kind, t0, at) {
    const parts = [];
    const n = kind === "puff" ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const s = kind === "puff" ? sprite("puff", "#ffffff", this.pixel * 2) : sprite(i % 2 ? "heart" : "sparkle", i % 2 ? "#ff6f91" : "#fff4b8", this.pixel * 2);
      const a = (i / n) * Math.PI * 2 + 0.4;
      s.userData.dir = new THREE.Vector3(Math.cos(a), kind === "puff" ? 0.4 + (i % 3) * 0.3 : 1.2 + (i % 2) * 0.5, Math.sin(a));
      this.group.add(s);
      parts.push(s);
    }
    this.events.push({ kind, t0, at: at.clone(), parts });
  }

  /** Poses every effect at time t, facing the camera. */
  pose(t, camera, center) {
    if (this.motes) this.motes.material.uniforms.uTime.value = t;
    this.stars.forEach((s, i) => {
      const a = t * 0.5 + (i / this.stars.length) * Math.PI * 2;
      s.position.set(center.x + Math.cos(a) * 1.3, center.y + 0.6 * Math.sin(a * 1.7 + i), center.z + Math.sin(a) * 1.3);
      s.visible = Math.sin(t * 3 + i * 1.9) > -0.3;
      s.quaternion.copy(camera.quaternion);
    });
    for (const e of this.events) {
      const age = t - e.t0;
      const life = e.kind === "puff" ? 0.6 : 1.2;
      e.parts.forEach((s, i) => {
        s.visible = age >= 0 && age < life;
        if (!s.visible) return;
        const d = s.userData.dir;
        const k = e.kind === "puff" ? 1.6 * age : 0.9 * age;
        s.position.set(e.at.x + d.x * k, e.at.y + d.y * k + (e.kind === "puff" ? 0 : 0.2 * Math.sin(age * 6 + i)), e.at.z + d.z * k);
        s.quaternion.copy(camera.quaternion);
        const shrink = e.kind === "puff" ? Math.max(0.2, 1 - age / life) : 1;
        s.scale.setScalar(shrink);
      });
    }
    for (const e of this.events.filter((e) => t - e.t0 > 1.5)) {
      for (const s of e.parts) {
        this.group.remove(s);
        s.geometry.dispose();
        s.material.dispose();
      }
    }
    this.events = this.events.filter((e) => t - e.t0 <= 1.5);
  }
}
