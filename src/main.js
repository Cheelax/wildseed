import './style.css';
import { genomeOf, hash32, normalizeSeed } from './genome.mjs';
import { CREATURES, WORDS } from './catalog.mjs';
import { readJournal, writeJournal } from './storage.mjs';
import { HatchScene } from './scene.js';
import { CreatureVoice } from './audio.js';
import { saveCard, saveGif } from './export.js';

document.querySelector('#app').innerHTML = `
  <header class="masthead">
    <a class="brand" href="./" aria-label="Wildseed home"><span class="brand-icon" aria-hidden="true">✳</span> wildseed<span class="edition">FIELD NOTES / 001</span></a>
    <div class="header-actions"><span class="local-badge"><i></i> a tiny world, all yours</span><button id="sound" class="icon-button" aria-label="Mute sound" aria-pressed="false">♫ <span>Sound on</span></button></div>
  </header>
  <section class="intro"><div><p class="eyebrow">THE HATCHERY</p><h1>Every word has<br>a little <em>wild</em> in it.</h1><p class="intro-copy">Start with your name. See who’s been waiting.</p></div><p class="margin-note">One word.<br>One small wonder.<br><span>Always yours.</span></p></section>
  <section class="hatchery" aria-label="Creature hatchery">
    <div class="world-column">
      <div class="world-top"><span id="habitat">A quiet clearing</span><span id="specimen-number">SPECIMEN —</span></div>
      <div class="scene-wrap"><canvas data-testid="scene" tabindex="0" role="img" aria-label="Creature. Drag to turn. Arrow keys turn the camera; Enter says hello; Home resets the view."></canvas></div>
      <div class="world-bottom"><span class="life-label"><i></i><span id="life">Something is stirring…</span></span><button id="reset-camera" class="text-button" title="Reset camera (Home)">↺ Reset view</button></div>
      <p class="scene-hint">DRAG TO TURN <span>·</span> TAP TO SAY HELLO</p>
    </div>
    <aside class="specimen" data-testid="creature-card" aria-label="Creature details">
      <div class="card-top"><span class="eyebrow">MEET YOUR WILDSEED</span><button id="favourite" class="icon-button heart" aria-label="Keep this creature" aria-pressed="false">♡</button></div>
      <div class="identity"><span id="rare" class="rare" hidden>✦ GOLDEN VARIANT</span><h2 id="creature-name">A little mystery</h2><p id="species">Waiting to hatch</p></div>
      <div class="tags"><span id="affinity" class="tag">—</span><span id="temperament" class="tag subtle">—</span></div>
      <p id="description" class="description">A word is all it takes.</p>
      <div id="stats" class="stats"></div>
      <div class="seed-caption"><span>GROWN FROM</span><strong id="current-seed">—</strong></div>
      <button id="hello" class="hello-button">Say hello <span aria-hidden="true">↗</span></button>
      <div class="export-row"><button data-testid="save-gif" disabled>↓ Save GIF</button><button data-testid="save-card" disabled>↓ Save card</button></div>
      <button id="share" class="share-button">Copy creature link</button>
    </aside>
  </section>
  <form id="hatch-form" class="seed-form" novalidate>
    <label for="seed">What shall we grow next?</label><div class="seed-controls"><div class="input-wrap"><span aria-hidden="true">✳</span><input id="seed" data-testid="seed-input" placeholder="A name, a word, a little feeling…" autocomplete="off" spellcheck="false" aria-describedby="seed-help seed-error"><button class="hatch-button" type="submit">Hatch <span aria-hidden="true">↗</span></button></div><button type="button" data-testid="random" class="random-button">⚄ Surprise me</button></div>
    <p id="seed-help">Same word, same friend. Up to 24 characters, in any language.</p><p id="seed-error" data-testid="seed-error" role="alert" hidden></p>
  </form>
  <section class="journal" aria-label="Your field notes"><div class="journal-title"><h3>Your field notes <span id="journal-count"></span></h3><div class="journal-tabs"><button id="show-recent" aria-pressed="true">Recent</button><button id="show-kept" aria-pressed="false">Kept ♡</button></div></div><div id="journal-list" class="journal-list"></div><p class="storage-note" id="storage-note">Remembered on this device. Your words never leave this page.</p></section>
  <footer><span>WILDSEED <span class="footer-dot">✳</span> Grown from words. Made to wonder.</span><button id="help-button" class="text-button">A small field guide ↗</button></footer>
  <div id="status" class="toast" role="status" aria-live="polite"></div>
  <dialog id="help"><form method="dialog"><button class="dialog-close" aria-label="Close field guide">×</button></form><p class="eyebrow">A SMALL FIELD GUIDE</p><h2>Find your kind of wild.</h2><p>Every word grows one creature, forever. Try your name, a place you love, or a word in another language.</p><p>Drag the creature to look around it. Tap it or choose <strong>Say hello</strong> to hear its voice. With the scene focused, use arrow keys to turn, Enter or Space to greet it, and Home to reset.</p><p>Six families live here. About one in 64 creatures carries a golden crown. Keep favourites with ♡, or share their link. GIFs and cards are made right here on your device.</p><p>Sound begins only after you interact. Recent words, kept creatures and your sound preference are stored on this device when browser storage is available.</p></dialog>
`;

