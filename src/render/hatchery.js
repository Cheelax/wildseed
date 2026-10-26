// The live view: the stage drawn in art pixels on the page's canvas, a camera that turns around the
// creature, a creature that follows the pointer and laughs when it is poked.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PIXEL_MIN } from "../rules.mjs";
import { PixelRenderer } from "./pixel.js";
import { Stage } from "./stage.js";

/** The art pixel's size in CSS pixels for a scene of w × h: about 160 art pixels tall, 3 or more. */
export function pixelSize(w, h) {
  return Math.max(PIXEL_MIN, Math.round(Math.min(w * 0.72, h) / 165));
}

export class Hatchery {
  constructor(canvas, { onPoke = () => {}, onHatched = () => {}, onMeet = () => {}, onReady = () => {}, onResize = () => {} } = {}) {
    this.canvas = canvas;
    this.renderer = new PixelRenderer(canvas);
    this.stage = new Stage();
    this.controls = new OrbitControls(this.stage.camera, canvas);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, dampingFactor: 0.12, rotateSpeed: 0.55, minPolarAngle: 0.45, maxPolarAngle: 1.5 });
    Object.assign(this, { onPoke, onHatched, onMeet, onReady, onResize });
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
    const { camera, center } = this.stage;
    const d = this.stage.aim(camera, 1.28, { least: 1.3 });
    this.controls.target.copy(center);
    this.controls.minDistance = d * 0.7;
    this.controls.maxDistance = d * 1.6;
    this.controls.update();
  }

  /**
   * Starts hatching a genome, `from` seconds into it (a page opened from a link skips the egg's fall).
   * Resolves when the creature is out and alive.
   */
  hatch(genome, { from = 0 } = {}) {
    this.stage.set(genome);
    this.started = performance.now() - from * 1000;
    this.cried = this.met = false;
    this.resize();
    this.reframe();
    return new Promise((resolve) => (this.whenReady = resolve));
  }

  get time() {
    return (performance.now() - this.started) / 1000;
  }

  loop() {
    requestAnimationFrame(this.loop);
    if (!this.stage.genome) return;
    this.resize();
    this.controls.update();
    const t = this.time;
    this.stage.frame(t, { look: this.lookAt() });
    this.renderer.render(this.stage, this.size.width, this.size.height);
    const { meet, burst, ready } = this.stage.timeline;
    if (!this.met && meet !== null && t >= meet) {
      this.met = true;
      this.onMeet(this.stage.meeting.parents.map((p) => p.genome));
    }
    if (!this.cried && t >= burst) {
      this.cried = true;
      this.onHatched(this.stage.genome);
    }
    if (this.whenReady && t >= ready) {
      this.whenReady();
      this.whenReady = null;
      this.onReady(this.stage.genome);
    }
  }

  /** Where the creature should look: toward the pointer, as yaw and pitch from -1 to 1. */
  lookAt() {
    if (!this.pointer) return null;
    const { camera, creature } = this.stage;
    const head = new THREE.Vector3();
    creature.rig.head.getWorldPosition(head);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(this.pointer, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), head);
    const at = ray.ray.intersectPlane(plane, new THREE.Vector3());
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

  /** A tap or click: the creature it lands on reacts, the child (-1) or one of its parents (0 or 1). */
  tap(point) {
    const { creature, meeting, timeline } = this.stage;
    if (!creature?.root.visible || this.time < timeline.ready) return;
    const who = this.hit(point);
    if (who === null) return;
    this.stage.poke(this.time, who);
    this.onPoke(who < 0 ? this.stage.genome : meeting.parents[who].genome);
  }

  /**
   * Which creature a tap at `point` lands on: the one the ray meets first, else the nearest whose outline
   * on screen holds the point, so that thin parts and the gaps between them (a drift's tentacles, a
   * flutterling's antennae) answer too. -1 for the child, 0 or 1 for a parent, null for none.
   */
  hit(point) {
    const { camera, creature, meeting } = this.stage;
    const creatures = [[-1, creature], ...(meeting?.parents.map((p, i) => [i, p]) ?? [])];
    const ray = new THREE.Raycaster();
    ray.setFromCamera(point, camera);
    let best = null, near = Infinity;
    for (const [who, c] of creatures) {
      const [h] = ray.intersectObject(c.root, true);
      if (h && h.distance < near) [best, near] = [who, h.distance];
    }
    if (best !== null) return best;
    const slack = new THREE.Vector2(6 / this.size.width, 6 / this.size.height); // three art pixels
    for (const [who, c] of creatures) {
      const d = camera.position.distanceTo(c.root.getWorldPosition(new THREE.Vector3()));
      if (d < near && covers(c.root, camera, point, slack)) [best, near] = [who, d];
    }
    return best;
  }
}

/** Whether `point` (device coordinates, -1 to 1) lies in the box `object` covers on screen, `slack` around. */
function covers(object, camera, point, slack) {
  const box = new THREE.Box3().setFromObject(object, true);
  if (box.isEmpty()) return false;
  const lo = new THREE.Vector2(Infinity, Infinity), hi = new THREE.Vector2(-Infinity, -Infinity);
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    lo.min(corner);
    hi.max(corner);
  }
  return point.x >= lo.x - slack.x && point.x <= hi.x + slack.x && point.y >= lo.y - slack.y && point.y <= hi.y + slack.y;
}
