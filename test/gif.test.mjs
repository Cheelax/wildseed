// The GIF encoder (src/share/gif.js) needs no browser: frames in, bytes out. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeGif, quantize } from "../src/share/gif.js";

/** Walks a GIF's blocks: its size, the size of its color table, and its frames' compressed bytes. */
function walk(bytes) {
  const b = Buffer.from(bytes);
  assert.equal(b.toString("latin1", 0, 6), "GIF89a");
  const table = b[10] & 0x80 ? 2 ** ((b[10] & 7) + 1) : 0;
  let pos = 13 + 3 * table;
  const frames = [];
  let loops = false;
  const blocks = () => {
    const parts = [];
    for (let n = b[pos++]; n; n = b[pos++]) parts.push(b.subarray(pos, (pos += n)));
    return Buffer.concat(parts);
  };
  for (;;) {
    const kind = b[pos++];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      const label = b[pos++];
      const data = blocks();
      if (label === 0xff && data.toString("latin1", 0, 11) === "NETSCAPE2.0") loops = true;
    } else if (kind === 0x2c) {
      pos += 9;
      pos++; // the LZW minimum code size
      frames.push(blocks());
    } else throw new Error(`unknown block ${kind} at ${pos - 1}`);
  }
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8), table, frames, loops };
}

/** An RGBA frame of w × h filled by f(x, y) → [r, g, b]. */
function frame(w, h, f) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set([...f(x, y), 255], (y * w + x) * 4);
  return px;
}

test("encodes looping frames, scaled up, with one table of 64 colors at most", () => {
  const frames = [0, 1, 2].map((k) => frame(8, 6, (x, y) => [((x + k) % 8) * 30, y * 40, 100]));
  const gif = walk(encodeGif(frames, 8, 6, { scale: 3, delays: [10, 10, 10] }));
  assert.equal(gif.width, 24);
  assert.equal(gif.height, 18);
  assert.equal(gif.frames.length, 3);
  assert.ok(gif.table > 0 && gif.table <= 64);
  assert.ok(gif.loops);
  assert.equal(new Set(gif.frames.map((f) => f.toString("base64"))).size, 3);
});

test("more than 64 colors are cut down to 64, each pixel to its nearest", () => {
  const many = frame(32, 32, (x, y) => [x * 8, y * 8, (x + y) * 4]);
  const { palette, indexed } = quantize([many]);
  assert.equal(palette.length, 64);
  assert.ok(indexed[0].every((i) => i < 64));
});

test("a frame of few colors keeps them exactly", () => {
  const colors = [[255, 0, 0], [0, 128, 255], [250, 250, 240]];
  const { palette } = quantize([frame(4, 4, (x) => colors[x % 3])]);
  assert.deepEqual(new Set(palette), new Set(colors.map(([r, g, b]) => (r << 16) | (g << 8) | b)));
});
