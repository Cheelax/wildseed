// The family tree on the page: a child, its parents and its grandparents, each by its face and its name,
// and where each part of the child came from, in words. A click on a member of the family hatches it.
import { familyOf, originsOf } from "../family.mjs";

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Faces drawn in art pixels: the size of a face, in art pixels, for each generation (child first). */
export const FACE = [32, 26, 20];

/** How a part's origin reads: "Thomnub's", "both parents'", "a blend", "a mutation". */
function originText(from, names) {
  if (from === "a" || from === "b") return names[from];
  return { both: "both", blend: "a blend", new: "✦ new" }[from];
}

/**
 * Shows the family of `genome` in `section`, or hides it for a word. `face(genome, size, canvas)` draws a
 * creature's face into a canvas, now or later; `pick(seed)` hatches a member of the family.
 */
export function showTree(section, genome, { face, pick }) {
  section.hidden = !genome.parents;
  if (!genome.parents) return section.replaceChildren();
  const family = familyOf(genome);
  const [a, b] = family.parents.map((p) => p.genome);

  const member = (node, generation, side = "") => {
    const g = node.genome;
    const button = el("button", `member gen${generation} ${side}`);
    button.type = "button";
    button.title = `${g.name}: ${g.species}, ${g.affinity}. Seed “${g.seed}”: hatch it`;
    button.style.setProperty("--member", g.palette[0]);
    const canvas = el("canvas", "face");
    canvas.width = canvas.height = FACE[generation];
    face(g, FACE[generation], canvas);
    const note = !g.parents ? g.seed : g.clutch > 1 ? `a child, egg #${g.clutch}` : "a child";
    button.append(canvas, el("span", "who", g.name), el("span", "word", note));
    button.addEventListener("click", () => pick(g.seed));
    return button;
  };

  const grand = el("div", "row grand");
  family.parents.forEach((p, i) => {
    const pair = el("div", `pair ${i ? "right" : "left"}`);
    if (p.parents) pair.append(...p.parents.map((q) => member(q, 2)));
    else pair.append(el("span", "root", "a word, no parents"));
    grand.append(pair);
  });
  const parents = el("div", "row parents");
  parents.append(member(family.parents[0], 1, "left"), el("span", "heart", "♥"), member(family.parents[1], 1, "right"));
  const child = el("div", "row child");
  child.append(member(family, 0));

  const names = { a: `${a.name}'s`, b: `${b.name}'s` };
  const origins = el("ul", "origins");
  origins.setAttribute("aria-label", `Where ${genome.name} got each part`);
  for (const { part, from } of originsOf(genome, a, b)) {
    const li = el("li", `from-${from}`);
    li.append(el("span", "part", part), el("span", "src", originText(from, names)));
    if (from === "a" || from === "b") li.style.setProperty("--from", (from === "a" ? a : b).palette[0]);
    origins.append(li);
  }

  const title = el("h3", "", `${genome.name}'s family`);
  section.replaceChildren(title, el("div", "tree", ""), origins);
  section.querySelector(".tree").append(grand, parents, child);
}
