import { paletteOf, encodeGif } from './gif.mjs';
import { CREATURES } from './catalog.mjs';

function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function saveGif(scene, genome, progress) {
  const size = 160, count = 48, frames = [];
  for (let i = 0; i < count; i++) {
    const time = i * .09;
    const canvas = scene.snapshot(time, time, size);
    frames.push(canvas.getContext('2d').getImageData(0, 0, size, size).data);
    progress(`Growing your GIF… ${Math.round((i + 1) / count * 85)}%`);
    await yieldFrame();
  }
  progress('Gathering the colours…'); await yieldFrame();
  const palette = paletteOf(frames);
  const data = encodeGif(size, size, frames, palette, 9);
  download(new Blob([data], { type: 'image/gif' }), `wildseed-${genome.seed}.gif`);
}

export async function saveCard(scene, genome) {
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 960;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f1e6'; ctx.fillRect(0, 0, 720, 960);
  ctx.strokeStyle = '#c9cebc'; ctx.lineWidth = 2; ctx.strokeRect(25, 25, 670, 910);
  ctx.fillStyle = '#334d3e'; ctx.font = 'bold 25px monospace'; ctx.fillText('WILDSEED', 52, 75);
  ctx.font = '16px monospace'; ctx.textAlign = 'right'; ctx.fillText(genome.rare ? '✦ GOLDEN VARIANT' : 'A WORD, A LITTLE WONDER', 668, 73); ctx.textAlign = 'left';
  const portrait = scene.snapshot(2.5, 3, 160);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(portrait, 120, 108, 480, 480);
  ctx.fillStyle = '#f5f1e6'; ctx.fillRect(40, 600, 640, 310);
  ctx.fillStyle = '#283e32'; ctx.font = 'bold 48px Georgia, serif'; ctx.fillText(genome.name, 54, 652);
  ctx.font = '20px monospace'; ctx.fillStyle = '#60715a';
  ctx.fillText(`${CREATURES[genome.species].label} · ${genome.affinity} · ${genome.traits.temperament}`, 54, 690);
  const labels = { hp: 'HP', attack: 'ATTACK', defense: 'DEFENSE', speed: 'SPEED' };
  Object.entries(genome.stats).forEach(([key, value], i) => {
    const x = 54 + i * 159;
    ctx.fillStyle = '#e7e8da'; ctx.fillRect(x, 723, 141, 92);
    ctx.fillStyle = '#60715a'; ctx.font = '14px monospace'; ctx.fillText(labels[key], x + 12, 747);
    ctx.fillStyle = '#283e32'; ctx.font = 'bold 33px monospace'; ctx.fillText(String(value), x + 12, 791);
  });
  ctx.fillStyle = '#60715a'; ctx.font = '15px monospace'; ctx.fillText('GROWN FROM', 54, 852);
  ctx.fillStyle = '#283e32'; ctx.font = '23px sans-serif';
  while (ctx.measureText(genome.seed).width > 600) { const size = parseInt(ctx.font) - 1; ctx.font = `${size}px sans-serif`; }
  ctx.fillText(genome.seed, 54, 887);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('The card could not be encoded.')), 'image/png'));
  download(blob, `wildseed-${genome.seed}.png`);
}
