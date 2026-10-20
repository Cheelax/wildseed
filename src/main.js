// The hatchery page: a word in, a creature out. ARCHITECTURE.md, "The page".
import "./hatchery.css";
import { genomeOf, normalizeSeed, seedProblem } from "./genome.mjs";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { cry, wakeAudio } from "./audio/cry.js";
import { makeGif } from "./share/film.js";
import { makeCard } from "./share/card.js";
import { save } from "./share/save.js";

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const card = $("creature-card");
const input = $("seed-input");
const error = $("seed-error");

/** What the page shows, kept up to date: ARCHITECTURE.md, "window.__wild". */
const wild = (window.__wild = { ready: false, renderer: null, pixel: null, creature: null });

const view = new Hatchery($("scene"), {
  onHatched: (genome) => cry(genome),
  onPoke: (genome) => cry(genome),
  onReady: (genome) => {
    if (wild.creature === genome) wild.ready = true;
  },
  onResize: ({ pixel }) => (wild.pixel = pixel),
});
wild.renderer = view.kind;

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
  const sky = view.stage.colors.sky;
  const root = document.documentElement.style;
  Object.entries({ body, belly, accent, detail, ink, sky0: sky[0], sky1: sky[1], sky2: sky[2], sky3: sky[3] }).forEach(([k, v]) => root.setProperty(`--${k}`, v));
  document.title = `${g.name} · Wildseed`;
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

/** Hatches a seed: the egg drops, cracks, and the creature that word was always going to be comes out. */
function hatch(seed, { push = true } = {}) {
  const genome = genomeOf(seed);
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  view.hatch(genome);
  showCard(genome);
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
  if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
}

const randomWord = () => {
  let word;
  do word = WORDS[Math.floor(Math.random() * WORDS.length)];
  while (word === wild.creature?.seed);
  return word;
};

document.querySelector("form.hatch").addEventListener("submit", (e) => {
  e.preventDefault();
  wakeAudio();
  const seed = normalizeSeed(input.value);
  const problem = seedProblem(seed);
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

/** Runs a slow export with its button showing that it works. */
async function exporting(button, busyText, make, filename) {
  if (button.disabled) return;
  const genome = wild.creature;
  const text = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    save(await make(view.renderer, genome), `${filename(genome)}`);
  } finally {
    button.disabled = false;
    button.textContent = text;
  }
}
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/[\s']+/g, "-")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", makeGif, (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", makeCard, (g) => `${fileName(g)}-card.png`));

function fromAddress({ push }) {
  const asked = new URLSearchParams(location.search).get("seed");
  if (asked !== null) {
    const seed = normalizeSeed(asked);
    const problem = seedProblem(seed);
    if (!problem) {
      input.value = seed;
      return hatch(seed, { push });
    }
    if (!wild.creature) hatch(randomWord(), { push: false });
    return showError(problem);
  }
  hatch(randomWord(), { push: false });
}

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false });
