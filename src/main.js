// The hatchery page: a word in, a creature out; two in, an egg laid and their child out. ARCHITECTURE.md,
// "The page" and "Lineages".
import "./hatchery.css";
import { canonical, genomeOf, readLineage } from "./genome.mjs";
import { writeCross } from "./lineage.mjs";
import { CLUTCH_MAX } from "./rules.mjs";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { HATCH } from "./render/stage.js";
import { chime, cry, hatchSounds, mute, wakeAudio } from "./audio/cry.js";
import { makeGif } from "./share/film.js";
import { makeCard } from "./share/card.js";
import { makeTree } from "./share/tree.js";
import { save } from "./share/save.js";
import { showCard } from "./page/card.js";
import { showTree } from "./page/tree.js";
import { Faces } from "./page/faces.js";
import { showHatched } from "./page/hatched.js";
import { resemblance } from "./family.mjs";

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const card = $("creature-card");
const input = $("seed-input");
const mate = document.querySelector(".hatch [name=mate]");
const error = $("seed-error");
const layButton = document.querySelector(".hatch-btn");

/** What the page shows, kept up to date: ARCHITECTURE.md, "window.__wild". */
const wild = (window.__wild = { ready: false, renderer: null, pixel: null, creature: null });

/** The live scene, or null where the browser offers no WebGL 2: the page then says so and still names the creature. */
const view = (() => {
  try {
    return new Hatchery($("scene"), {
      onMeet: ([a, b]) => (cry(a), cry(b, 0.3)),
      onHatched: (genome) => {
        cry(genome);
        const parents = view.stage.meeting?.parents.map((p) => p.genome);
        if (!parents) return;
        parents.forEach((p, i) => cry(p, 0.55 + 0.25 * i)); // and its parents cheer
        if (genome.mutations.length || genome.rare) chime(0.2);
        announce(genome, parents);
      },
      onPoke: (genome) => cry(genome),
      onReady: (genome) => {
        if (wild.creature === genome) wild.ready = true;
        faces.wake(true);
      },
      onResize: ({ pixel }) => (wild.pixel = pixel),
    });
  } catch (e) {
    const note = document.createElement("p");
    note.className = "no-webgl";
    note.textContent = "This browser cannot draw the hatchery: it needs WebGL 2.";
    document.querySelector(".stage").append(note);
    for (const b of document.querySelectorAll(".share .btn:not(.copy-link)")) b.disabled = true;
    console.error(e);
    return null;
  }
})();
wild.renderer = view?.kind ?? null;

const faces = new Faces(view?.renderer);

