// The live view: the stage drawn in art pixels on the page's canvas, a camera that turns around the
// creature, a creature that follows the pointer and laughs when it is poked.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PixelRenderer } from "./pixel.js";
import { HATCH, Stage } from "./stage.js";

/** The art pixel's size in CSS pixels for a scene of w × h: about 160 art pixels tall, 3 or more. */
export function pixelSize(w, h) {
  return Math.max(3, Math.round(Math.min(w * 0.72, h) / 165));
}

/** The default view: a little from the right and above, far enough to see the whole island. */
export function frameCamera(camera, center, height, aspect) {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const fitHeight = Math.max(1.75, height * 0.95) / Math.tan(vfov / 2);
  const fitWidth = 2.1 / Math.tan(hfov / 2);
  const d = Math.max(fitHeight, fitWidth);
  const azimuth = 0.38, elevation = 0.2;
  camera.position.set(center.x + d * Math.sin(azimuth) * Math.cos(elevation), center.y + d * Math.sin(elevation), center.z + d * Math.cos(azimuth) * Math.cos(elevation));
  camera.lookAt(center);
  return d;
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
    const { camera, center, creature } = this.stage;
    const d = frameCamera(camera, center, creature.height, camera.aspect);
    this.controls.target.copy(center);
    this.controls.minDistance = d * 0.7;
    this.controls.maxDistance = d * 1.6;
    this.controls.update();
  }

  /** Starts hatching a genome. Resolves when the creature is out and alive. */
  hatch(genome) {
    this.stage.set(genome);
    this.started = performance.now();
    this.cried = false;
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
    if (!this.cried && t >= HATCH.pop) {
      this.cried = true;
      this.onHatched(this.stage.genome);
    }
    if (this.whenReady && t >= HATCH.ready) {
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

  /** A tap or click: if it lands on the creature, the creature reacts. */
  tap(point) {
    const { camera, creature } = this.stage;
    if (!creature?.root.visible || this.time < HATCH.ready) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(point, camera);
    if (ray.intersectObject(creature.root, true).length) {
      this.stage.poke(this.time);
      this.onPoke(this.stage.genome);
    }
  }
}
