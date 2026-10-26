// The family tree on the page: a child, its parents and grandparents, each by its creature's name (a click
// hatches it), and where the child's looks came from: which parent, between them, or a mutation.
import { familyOf, originsOf } from "../family.mjs";

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter((c) => c !== null));
  return e;
};

/** A color a fifth of the way from the paper to `color`: the background of a line of origins. */
function tint(color) {
  if (!color.startsWith("#")) return "transparent";
  const paper = [255, 250, 240];
  const rgb = [1, 3, 5].map((i, k) => Math.round(paper[k] + (parseInt(color.slice(i, i + 2), 16) - paper[k]) * 0.2));
  return `rgb(${rgb.join(", ")})`;
}

const FACE = 28; // a portrait's size in art pixels

export class FamilyTree {
  /**
   * `section` holds the tree; `onPick(lineage)` hatches the ancestor clicked; `portrait(genome, size)` resolves
   * to a picture of a creature (RGBA rows), or null where there is no renderer.
   */
  constructor(section, { onPick, portrait }) {
    this.section = section;
    this.onPick = onPick;
    this.portrait = portrait;
    this.faces = new Map(); // portraits drawn so far, by seed, as image addresses
  }

  /** A creature in the tree: its portrait (its colors until it is drawn), its name and its species. */
  node(g, kind) {
    const face = el("img", { className: "face", alt: "", width: FACE * 2, height: FACE * 2 });
    face.dataset.seed = g.seed;
    if (this.faces.has(g.seed)) face.src = this.faces.get(g.seed);
    const b = el("button", { type: "button", className: `node ${kind}`, title: `“${g.seed}”: ${g.species}, ${g.affinity}` },
      el("span", { className: "swatch" }, face), el("b", { textContent: g.name }), el("small", { textContent: g.species }));
    b.style.setProperty("--a", g.palette[0]);
    b.style.setProperty("--b", g.palette[2]);
    if (kind !== "child") b.addEventListener("click", () => this.onPick(g.seed));
    return b;
  }

  /** Shows the family of `genome`, or hides the tree for a creature hatched from a word. */
  show(genome) {
    this.shown = genome;
    this.section.hidden = !genome.parents;
    if (!genome.parents) return this.section.querySelector(".tree-holder").replaceChildren();
    const { child, parents, grandparents } = familyOf(genome);
    const grand = parents.map((p, i) => (grandparents[i]
      ? el("div", { className: "pair" }, this.node(grandparents[i][0], "grand"), this.node(grandparents[i][1], "grand"))
      : el("div", { className: "pair word" }, el("small", { textContent: `the word “${p.seed}”` }))));
    const tree = el("div", { className: "tree" },
      el("div", { className: "row grand" }, grand[0], el("span"), grand[1]),
      el("div", { className: "row parents" }, this.node(parents[0], "parent"), el("span", { className: "heart", textContent: "♥" }), this.node(parents[1], "parent")),
      el("div", { className: "row child" }, this.node(child, "child"), el("small", { className: "clutch", textContent: `egg #${child.clutch}` })));

    // Where its looks came from, one line per origin, marked with that parent's color.
    const origins = originsOf(child, parents);
    const lines = [
      [0, `From ${parents[0].name}`, parents[0].palette[0]],
      [1, `From ${parents[1].name}`, parents[1].palette[0]],
      ["blend", "Between the two", child.palette[0]],
      ["both", "Like both", "transparent"],
      ["mutation", "✦ Mutated", "#ffd66b"],
    ].map(([from, title, color]) => {
      const labels = origins.filter((o) => o.from === from).map((o) => o.label);
      if (!labels.length) return null;
      const li = el("li", { className: `from-${from}` }, el("b", { textContent: `${title}: ` }), labels.join(", "));
      li.style.setProperty("--who", color);
      li.style.setProperty("--tint", tint(color));
      return li;
    });
    this.section.querySelector(".tree-holder").replaceChildren(tree, el("ul", { className: "origins" }, ...lines));
  }

  /** Draws the portraits of the family on screen, one at a time, until another family is shown. */
  async paint() {
    const genome = this.shown;
    for (const img of this.section.querySelectorAll("img.face:not([src])")) {
      const seed = img.dataset.seed;
      if (!this.faces.has(seed)) {
        await new Promise((r) => setTimeout(r, 30)); // let the page breathe between two portraits
        if (this.shown !== genome) return;
        const picture = await this.portrait(genomeFor(genome, seed), FACE);
        if (!picture) return;
        this.faces.set(seed, toImage(picture, FACE));
      }
      img.src = this.faces.get(seed);
    }
  }
}

/** The genome of a creature of the family of `genome`, by its seed. */
function genomeFor(genome, seed) {
  const { child, parents, grandparents } = familyOf(genome);
  return [child, ...parents, ...grandparents.flat()].find((g) => g?.seed === seed);
}

/** RGBA rows of size × size as an image address. */
function toImage(rgba, size) {
  const c = el("canvas", { width: size, height: size });
  c.getContext("2d").putImageData(new ImageData(rgba, size, size), 0, 0);
  return c.toDataURL("image/png");
}
