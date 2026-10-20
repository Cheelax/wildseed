// The card: a trading card drawn in art pixels, then scaled up 4 times without smoothing. The creature
// on its island, its name, species and affinity, its four stats as bars, its seed and a line about it.
import { HATCH } from "../render/stage.js";
import { film, studio } from "./film.js";
import { anyText, drawable, measure, pixelText } from "./font.js";

const W = 160, H = 230, SCALE = 4;

/** A line about the creature, from its mood and affinity. */
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

export async function makeCard(renderer, genome) {
  const [body, belly, accent, , , ink] = genome.palette;
  const artW = W - 16, artH = 112;
  const stage = studio(renderer, genome, artW, artH, { zoom: 0.92 });
  const [picture] = await film(renderer, stage, [HATCH.ready + 0.35], artW, artH);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  box(g, 0, 0, W, H, ink);
  box(g, 2, 2, W - 4, H - 4, genome.rare ? "#ffd66b" : accent);
  box(g, 5, 5, W - 10, H - 10, belly);

  const title = genome.rare ? `★${genome.name}★` : genome.name;
  const tx = Math.floor((W - measure(title, 2)) / 2);
  pixelText(g, title, tx + 1, 11, body, 2);
  pixelText(g, title, tx, 10, ink, 2);

  g.fillStyle = ink;
  g.fillRect(7, 27, artW + 2, artH + 2);
  g.putImageData(new ImageData(picture, artW, artH), 8, 28);

  let y = 28 + artH + 6;
  const kind = `${genome.species} · ${genome.affinity}`;
  const kx = Math.floor((W - measure(kind) - 8) / 2);
  icon(g, ICONS[genome.affinity], kx, y + 1, ink);
  pixelText(g, kind, kx + 8, y, ink);
  y += 12;

  const STATS = [["hp", "HP"], ["attack", "ATK"], ["defense", "DEF"], ["speed", "SPD"]];
  for (const [key, name] of STATS) {
    const v = genome.stats[key];
    pixelText(g, name, 10, y, ink);
    g.fillStyle = ink;
    g.fillRect(31, y, 92, 7);
    g.fillStyle = belly;
    g.fillRect(32, y + 1, 90, 5);
    g.fillStyle = body;
    g.fillRect(32, y + 1, Math.max(1, Math.round((90 * v) / 100)), 5);
    g.fillStyle = "#ffffff";
    g.fillRect(32, y + 1, Math.max(1, Math.round((90 * v) / 100)), 1);
    pixelText(g, String(v), W - 10 - measure(String(v)), y, ink);
    y += 10;
  }
  y += 2;
  const about = MOODS[genome.traits.mood];
  pixelText(g, about, Math.floor((W - measure(about)) / 2), y, ink);
  y += 13;

  g.fillStyle = ink;
  g.fillRect(10, y - 4, W - 20, 1);
  const seed = `seed "${genome.seed}"`;
  const room = W - 20;
  if (!drawable(seed) || measure(seed) > room) anyText(g, seed, 10, y - 2, ink, 9);
  else {
    pixelText(g, seed, 10, y, ink);
    if (measure(seed) + 8 + measure("wildseed") <= room) pixelText(g, "wildseed", W - 10 - measure("wildseed"), y, body);
  }

  const out = document.createElement("canvas");
  out.width = W * SCALE;
  out.height = H * SCALE;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.drawImage(c, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
