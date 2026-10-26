// The hatchery page: a word or a lineage in, a creature out. ARCHITECTURE.md, "The page".
import "./hatchery.css";
import { genomeOf, lineageProblem, wordsOf } from "./genome.mjs";
import { WORDS } from "./words.mjs";
import { Hatchery } from "./render/hatchery.js";
import { HATCH, skyOf } from "./render/stage.js";
import { cry, hatchSounds, mute, wakeAudio } from "./audio/cry.js";
import { makeGif } from "./share/film.js";
import { makeCard } from "./share/card.js";
import { save } from "./share/save.js";

const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const card = $("creature-card");
const input = $("seed-input");
const error = $("seed-error");
const tree = $("family-tree");
const mateA = $("mate-a");
const mateB = $("mate-b");

/** What the page shows, kept up to date: ARCHITECTURE.md, "window.__wild". */
const wild = (window.__wild = { ready: false, renderer: null, pixel: null, creature: null });

/** The live scene, or null where the browser offers no WebGL 2: the page then says so and still names the creature. */
const view = (() => {
  try {
    return new Hatchery($("scene"), {
      onHatched: (genome) => cry(genome),
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

function leaves(v, prefix = "", out = new Map()) {
  for (const [k, x] of Object.entries(v ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, p, out);
    else out.set(p, x);
  }
  return out;
}

function showCard(g) {
  card.querySelector(".name").textContent = g.name;
  card.querySelector(".species").textContent = g.species;
  card.querySelector(".affinity").textContent = g.affinity;
  card.querySelector(".about").textContent = MOODS[g.traits.mood] ?? "";
  card.querySelector(".rare").hidden = !g.rare;
  const words = wordsOf(g.seed);
  card.querySelector(".seed").textContent =
    g.parents ? `lineage ${g.seed}` : `seed “${g.seed}”`;
  if (g.parents) {
    card.querySelector(".seed").textContent = `${g.seed} · ${words.join(" × ")}`;
  }
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
  showTree(g);
}

/** Family tree: child, parents, grandparents by name, with where traits came from. */
function showTree(g) {
  if (!tree) return;
  if (!g.parents) {
    tree.hidden = true;
    tree.replaceChildren();
    return;
  }
  tree.hidden = false;
  const parentGenomes = g.parents.map((s) => genomeOf(s));
  const grandparents = parentGenomes.flatMap((p) => (p.parents ? p.parents.map((s) => genomeOf(s)) : []));

  const origin = (path, value) => {
    if ((g.mutations ?? []).includes(path)) return "mutation";
    for (const [i, p] of parentGenomes.entries()) {
      const pv = leaves(p.traits).get(path);
      if (pv !== undefined && JSON.stringify(pv) === JSON.stringify(value)) return parentGenomes[i].name;
      if (typeof pv === "number" && typeof value === "number" && Math.abs(pv - value) < 1e-9) return parentGenomes[i].name;
    }
    // Blend: both
    const nums = parentGenomes.map((p) => leaves(p.traits).get(path)).filter((v) => typeof v === "number");
    if (typeof value === "number" && nums.length === 2) return `${parentGenomes[0].name} + ${parentGenomes[1].name}`;
    return parentGenomes.map((p) => p.name).join(" / ");
  };

  const interesting = [...leaves(g.traits).entries()]
    .filter(([path]) => ["ears", "tail", "eyes", "mouth", "marking", "charm", "size", "build", "voice.pitch"].some((k) => path === k || path.endsWith(`.${k}`) || path.startsWith(k)))
    .slice(0, 8);

  const line = (label, creatures) => {
    const p = document.createElement("p");
    p.className = "tree-line";
    p.textContent = `${label}: ${creatures.map((c) => c.name).join(", ")}`;
    return p;
  };

  const traitLines = interesting.map(([path, value]) => {
    const p = document.createElement("p");
    p.className = "tree-trait";
    p.textContent = `${path} ← ${origin(path, value)}`;
    return p;
  });

  tree.replaceChildren(
    line("Child", [g]),
    line("Parents", parentGenomes),
    grandparents.length ? line("Grandparents", grandparents) : document.createTextNode(""),
    ...traitLines,
  );
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
    chip.draggable = true;
    chip.textContent = g.name;
    chip.title = `“${seed}”: ${g.species}, ${g.affinity}`;
    chip.dataset.seed = seed;
    chip.style.setProperty("--chip", g.palette[0]);
    chip.setAttribute("aria-current", String(seed === genome.seed));
    chip.addEventListener("click", () => {
      input.value = seed;
      hatch(seed);
    });
    chip.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", seed);
      e.dataTransfer.effectAllowed = "copy";
    });
    return chip;
  });
  document.querySelector(".recent").replaceChildren(...chips);
  document.querySelector(".hatched").hidden = seeds.length < 2;
  fillMateSelects(seeds, genome.seed);
}

function fillMateSelects(seeds, current) {
  if (!mateA || !mateB) return;
  const opts = (selected) =>
    seeds.map((seed) => {
      const o = document.createElement("option");
      o.value = seed;
      o.textContent = genomeOf(seed).name;
      o.selected = seed === selected;
      return o;
    });
  const keepA = mateA.value && seeds.includes(mateA.value) ? mateA.value : seeds[1] ?? seeds[0];
  const keepB = mateB.value && seeds.includes(mateB.value) ? mateB.value : current;
  mateA.replaceChildren(...opts(keepA));
  mateB.replaceChildren(...opts(keepB));
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

/** Hatches a seed or lineage: the egg drops, cracks, and the creature comes out. */
function hatch(text, { push = true } = {}) {
  const genome = genomeOf(text);
  wild.ready = false;
  wild.creature = genome;
  error.hidden = true;
  view?.hatch(genome);
  if (view) hatchSounds(HATCH);
  showCard(genome);
  card.classList.remove("fresh");
  void card.offsetWidth;
  card.classList.add("fresh");
  remember(genome);
  const url = new URL(location.href);
  url.search = `?seed=${encodeURIComponent(genome.seed)}`;
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
  const text = input.value;
  const problem = lineageProblem(text);
  if (problem) return showError(problem);
  hatch(text);
});

$("random").addEventListener("click", () => {
  wakeAudio();
  const word = randomWord();
  input.value = word;
  hatch(word);
});

/** Cross two creatures: parents meet, an egg is laid, the child hatches. */
function layEgg(seedA, seedB) {
  wakeAudio();
  const problem = lineageProblem(`${seedA}*${seedB}`) || lineageProblem(seedA) || lineageProblem(seedB);
  if (problem) return showError(problem);
  const a = genomeOf(seedA);
  const b = genomeOf(seedB);
  const side = (g) => (g.parents ? `(${g.seed})` : g.seed);
  // Find next free clutch for this couple's canonical pair.
  let clutch = 1;
  let childText = `${side(a)}*${side(b)}`;
  const seen = new Set();
  try {
    const kept = JSON.parse(localStorage.getItem(KEPT) ?? "[]");
    for (const s of kept) seen.add(genomeOf(s).seed);
  } catch {}
  while (seen.has(genomeOf(clutch === 1 ? childText : `${childText}#${clutch}`).seed) && clutch < 99) clutch++;
  const lineage = clutch === 1 ? childText : `${childText}#${clutch}`;
  input.value = lineage;
  // Brief "meeting" flash on the card before hatch.
  card.classList.add("crossing");
  setTimeout(() => {
    card.classList.remove("crossing");
    hatch(lineage);
  }, 280);
}

$("cross-btn")?.addEventListener("click", () => {
  if (!mateA.value || !mateB.value) return showError("pick two creatures to cross");
  layEgg(mateA.value, mateB.value);
});

// Drag a hatched chip onto the stage to cross with the creature on screen.
const stageEl = document.querySelector(".stage");
stageEl?.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
stageEl?.addEventListener("drop", (e) => {
  e.preventDefault();
  const other = e.dataTransfer.getData("text/plain");
  if (!other || !wild.creature) return;
  layEgg(wild.creature.seed, other);
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
const fileName = (g) => `${g.name.toLowerCase()}-${g.seed.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`;
$("save-gif").addEventListener("click", () => exporting($("save-gif"), "Filming…", makeGif, (g) => `${fileName(g)}.gif`));
$("save-card").addEventListener("click", () => exporting($("save-card"), "Drawing…", makeCard, (g) => `${fileName(g)}-card.png`));

function fromAddress({ push }) {
  const asked = new URLSearchParams(location.search).get("seed");
  if (asked !== null) {
    const problem = lineageProblem(asked);
    if (!problem) {
      input.value = asked;
      return hatch(asked, { push });
    }
    if (!wild.creature) hatch(randomWord(), { push: false });
    return showError(problem);
  }
  hatch(randomWord(), { push: false });
}

addEventListener("popstate", () => fromAddress({ push: false }));
fromAddress({ push: false });
