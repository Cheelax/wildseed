// An animated GIF encoder: one palette of at most 64 colors for every frame (median cut when the frames
// hold more), LZW compression, endless looping. No dependency.
import { GIF_MAX_COLORS } from "../rules.mjs";

/** Splits the colors into at most `max` boxes along their widest channel; one average color per box. */
function medianCut(counts, max) {
  let boxes = [[...counts.entries()]];
  const range = (box, shift) => {
    let lo = 255, hi = 0;
    for (const [c] of box) {
      const v = (c >> shift) & 255;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  };
  while (boxes.length < max) {
    let best = null, bestRange = 0, bestShift = 0;
    for (const box of boxes) {
      if (box.length < 2) continue;
      for (const shift of [16, 8, 0]) {
        const r = range(box, shift);
        if (r > bestRange) [best, bestRange, bestShift] = [box, r, shift];
      }
    }
    if (!best) break;
    best.sort((a, b) => ((a[0] >> bestShift) & 255) - ((b[0] >> bestShift) & 255));
    const total = best.reduce((s, [, n]) => s + n, 0);
    let acc = 0, cut = 1;
    for (; cut < best.length - 1; cut++) if ((acc += best[cut - 1][1]) >= total / 2) break;
    boxes = boxes.filter((b) => b !== best).concat([best.slice(0, cut), best.slice(cut)]);
  }
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const [c, k] of box) {
      r += ((c >> 16) & 255) * k;
      g += ((c >> 8) & 255) * k;
      b += (c & 255) * k;
      n += k;
    }
    return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
  });
}

/** One palette for all frames (RGBA arrays), and each frame as palette indices. */
export function quantize(frames, max = GIF_MAX_COLORS) {
  const counts = new Map();
  for (const f of frames) {
    for (let i = 0; i < f.length; i += 4) {
      const c = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2];
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const palette = counts.size <= max ? [...counts.keys()] : medianCut(counts, max);
  const nearest = new Map();
  const indexOf = (c) => {
    let i = nearest.get(c);
    if (i !== undefined) return i;
    let best = Infinity;
    palette.forEach((p, j) => {
      const dr = ((p >> 16) & 255) - ((c >> 16) & 255), dg = ((p >> 8) & 255) - ((c >> 8) & 255), db = (p & 255) - (c & 255);
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < best) [best, i] = [d, j];
    });
    nearest.set(c, i);
    return i;
  };
  const indexed = frames.map((f) => {
    const out = new Uint8Array(f.length / 4);
    for (let i = 0; i < out.length; i++) out[i] = indexOf((f[i * 4] << 16) | (f[i * 4 + 1] << 8) | f[i * 4 + 2]);
    return out;
  });
  return { palette, indexed };
}

/** GIF's variable-width LZW, as the decoder expects it (the code size grows before the entry that needs it). */
function lzw(indices, minCodeSize, out) {
  const clear = 1 << minCodeSize, end = clear + 1;
  let size = minCodeSize + 1, next = end + 1, table = new Map();
  let acc = 0, bits = 0;
  const bytes = [];
  const emit = (code) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const code = table.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      size = minCodeSize + 1;
      next = end + 1;
    } else {
      if (next >= 1 << size) size++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) bytes.push(acc & 255);
  out.push(minCodeSize);
  for (let i = 0; i < bytes.length; i += 255) {
    const block = bytes.slice(i, i + 255);
    out.push(block.length, ...block);
  }
  out.push(0);
}

/**
 * Encodes RGBA frames of width × height into a looping GIF, each art pixel `scale` pixels wide, each
 * frame shown for `delays[i]` hundredths of a second.
 */
export function encodeGif(frames, width, height, { scale = 1, delays }) {
  const { palette, indexed } = quantize(frames);
  const bitsPerIndex = Math.max(1, Math.ceil(Math.log2(palette.length)));
  const tableSize = 1 << bitsPerIndex;
  const W = width * scale, H = height * scale;
  const out = [];
  const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
  out.push(..."GIF89a".split("").map((c) => c.charCodeAt(0)));
  u16(W);
  u16(H);
  out.push(0x80 | 0x70 | (bitsPerIndex - 1), 0, 0);
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] ?? 0;
    out.push((c >> 16) & 255, (c >> 8) & 255, c & 255);
  }
  out.push(0x21, 0xff, 11, ..."NETSCAPE2.0".split("").map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  indexed.forEach((frame, f) => {
    out.push(0x21, 0xf9, 4, 0x04);
    u16(delays[f] ?? 10);
    out.push(0, 0);
    out.push(0x2c);
    u16(0);
    u16(0);
    u16(W);
    u16(H);
    out.push(0);
    const big = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = Math.floor(y / scale) * width;
      for (let x = 0; x < W; x++) big[y * W + x] = frame[row + Math.floor(x / scale)];
    }
    lzw(big, Math.max(2, bitsPerIndex), out);
  });
  out.push(0x3b);
  return new Uint8Array(out);
}
