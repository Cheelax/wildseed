import { encodeGif, quantize } from './gif.mjs';
export const GIF_SIZE = 192;
export const GIF_FRAMES = 36;

function download(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const canvas2D = (width, height) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; };
function fit(ctx, source, x, y, width, height) {
  const ratio = Math.min(width / source.width, height / source.height), w = source.width * ratio, h = source.height * ratio;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

export async function saveGif(scene, time) {
  const canvas = canvas2D(GIF_SIZE, GIF_SIZE), ctx = canvas.getContext('2d', { willReadFrequently: true }), frames = [];
  for (let frame = 0; frame < GIF_FRAMES; frame++) {
    scene.draw(time + frame / 12, { exportAge: frame / 12 });
    ctx.fillStyle = '#dce7d2'; ctx.fillRect(0, 0, GIF_SIZE, GIF_SIZE); fit(ctx, scene.canvas, 0, 0, GIF_SIZE, GIF_SIZE);
    frames.push(quantize(ctx.getImageData(0, 0, GIF_SIZE, GIF_SIZE).data));
    if (frame % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  download(new Blob([encodeGif(frames, GIF_SIZE, GIF_SIZE)], { type: 'image/gif' }), 'wildseed-creature.gif');
}

export async function saveCard(scene, genome) {
  const canvas = canvas2D(720, 900), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f1f3e8'; ctx.fillRect(0, 0, 720, 900);
  ctx.fillStyle = '#203a32'; ctx.font = 'bold 20px system-ui'; ctx.fillText('WILDSEED / FIELD NOTES', 48, 52);
  ctx.fillStyle = '#dce7d2'; ctx.fillRect(32, 80, 656, 480); fit(ctx, scene.canvas, 32, 80, 656, 480);
  ctx.fillStyle = '#203a32'; ctx.font = '52px Georgia'; ctx.fillText(genome.name, 48, 627);
  ctx.font = '22px system-ui'; ctx.fillText(`${genome.species} · ${genome.affinity}${genome.rare ? ' · Rare' : ''}`, 48, 667);
  ctx.font = '20px system-ui';
  Object.entries(genome.stats).forEach(([key, value], i) => { const x = 48 + i % 2 * 320, y = 720 + Math.floor(i / 2) * 44; ctx.fillText(`${key.toUpperCase()}  ${value}`, x, y); });
  ctx.font = '20px system-ui'; ctx.fillText(`Seed: ${genome.seed}`, 48, 837, 624);
  ctx.font = '14px system-ui'; ctx.fillText('A word. A creature. Always yours.', 48, 868);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG encoding failed')), 'image/png'));
  download(blob, `wildseed-${genome.traits.signature}.png`);
}
