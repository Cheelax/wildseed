// Drawing in art pixels, for the card and the family tree's picture: boxes with cut corners, outlined
// text, faces, and a lineage wrapped onto as many lines as it takes.
import { anyText, anyWidth, drawable, measure, pixelText } from "./font.js";

/** A rectangle with its corners cut, the pixel artist's rounded box. */
export function box(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

/** Text with a one-pixel outline all around. */
export function outlined(g, text, x, y, fill, ink, scale) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pixelText(g, text, x + dx, y + dy, ink, scale);
  pixelText(g, text, x, y, fill, scale);
}

/** Text in the pixel font when it can draw it, else in the system font snapped to pixels. */
export function line(g, text, x, y, color) {
  if (drawable(text)) pixelText(g, text, x, y, color);
  else anyText(g, text, x, y - 2, color, 9);
}

/** The width of a line drawn by line(). */
export const textWidth = (text) => (drawable(text) ? measure(text) : anyWidth(text, 9));

/**
 * A lineage cut into lines of at most `room` pixels: between its two parents when the first fits on a line,
 * else between the signs inside them.
 */
export function wrapLineage(seed, room) {
  if (textWidth(seed) <= room) return [seed];
  let depth = 0;
  for (let i = 0; i < seed.length; i++) {
    depth += seed[i] === "(" ? 1 : seed[i] === ")" ? -1 : 0;
    if (seed[i] === "*" && depth === 0 && textWidth(seed.slice(0, i + 1)) <= room) return [seed.slice(0, i + 1), ...wrapLineage(seed.slice(i + 1), room)];
  }
  const pieces = seed.split(/(?<=\*)/); // "(auri*thomas#2)*noe": "(auri*", "thomas#2)*", "noe"
  const lines = [""];
  for (const piece of pieces) {
    if (lines.at(-1) && textWidth(lines.at(-1) + piece) > room) lines.push("");
    lines[lines.length - 1] += piece;
  }
  return lines;
}

/** RGBA pixels of w × h drawn at (x, y), their clear pixels leaving what is under them. */
export function draw(g, pixels, w, h, x, y) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").putImageData(new ImageData(pixels, w, h), 0, 0);
  g.drawImage(c, x, y);
}

/** A canvas of w × h art pixels drawn by `paint(g)`, scaled up `scale` times without smoothing, as a PNG. */
export function png(w, h, scale, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"));
  const out = document.createElement("canvas");
  out.width = w * scale;
  out.height = h * scale;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.drawImage(c, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
