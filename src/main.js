// The hatchery page: a word in, a creature out; two creatures in, an egg, and their child. ARCHITECTURE.md,
// "The page".
import "./hatchery.css";
import { genomeOf, lineageOf, lineageProblem } from "./genome.mjs";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { MEET } from "./render/meeting.js";
import { HATCH, skyOf } from "./render/stage.js";
import { cry, hatchSounds, meetSounds, mute, wakeAudio } from "./audio/cry.js";
import { makeGif, portrait } from "./share/film.js";
import { labelOf } from "./family.mjs";
import { makeCard } from "./share/card.js";
import { makeTree } from "./share/tree.js";
import { save } from "./share/save.js";
import { FamilyTree } from "./ui/family.js";
import { Nest } from "./ui/nest.js";

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
      onHatched: (genome) => {
        cry(genome);
        // Its parents call out to it, one after the other.
        genome.parents?.forEach((p, i) => setTimeout(() => wild.creature === genome && cry(genomeOf(p)), 450 + 300 * i));
      },
      onPoke: (genome) => cry(genome),
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
    for (const id of ["save-gif", "save-card", "save-tree"]) $(id).disabled = true;
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

function showCard(g, parents) {
  card.querySelector(".name").textContent = g.name;
  card.querySelector(".species").textContent = g.species;
  card.querySelector(".affinity").textContent = g.affinity;
  card.querySelector(".about").textContent = MOODS[g.traits.mood];
  card.querySelector(".rare").hidden = !g.rare;
  card.querySelector(".seed").textContent = parents ? `lineage “${g.seed}”` : `seed “${g.seed}”`;
  const mutated = [...new Set((g.mutations ?? []).map(labelOf))];
  card.querySelector(".parents").textContent = parents ? `egg #${g.clutch} of ${parents[0].name} × ${parents[1].name}` : "";
  card.querySelector(".mutant").textContent = mutated.length ? `✦ mutation: ${mutated.join(", ")}` : "";
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

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

const tree = new FamilyTree($("family-tree"), {
  onPick: (lineage) => hatch(lineage),
  portrait: async (genome, size) => (view ? portrait(view.renderer, genome, size, size, { zoom: 1.7 }) : null),
});
const nest = new Nest({ root: $("cross"), recent: document.querySelector(".hatched"), stage: document.querySelector(".stage") }, {
  current: () => wild.creature,
  hatch: (lineage) => hatch(lineage),
  showError,
});

/** The caption over the scene while a child's parents meet and its egg hatches: what happens, as it happens. */
const caption = document.querySelector(".caption");
let story = [];
function narrate(genome, parents, tempo) {
  story.forEach(clearTimeout);
  caption.hidden = true;
  if (!parents || !view) return;
  const at = (seconds, text) => setTimeout(() => {
    caption.textContent = text;
    caption.hidden = !text;
  }, (seconds * 1000) / tempo);
  story = [
    at(0, `${parents[0].name} meets ${parents[1].name}…`),
    at(MEET.laid, "An egg!"),
    at(MEET.laid + HATCH.burst, `It's ${genome.name}!${genome.mutations.length ? " ✦" : ""}`),
    at(MEET.laid + HATCH.ready + 2, ""),
  ];
}

/**
 * Hatches a lineage: the egg drops, cracks, and the creature that word was always going to be comes out; or,
 * for a child, its parents meet and lay its egg first. `tempo` plays the hatch faster (a page opened from a link).
 */
function hatch(lineage, { push = true, tempo = 1 } = {}) {
  const genome = genomeOf(lineage);
  const parents = genome.parents?.map(genomeOf) ?? null;
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  input.value = parents ? genome.seed.replaceAll("*", " × ") : genome.seed;
  view?.hatch(genome, { parents, tempo }).then(() => tree.paint());
  if (view && parents) meetSounds(parents, MEET);
  if (view) hatchSounds(HATCH, parents ? MEET.laid : 0);
  narrate(genome, parents, tempo);
  showCard(genome, parents);
  card.classList.remove("fresh");
  void card.offsetWidth; // restart the card's little hop
  card.classList.add("fresh");
  tree.show(genome);
  nest.show(genome);
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
  url.hash = "";
  if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
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
  hatch(lineageOf(input.value));
});

$("random").addEventListener("click", () => {
  wakeAudio();
  hatch(randomWord());
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
  const parents = genome.parents?.map(genomeOf) ?? null;
  const text = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    save(await make(view.renderer, genome, { parents }), filename(genome));
  } finally {
    button.disabled = false;
    button.textContent = text;
  }
}
/** A file name from the creature's name and its seed: `thomik-auri-x-thomas-3`. */
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/\*/g, "-x-").replace(/[\s'#()]+/g, "-").replace(/-+/g, "-").replace(/-$/, "")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", makeGif, (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", makeCard, (g) => `${fileName(g)}-card.png`));
$("save-tree").addEventListener("click", () => exporting($("save-tree"), "Drawing…", makeTree, (g) => `${fileName(g)}-family.png`));

/** Hatches what the address names, any way it is written; a page opened from a link hatches briskly. */
function fromAddress({ push, tempo = 1 }) {
  let asked = new URLSearchParams(location.search).get("seed");
  // A link pasted with its # unescaped (`?seed=a*b#2`) still names that egg.
  if (asked !== null && /^#[0-9]+$/.test(location.hash)) asked += location.hash;
  if (asked !== null) {
    const problem = lineageProblem(asked);
    if (!problem) return hatch(lineageOf(asked), { push, tempo });
    if (!wild.creature) hatch(randomWord(), { push: false, tempo });
    input.value = asked;
    return showError(problem);
  }
  hatch(randomWord(), { push: false, tempo });
}

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false, tempo: 1.6 });
