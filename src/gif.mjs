export const CUBE_PALETTE = Array.from({ length: 64 }, (_, i) => [(i >>> 4) * 85, (i >>> 2 & 3) * 85, (i & 3) * 85]);

export function encodeGif(frames, width, height, delay = 9, palette = CUBE_PALETTE) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535) throw new Error('Invalid GIF dimensions');
  if (!frames.length || frames.some((frame) => frame.length !== width * height || frame.some((pixel) => !Number.isInteger(pixel) || pixel < 0 || pixel > 63))) throw new Error('GIF frames must contain 64-color indices matching dimensions');
  if (palette.length !== 64 || palette.some((color) => color.length !== 3 || color.some((n) => !Number.isInteger(n) || n < 0 || n > 255))) throw new Error('GIF requires 64 RGB colors');
  const delays = Array.isArray(delay) ? delay : frames.map(() => delay);
  if (delays.length !== frames.length || delays.some((n) => !Number.isInteger(n) || n < 1 || n > 65535)) throw new Error('GIF delays must be positive centiseconds for every frame');
  const out = [], byte = (n) => out.push(n & 255), word = (n) => { byte(n); byte(n >>> 8); };
  const text = (value) => { for (const char of value) byte(char.charCodeAt(0)); };
  text('GIF89a'); word(width); word(height); byte(0xf5); byte(0); byte(0);
  for (const color of palette) for (const channel of color) byte(channel);
  byte(0x21); byte(0xff); byte(11); text('NETSCAPE2.0'); byte(3); byte(1); word(0); byte(0);
  for (const [frame, pixels] of frames.entries()) {
    byte(0x21); byte(0xf9); byte(4); byte(4); word(delays[frame]); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(width); word(height); byte(0); byte(6);
    // Reset below 128 entries so encoder and decoder always use seven-bit LZW codes.
    const compressed = []; let bits = 0, count = 0;
    const code = (value) => { bits |= value << count; count += 7; while (count >= 8) { compressed.push(bits & 255); bits >>>= 8; count -= 8; } };
    const dictionary = new Map(); let next = 66, prefix = pixels[0]; code(64);
    for (let i = 1; i < pixels.length; i++) {
      const pixel = pixels[i], key = prefix * 64 + pixel, match = dictionary.get(key);
      if (match !== undefined) { prefix = match; continue; }
      code(prefix);
      if (next < 126) dictionary.set(key, next++);
      else { code(64); dictionary.clear(); next = 66; }
      prefix = pixel;
    }
    code(prefix);
    code(65); if (count) compressed.push(bits & 255);
    for (let start = 0; start < compressed.length; start += 255) {
      const block = compressed.slice(start, start + 255); byte(block.length); out.push(...block);
    }
    byte(0);
  }
  byte(0x3b); return new Uint8Array(out);
}

export function quantize(rgba, palette = CUBE_PALETTE) {
  const pixels = new Uint8Array(rgba.length / 4);
  const cache = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], key = r * 65536 + g * 256 + b;
    if (!cache.has(key)) {
      let best = 0, distance = Infinity;
      palette.forEach((color, index) => {
        const d = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
        if (d < distance) { best = index; distance = d; }
      });
      cache.set(key, best);
    }
    pixels[i] = cache.get(key);
  }
  return pixels;
}

export function paletteOf(frames) {
  const histogram = new Map();
  for (const rgba of frames) for (let i = 0; i < rgba.length; i += 4) {
    const rgb = [rgba[i], rgba[i + 1], rgba[i + 2]], key = (rgb[0] >> 3) * 1024 + (rgb[1] >> 3) * 32 + (rgb[2] >> 3);
    const bin = histogram.get(key) ?? { rgb: [0, 0, 0], count: 0 };
    bin.count++; rgb.forEach((n, c) => { bin.rgb[c] += n; }); histogram.set(key, bin);
  }
  if (!histogram.size) throw new Error('Cannot build an empty palette');
  const colors = [...histogram.values()].map(({ rgb, count }) => ({ rgb: rgb.map((n) => n / count), count }));
  const box = (values) => {
    const ranges = [0, 1, 2].map((c) => Math.max(...values.map((v) => v.rgb[c])) - Math.min(...values.map((v) => v.rgb[c])));
    const channel = ranges.indexOf(Math.max(...ranges));
    return { values, channel, score: ranges[channel] * values.reduce((sum, v) => sum + v.count, 0) };
  };
  const boxes = [box(colors)];
  while (boxes.length < 64) {
    boxes.sort((a, b) => b.score - a.score);
    const index = boxes.findIndex((b) => b.values.length > 1);
    if (index < 0) break;
    const current = boxes.splice(index, 1)[0], values = current.values.sort((a, b) => a.rgb[current.channel] - b.rgb[current.channel]);
    const half = values.reduce((sum, v) => sum + v.count, 0) / 2;
    let split = 0, count = 0;
    while (split < values.length - 1 && count < half) count += values[split++].count;
    boxes.push(box(values.slice(0, split)), box(values.slice(split)));
  }
  const palette = boxes.map(({ values }) => {
    const count = values.reduce((sum, v) => sum + v.count, 0);
    return [0, 1, 2].map((c) => Math.round(values.reduce((sum, v) => sum + v.rgb[c] * v.count, 0) / count));
  });
  while (palette.length < 64) palette.push([...palette[0]]);
  return palette;
}
