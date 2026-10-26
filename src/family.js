// The family tree: a child, its parents and its grandparents, each by its creature's name, and where each of
// the child's traits came from: which parent, or a mutation. ARCHITECTURE.md, "The page".
//
// Nothing is stored: every ancestor is hatched again from the child's lineage.
import { genomeOf } from "./genome.mjs";
import { heritageOf } from "./genome/heredity.mjs";

/** What a group of traits is called in a sentence, after its first trait. */
const CALLED = {
  size: "size", build: "build", eyes: "eyes", mouth: "mouth", cheeks: "cheeks", marking: "markings", charm: "charm",
  mood: "mood", "voice.pitch": "voice", "voice.notes": "song", crest: "crest", beak: "beak", wings: "wings",
  tailFeathers: "tail feathers", ears: "ears", feet: "feet", tailPuff: "tail puff", snout: "snout", legs: "legs",
  tail: "tail", ridge: "back", dome: "bell", tentacles: "tentacles", frills: "frills", antenna: "antenna",
  spikes: "spines", muzzle: "muzzle", horns: "horns", mane: "mane", segments: "segments", rise: "neck", antennae: "antennae",
  shell: "shell", neck: "neck", head: "head", domes: "eye domes", throat: "throat", fluff: "ruff", eyespots: "eyespots",
};

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** "eyes, song and wings". */
const list = (words) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);

/** One creature of the tree: its color, its name and its seed; a click opens it. */
function member(g, role, open) {
  const b = el("button", `who ${role}`);
  b.type = "button";
  b.style.setProperty("--c", g.palette[0]);
  b.title = `Open ${g.name}: “${g.seed}”`;
  b.append(el("b", "", g.name), el("small", "", g.parents ? (g.clutch > 1 ? `egg #${g.clutch}` : "first egg") : `“${g.seed}”`));
  b.addEventListener("click", () => open(g.seed));
  return b;
}

/** What the child took from each parent, by group of traits, in sentences. */
function heritage(child, a, b) {
  const by = { a: [], b: [], both: [], blend: [], mutation: [] };
  for (const { paths, from } of heritageOf(child, a, b)) by[from].push(CALLED[paths[0]] ?? paths[0]);
  const ul = el("ul", "heritage");
  const line = (who, cls, text) => {
    const li = el("li", cls);
    if (who) {
      const name = el("b", "", who.name);
      name.style.setProperty("--c", who.palette[0]);
      li.append(name, " ");
    }
    li.append(text);
    ul.append(li);
  };
  for (const [key, who] of [["a", a], ["b", b]]) {
    const own = [...(child.species === who.species && a.species !== b.species ? [`body (a ${child.species})`] : []), ...by[key]];
    if (child.affinity === who.affinity && a.affinity !== b.affinity) own.push(`${child.affinity} affinity`);
    if (own.length) line(who, "from", `gave it its ${list(own)}`);
  }
  if (by.blend.length) line(null, "blend", `In between them: its ${list(by.blend)}`);
  if (by.both.length) line(null, "both", `Like both: its ${list(by.both)}`);
  line(null, "colors", "Its colors: a blend of theirs");
  if (by.mutation.length) line(null, "mutation", `A mutation: its ${list(by.mutation)}, like neither parent`);
  return ul;
}

/**
 * Draws the family tree of `genome` in `section`, hidden for a word: its grandparents over its parents over
 * the child, joined by ink brackets, then what it took from whom. `open(seed)` opens one of its ancestors.
 */
export function drawFamily(section, genome, open) {
  section.hidden = !genome.parents;
  if (!genome.parents) return section.replaceChildren();
  const [a, b] = genome.parents.map((p) => genomeOf(p));
  const tree = el("div", "tree");
  [a, b].forEach((p, i) => {
    const column = `${2 * i + 1} / span 2`;
    if (p.parents) {
      p.parents.forEach((g, k) => {
        const grand = member(genomeOf(g), "grand", open);
        grand.style.gridColumn = String(2 * i + 1 + k);
        tree.append(grand);
      });
      const link = el("span", "link");
      link.style.gridColumn = column;
      tree.append(link);
    } else {
      const word = el("span", "word", "from a word");
      word.style.gridColumn = column;
      tree.append(word);
    }
    const parent = member(p, "parent", open);
    parent.style.gridColumn = column;
    tree.append(parent);
  });
  const child = member(genome, "child", open);
  child.disabled = true;
  tree.append(el("span", "link down"), child);
  section.replaceChildren(el("h3", "", "Family tree"), tree, heritage(genome, a, b));
}
