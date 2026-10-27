// "Hatched here": the last twelve creatures hatched on this device (in localStorage), newest first, as
// chips. A chip's name hatches its creature again; its × lays an egg of it and the creature on screen, and
// so does dragging the chip onto the scene.
import { canonical, genomeOf } from "../genome.mjs";

const KEPT = "wildseed.hatched";

const isLineage = (text) => {
  try {
    return canonical(text) === text;
  } catch {
    return false;
  }
};

/** Remembers `genome` and redraws the chips in `section`; `hatch(seed)` and `layWith(seed)` act on a click. */
export function showHatched(section, genome, { hatch, layWith }) {
  let seeds = [];
  try {
    seeds = JSON.parse(localStorage.getItem(KEPT) ?? "[]").filter((s) => typeof s === "string" && isLineage(s));
  } catch {}
  seeds = [genome.seed, ...seeds.filter((s) => s !== genome.seed)].slice(0, 12);
  try {
    localStorage.setItem(KEPT, JSON.stringify(seeds));
  } catch {}
  const button = (className, text, title, onclick) => Object.assign(document.createElement("button"), { type: "button", className, textContent: text, title, onclick });
  const chips = seeds.map((seed) => {
    const g = genomeOf(seed);
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.draggable = true;
    chip.style.setProperty("--chip", g.palette[0]);
    chip.setAttribute("aria-current", String(seed === genome.seed));
    chip.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", seed));
    chip.append(button("", g.name, `“${seed}”: ${g.species}, ${g.affinity}. Hatch it again`, () => hatch(seed)));
    if (seed !== genome.seed) {
      const pair = button("pair", "×", `Lay an egg: ${g.name} × the creature on screen`, () => layWith(seed));
      pair.setAttribute("aria-label", `Cross ${g.name} with the creature on screen`);
      chip.append(pair);
    }
    return chip;
  });
  section.querySelector(".recent").replaceChildren(...chips);
  section.hidden = seeds.length < 2;
}
