// Browser-only indexed GIF89a encoder. Palette is shared across the entire animation.
// Periodic LZW clear codes keep the dictionary width bounded; this favors simple,
// predictable memory use over compression ratio for small pixel-art animations.
export function paletteOf(frames, limit = 64) {
  const histogram = new Map();
  for (const frame of frames) for (let i = 0; i < frame.length; i += 16) {
    const key = (frame[i] >> 3) << 10 | (frame[i + 1] >> 3) << 5 | frame[i + 2] >> 3;
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }
  const points = [...histogram].map(([key, n]) => ({ rgb: [(key >> 10) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4], n }));
  if (!points.length) return Array.from({ length: limit }, () => [0, 0, 0]);
  const describe = (items) => {
    const low = [255, 255, 255], high = [0, 0, 0]; let count = 0;
    for (const p of items) { count += p.n; for (let c = 0; c < 3; c++) { low[c] = Math.min(low[c], p.rgb[c]); high[c] = Math.max(high[c], p.rgb[c]); } }
    const ranges = high.map((v, i) => v - low[i]);
    const axis = ranges.indexOf(Math.max(...ranges));
    return { items, count, axis, priority: items.length > 1 ? ranges[axis] * Math.sqrt(count) : -1 };
  };
  const boxes = [describe(points)];
  while (boxes.length < limit) {
    boxes.sort((a, b) => b.priority - a.priority);
    const box = boxes[0]; if (box.priority < 0) break;
    box.items.sort((a, b) => a.rgb[box.axis] - b.rgb[box.axis]);
    let sum = 0, split = 1;
    for (; split < box.items.length - 1; split++) { sum += box.items[split - 1].n; if (sum >= box.count / 2) break; }
    boxes.splice(0, 1, describe(box.items.slice(0, split)), describe(box.items.slice(split)));
  }
  const palette = boxes.map(({ items, count }) => [0, 1, 2].map((c) => Math.round(items.reduce((sum, p) => sum + p.rgb[c] * p.n, 0) / count)));
  while (palette.length < limit) palette.push([...palette[palette.length - 1]]);
  return palette;
}

export function encodeGif(width, height, frames, palette, delay = 9) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535) throw new Error('Invalid GIF size.');
  if (palette.length !== 64 || !frames.length || frames.some((f) => f.length !== width * height * 4)) throw new Error('Invalid GIF frames or palette.');
  const chunks = [];
  const bytes = (...values) => chunks.push(Uint8Array.from(values));
  const word = (n) => [n & 255, n >> 8 & 255];
  chunks.push(new TextEncoder().encode('GIF89a'));
  bytes(...word(width), ...word(height), 0xf5, 0, 0); // global table: 64 colors
  chunks.push(Uint8Array.from(palette.flat()));
  bytes(0x21, 0xff, 11); chunks.push(new TextEncoder().encode('NETSCAPE2.0')); bytes(3, 1, 0, 0, 0);
  const lookup = new Int16Array(32768); lookup.fill(-1);
  function index(r, g, b) {
    const key = (r >> 3) << 10 | (g >> 3) << 5 | b >> 3;
    if (lookup[key] >= 0) return lookup[key];
    let best = 0, distance = Infinity;
    for (let j = 0; j < 64; j++) {
      const p = palette[j], d = (r - p[0]) ** 2 * 2 + (g - p[1]) ** 2 * 3 + (b - p[2]) ** 2;
      if (d < distance) { distance = d; best = j; }
    }
    lookup[key] = best; return best;
  }
  for (const frame of frames) {
    bytes(0x21, 0xf9, 4, 4, ...word(delay), 0, 0);
    bytes(0x2c, 0, 0, 0, 0, ...word(width), ...word(height), 0, 6);
    const compressed = []; let accumulator = 0, bits = 0;
    const code = (value) => {
      accumulator |= value << bits; bits += 7;
      while (bits >= 8) { compressed.push(accumulator & 255); accumulator >>>= 8; bits -= 8; }
    };
    for (let pixel = 0; pixel < width * height; pixel++) {
      if (pixel % 60 === 0) code(64);
      const at = pixel * 4; code(index(frame[at], frame[at + 1], frame[at + 2]));
    }
    code(65); if (bits) compressed.push(accumulator & 255);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255); bytes(block.length); chunks.push(Uint8Array.from(block));
    }
    bytes(0);
  }
  bytes(0x3b);
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
