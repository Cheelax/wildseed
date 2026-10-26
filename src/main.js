// The hatchery page: a word in, a creature out; two creatures in, an egg and their child out.
// ARCHITECTURE.md, "The page".
import "./hatchery.css";
import { genomeOf, lineageOf, lineageProblem, SeedError } from "./genome.mjs";
import { crossLineage } from "./lineage.mjs";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { skyOf } from "./render/stage.js";
import { MEET } from "./render/meeting.js";
import { cry, hatchSounds, mute, wakeAudio } from "./audio/cry.js";
import { makeGif } from "./share/film.js";
import { makeCard } from "./share/card.js";
import { save } from "./share/save.js";
import { drawFamily } from "./family.js";

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const card = $("creature-card");
const input = $("seed-input");
const error = $("seed-error");
const caption = document.querySelector(".caption");

/** What the page shows, kept up to date: ARCHITECTURE.md, "window.__wild". */
const wild = (window.__wild = { ready: false, renderer: null, pixel: null, creature: null });

/** The live scene, or null where the browser offers no WebGL 2: the page then says so and still names the creature. */
const view = (() => {
  try {
    return new Hatchery($("scene"), {
      onHatched: (genome) => cry(genome),
      onPoke: (genome) => cry(genome),
      onCue: (cue) => tell(cue),
      onReady: (genome) => {
        if (wild.creature === genome) wild.ready = true;
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
  card.querySelector(".seed").textContent = g.parents ? `lineage “${g.seed}”` : `seed “${g.seed}”`;
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

/** The creatures hatched on this device, newest first: chips that open them again, or cross them with the one on screen. */
const KEPT = "wildseed.hatched";
function remember(genome) {
  let seeds = [];
  try {
    seeds = JSON.parse(localStorage.getItem(KEPT) ?? "[]").filter((s) => typeof s === "string" && !lineageProblem(s));
  } catch {}
  seeds = [genome.seed, ...seeds.filter((s) => s !== genome.seed)].slice(0, 16);
  try {
    localStorage.setItem(KEPT, JSON.stringify(seeds));
  } catch {}
  const chips = seeds.map((seed) => {
    const g = genomeOf(seed);
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.draggable = true;
    chip.style.setProperty("--chip", g.palette[0]);
    chip.setAttribute("aria-current", String(seed === genome.seed));
    chip.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/x-wildseed", seed);
      e.dataTransfer.effectAllowed = "copy";
    });
    const open = document.createElement("button");
    open.type = "button";
    open.className = "open";
    open.textContent = g.name;
    open.title = `Open ${g.name}: “${seed}”, ${g.species}, ${g.affinity}`;
    open.addEventListener("click", () => {
      input.value = seed;
      hatch(seed);
    });
    const mate = document.createElement("button");
    mate.type = "button";
    mate.className = "mate-with";
    mate.textContent = "×";
    mate.title = `Cross ${g.name} with the creature on screen`;
    mate.setAttribute("aria-label", mate.title);
    mate.addEventListener("click", () => crossWith(seed));
    chip.append(open, mate);
    return chip;
  });
  document.querySelector(".recent").replaceChildren(...chips);
  document.querySelector(".hatched").hidden = seeds.length < 2;
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

/** A line over the scene while parents meet and lay their egg. */
function tell(text) {
  caption.textContent = text ?? "";
  caption.hidden = !text;
}

/**
 * Hatches a lineage (written form): the egg drops, cracks, and the creature comes out. A child's parents
 * first meet and lay the egg when `meet` is set; `quick` skips to the shell bursting, for a page that opens.
 */
function hatch(seed, { push = true, meet = false, quick = false } = {}) {
  const genome = genomeOf(seed);
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  tell(null);
  const parents = meet && genome.parents ? genome.parents.map((p) => genomeOf(p)) : null;
  if (view) hatchSounds(view.hatch(genome, { parents, quick }), { parents, meet: MEET.arrive, lay: MEET.lay });
  showCard(genome);
  card.classList.remove("fresh");
  void card.offsetWidth; // restart the card's little hop
  card.classList.add("fresh");
  drawFamily($("family-tree"), genome, (ancestor) => {
    input.value = ancestor;
    hatch(ancestor);
  });
  showCrossing(genome);
  remember(genome);
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
  url.hash = "";
  if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
}

/** The crossing box: the creature on screen, who to cross it with, and a child's parents' next egg. */
function showCrossing(g) {
  const mate = document.querySelector(".cross .mate");
  mate.textContent = g.name;
  mate.style.setProperty("--chip", g.palette[0]);
  const next = $("next-egg");
  next.hidden = !g.parents || g.clutch >= 99;
  if (g.parents) next.textContent = `Their egg #${g.clutch + 1}`;
}

/** Crosses the creature on screen with another lineage: they meet, lay an egg, and their child hatches. */
function crossWith(text) {
  wakeAudio();
  const problem = lineageProblem(text);
  if (problem) return showError(problem);
  layEgg(wild.creature.seed, lineageOf(text), 1);
}

function layEgg(a, b, clutch) {
  let child;
  try {
    child = crossLineage(a, b, clutch);
  } catch (e) {
    if (e instanceof SeedError) return showError(`These two cannot have a child: ${e.message}.`);
    throw e;
  }
  input.value = child;
  hatch(child, { meet: true });
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
  if (problem) return showError(problem);
  hatch(lineageOf(input.value), { meet: true });
});

document.querySelector(".cross form").addEventListener("submit", (e) => {
  e.preventDefault();
  const partner = $("cross-input");
  if (!partner.value.trim()) return partner.focus();
  crossWith(partner.value);
});

$("next-egg").addEventListener("click", () => {
  wakeAudio();
  const g = wild.creature;
  if (g?.parents) layEgg(g.parents[0], g.parents[1], g.clutch + 1);
});

$("random").addEventListener("click", () => {
  wakeAudio();
  const word = randomWord();
  input.value = word;
  hatch(word);
});

// Drop a creature hatched here onto the scene, and it crosses with the one on screen.
const stage = document.querySelector(".stage");
stage.addEventListener("dragover", (e) => {
  if (!e.dataTransfer.types.includes("text/x-wildseed")) return;
  e.preventDefault();
  stage.classList.add("dropping");
});
stage.addEventListener("dragleave", () => stage.classList.remove("dropping"));
stage.addEventListener("drop", (e) => {
  stage.classList.remove("dropping");
  const seed = e.dataTransfer.getData("text/x-wildseed");
  if (!seed) return;
  e.preventDefault();
  crossWith(seed);
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

/** Runs a slow export with its button showing that it works, the live scene paused meanwhile. */
async function exporting(button, busyText, make, filename) {
  if (button.disabled || !view) return;
  const genome = wild.creature;
  const text = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  view.paused = true;
  try {
    save(await make(view.renderer, genome), filename(genome));
  } finally {
    view.paused = false;
    button.disabled = false;
    button.textContent = text;
  }
}
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", makeGif, (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", makeCard, (g) => `${fileName(g)}-card.png`));

/** The lineage the address asks for: `?seed=`, plus a "#2" left unencoded, which the browser reads as the fragment. */
function asked() {
  const seed = new URLSearchParams(location.search).get("seed");
  if (seed === null) return null;
  return seed.includes("*") && !seed.includes("#") && /^#\d+$/.test(location.hash) ? seed + location.hash : seed;
}

function fromAddress({ push }) {
  const text = asked();
  const first = !wild.creature;
  if (text !== null) {
    const problem = lineageProblem(text);
    if (!problem) {
      input.value = lineageOf(text);
      return hatch(lineageOf(text), { push, quick: first });
    }
    if (first) hatch(randomWord(), { push: false, quick: true });
    return showError(problem);
  }
  hatch(randomWord(), { push: false, quick: first });
}

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false });
