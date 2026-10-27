// The creature's card on the page: its name, species and affinity, its mood, its four stats, and its seed
// as it is written. A child's card names its parents and shows its lineage, words and all.
import { skyOf } from "../render/stage.js";

const MOODS = {
  bouncy: "Can't sit still for long.",
  sleepy: "Naps wherever it lands.",
  curious: "Pokes at everything new.",
  shy: "Hides when you stare.",
  proud: "Poses for every picture.",
};
const STATS = [["hp", "HP"], ["attack", "Attack"], ["defense", "Defense"], ["speed", "Speed"]];

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Fills the card with genome `g`; `parents` are a child's parents' genomes (or null for a word). */
export function showCard(card, g, parents) {
  card.querySelector(".name").textContent = g.name;
  card.querySelector(".species").textContent = g.species;
  card.querySelector(".affinity").textContent = g.affinity;
  card.querySelector(".about").textContent = MOODS[g.traits.mood];
  card.querySelector(".rare").hidden = !g.rare;
  const kin = card.querySelector(".kin");
  kin.hidden = !parents;
  if (parents) kin.replaceChildren("child of ", el("b", "", parents[0].name), " × ", el("b", "", parents[1].name), g.clutch > 1 ? `, egg #${g.clutch}` : "");
  const seed = card.querySelector(".seed");
  seed.replaceChildren(parents ? "lineage " : "seed ", el("code", "", g.seed));
  card.querySelector(".stats").replaceChildren(
    ...STATS.map(([key, name]) => {
      const row = el("div");
      const bar = el("span", "bar");
      bar.style.setProperty("--v", g.stats[key]);
      const dd = el("dd");
      dd.append(bar, el("b", "", String(g.stats[key])));
      row.append(el("dt", "", name), dd);
      return row;
    }),
  );
  // The page takes the creature's colors and its sky's.
  const [body, belly, accent, detail, , ink] = g.palette;
  const sky = skyOf(g.affinity);
  const root = document.documentElement.style;
  Object.entries({ body, belly, accent, detail, ink, sky0: sky[0], sky1: sky[1], sky2: sky[2], sky3: sky[3] }).forEach(([k, v]) => root.setProperty(`--${k}`, v));
  document.title = parents ? `${g.name}, child of ${parents[0].name} and ${parents[1].name} · Wildseed` : `${g.name} · Wildseed`;
}
