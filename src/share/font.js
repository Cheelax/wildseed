// A 5 × 7 pixel font, drawn here row by row, for the GIF and the card. Text in other scripts (a seed in
// Japanese or Arabic) falls back to the system font, drawn small and snapped to whole pixels.

const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12], ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0], "-": [0, 0, 0, 31, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4], "?": [14, 17, 1, 2, 4, 0, 4], "/": [1, 2, 2, 4, 8, 8, 16],
  "+": [0, 4, 4, 31, 4, 4, 0], '"': [10, 10, 0, 0, 0, 0, 0], "·": [0, 0, 0, 12, 12, 0, 0],
  "★": [4, 4, 31, 14, 14, 27, 0], "♥": [0, 10, 31, 31, 14, 4, 0],
};

/** Whether the pixel font can draw every character of `text` (case aside). */
export const drawable = (text) => [...text.toUpperCase()].every((ch) => GLYPHS[ch]);

/** The width of `text` in pixels at `scale`. */
export const measure = (text, scale = 1) => Math.max(0, [...text].length * 6 - 1) * scale;

/** Draws `text` with its top-left corner at (x, y), each font pixel `scale` pixels wide. */
export function pixelText(g, text, x, y, color, scale = 1) {
  g.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    const rows = GLYPHS[ch] ?? GLYPHS["?"];
    rows.forEach((bits, r) => {
      for (let c = 0; c < 5; c++) if (bits & (16 >> c)) g.fillRect(x + (i * 6 + c) * scale, y + r * scale, scale, scale);
    });
  });
}

/**
 * Text in any script, snapped to whole pixels: drawn with the system font on a scratch canvas, then
 * every pixel more than half covered is filled. Returns the width drawn.
 */
export function anyText(g, text, x, y, color, size = 9) {
  const scratch = document.createElement("canvas");
  const s = scratch.getContext("2d");
  s.font = `bold ${size}px system-ui, sans-serif`;
  const w = Math.ceil(s.measureText(text).width) + 2;
  scratch.width = w;
  scratch.height = size + 4;
  s.font = `bold ${size}px system-ui, sans-serif`;
  s.textBaseline = "top";
  s.fillStyle = "#000";
  s.fillText(text, 1, 1);
  const { data } = s.getImageData(0, 0, w, size + 4);
  g.fillStyle = color;
  for (let py = 0; py < size + 4; py++) for (let px = 0; px < w; px++) if (data[(py * w + px) * 4 + 3] > 120) g.fillRect(x + px, y + py, 1, 1);
  return w;
}

/** Draws text in the pixel font when it can, else in the snapped system font. Returns the width. */
export function label(g, text, x, y, color, scale = 1) {
  if (drawable(text)) {
    pixelText(g, text, x, y, color, scale);
    return measure(text, scale);
  }
  return anyText(g, text, x, y - 1, color, 8 * scale);
}
