// Crossing on the page: two fields for the parents, the couple's next egg, and the creatures hatched on this
// device, to hatch again, to cross with the one on screen (♥), or to drag onto the scene or onto each other.
import { genomeOf } from "../genome.mjs";
import { crossLineage, lineageProblem } from "../lineage.mjs";

const KEPT = "wildseed.hatched";
const DRAGGED = "application/x-wildseed-lineage";

export class Nest {
  /**
   * `root` holds the crossing controls, `recent` the creatures hatched here, `stage` takes drops. `current()` is
   * the genome on screen, `hatch(lineage)` hatches one, `showError(message)` says what is wrong.
   */
  constructor({ root, recent, stage }, { current, hatch, showError }) {
    Object.assign(this, { root, recent, current, hatch, showError });
    this.a = root.querySelector('[data-testid="parent-a"]');
    this.b = root.querySelector('[data-testid="parent-b"]');
    this.clutch = root.querySelector(".clutch");
    this.next = root.querySelector('[data-testid="next-egg"]');
    this.again = root.querySelector('[data-testid="cross-again"]');

    root.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.lay(this.a.value.trim() || this.current()?.seed, this.b.value.trim());
    });
    this.next.addEventListener("click", () => {
      const g = this.current();
      if (g?.parents) this.lay(g.parents[0], g.parents[1], g.clutch + 1);
    });
    this.again.addEventListener("click", () => {
      this.a.value = this.current().seed;
      this.b.value = "";
      this.b.focus();
    });
    // Drop a creature on the scene: it lays an egg with the one on screen.
    stage.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes(DRAGGED)) return;
      e.preventDefault();
      stage.classList.add("dropping");
    });
    stage.addEventListener("dragleave", () => stage.classList.remove("dropping"));
    stage.addEventListener("drop", (e) => {
      stage.classList.remove("dropping");
      const lineage = e.dataTransfer.getData(DRAGGED);
      if (!lineage) return;
      e.preventDefault();
      this.lay(this.current().seed, lineage);
    });
  }

  /** Lays the `clutch`-th egg of two parents, each a lineage, and hatches it; or says why it cannot. */
  lay(a, b, clutch = 1) {
    if (!b) {
      this.b.focus();
      return this.showError("a cross needs a second parent: type a friend's name, or press ♥ on a creature below");
    }
    for (const [text, which] of [[a, "the first parent"], [b, "the second parent"]]) {
      const problem = lineageProblem(text);
      if (problem) return this.showError(`${which}: ${problem}`);
    }
    try {
      this.hatch(crossLineage(a, b, clutch));
    } catch (e) {
      this.showError(e.message);
    }
  }

  /** Fits the controls to the creature on screen: a child's couple and its next egg, or a word to cross. */
  show(genome) {
    this.clutch.hidden = !genome.parents;
    if (genome.parents) {
      [this.a.value, this.b.value] = genome.parents;
      const [x, y] = genome.parents.map(genomeOf);
      this.clutch.querySelector(".what").textContent = `${genome.name} is egg #${genome.clutch} of ${x.name} and ${y.name}.`;
      this.next.disabled = genome.clutch >= 99;
      this.next.textContent = `Lay egg #${genome.clutch + 1}`;
      this.again.textContent = `Cross ${genome.name} with…`;
    } else this.a.value = genome.seed;
    this.remember(genome);
  }

  /** Keeps the creature among those hatched here, newest first, and draws them as chips. */
  remember(genome) {
    let seeds = [];
    try {
      seeds = JSON.parse(localStorage.getItem(KEPT) ?? "[]").filter((s) => typeof s === "string" && !lineageProblem(s));
    } catch {}
    seeds = [genome.seed, ...seeds.filter((s) => s !== genome.seed)].slice(0, 12);
    try {
      localStorage.setItem(KEPT, JSON.stringify(seeds));
    } catch {}
    this.recent.querySelector("nav").replaceChildren(...seeds.map((seed) => this.chip(seed, seed === genome.seed)));
    this.recent.hidden = seeds.length < 2;
  }

  /** A creature hatched here: press it to hatch it again, ♥ to cross it with the one on screen, or drag it. */
  chip(seed, here) {
    const g = genomeOf(seed);
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.draggable = true;
    chip.style.setProperty("--chip", g.palette[0]);
    const name = document.createElement("button");
    name.type = "button";
    name.textContent = g.name;
    name.title = `“${seed}”: ${g.species}, ${g.affinity}`;
    name.setAttribute("aria-current", String(here));
    name.addEventListener("click", () => this.hatch(seed));
    chip.append(name);
    if (!here) {
      const heart = document.createElement("button");
      heart.type = "button";
      heart.className = "heart";
      heart.textContent = "♥";
      heart.title = `Lay an egg: ${g.name} × ${this.current()?.name}`;
      heart.addEventListener("click", () => this.lay(this.current().seed, seed));
      chip.append(heart);
    }
    chip.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(DRAGGED, seed);
      e.dataTransfer.setData("text/plain", seed);
    });
    // One creature dropped on another lays their egg.
    chip.addEventListener("dragover", (e) => e.dataTransfer.types.includes(DRAGGED) && e.preventDefault());
    chip.addEventListener("drop", (e) => {
      const other = e.dataTransfer.getData(DRAGGED);
      if (!other || other === seed) return;
      e.preventDefault();
      e.stopPropagation();
      this.lay(seed, other);
    });
    return chip;
  }
}
