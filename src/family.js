import { genomeOf } from "./genome.mjs";
import { cross, traitLeaves } from "./cross.mjs";
import { HATCH, COURTSHIP } from "./render/stage.js";
import { drawPortrait } from "./render/portrait.js";
import { traitLabel as label, traitHighlights, originText } from "./heritage.mjs";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
export function setupFamily({ view, hatch, current, onError, wakeAudio }) {
  const fields = [document.querySelector("#parent-a"), document.querySelector("#parent-b")];
  const previews = [...document.querySelectorAll(".parent-portrait")];
  const tree = document.querySelector(".family");
  const actions = document.querySelector(".child-actions");
  const next = document.querySelector(".next-egg");
  const note = document.querySelector(".cross-note");
  let previewTimer;

  function updatePreviews() {
    fields.forEach((input, i) => {
      try {
        const g = genomeOf(input.value);
        drawPortrait(view?.renderer, g, previews[i]);
        previews[i].title = `${g.name} · ${g.species}`;
        input.setAttribute("aria-invalid", "false");
      } catch {
        input.setAttribute("aria-invalid", "true");
        previews[i].getContext("2d").clearRect(0, 0, 72, 72);
      }
    });
  }
  fields.forEach(input => input.addEventListener("input", () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreviews, 350);
    note.textContent = "Two names make a creature only they could make.";
  }));
  document.querySelector(".cross-form").addEventListener("submit", e => {
    e.preventDefault();
    wakeAudio();
    try { hatch(cross(...fields.map(f => genomeOf(f.value))).seed); }
    catch (error) { onError(error.message); }
  });
  document.querySelectorAll(".use-current").forEach((button, i) => button.addEventListener("click", () => {
    fields[i].value = current().seed;
    updatePreviews();
    note.textContent = `${current().name} is ready to meet someone.`;
  }));
  next.addEventListener("click", () => {
    const g = current();
    if (!g.parents || g.clutch >= 99) return;
    wakeAudio();
    try { hatch(cross(...g.parents.map(genomeOf), g.clutch + 1).seed); }
    catch (error) { onError(error.message); }
  });
  document.querySelector(".breed-child").addEventListener("click", () => {
    fields[0].value = current().seed;
    fields[1].value = "";
    updatePreviews();
    fields[1].focus();
    fields[1].scrollIntoView({ block: "center", behavior: "smooth" });
    note.textContent = `Who will ${current().name} meet? Add a third name.`;
  });
  const copy = document.querySelector(".copy-link");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copy.textContent = "Link copied ✓";
      setTimeout(() => copy.textContent = "Copy creature link ↗", 1800);
    } catch {
      const field = el("input", "link-fallback");
      field.value = location.href;
      field.readOnly = true;
      field.setAttribute("aria-label", "Creature link to copy");
      copy.after(field);
      field.select();
    }
  });

  function member(g, depth = 0, portraits = []) {
    const branch = el("div", "family-branch");
    if (g.parents && depth < 2) {
      const ancestors = el("div", "ancestors");
      ancestors.append(...g.parents.map(seed => member(genomeOf(seed), depth + 1, portraits)));
      branch.append(ancestors);
    }
    const node = el("button", "family-member");
    node.type = "button";
    node.title = `Open ${g.seed}`;
    const canvas = el("canvas", "family-portrait");
    canvas.width = canvas.height = 72;
    portraits.push(() => drawPortrait(view?.renderer, g, canvas));
    const text = el("div", "member-text");
    text.append(el("strong", "", g.name), el("span", "", g.species), el("small", "", g.seed));
    node.append(canvas, text);
    node.addEventListener("click", () => hatch(g.seed));
    branch.append(node);
    return branch;
  }

  function show(g) {
    tree.hidden = !g.parents;
    actions.hidden = !g.parents;
    if (!g.parents) return;
    next.disabled = g.clutch === 99;
    next.textContent = g.clutch === 99 ? "Clutch complete" : `Lay egg ${g.clutch + 1}`;
    fields.forEach((f, i) => f.value = g.parents[i]);
    note.textContent = `Egg ${g.clutch} · ${g.mutations.length ? `${g.mutations.length} new ${g.mutations.length === 1 ? "mutation" : "mutations"}` : "A familiar spark, a new little life"}`;
    // Names and provenance are synchronous; ready never points at an incomplete album.
    const portraits = [];
    const parents = g.parents.map(genomeOf);
    const heading = el("div", "family-heading");
    const title = el("div");
    title.append(el("span", "eyebrow", "THE FAMILY ALBUM"), el("h2", "", "You can see the resemblance."));
    heading.append(title, el("span", "egg-number", `EGG ${String(g.clutch).padStart(2, "0")}`));
    const chart = el("div", "family-chart");
    chart.classList.toggle("deep-family", parents.some(parent => parent.parents));
    chart.setAttribute("aria-label", "Family tree; scroll sideways for a larger family");
    chart.append(member(g, 0, portraits));
    const details = el("details", "inheritance");
    details.append(el("summary", "", "Every little thing they passed on"));
    const list = el("dl", "trait-list");
    for (const [path, value] of Object.entries(traitLeaves(g.traits))) {
      const row = el("div", g.mutations.includes(path) ? "mutation" : "");
      row.append(el("dt", "", label(path)), el("dd", "", `${value} · ${originText(g, path, parents)}`));
      list.append(row);
    }
    details.append(list);
    const highlights = el("div", "inheritance-highlights");
    for (const path of traitHighlights(g)) {
      const item = el("div", "inheritance-chip");
      item.append(el("strong", "", label(path)), el("span", "", originText(g, path, parents)));
      highlights.append(item);
    }
    tree.replaceChildren(heading, chart, highlights, details);
    // Paint only the expensive pictures later, without delaying or replacing the family text.
    setTimeout(() => {
      if (current() !== g) return;
      updatePreviews();
      const paintNext = () => {
        if (current() !== g || !portraits.length) return;
        portraits.shift()();
        setTimeout(paintNext, 0);
      };
      paintNext();
    }, (HATCH.ready + COURTSHIP + 0.3) * 1000);
  }
  setTimeout(updatePreviews, 1800);
  return { show };
}
