// The family tree as a picture to post: a child under its parents and grandparents, each with its portrait and
// its name, joined by lines, and its lineage as it is written. Drawn in art pixels like the card.
import { familyOf } from "../family.mjs";
import { box, framed, outlined, seedLines, toPng } from "./card.js";
import { portrait } from "./film.js";
import { measure, pixelText } from "./font.js";

const W = 232;
const SIZES = { grand: 34, parent: 44, child: 64 };

/** A name that fits `room` pixels of the pixel font. */
const fit = (name, room) => name.slice(0, Math.floor((room + 1) / 6));

/** The family tree of a child (a genome with parents), as a PNG blob. */
export async function makeTree(renderer, genome) {
  const { child, parents, grandparents } = familyOf(genome);
  const face = (g, size) => portrait(renderer, g, size, size, { zoom: 1.7 });
  const pictures = new Map();
  for (const [g, kind] of [[child, "child"], ...parents.map((p) => [p, "parent"]), ...grandparents.flat().filter(Boolean).map((g) => [g, "grand"])]) {
    pictures.set(g, await face(g, SIZES[kind]));
  }
  const [body, belly, accent, , , ink] = child.palette;
  const lines = seedLines(child.seed, W - 20) ?? [];
  const hasGrand = grandparents.some(Boolean);
  const H = 34 + (hasGrand ? SIZES.grand + 24 : 0) + SIZES.parent + 24 + SIZES.child + 22 + 12 + (lines.length + 1) * 9 + 8;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  box(g, 0, 0, W, H, ink);
  box(g, 2, 2, W - 4, H - 4, child.rare ? "#ffd66b" : accent);
  box(g, 5, 5, W - 10, H - 10, belly);

  // The title, on a band of the child's color.
  box(g, 8, 8, W - 16, 20, ink);
  box(g, 9, 9, W - 18, 18, body);
  const title = `${child.name}'s family`;
  const scale = measure(title, 2) <= W - 24 ? 2 : 1;
  outlined(g, title, Math.floor((W - measure(title, scale)) / 2), scale === 2 ? 11 : 15, "#ffffff", ink, scale);

  /** A creature at the middle x, its top at y: its portrait framed, its name under it. Returns its bottom. */
  const member = (who, kind, x, y, room) => {
    const size = SIZES[kind];
    framed(g, pictures.get(who), Math.round(x - size / 2), y + 1, size, size, ink);
    const name = fit(who.name, room);
    pixelText(g, name, Math.round(x - measure(name) / 2), y + size + 5, ink);
    return y + size + 12;
  };
  const line = (x0, y0, x1, y1) => {
    g.fillStyle = ink;
    g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1);
  };

  const cols = [W / 4, (3 * W) / 4].map(Math.round);
  let y = 34;
  if (hasGrand) {
    grandparents.forEach((pair, i) => {
      if (!pair) return;
      const xs = [cols[i] - 28, cols[i] + 28];
      pair.forEach((gp, k) => member(gp, "grand", xs[k], y, 54));
      line(xs[0], y + SIZES.grand + 14, xs[1], y + SIZES.grand + 14);
      line(cols[i], y + SIZES.grand + 14, cols[i], y + SIZES.grand + 24);
    });
    y += SIZES.grand + 24;
  }
  parents.forEach((p, i) => member(p, "parent", cols[i], y, W / 2 - 8));
  pixelText(g, "♥", Math.round(W / 2 - 3), y + SIZES.parent / 2 - 2, "#d63c64");
  const under = y + SIZES.parent + 14;
  cols.forEach((x) => line(x, under - 1, x, under + 3));
  line(cols[0], under + 3, cols[1], under + 3);
  line(W / 2, under + 3, W / 2, under + 10);
  y = under + 10;
  y = member(child, "child", W / 2, y, W - 20);
  const egg = `egg #${child.clutch}`;
  pixelText(g, egg, Math.round(W / 2 + SIZES.child / 2 + 6), y - 26, ink, 1, { caps: false });

  // The lineage as it is written, and where it comes from.
  y += 8;
  g.fillStyle = ink;
  for (let x = 10; x < W - 10; x += 2) g.fillRect(x, y, 1, 1);
  y += 4;
  pixelText(g, "lineage", 10, y, ink);
  pixelText(g, "wildseed", W - 10 - measure("wildseed"), y, accent === belly ? body : accent);
  lines.forEach((l, i) => pixelText(g, l, 10, y + 9 * (i + 1), ink, 1, { caps: false }));
  return toPng(c);
}
