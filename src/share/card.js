// The card: a trading card drawn in art pixels, then scaled up 4 times without smoothing. Its name on a
// band of its body color, the creature on its island, species and affinity, its four stats as bars, a
// line about its mood, and its seed. Rare creatures get a gold frame that sparkles.
import { HATCH } from "../render/stage.js";
import { film, studio } from "./film.js";
import { anyText, anyWidth, drawable, measure, pixelText } from "./font.js";

const W = 160, H = 224, SCALE = 4;

/** A line about the creature, from its mood. */
const MOODS = {
  bouncy: "can't sit still for long",
  sleepy: "naps wherever it lands",
  curious: "pokes at everything new",
  shy: "hides when you stare",
  proud: "poses for every picture",
};
const ICONS = {
  moss: [".##..", "####.", "#####", ".###.", "..#.."],
  stone: ["..#..", ".###.", "##.##", "#####", ".###."],
  spark: ["..##.", ".##..", "####.", "..##.", ".##.."],
};
const STATS = [["hp", "HP"], ["attack", "ATK"], ["defense", "DEF"], ["speed", "SPD"]];

function icon(g, rows, x, y, color) {
  g.fillStyle = color;
  rows.forEach((row, r) => [...row].forEach((ch, c) => ch === "#" && g.fillRect(x + c, y + r, 1, 1)));
}

/** A rectangle with its corners cut, the pixel artist's rounded box. */
function box(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

/** Text with a one-pixel outline all around. */
function outlined(g, text, x, y, fill, line, scale) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pixelText(g, text, x + dx, y + dy, line, scale);
  pixelText(g, text, x, y, fill, scale);
}

export async function makeCard(renderer, genome) {
  const [body, belly, accent, , , ink] = genome.palette;
  const frame = genome.rare ? "#ffd66b" : accent;
  const artW = W - 18, artH = 108;
  const stage = studio(renderer, genome, artW, artH, { zoom: 0.95 });
  const [picture] = await film(renderer, stage, [HATCH.ready + 0.35], artW, artH);
  stage.dispose();

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  box(g, 0, 0, W, H, ink);
  box(g, 2, 2, W - 4, H - 4, frame);
  box(g, 5, 5, W - 10, H - 10, belly);
  g.fillStyle = ink;
  g.globalAlpha = 0.06;
  for (let y = 9; y < H - 8; y += 4) for (let x = 9 + (y % 8 ? 2 : 0); x < W - 8; x += 4) g.fillRect(x, y, 1, 1);
  g.globalAlpha = 1;
  if (genome.rare) {
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 9; i++) {
      const x = 3 + ((i * 37) % (W - 8)), y = i % 2 ? 3 : H - 4;
      g.fillRect(x, y, 1, 1);
      g.fillRect(i % 2 ? 3 : W - 4, 12 + ((i * 53) % (H - 24)), 1, 1);
    }
  }

  // The name, on a band of the creature's color.
  box(g, 8, 8, W - 16, 20, ink);
  box(g, 9, 9, W - 18, 18, body);
  g.fillStyle = "#ffffff";
  g.globalAlpha = 0.35;
  g.fillRect(10, 10, W - 20, 1);
  g.globalAlpha = 1;
  const scale = measure(genome.name, 2) <= W - 30 ? 2 : 1;
  const nx = Math.floor((W - measure(genome.name, scale)) / 2);
  outlined(g, genome.name, nx, scale === 2 ? 11 : 15, "#ffffff", ink, scale);
  if (genome.rare) {
    pixelText(g, "★", 12, 15, "#ffd66b");
    pixelText(g, "★", W - 17, 15, "#ffd66b");
  }

  // The creature, framed.
  g.fillStyle = ink;
  g.fillRect(8, 30, artW + 2, artH + 2);
  g.putImageData(new ImageData(picture, artW, artH), 9, 31);

  let y = 30 + artH + 5;
  const kind = `${genome.species} · ${genome.affinity}`;
  const kx = Math.floor((W - measure(kind) - 8) / 2);
  icon(g, ICONS[genome.affinity], kx, y + 1, ink);
  pixelText(g, kind, kx + 8, y, ink);
  y += 12;

  for (const [key, name] of STATS) {
    const v = genome.stats[key];
    const fill = Math.max(1, Math.round((90 * v) / 100));
    pixelText(g, name, 10, y, ink);
    g.fillStyle = ink;
    g.fillRect(31, y, 92, 7);
    g.fillStyle = "#ffffff";
    g.fillRect(32, y + 1, 90, 5);
    g.fillStyle = body;
    g.fillRect(32, y + 1, fill, 5);
    g.fillStyle = "#ffffff";
    g.globalAlpha = 0.45;
    g.fillRect(32, y + 1, fill, 1);
    g.globalAlpha = 1;
    pixelText(g, String(v), W - 10 - measure(String(v)), y, ink);
    y += 10;
  }
  y += 1;
  const about = MOODS[genome.traits.mood];
  pixelText(g, about, Math.floor((W - measure(about)) / 2), y, ink);
  y += 11;

  g.fillStyle = ink;
  for (let x = 10; x < W - 10; x += 2) g.fillRect(x, y, 1, 1);
  y += 4;
  // The seed in the pixel font when it can be, else in the system font, smaller for a long seed.
  const seed = `seed "${genome.seed}"`;
  const room = W - 20;
  if (drawable(seed) && measure(seed) <= room) {
    pixelText(g, seed, 10, y, ink);
    if (measure(seed) + 8 + measure("wildseed") <= room) pixelText(g, "wildseed", W - 10 - measure("wildseed"), y, frame === belly ? body : frame);
  } else {
    const size = anyWidth(seed, 9) <= room ? 9 : 7;
    const text = anyWidth(seed, size) <= room ? seed : `"${genome.seed}"`;
    anyText(g, text, 10, y - (size === 9 ? 2 : 0), ink, size);
  }

  const out = document.createElement("canvas");
  out.width = W * SCALE;
  out.height = H * SCALE;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.drawImage(c, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