const $ = (selector) => document.querySelector(selector);
const input = $('[data-testid="seed-input"]'), error = $('#seed-error'), canvas = $('[data-testid="scene"]');
let storage; try { storage = window.localStorage; } catch { storage = null; }
const journal = readJournal(storage), voice = new CreatureVoice(); voice.muted = journal.muted;
let genome = null, scene = null, busy = false, journalMode = 'recent', exportId = 0, toastTimer, tick = 0;
let pendingHistory = null;
const now = () => performance.now() / 1000;
window.__wild = { ready: false, renderer: 'webgl2', pixel: 4, creature: null };
function announce(message, permanent = false) {
  clearTimeout(toastTimer); $('#status').textContent = message; $('#status').classList.toggle('visible', !!message);
  if (!permanent) toastTimer = setTimeout(() => $('#status').classList.remove('visible'), 4000);
}
function persist() {
  if (!writeJournal(storage, journal)) $('#storage-note').textContent = 'Storage is unavailable. You can still save a card or copy a creature link.';
}
function soundLabel() {
  $('#sound').innerHTML = `${voice.muted ? '♩' : '♫'} <span>Sound ${voice.muted ? 'off' : 'on'}</span>`;
  $('#sound').setAttribute('aria-pressed', String(voice.muted)); $('#sound').setAttribute('aria-label', voice.muted ? 'Enable sound' : 'Mute sound');
}
function updateKept() {
  const kept = genome && journal.favourites.includes(genome.seed);
  $('#favourite').textContent = kept ? '♥' : '♡'; $('#favourite').setAttribute('aria-pressed', String(!!kept));
  $('#favourite').setAttribute('aria-label', kept ? 'Remove from kept creatures' : 'Keep this creature');
}
function renderJournal() {
  const list = $('#journal-list'); list.replaceChildren();
  const seeds = journalMode === 'recent' ? journal.recent : journal.favourites;
  $('#journal-count').textContent = `${journal.favourites.length} kept`;
  $('#show-recent').setAttribute('aria-pressed', String(journalMode === 'recent'));
  $('#show-kept').setAttribute('aria-pressed', String(journalMode === 'favourites'));
  if (!seeds.length) { const p = document.createElement('p'); p.className = 'journal-empty'; p.textContent = 'A little blank page. Keep a creature with ♡ to begin.'; list.append(p); }
  for (const seed of seeds) {
    const g = genomeOf(seed), button = document.createElement('button');
    button.className = 'journal-entry'; button.disabled = busy; button.setAttribute('aria-label', `Hatch ${seed}, ${g.name}, ${g.species}`);
    const swatch = document.createElement('span'); swatch.className = 'journal-swatch'; swatch.style.backgroundColor = g.palette[2]; swatch.textContent = ['♧', '◆', '❧', '♠', '✿', '☽'][['spriglet', 'craggle', 'flutterseed', 'mushling', 'bloomkin', 'embercurl'].indexOf(g.species)];
    const label = document.createElement('span'); label.textContent = seed;
    button.append(swatch, label); button.addEventListener('click', () => hatch(seed)); list.append(button);
  }
}
function setControls() {
  for (const el of document.querySelectorAll('button:not(#help-button):not(.dialog-close):not(#sound), #seed')) el.disabled = busy;
  for (const el of document.querySelectorAll('[data-testid="save-gif"], [data-testid="save-card"], #hello, #favourite, #share')) el.disabled = busy || !window.__wild.ready;
  canvas.setAttribute('aria-busy', String(busy || !window.__wild.ready));
}
function showCard(g) {
  const info = CREATURES[g.species];
  $('#creature-name').textContent = g.name; $('#species').textContent = `${info.label} · ${info.family}`;
  $('#affinity').textContent = `${{ moss: '♧', stone: '◆', spark: '✦' }[g.affinity]} ${g.affinity}`;
  $('#affinity').dataset.affinity = g.affinity; $('#temperament').textContent = g.traits.temperament;
  $('#description').textContent = info.description; $('#current-seed').textContent = g.seed;
  $('#rare').hidden = !g.rare; $('#habitat').textContent = info.home;
  $('#specimen-number').textContent = `SPECIMEN ${String(hash32(g.seed) % 100000).padStart(5, '0')}`;
  canvas.setAttribute('aria-label', `${g.name}, a ${g.species}. Drag or use arrow keys to turn. Tap or press Enter to say hello.`);
  $('#stats').replaceChildren();
  for (const [key, value] of Object.entries(g.stats)) {
    const stat = document.createElement('div'); stat.className = 'stat';
    const label = document.createElement('span'); label.textContent = { hp: 'Vitality · HP', attack: 'Attack', defense: 'Defense', speed: 'Speed' }[key];
    const number = document.createElement('strong'); number.textContent = String(value);
    const bar = document.createElement('div'); bar.className = 'stat-bar'; const fill = document.createElement('i'); fill.style.width = `${value}%`; bar.append(fill);
    stat.append(label, number, bar); $('#stats').append(stat);
  }
  updateKept();
}
function hatch(value, { history = true } = {}) {
  if (busy || !scene || scene.lost) return;
  let next;
  try { next = genomeOf(value); } catch (e) { error.textContent = e.message; error.hidden = false; input.setAttribute('aria-invalid', 'true'); return; }
  error.hidden = true; error.textContent = ''; input.removeAttribute('aria-invalid');
  genome = next; input.value = genome.seed;
  window.__wild.ready = false; window.__wild.creature = genome;
  scene.hatch(genome, now()); showCard(genome); setControls();
  $('#life').textContent = 'Something is stirring…';
  if (history) {
    const url = new URL(location.href); url.searchParams.set('seed', genome.seed);
    try { window.history.replaceState(null, '', url); } catch { /* A restricted embed may refuse URL changes. */ }
  }
  journal.recent = [genome.seed, ...journal.recent.filter((s) => s !== genome.seed)].slice(0, 12);
  persist(); renderJournal();
}
function hello() {
  if (!genome || !window.__wild.ready || busy) return;
  scene.hello(now()); voice.cry(genome); announce(`${genome.name} is happy to see you.`);
}
$('#hatch-form').addEventListener('submit', (event) => { event.preventDefault(); hatch(input.value); });
$('[data-testid="random"]').addEventListener('click', () => {
  const choices = WORDS.filter((seed) => seed !== genome?.seed);
  const numbers = new Uint32Array(1);
  try { crypto.getRandomValues(numbers); } catch { numbers[0] = (Date.now() >>> 0); }
  hatch(choices[numbers[0] % choices.length]);
});
$('#hello').addEventListener('click', hello); $('#reset-camera').addEventListener('click', () => scene?.resetCamera());
$('#sound').addEventListener('click', () => { voice.muted = !voice.muted; journal.muted = voice.muted; if (voice.muted) voice.silence(); else if (genome) voice.cry(genome); persist(); soundLabel(); });
$('#favourite').addEventListener('click', () => {
  if (!genome || busy) return;
  const kept = journal.favourites.includes(genome.seed);
  if (!kept && journal.favourites.length >= 24) { announce('Your notebook holds 24 friends. Unkeep one to make room.'); return; }
  journal.favourites = kept ? journal.favourites.filter((s) => s !== genome.seed) : [genome.seed, ...journal.favourites];
  persist(); updateKept(); renderJournal(); announce(kept ? 'Released from your kept pages.' : `${genome.name} has a page in your notebook.`);
});
for (const [id, mode] of [['#show-recent', 'recent'], ['#show-kept', 'favourites']]) $(id).addEventListener('click', () => { journalMode = mode; renderJournal(); });
$('#share').addEventListener('click', async () => {
  const url = new URL(location.href); url.searchParams.set('seed', genome.seed);
  try { await navigator.clipboard.writeText(url.href); announce('Creature link copied. A little wonder, ready to travel.'); }
  catch { input.focus(); announce('Copy the address from your browser to share this creature.'); }
});
$('#help-button').addEventListener('click', () => $('#help').showModal());
$('#help').addEventListener('click', (event) => { if (event.target === $('#help')) { const r = $('#help').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('#help').close(); } });
window.addEventListener('popstate', () => {
  const value = new URLSearchParams(location.search).get('seed') ?? 'clover';
  if (busy) pendingHistory = value; else hatch(value, { history: false });
});
document.addEventListener('visibilitychange', () => { if (document.hidden) voice.silence(); });
async function exportCreature(type) {
  if (busy || !window.__wild.ready) return;
  busy = true; scene.busy = true; setControls(); const id = ++exportId;
  announce(type === 'gif' ? 'Growing your GIF…' : 'Pressing your field card…', true);
  try {
    if (type === 'gif') await saveGif(scene, genome, (message) => announce(message, true)); else await saveCard(scene, genome);
    announce(type === 'gif' ? 'Your GIF is ready. Keep a little wild with you.' : 'Your field card is ready.');
  } catch (e) { announce(`Export failed: ${e.message}. Please try again.`, true); }
  finally {
    if (id === exportId) {
      busy = false; scene.busy = false; scene.resize(); scene.draw(now()); setControls();
      if (pendingHistory !== null) { const value = pendingHistory; pendingHistory = null; hatch(value, { history: false }); }
    }
  }
}
$('[data-testid="save-gif"]').addEventListener('click', () => exportCreature('gif'));
$('[data-testid="save-card"]').addEventListener('click', () => exportCreature('card'));

