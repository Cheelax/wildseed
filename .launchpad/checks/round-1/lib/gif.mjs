// A GIF structure reader, Node built-ins only: walks the blocks without decoding the pictures.
// parseGif(buffer) gives { width, height, frames: [{ width, height, colors, data }] }, where `colors`
// is the size of the color table the frame uses and `data` its compressed picture.

export function parseGif(buf) {
  const head = buf.toString("latin1", 0, 6);
  if (head !== "GIF89a" && head !== "GIF87a") throw new Error(`not a GIF: it starts with ${JSON.stringify(head)}`);
  if (buf.length < 13) throw new Error("not a GIF: too short");
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8), flags = buf[10];
  let pos = 13;
  const global = flags & 0x80 ? 2 ** ((flags & 7) + 1) : 0;
  pos += 3 * global;
  const frames = [];
  const blocks = () => {
    const parts = [];
    for (;;) {
      if (pos >= buf.length) throw new Error("not a GIF: a data block runs past the end of the file");
      const n = buf[pos++];
      if (n === 0) return Buffer.concat(parts);
      if (pos + n > buf.length) throw new Error("not a GIF: a data block runs past the end of the file");
      parts.push(buf.subarray(pos, pos + n));
      pos += n;
    }
  };
  for (;;) {
    if (pos >= buf.length) throw new Error("not a GIF: no trailer");
    const b = buf[pos++];
    if (b === 0x3b) break;
    if (b === 0x21) {
      pos++;
      blocks();
    } else if (b === 0x2c) {
      if (pos + 9 > buf.length) throw new Error("not a GIF: an image descriptor runs past the end of the file");
      const w = buf.readUInt16LE(pos + 4), h = buf.readUInt16LE(pos + 6), f = buf[pos + 8];
      pos += 9;
      const local = f & 0x80 ? 2 ** ((f & 7) + 1) : 0;
      pos += 3 * local;
      pos++;
      frames.push({ width: w, height: h, colors: local || global, data: blocks() });
    } else {
      throw new Error(`not a GIF: unknown block 0x${b.toString(16)} at byte ${pos - 1}`);
    }
  }
  return { width, height, frames };
}
