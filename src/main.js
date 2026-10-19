import { genomeOf } from './genome.mjs';
import { createScene } from './scene.js';
import { saveCard, saveGif } from './sharing.js';
import './style.css';

const words = ['moss', 'pebble', 'juniper', 'thomas', 'auri', 'fern', 'clover', 'amber', 'puddle', 'cinder', 'moonbeam', 'thistle', 'fig', 'basil', 'river', 'hotpod', 'daniel', 'a', 'willow', 'hazel', 'coral', 'cloud', 'drift', 'meadow'];
const input = document.querySelector('[data-testid="seed-input"]'), error = document.querySelector('[data-testid="seed-error"]');
const notice = document.querySelector('#notice'), exports = [...document.querySelectorAll('.export')];
let scene, genome = null, exporting = false, sound = true, audio = null, time = 0;
window.__wild = { ready: false, renderer: null, pixel: 4, creature: null };

function cry() {
  if (!sound || !genome) return;
  audio ??= new AudioContext();
  audio.resume().catch((failure) => { notice.textContent = `Sound unavailable: ${failure.message}`; });
  const base = 180 + genome.traits.voice * 26 + genome.stats.speed * 2;
  for (let i = 0; i < 3; i++) {
    const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + i * 0.11;
    oscillator.type = genome.affinity === 'stone' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(base * [1, 1.25, 1.5][i], start);
    oscillator.frequency.exponentialRampToValueAtTime(base * 0.8, start + 0.15);
    gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.19);
  }
}

function fillCard(g) {
  document.querySelector('#name').textContent = g.name;
  document.querySelector('#species').textContent = g.species;
  document.querySelector('#affinity').textContent = g.affinity;
  document.querySelector('#rarity').textContent = g.rare ? 'Rare · golden halo' : 'A one-word wonder';
  for (const [key, value] of Object.entries(g.stats)) {
    document.querySelector(`#${key}-value`).textContent = value;
    document.querySelector(`#${key}-meter`).value = value;
  }
  document.querySelector('#seed-note').textContent = `Grown from “${g.seed}”`;
}

function hatch(seed, updateAddress = true) {
  if (exporting) return;
  let next;
  try { next = genomeOf(seed); }
  catch (failure) { error.textContent = failure.message; input.setAttribute('aria-invalid', 'true'); return; }
  error.textContent = ''; input.removeAttribute('aria-invalid');
  genome = next; input.value = genome.seed; fillCard(genome);
  window.__wild.creature = genome; window.__wild.ready = false;
  exports.forEach((button) => { button.disabled = true; });
  scene.hatch(genome, time); notice.textContent = 'A little life is stirring…';
  if (updateAddress) { const url = new URL(location.href); url.searchParams.set('seed', genome.seed); history.replaceState(null, '', url); }
}

document.querySelector('#seed-form').addEventListener('submit', (event) => { event.preventDefault(); hatch(input.value); if (!input.hasAttribute('aria-invalid')) cry(); });
document.querySelector('[data-testid="random"]').onclick = () => {
  const options = words.filter((word) => word !== genome?.seed);
  const random = new Uint32Array(1); crypto.getRandomValues(random);
  hatch(options[random[0] % options.length]); cry();
};
document.querySelector('#sound').onclick = (event) => { sound = !sound; event.currentTarget.textContent = sound ? 'Sound on' : 'Sound off'; event.currentTarget.setAttribute('aria-pressed', String(sound)); if (sound) cry(); };
async function exportCreature(kind) {
  if (exporting || !window.__wild.ready) return;
  exporting = true; exports.forEach((button) => { button.disabled = true; });
  input.disabled = true; document.querySelector('[data-testid="random"]').disabled = true;
  notice.textContent = kind === 'gif' ? 'Making your animated keepsake…' : 'Preparing your field card…';
  try { if (kind === 'gif') await saveGif(scene, time); else await saveCard(scene, genome); notice.textContent = 'Your keepsake is ready.'; }
  catch (failure) { notice.textContent = `Export failed: ${failure.message}`; }
  finally {
    exporting = false; input.disabled = false; document.querySelector('[data-testid="random"]').disabled = false;
    exports.forEach((button) => { button.disabled = false; }); scene.draw(time);
  }
}
document.querySelector('[data-testid="save-gif"]').onclick = () => exportCreature('gif');
document.querySelector('[data-testid="save-card"]').onclick = () => exportCreature('card');
try {
  scene = createScene(document.querySelector('#diorama'));
  window.__wild.renderer = 'webgl2'; window.__wild.pixel = scene.pixel;
  scene.canvas.addEventListener('greet', cry);
  const urlSeed = new URLSearchParams(location.search).get('seed');
  hatch(urlSeed ?? 'moss', false);
  if (!genome) { const reason = error.textContent; hatch('moss', false); error.textContent = reason; input.setAttribute('aria-invalid', 'true'); input.value = urlSeed; }
  let previous = performance.now();
  function loop(now) {
    time += Math.min(0.1, (now - previous) / 1000); previous = now;
    if (!exporting && !document.hidden) {
      const ready = scene.draw(time);
      if (ready && !window.__wild.ready) { window.__wild.ready = true; notice.textContent = `Meet ${genome.name}. Drag to turn, tap to say hello.`; exports.forEach((button) => { button.disabled = false; }); }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
} catch (failure) {
  notice.textContent = `The hatchery could not start: ${failure.message}. Please enable WebGL 2.`;
  window.__wild.error = failure.message;
}
