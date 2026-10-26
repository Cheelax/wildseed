// The family tree on the page: a child, its parents and grandparents, each by its creature's name (a click
// hatches it), and where the child's looks came from: which parent, between them, or a mutation.
import { familyOf, originsOf } from "../family.mjs";

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter((c) => c !== null));
  return e;
};

export class FamilyTree {
  /** `section` holds the tree; `onPick(lineage)` hatches the ancestor clicked. */
  constructor(section, { onPick }) {
    this.section = section;
    this.onPick = onPick;
  }

  /** A creature in the tree: its colors, its name and its species. */
  node(g, kind) {
    const b = el("button", { type: "button", className: `node ${kind}`, title: `“${g.seed}”: ${g.species}, ${g.affinity}` },
      el("span", { className: "swatch" }), el("b", { textContent: g.name }), el("small", { textContent: g.species }));
    b.style.setProperty("--a", g.palette[0]);
    b.style.setProperty("--b", g.palette[2]);
    if (kind !== "child") b.addEventListener("click", () => this.onPick(g.seed));
    return b;
  }

  /** Shows the family of `genome`, or hides the tree for a creature hatched from a word. */
  show(genome) {
    this.section.hidden = !genome.parents;
    if (!genome.parents) return;
    const { child, parents, grandparents } = familyOf(genome);
    const grand = parents.map((p, i) => (grandparents[i]
      ? el("div", { className: "pair" }, this.node(grandparents[i][0], "grand"), this.node(grandparents[i][1], "grand"))
      : el("div", { className: "pair word" }, el("small", { textContent: `the word “${p.seed}”` }))));
    const tree = el("div", { className: "tree" },
      el("div", { className: "row grand" }, ...grand),
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
      return li;
    });
    this.section.querySelector(".tree-holder").replaceChildren(tree, el("ul", { className: "origins" }, ...lines));
  }
}
