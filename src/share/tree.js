// The family tree as a picture to post: the grandparents, the parents with a heart between them, the
// child at the bottom, each by its face and its name, then where each of the child's parts came from and
// its whole lineage. Drawn in art pixels, then scaled up 4 times without smoothing.
import { familyOf, originsOf } from "../family.mjs";
import { portrait } from "./film.js";
import { measure, pixelText } from "./font.js";
import { box, draw, line, outlined, png, textWidth, wrapLineage } from "./paint.js";

const W = 240, SCALE = 4;
const FACES = [56, 42, 32]; // the child's face, its parents', its grandparents'

export async function makeTree(renderer, genome) {
  if (!genome.parents) throw new Error("only a child has a family tree");
  const family = familyOf(genome);
  const [a, b] = family.parents.map((p) => p.genome);
  const [body, belly, accent, , , ink] = genome.palette;
  const face = (g, generation) => portrait(renderer, g, FACES[generation], FACES[generation]);
  const origins = originsOf(genome, a, b);
  const lineage = wrapLineage(genome.seed, W - 20);
  const rows = Math.ceil(origins.length / 2);
  const H = 22 + 66 + 76 + 92 + 8 + rows * 9 + 8 + lineage.length * 9 + 12;

  // Faces first: each is a render of its own.
  const grand = family.parents.map((p) => p.parents?.map((q) => [q.genome, face(q.genome, 2)]) ?? null);
  const parents = [a, b].map((g) => face(g, 1));
  const child = face(genome, 0);

  return png(W, H, SCALE, (g) => {
    box(g, 0, 0, W, H, ink);
    box(g, 2, 2, W - 4, H - 4, genome.rare ? "#ffd66b" : accent);
    box(g, 5, 5, W - 10, H - 10, belly);
    const title = `${genome.name}'s family`;
    box(g, 8, 8, W - 16, 15, ink);
    outlined(g, title, Math.floor((W - measure(title)) / 2), 12, "#ffffff", ink, 1);

    /** A member of the family: its face over its name, centered on x. */
    const member = (pixels, size, gn, x, y, big = false) => {
      draw(g, pixels, size, size, x - size / 2, y);
      const name = measure(gn.name) <= 52 || big ? gn.name : `${gn.name.slice(0, 8)}.`;
      pixelText(g, name, Math.round(x - measure(name) / 2), y + size + 1, ink);
    };
    const link = (x0, y0, x1, y1) => {
      g.fillStyle = ink;
      const ym = Math.round((y0 + y1) / 2);
      g.fillRect(x0, y0, 1, ym - y0);
      g.fillRect(Math.min(x0, x1), ym, Math.abs(x1 - x0) + 1, 1);
      g.fillRect(x1, ym, 1, y1 - ym);
    };

    // Grandparents, two above each parent; a parent that is a word has none.
    const px = [W * 0.27, W * 0.73].map(Math.round);
    let y = 28;
    grand.forEach((pair, i) => {
      if (!pair) return pixelText(g, "a word", px[i] - measure("a word") / 2, y + 20, ink);
      pair.forEach(([gn, pixels], j) => {
        const x = px[i] + (j ? 28 : -28);
        member(pixels, FACES[2], gn, x, y);
        link(x, y + FACES[2] + 10, px[i], y + 66);
      });
    });
    // The parents, a heart between them, then the child.
    y += 66;
    [a, b].forEach((gn, i) => {
      member(parents[i], FACES[1], gn, px[i], y);
      link(px[i], y + FACES[1] + 10, W / 2, y + 76);
    });
    pixelText(g, "♥", W / 2 - 2, y + 16, "#ff6f91");
    y += 76;
    member(child, FACES[0], genome, W / 2, y, true);
    y += 92;

    // Where each part came from, in two columns.
    g.fillStyle = ink;
    for (let x = 10; x < W - 10; x += 2) g.fillRect(x, y, 1, 1);
    y += 5;
    const names = { a: a.name, b: b.name, both: "both", blend: "a blend", new: "✦ new" };
    origins.forEach(({ part, from }, i) => {
      const x = i % 2 ? W / 2 + 2 : 10, yy = y + 9 * Math.floor(i / 2);
      const color = from === "a" ? a.palette[0] : from === "b" ? b.palette[0] : from === "new" ? "#ffd66b" : belly;
      box(g, x, yy - 1, 5, 9, ink);
      g.fillStyle = color;
      g.fillRect(x + 1, yy, 3, 7);
      const text = `${part} ${names[from]}`;
      pixelText(g, text.length > 17 ? text.slice(0, 17) : text, x + 7, yy, ink);
    });
    y += 9 * rows + 4;
    g.fillStyle = ink;
    for (let x = 10; x < W - 10; x += 2) g.fillRect(x, y, 1, 1);
    y += 4;
    lineage.forEach((text, i) => line(g, text, 10, y + 9 * i, ink));
    const last = lineage.at(-1);
    if (textWidth(last) + 8 + measure("wildseed") <= W - 20) pixelText(g, "wildseed", W - 10 - measure("wildseed"), y + 9 * (lineage.length - 1), body);
  });
}
