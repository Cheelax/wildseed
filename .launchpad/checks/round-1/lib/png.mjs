// A small PNG reader, Node built-ins only: 8-bit grey, grey-alpha, RGB and RGBA, not interlaced (what
// Chromium writes for screenshots and canvas exports). decodePng(buffer) gives { width, height, rgba }.
import { inflateSync } from "node:zlib";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

export function decodePng(buf) {
  if (buf.length < 8 || SIGNATURE.some((b, i) => buf[i] !== b)) throw new Error("not a PNG: the signature is wrong");
  let pos = 8, ihdr = null, ended = false;
  const idat = [];
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString("latin1", pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw new Error(`not a PNG: chunk ${kind} runs past the end of the file`);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], type: data[9], interlace: data[12] };
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") { ended = true; break; }
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("not a PNG: no IHDR chunk");
  if (!ended) throw new Error("not a PNG: no IEND chunk");
  const { width, height, depth, type, interlace } = ihdr;
  const ch = CHANNELS[type];
  if (depth !== 8 || !ch || interlace !== 0) throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}, interlace ${interlace}`);
  if (!width || !height || width * height > 40_000_000) throw new Error(`unsupported PNG size ${width} × ${height}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  if (raw.length < (stride + 1) * height) throw new Error("not a PNG: the image data is too short");
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0;
      const b = y > 0 ? px[up + x] : 0;
      const c = x >= ch && y > 0 ? px[up + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`not a PNG: unknown filter ${f} on row ${y}`);
      px[dst + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * ch;
    const [r, g, b, a] = ch === 1 ? [px[s], px[s], px[s], 255] : ch === 2 ? [px[s], px[s], px[s], px[s + 1]] : ch === 3 ? [px[s], px[s + 1], px[s + 2], 255] : [px[s], px[s + 1], px[s + 2], px[s + 3]];
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { width, height, rgba };
}

/** The number of distinct opaque colours, counted up to `cap`. */
export function colourCount({ rgba }, cap = 4096) {
  const seen = new Set();
  for (let i = 0; i < rgba.length && seen.size < cap; i += 4) if (rgba[i + 3] > 0) seen.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  return seen.size;
}
