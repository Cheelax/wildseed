// Films a creature off screen, on a stage of its own: the same hatch and the same life as the page,
// frame by frame at chosen times, in art pixels. The GIF and the card are made from these frames.
import * as THREE from "three";
import { HATCH, Stage } from "../render/stage.js";
import { encodeGif } from "./gif.js";
import { pixelText, measure } from "./font.js";

const pause = () => new Promise((r) => setTimeout(r, 0));

/** A stage for `genome` with its camera framing the creature in a w × h picture. */
export function studio(renderer, genome, w, h, { zoom = 1 } = {}) {
  const stage = new Stage();
  stage.set(genome);
  const cam = stage.camera;
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  const height = stage.creature.height;
  const center = new THREE.Vector3(0, height * 0.45 + 0.1, 0);
  const d = ((height * 0.62 + 0.75) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / zoom;
  const azimuth = 0.42, elevation = 0.26;
  cam.position.set(d * Math.sin(azimuth) * Math.cos(elevation), center.y + d * Math.sin(elevation), d * Math.cos(azimuth) * Math.cos(elevation));
  cam.lookAt(center);
  return stage;
}

/** RGBA frames of the stage at each time in `times`. */
export async function film(renderer, stage, times, w, h) {
  const frames = [];
  for (const t of times) {
    stage.frame(t);
    frames.push(renderer.capture(stage, w, h));
    await pause();
  }
  return frames;
}

/**
 * The GIF: the egg drops, cracks and hatches, then the creature lives for a few seconds: it looks
 * around, blinks, and laughs when poked. Its name runs along the bottom.
 */
export async function makeGif(renderer, genome) {
  const W = 120, H = 120, scale = 4;
  const stage = studio(renderer, genome, W, H);
  stage.poke(HATCH.ready + 1.6);
  const times = [];
  for (let t = 0; t < HATCH.ready; t += 0.08) times.push(t);
  const hatchFrames = times.length;
  for (let t = HATCH.ready; t < HATCH.ready + 3.6; t += 0.1) times.push(t);
  const frames = await film(renderer, stage, times, W, H);
  const banner = nameBanner(genome, W);
  for (const f of frames) stamp(f, W, banner);
  const delays = times.map((_, i) => (i < hatchFrames ? 8 : 10));
  return new Blob([encodeGif(frames, W, H, { scale, delays })], { type: "image/gif" });
}

/** The name in the pixel font on a strip of ink, as RGBA rows to stamp at the bottom of each frame. */
function nameBanner(genome, width) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = 11;
  const g = c.getContext("2d");
  g.fillStyle = genome.palette[5];
  g.fillRect(0, 0, width, 11);
  const text = genome.rare ? `★ ${genome.name} ★` : genome.name;
  pixelText(g, text, Math.floor((width - measure(text)) / 2), 2, genome.rare ? "#ffd66b" : "#ffffff");
  return g.getImageData(0, 0, width, 11).data;
}

function stamp(frame, width, banner) {
  const rows = banner.length / 4 / width;
  const at = frame.length - banner.length;
  for (let i = 0; i < rows * width; i++) {
    frame[at + i * 4] = banner[i * 4];
    frame[at + i * 4 + 1] = banner[i * 4 + 1];
    frame[at + i * 4 + 2] = banner[i * 4 + 2];
  }
}
