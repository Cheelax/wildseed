// Films a creature off screen, on a stage of its own: the same hatch and the same life as the page,
// frame by frame at chosen times, in art pixels. The GIF, the card and the family tree's portraits are made
// from these frames.
import { Stage, aim } from "../render/stage.js";
import { HABIT_START, habitLength } from "../render/creature.js";
import { encodeGif } from "./gif.js";
import { pixelText, measure } from "./font.js";

const pause = () => new Promise((r) => setTimeout(r, 0));

/** A stage for `genome` (a child with its `parents`, when given) with its camera framing it in a w × h picture. */
export function studio(renderer, genome, w, h, { zoom = 1, parents = null } = {}) {
  const stage = new Stage();
  stage.set(genome, { parents });
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

/** A still of a creature out of its egg, alive, as RGBA rows of w × h. */
export async function portrait(renderer, genome, w, h = w) {
  const stage = studio(renderer, genome, w, h, { zoom: 0.95 });
  const [picture] = await film(renderer, stage, [stage.readyAt + 0.35], w, h);
  stage.dispose();
  return picture;
}

/**
 * The GIF: the egg drops, cracks and hatches, then the creature lives for a few seconds: it looks
 * around, blinks, and laughs when poked. A child's GIF starts with its `parents` meeting and laying its egg,
 * wider to hold the family. Its name runs along the bottom.
 */
export async function makeGif(renderer, genome, { parents = null } = {}) {
  const W = parents ? 168 : 120, H = 120, scale = 4;
  const stage = studio(renderer, genome, W, H, { parents });
  // It shows its habit (a hop, a nap, a tilt…), then gets poked.
  const poke = stage.openAt + HABIT_START + habitLength(genome.traits.mood) + 0.3;
  stage.poke(poke);
  const times = [];
  for (let t = 0; t < stage.readyAt; t += 0.08) times.push(t);
  const hatchFrames = times.length;
  for (let t = stage.readyAt; t < poke + 1.4; t += 0.1) times.push(t);
  const frames = await film(renderer, stage, times, W, H);
  stage.dispose();
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
