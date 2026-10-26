// The hatchery page: a word in, a creature out. ARCHITECTURE.md, "The page".
import "./hatchery.css";
import { genomeOf } from "./genome.mjs";
import { lineageProblem } from "./lineage.mjs";
import { cross } from "./cross.mjs";
import { showFamily } from "./family.js";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { HATCH, skyOf } from "./render/stage.js";
import { cry, hatchSounds, mute, wakeAudio } from "./audio/cry.js";
import { save } from "./share/save.js";

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const card = $("creature-card");
const input = $("seed-input");
const error = $("seed-error");

/** What the page shows, kept up to date: ARCHITECTURE.md, "window.__wild". */
const wild = (window.__wild = { ready: false, renderer: null, pixel: null, creature: null });

/** The live scene, or null where the browser offers no WebGL 2: the page then says so and still names the creature. */
const view = (() => {
  try {
    return new Hatchery($("scene"), {
      onHatched: (genome) => cry(genome),
      onPoke: (genome) => cry(genome),
      onReady: (genome) => {
        if (wild.creature === genome) {
          reveal(genome);
          wild.ready = true;
        }
      },
      onResize: ({ pixel }) => (wild.pixel = pixel),
    });
  } catch (e) {
    const note = document.createElement("p");
    note.className = "no-webgl";
    note.textContent = "This browser cannot draw the hatchery: it needs WebGL 2.";
    document.querySelector(".stage").append(note);
    for (const id of ["save-gif", "save-card"]) $(id).disabled = true;
    console.error(e);
    return null;
  }
})();
wild.renderer = view?.kind ?? null;

const MOODS = {
  bouncy: "Can't sit still for long.",
  sleepy: "Naps wherever it lands.",
  curious: "Pokes at everything new.",
  shy: "Hides when you stare.",
  proud: "Poses for every picture.",
};
const STATS = [["hp", "HP"], ["attack", "Attack"], ["defense", "Defense"], ["speed", "Speed"]];

function showCard(g) {
  card.querySelector(".name").textContent = g.name;
  card.querySelector(".species").textContent = g.species;
  card.querySelector(".affinity").textContent = g.affinity;
  card.querySelector(".about").textContent = MOODS[g.traits.mood];
  card.querySelector(".rare").hidden = !g.rare;
  card.querySelector(".seed").textContent = `seed “${g.seed}”`;
  card.querySelector(".stats").replaceChildren(
    ...STATS.map(([key, name]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      const bar = document.createElement("span");
      dt.textContent = name;
      bar.className = "bar";
      bar.style.setProperty("--v", g.stats[key]);
      const value = document.createElement("b");
      value.textContent = g.stats[key];
      dd.append(bar, value);
      row.append(dt, dd);
      return row;
    }),
  );
  const [body, belly, accent, detail, , ink] = g.palette;
  const sky = skyOf(g.affinity);
  const root = document.documentElement.style;
  Object.entries({ body, belly, accent, detail, ink, sky0: sky[0], sky1: sky[1], sky2: sky[2], sky3: sky[3] }).forEach(([k, v]) => root.setProperty(`--${k}`, v));
  document.title = `${g.name} · Wildseed`;
}

/** The creatures hatched on this device, newest first: a row of chips that hatch them again. */
const KEPT = "wildseed.hatched";
function remember(genome) {
  let seeds = [];
  try {
    seeds = JSON.parse(localStorage.getItem(KEPT) ?? "[]").filter((s) => typeof s === "string" && !lineageProblem(s));
  } catch {}
  seeds = [genome.seed, ...seeds.filter((s) => s !== genome.seed)].slice(0, 12);
  try {
    localStorage.setItem(KEPT, JSON.stringify(seeds));
  } catch {}
  const chips = seeds.map((seed) => {
    const g = genomeOf(seed);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = g.name;
    chip.title = `“${seed}”: ${g.species}, ${g.affinity}`;
    chip.style.setProperty("--chip", g.palette[0]);
    chip.setAttribute("aria-current", String(seed === genome.seed));
    chip.addEventListener("click", () => {
      input.value = seed;
      hatch(seed);
    });
    return chip;
  });
  document.querySelector(".recent").replaceChildren(...chips);
  document.querySelector(".hatched").hidden = seeds.length < 2;
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

/** Hatches a seed: the egg drops, cracks, and the creature that word was always going to be comes out. */
function hatch(seed, { push = true, parents = null } = {}) {
  const genome = genomeOf(seed);
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  view?.hatch(genome, parents);
  if (view) hatchSounds(HATCH, parents ? 0.9 : 0);
  card.hidden = true;
  $("family-tree").hidden = true;
  $("next-egg").hidden = true;
  if (!view) reveal(genome);
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
  if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
}

/** Reveal the card and ancestors together once the child has left its shell. */
function reveal(genome) {
  card.hidden = false;
  showCard(genome);
  showFamily($("family-tree"), genome);
  $("next-egg").hidden = !genome.parents || genome.clutch >= 99;
  $("next-egg").textContent = `Lay egg #${genome.clutch + 1} →`;
  card.classList.remove("fresh");
  void card.offsetWidth; // restart the card's little hop
  card.classList.add("fresh");
  remember(genome);
}

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
  const problem = lineageProblem(input.value);
  const seed = input.value;
  if (problem) return showError(problem);
  hatch(seed);
});

$("random").addEventListener("click", () => {
  wakeAudio();
  const word = randomWord();
  input.value = word;
  hatch(word);
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
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/[\s']+/g, "-")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", async (...args) => (await import("./share/film.js")).makeGif(...args), (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", async (...args) => (await import("./share/card.js")).makeCard(...args), (g) => `${fileName(g)}-card.png`));

function fromAddress({ push }) {
  const asked = new URLSearchParams(location.search).get("seed");
  if (asked !== null) {
    const seed = asked;
    const problem = lineageProblem(seed);
    if (!problem) {
      input.value = seed;
      return hatch(seed, { push });
    }
    if (!wild.creature) hatch(randomWord(), { push: false });
    return showError(problem);
  }
  hatch(randomWord(), { push: false });
}

const parentA = $("parent-a"), parentB = $("parent-b");
document.querySelector('.crossing').addEventListener('submit', e => {
  e.preventDefault();
  const problem = lineageProblem(parentA.value) || lineageProblem(parentB.value);
  if (problem) return showError(problem);
  try {
    wakeAudio();
    const parents = [genomeOf(parentA.value), genomeOf(parentB.value)];
    const child = cross(...parents);
    input.value = child.seed;
    hatch(child.seed, { parents });
  } catch (e) { showError(e.message); }
});
$("next-egg").addEventListener('click', () => {
  const g = wild.creature;
  if (!g.parents || g.clutch >= 99) return;
  const parents = g.parents.map(genomeOf);
  const child = cross(...parents, g.clutch + 1);
  input.value = child.seed;
  hatch(child.seed, { parents });
});
$("use-child").addEventListener('click', () => {
  parentA.value = wild.creature.seed;
  parentB.focus();
});

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false });
