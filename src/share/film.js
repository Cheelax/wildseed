// Films a creature off screen, on a stage of its own: the same hatch and the same life as the page,
// frame by frame at chosen times, in art pixels. The GIF and the card are made from these frames.
import { HATCH, Stage, aim } from "../render/stage.js";
import { HABIT_START, habitLength } from "../render/creature.js";
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
  aim(cam, stage.center, stage.bounds.radius, 1.02 / zoom, { elevation: 0.22 });
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
  // It shows its habit (a hop, a nap, a tilt…), then gets poked.
  const poke = HATCH.pop + HABIT_START + habitLength(genome.traits.mood) + 0.3;
  stage.poke(poke);
  const times = [];
  for (let t = 0; t < HATCH.ready; t += 0.08) times.push(t);
  const hatchFrames = times.length;
  for (let t = HATCH.ready; t < poke + 1.4; t += 0.1) times.push(t);
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