soundLabel(); renderJournal();
try {
  scene = new HatchScene(canvas, hello, () => {
    window.__wild.ready = false; busy = true; setControls(); announce('The 3D view was interrupted. Reload this page to bring your creature back.', true);
  });
  const requested = new URLSearchParams(location.search).get('seed');
  let initial = requested ?? journal.recent[0] ?? 'clover';
  try { normalizeSeed(initial); } catch { initial = 'clover'; }
  hatch(initial);
  if (requested !== null && initial !== requested) {
    try { normalizeSeed(requested); } catch (e) { error.textContent = e.message; error.hidden = false; }
  }
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden || busy || scene.lost) return;
    const time = now(); if (time - tick < 1 / 30) return; tick = time;
    const ready = scene.draw(time);
    if (ready && !window.__wild.ready) {
      window.__wild.ready = true; $('#life').textContent = `${genome.name} is ${CREATURES[genome.species].verb}`; setControls();
    }
  }
  requestAnimationFrame(frame);
} catch (e) {
  console.error('Wildseed could not initialize the 3D view:', e);
  busy = true; setControls();
  error.hidden = false; error.textContent = 'This little world needs WebGL 2. Try a recent browser with graphics enabled.';
  announce('The 3D view could not start. Your saved notebook is still safe.', true);
}