/** Says, over the scene, who just hatched and whom it takes after. */
const news = document.querySelector(".news");
let newsTimer = 0;
function announce(child, [a, b]) {
  news.replaceChildren(Object.assign(document.createElement("b"), { textContent: `${child.name} hatched!` }), ` ${resemblance(child, a, b).join(" · ")}`);
  news.hidden = false;
  clearTimeout(newsTimer);
  newsTimer = setTimeout(() => (news.hidden = true), 5000);
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

/** The first egg of two lineages (each a word or a child): their child's seed. Throws a LineageError. */
function crossOf(a, b, clutch = 1) {
  const seed = writeCross(canonical(a), canonical(b), clutch);
  readLineage(seed); // refuses a child past 6 generations or 120 characters
  return seed;
}

/**
 * Hatches a lineage: a word's egg drops and cracks; a child's parents meet, lay the egg and watch it
 * hatch. `quick` starts a word's hatch with its egg landed, for a page that has just opened.
 */
function hatch(seed, { push = true, quick = false } = {}) {
  const genome = genomeOf(seed);
  const parents = genome.parents?.map((s) => genomeOf(s)) ?? null;
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  faces.wake(false);
  news.hidden = true;
  const from = quick && !parents ? HATCH.cracks[0] + 0.3 : 0;
  view?.hatch(genome, { from });
  if (view) hatchSounds(HATCH, { at: view.stage.timeline.hatch - from, laid: !!parents });
  input.value = genome.seed;
  mate.value = "";
  syncButton();
  showCard(card, genome, parents);
  card.classList.remove("fresh");
  void card.offsetWidth; // restart the card's little hop
  card.classList.add("fresh");
  showTree($("family-tree"), genome, { face: (g, size, canvas) => faces.draw(g, size, canvas), pick: (s) => hatch(s) });
  showEggs(genome, parents);
  treeButton.hidden = !parents;
  showHatched(document.querySelector(".hatched"), genome, { hatch, layWith });
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
  if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
}

/** Lays an egg of the creature on screen and another lineage. */
function layWith(other) {
  wakeAudio();
  try {
    hatch(crossOf(wild.creature.seed, other));
  } catch (e) {
    showError(e.message);
  }
}

/** A child's eggs: its parents' egg before and after this one, laid with a click. A word can find a mate. */
function showEggs(genome, parents) {
  const eggs = document.querySelector(".eggs");
  eggs.classList.toggle("child", !!parents);
  if (!parents) return;
  const n = genome.clutch;
  eggs.querySelector(".which").textContent = `${parents[0].name} × ${parents[1].name}, egg #${n}`;
  const prev = eggs.querySelector(".prev"), next = eggs.querySelector(".next");
  prev.disabled = n <= 1;
  next.disabled = n >= CLUTCH_MAX;
  prev.onclick = () => hatch(crossOf(genome.parents[0], genome.parents[1], n - 1));
  next.onclick = () => (wakeAudio(), hatch(crossOf(genome.parents[0], genome.parents[1], n + 1)));
}
document.querySelector(".eggs .mate").addEventListener("click", () => layWith(randomWord()));

/** The button says what Enter does: hatch what is typed, or lay an egg of it and a second creature. */
function syncButton() {
  layButton.textContent = mate.value.trim() ? "Lay an egg" : "Hatch";
}
mate.addEventListener("input", syncButton);

/** Random deals the words from a shuffled deck: no word comes back before the deck runs out. */
let deck = [];
const randomWord = () => {
  if (deck.length === 0) {
    deck = [...WORDS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  const word = deck.pop();
  return word === wild.creature?.seed ? randomWord() : word;
};

document.querySelector("form.hatch").addEventListener("submit", (e) => {
  e.preventDefault();
  wakeAudio();
  try {
    hatch(mate.value.trim() ? crossOf(input.value, mate.value) : canonical(input.value));
  } catch (err) {
    showError(err.message);
  }
});

$("random").addEventListener("click", () => {
  wakeAudio();
  hatch(randomWord());
});

// Drop a creature from "Hatched here" on the scene, and it lays an egg with the one on screen.
const stageBox = document.querySelector(".stage");
stageBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  stageBox.classList.add("dropping");
});
stageBox.addEventListener("dragleave", () => stageBox.classList.remove("dropping"));
stageBox.addEventListener("drop", (e) => {
  e.preventDefault();
  stageBox.classList.remove("dropping");
  const seed = e.dataTransfer.getData("text/plain");
  if (seed) layWith(seed);
});

addEventListener("pointerdown", wakeAudio);
addEventListener("keydown", wakeAudio);

/** The sound switch, remembered on this device. */
const sound = document.querySelector(".sound");
function setSound(on) {
  mute(!on);
  sound.setAttribute("aria-pressed", String(on));
  sound.textContent = on ? "Sound on" : "Sound off";
  try {
    localStorage.setItem("wildseed.sound", on ? "on" : "off");
  } catch {}
}
sound.addEventListener("click", () => setSound(sound.getAttribute("aria-pressed") !== "true"));
try {
  setSound(localStorage.getItem("wildseed.sound") !== "off");
} catch {}

/** Runs a slow export with its button showing that it works. */
async function exporting(button, busyText, make, filename) {
  if (button.disabled || !view) return;
  const genome = wild.creature;
  const text = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    save(await make(view.renderer, genome), filename(genome));
  } finally {
    button.disabled = false;
    button.textContent = text;
  }
}
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/[\s'*#()]+/g, "-").replace(/^-+|-+$/g, "")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", makeGif, (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", makeCard, (g) => `${fileName(g)}-card.png`));
const treeButton = document.querySelector(".save-tree");
treeButton.addEventListener("click", () => exporting(treeButton, "Drawing…", makeTree, (g) => `${fileName(g)}-family.png`));
// The link: shared through the device's own sheet where there is one (a phone), else copied.
const linkButton = document.querySelector(".copy-link");
if (navigator.share) linkButton.textContent = "Share link";
linkButton.addEventListener("click", async () => {
  const g = wild.creature;
  const text = linkButton.textContent;
  try {
    if (navigator.share) return await navigator.share({ title: `${g.name} · Wildseed`, text: g.parents ? `${g.name}, the child of ${g.parents.map((s) => genomeOf(s).name).join(" and ")}` : `${g.name}, hatched from “${g.seed}”`, url: location.href });
    await navigator.clipboard.writeText(location.href);
    linkButton.textContent = "Link copied";
  } catch {
    if (!navigator.share) linkButton.textContent = "Copy it from the address bar";
  }
  setTimeout(() => (linkButton.textContent = text), 1800);
});

function fromAddress({ push, quick = false }) {
  const asked = new URLSearchParams(location.search).get("seed");
  if (asked !== null) {
    try {
      return hatch(canonical(asked), { push, quick });
    } catch (e) {
      if (!wild.creature) hatch(randomWord(), { push: false, quick });
      return showError(e.message);
    }
  }
  hatch(randomWord(), { push: false, quick });
}

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false, quick: true });
