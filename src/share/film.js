// Films a creature off screen, on a stage of its own: the same hatch and the same life as the page,
// frame by frame at chosen times, in art pixels. The GIF and the card are made from these frames.
import { genomeOf } from "../genome.mjs";
import { HATCH, Stage } from "../render/stage.js";
import { HABIT_START, habitLength } from "../render/creature.js";
import { encodeGif } from "./gif.js";
import { pixelText, measure } from "./font.js";

const pause = () => new Promise((r) => setTimeout(r, 0));

/** A stage for `genome` with its camera framing the creature (and a child's parents) in a w × h picture. */
export function studio(renderer, genome, w, h, { zoom = 1, alone = false, parents = !alone } = {}) {
  const stage = new Stage();
  stage.set(genome, { alone, parents });
  const cam = stage.camera;
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
  stage.aim(cam, 1.02 / zoom, { elevation: 0.22 });
  return stage;
}

/** A creature alone, out of its egg and alive, as w × h RGBA pixels on a clear background. */
export function portrait(renderer, genome, w, h) {
  const stage = studio(renderer, genome, w, h, { zoom: 1.12, alone: true });
  stage.frame(stage.timeline.ready + 0.4);
  const pixels = renderer.capture(stage, w, h, { sky: false });
  stage.dispose();
  return pixels;
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
 * The GIF: a child's parents meet and lay the egg, the egg drops (or pops up), cracks and hatches, then
 * the creature lives for a few seconds: it looks around, blinks, and laughs when poked. Its name runs
 * along the bottom, and a child's parents' names along the top.
 */
export async function makeGif(renderer, genome) {
  const W = 120, H = 120, scale = 4;
  const stage = studio(renderer, genome, W, H);
  const { hatch, ready } = stage.timeline;
  // It shows its habit (a hop, a nap, a tilt…), then gets poked.
  const poke = hatch + HATCH.open + HABIT_START + habitLength(genome.traits.mood) + 0.3;
  stage.poke(poke);
  const times = [];
  for (let t = 0; t < ready; t += 0.08) times.push(t);
  const hatchFrames = times.length;
  for (let t = ready; t < poke + 1.4; t += 0.1) times.push(t);
  const frames = await film(renderer, stage, times, W, H);
  stage.dispose();
  const banner = nameBanner(genome, W);
  const top = genome.parents ? parentsBanner(genome, W) : null;
  for (const f of frames) {
    stamp(f, W, banner);
    if (top) stamp(f, W, top, 0);
  }
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

/** The parents' names, "Thomnub × Aurizap", on a strip of ink for the top of a child's frames. */
function parentsBanner(genome, width) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = 10;
  const g = c.getContext("2d");
  g.fillStyle = genome.palette[5];
  g.fillRect(0, 0, width, 10);
  const [a, b] = genome.parents.map((seed) => genomeOf(seed).name);
  let text = `${a} × ${b}`;
  if (measure(text) > width - 4) text = `${a.slice(0, 7)} × ${b.slice(0, 7)}`;
  pixelText(g, text, Math.floor((width - measure(text)) / 2), 1, "#ffffff");
  return g.getImageData(0, 0, width, 10).data;
}

/** Writes a strip of RGBA rows over a frame: at the bottom, or at row `y`. */
function stamp(frame, width, banner, y = null) {
  const rows = banner.length / 4 / width;
  const at = y === null ? frame.length - banner.length : y * width * 4;
  for (let i = 0; i < rows * width; i++) {
    frame[at + i * 4] = banner[i * 4];
    frame[at + i * 4 + 1] = banner[i * 4 + 1];
    frame[at + i * 4 + 2] = banner[i * 4 + 2];
  }
}
