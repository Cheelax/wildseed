// Films a creature off screen, on a stage of its own: the same hatch and the same life as the page,
// frame by frame at chosen times, in art pixels. The GIF and the card are made from these frames.
import { HATCH, Stage, aim, hatchOffset } from "../render/stage.js";
import { HABIT_START, habitLength } from "../render/creature.js";
import { genomeOf } from "../genome.mjs";
import { encodeGif } from "./gif.js";
import { pixelText, measure, anyText, anyWidth } from "./font.js";

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
  const W = genome.parents ? 160 : 120, H = genome.parents ? 180 : 120, scale = 4;
  const stage = studio(renderer, genome, W, H);
  // It shows its habit (a hop, a nap, a tilt…), then gets poked.
  const offset = hatchOffset(genome);
  const ready = HATCH.ready + offset;
  const poke = offset + HATCH.open + HABIT_START + habitLength(genome.traits.mood) + 0.3;
  stage.poke(poke);
  const times = [];
  for (let t = 0; t < ready; t += 0.08) times.push(t);
  const hatchFrames = times.length;
  for (let t = ready; t < poke + 1.4; t += 0.1) times.push(t);
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
  const lines = [];
  if (genome.parents) {
    let line = "";
    for (const ch of genome.seed) {
      if (anyWidth(line + ch, 7) > width - 10) { lines.push(line); line = ""; }
      line += ch;
    }
    if (line) lines.push(line);
  }
  c.height = genome.parents ? 24 + lines.length * 9 : 11;
  const g = c.getContext("2d");
  g.fillStyle = genome.palette[5];
  g.fillRect(0, 0, width, c.height);
  const text = genome.rare ? `★ ${genome.name} ★` : genome.name;
  pixelText(g, text, Math.floor((width - measure(text)) / 2), 2, genome.rare ? "#ffd66b" : "#ffffff");
  if (genome.parents) {
    const parents = genome.parents.map(seed => genomeOf(seed).name).join(" × ");
    anyText(g, parents, Math.floor((width - anyWidth(parents, 8)) / 2), 12, "#f0e6cc", 8);
    lines.forEach((line, i) => anyText(g, line, 5, 24 + i * 9, "#f0e6cc", 7));
  }
  return g.getImageData(0, 0, width, c.height).data;
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
