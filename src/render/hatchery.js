// The live view: the stage drawn in art pixels on the page's canvas, a camera that turns around the
// creature, a creature that follows the pointer and laughs when it is poked.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PIXEL_MIN } from "../rules.mjs";
import { PixelRenderer } from "./pixel.js";
import { Stage, aim, frameBox, viewOf } from "./stage.js";

/** The art pixel's size in CSS pixels for a scene of w × h: about 160 art pixels tall, 3 or more. */
export function pixelSize(w, h) {
  return Math.max(PIXEL_MIN, Math.round(Math.min(w * 0.72, h) / 165));
}

export class Hatchery {
  constructor(canvas, { onPoke = () => {}, onHatched = () => {}, onReady = () => {}, onResize = () => {} } = {}) {
    this.canvas = canvas;
    this.renderer = new PixelRenderer(canvas);
    this.stage = new Stage();
    this.controls = new OrbitControls(this.stage.camera, canvas);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, dampingFactor: 0.12, rotateSpeed: 0.55, minPolarAngle: 0.45, maxPolarAngle: 1.5 });
    Object.assign(this, { onPoke, onHatched, onReady, onResize });
    this.pointer = null;
    this.size = { width: 0, height: 0, pixel: 3 };
    this.listen();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  get kind() {
    return this.renderer.kind;
  }

  /**
   * Fits the canvas to its box: whole art pixels of `pixel` CSS pixels, its top-left corner on a whole
   * device pixel wherever the layout puts the box, so that every art pixel is a crisp square.
   */
  resize() {
    const box = this.canvas.parentElement;
    const rect = box.getBoundingClientRect();
    const innerW = rect.width - 2 * box.clientLeft, innerH = rect.height - 2 * box.clientTop;
    const pixel = pixelSize(innerW, innerH);
    const width = Math.max(40, Math.floor(innerW / pixel));
    const height = Math.max(40, Math.floor(innerH / pixel));
    const dpr = window.devicePixelRatio || 1;
    const snap = (v) => Math.round(v * dpr) / dpr;
    const x0 = rect.left + box.clientLeft, y0 = rect.top + box.clientTop;
    const left = snap(x0 + Math.floor((innerW - width * pixel) / 2)) - x0;
    const top = snap(y0 + Math.floor((innerH - height * pixel) / 2)) - y0;
    const layout = `${width}x${height}x${pixel}+${left}+${top}`;
    if (layout === this.layout) return;
    this.layout = layout;
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    if (width === this.size.width && height === this.size.height && pixel === this.size.pixel) return;
    this.size = { width, height, pixel };
    this.canvas.style.width = `${width * pixel}px`;
    this.canvas.style.height = `${height * pixel}px`;
    this.renderer.setSize(width, height);
    this.onResize(this.size);
    this.stage.camera.aspect = width / height;
    this.stage.camera.updateProjectionMatrix();
    if (this.stage.genome) this.reframe();
  }

  reframe() {
    const { camera, center, bounds } = this.stage;
    const view = viewOf(this.stage);
    const d = this.stage.parents ? frameBox(camera, this.stage.box, 1.1, view) : aim(camera, center, Math.max(bounds.radius, 1.3), 1.28, view);
    this.controls.target.copy(center);
    this.controls.minDistance = d * 0.7;
    this.controls.maxDistance = d * 1.6;
    this.controls.update();
  }

  /**
   * Starts hatching a genome, a child after its `parents` meet. The scene plays `tempo` times faster until
   * the creature is out (a page opened from a link hatches briskly). Resolves when the creature is out and alive.
   */
  hatch(genome, { parents = null, tempo = 1 } = {}) {
    this.stage.set(genome, { parents });
    this.started = performance.now();
    this.tempo = tempo;
    this.cried = false;
    this.resize();
    this.reframe();
    return new Promise((resolve) => (this.whenReady = resolve));
  }

  /** Seconds into the scene. */
  get time() {
    const real = (performance.now() - this.started) / 1000;
    const brisk = this.stage.readyAt / this.tempo;
    return real < brisk ? real * this.tempo : this.stage.readyAt + real - brisk;
  }

  loop() {
    requestAnimationFrame(this.loop);
    if (!this.stage.genome) return;
    this.resize();
    this.controls.update();
    const t = this.time;
    this.stage.frame(t, { look: this.lookAt() });
    // On a software renderer, the shadow pass is a good part of a frame: half the frames reuse the last one.
    this.frames = (this.frames ?? 0) + 1;
    this.renderer.render(this.stage, this.size.width, this.size.height, null, { shadows: this.frames % 2 === 1 });
    if (!this.cried && t >= this.stage.burstAt) {
      this.cried = true;
      this.onHatched(this.stage.genome);
    }
    if (this.whenReady && t >= this.stage.readyAt) {
      this.whenReady();
      this.whenReady = null;
      this.onReady(this.stage.genome);
    }
  }

  /** Where the creature should look: toward the pointer, as yaw and pitch from -1 to 1. */
  lookAt() {
    if (!this.pointer) return null;
    const { camera, creature } = this.stage;
    const head = creature.rig.head.getWorldPosition(scratch.head);
    ray.setFromCamera(this.pointer, camera);
    scratch.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(scratch.dir).negate(), head);
    const at = ray.ray.intersectPlane(scratch.plane, scratch.at);
    if (!at) return null;
    const v = at.sub(head);
    const yaw = Math.atan2(v.x, v.z);
    const pitch = Math.atan2(v.y, Math.hypot(v.x, v.z));
    return { x: THREE.MathUtils.clamp(yaw / 1.1, -1, 1), y: THREE.MathUtils.clamp(pitch / 0.8, -1, 1) };
  }

  listen() {
    const ndc = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    let down = null;
    this.canvas.addEventListener("pointermove", (e) => (this.pointer = ndc(e)));
    this.canvas.addEventListener("pointerleave", () => (this.pointer = null));
    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointer = ndc(e);
      down = { x: e.clientX, y: e.clientY, at: performance.now() };
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.at > 500) return;
      down = null;
      if (e.pointerType !== "mouse") this.pointer = null;
      this.tap(ndc(e));
    });
  }

  /**
   * A tap or click: if it lands on the creature or one of its parents, that one reacts. Anywhere inside a
   * creature's box counts, so a tap among a drift's tentacles or between a moth's wings is a poke too.
   */
  tap(point) {
    const { camera, creature, parents } = this.stage;
    const t = this.time;
    if (!creature?.root.visible || t < this.stage.readyAt) return;
    ray.setFromCamera(point, camera);
    const targets = [{ root: creature.root, poke: () => (this.stage.poke(t), this.onPoke(this.stage.genome)) }];
    parents?.members.forEach((p, i) => targets.push({ root: p.creature.root, poke: () => (this.stage.pokeParent(i, t), this.onPoke(p.genome)) }));
    const hit = targets.map((x) => ({ ...x, at: distanceTo(x.root) })).filter((x) => x.at < Infinity).sort((a, b) => a.at - b.at)[0];
    hit?.poke();
  }
}

const ray = new THREE.Raycaster();
const scratch = { head: new THREE.Vector3(), dir: new THREE.Vector3(), at: new THREE.Vector3(), plane: new THREE.Plane(), box: new THREE.Box3() };

/** How far along the ray a creature is: its nearest part, or its box when the ray passes between its parts. */
function distanceTo(root) {
  const parts = ray.intersectObject(root, true);
  if (parts.length) return parts[0].distance;
  const at = ray.ray.intersectBox(scratch.box.setFromObject(root), scratch.at);
  return at ? at.distanceTo(ray.ray.origin) : Infinity;
}
