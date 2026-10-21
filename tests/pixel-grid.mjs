import assert from 'node:assert/strict';
import { decodePng, colourCount } from '../.launchpad/checks/round-1/lib/png.mjs';

// The official condition, measured at (0, 0) on the complete decoded image.
// No crop, phase search, tolerance between RGB values, or exclusion of overlays.
export function inspectPixelGrid(png, pixel) {
  const image = decodePng(png), { width, height, rgba } = image;
  assert.ok(Number.isInteger(pixel) && pixel >= 3, `invalid art pixel size: ${pixel}`);
  let blocks = 0, uniform = 0;
  for (let y = 0; y + pixel <= height; y += pixel) {
    for (let x = 0; x + pixel <= width; x += pixel) {
      blocks++;
      const first = (y * width + x) * 4;
      let flat = true;
      for (let dy = 0; dy < pixel && flat; dy++) for (let dx = 0; dx < pixel; dx++) {
        const at = ((y + dy) * width + x + dx) * 4;
        if (rgba[at] !== rgba[first] || rgba[at + 1] !== rgba[first + 1] || rgba[at + 2] !== rgba[first + 2]) { flat = false; break; }
      }
      if (flat) uniform++;
    }
  }
  return { width, height, pixel, colors: colourCount(image), blocks, uniform, share: blocks ? uniform / blocks : 0 };
}

export function assertPixelGrid(metrics, label, minimumShare = .95) {
  assert.ok(metrics.width >= 20 * metrics.pixel && metrics.height >= 20 * metrics.pixel, `${label}: scene is too small`);
  assert.ok(metrics.colors >= 8, `${label}: fewer than eight colors`);
  assert.ok(metrics.share >= minimumShare, `${label}: ${(metrics.share * 100).toFixed(2)}% of ${metrics.blocks} blocks are uniform; need ${minimumShare * 100}%`);
}
