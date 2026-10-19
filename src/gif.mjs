export function encodeGif(frames, width, height, delay = 9) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535) throw new Error('Invalid GIF dimensions');
  if (!frames.length || frames.some((frame) => frame.length !== width * height || frame.some((pixel) => pixel > 63))) throw new Error('GIF frames must contain 64-color indices matching dimensions');
  const out = [], byte = (n) => out.push(n & 255), word = (n) => { byte(n); byte(n >>> 8); };
  const text = (value) => { for (const char of value) byte(char.charCodeAt(0)); };
  text('GIF89a'); word(width); word(height); byte(0xf5); byte(0); byte(0);
  for (let i = 0; i < 64; i++) { byte((i >>> 4) * 85); byte((i >>> 2 & 3) * 85); byte((i & 3) * 85); }
  byte(0x21); byte(0xff); byte(11); text('NETSCAPE2.0'); byte(3); byte(1); word(0); byte(0);
  for (const pixels of frames) {
    byte(0x21); byte(0xf9); byte(4); byte(4); word(delay); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(width); word(height); byte(0); byte(6);
    // Reset before dictionary growth changes the 7-bit code width. Literal streams trade size for a tiny deterministic encoder.
    const compressed = []; let bits = 0, count = 0;
    const code = (value) => { bits |= value << count; count += 7; while (count >= 8) { compressed.push(bits & 255); bits >>>= 8; count -= 8; } };
    for (let start = 0; start < pixels.length; start += 32) { code(64); for (let i = start; i < Math.min(start + 32, pixels.length); i++) code(pixels[i]); }
    code(65); if (count) compressed.push(bits & 255);
    for (let start = 0; start < compressed.length; start += 255) {
      const block = compressed.slice(start, start + 255); byte(block.length); out.push(...block);
    }
    byte(0);
  }
  byte(0x3b); return new Uint8Array(out);
}

export function quantize(rgba) {
  const pixels = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.round(rgba[i * 4] / 85) * 16 + Math.round(rgba[i * 4 + 1] / 85) * 4 + Math.round(rgba[i * 4 + 2] / 85);
  return pixels;
}
