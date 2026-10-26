// The live view: the stage drawn in art pixels on the page's canvas, a camera that turns around the
// creature, a creature that follows the pointer and laughs when it is poked.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PIXEL_MIN } from "../rules.mjs";
import { PixelRenderer } from "./pixel.js";
import { Stage, aim } from "./stage.js";

/** The art pixel's size in CSS pixels for a scene of w × h: about 160 art pixels tall, 3 or more. */
export function pixelSize(w, h) {
  return Math.max(PIXEL_MIN, Math.round(Math.min(w * 0.72, h) / 165));
}

export class Hatchery {
  constructor(canvas, { onPoke = () => {}, onHatched = () => {}, onReady = () => {}, onResize = () => {}, onCue = () => {} } = {}) {
    this.canvas = canvas;
    this.renderer = new PixelRenderer(canvas);
    this.stage = new Stage();
    this.controls = new OrbitControls(this.stage.camera, canvas);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, dampingFactor: 0.12, rotateSpeed: 0.55, minPolarAngle: 0.45, maxPolarAngle: 1.5 });
    Object.assign(this, { onPoke, onHatched, onReady, onResize, onCue });
    this.pointer = null;
    // Frame pacing: a frame is drawn once the GPU has finished the last one (a fence), and a machine that
    // takes long over each one rests between them, so a page drawn in software never stops answering.
    this.paused = false;
    this.cost = 0;
    this.fence = null;
    this.drawnAt = 0;
    this.restUntil = 0;
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
    const d = aim(camera, center, Math.max(bounds.radius, 1.3), 1.28);
    this.controls.target.copy(center);
    this.controls.minDistance = d * 0.7;
    this.controls.maxDistance = d * 1.6;
    this.controls.update();
  }

  /**
   * Starts hatching a genome, after its `parents` meet and lay the egg when they are given; `quick` starts
   * as the shell bursts. Returns when the egg cracks, opens and bursts, in seconds from now, for the sounds.
   */
  hatch(genome, { parents = null, quick = false } = {}) {
    this.stage.set(genome, { parents, quick });
    this.started = performance.now();
    this.cried = false;
    this.ready = false;
    this.cue = 0;
    this.resize();
    this.reframe();
    return this.stage.timing;
  }

  get time() {
    return (performance.now() - this.started) / 1000;
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const gl = this.renderer.gl.getContext();
    if (this.fence) {
      if (gl.getSyncParameter(this.fence, gl.SYNC_STATUS) !== gl.SIGNALED) return;
      gl.deleteSync(this.fence);
      this.fence = null;
      const took = Math.min(1500, now - this.drawnAt);
      this.cost = this.cost ? 0.7 * this.cost + 0.3 * took : took;
      this.restUntil = this.cost > 34 ? now + Math.min(1000, this.cost) : 0;
    }
    if (!this.stage.genome || this.paused || now < this.restUntil) return;
    this.resize();
    this.controls.update();
    const t = this.time;
    this.stage.frame(t, { look: this.lookAt() });
    this.renderer.render(this.stage, this.size.width, this.size.height);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    this.drawnAt = performance.now();
    const { timing, cues } = this.stage;
    while (this.cue < cues.length && t >= cues[this.cue][0]) this.onCue(cues[this.cue++][1]);
    if (!this.cried && t >= timing.burst) {
      this.cried = true;
      this.onHatched(this.stage.genome);
    }
    if (!this.ready && t >= timing.ready) {
      this.ready = true;
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
    if (!creature?.root.visible || this.time < this.stage.timing.ready) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(point, camera);
    if (ray.intersectObject(creature.root, true).length) {
      this.stage.poke(this.time);
      this.onPoke(this.stage.genome);
    }
  }
}
