import { genomeOf } from "../genome.mjs";
import { traitLeaves } from "../cross.mjs";
import { portrait } from "../render/portrait.js";
import { HATCH, hatchOffset } from "../render/stage.js";
import { film, studio } from "./film.js";

/** A printable family album: its full canonical lineage is always present, including Unicode. */
export async function makeFamilyCard(renderer, child) {
  const c = document.createElement("canvas");
  c.width = 768; c.height = 1120;
  const ctx = c.getContext("2d");
  const ink = "#27382f", paper = "#fffaf0";
  ctx.fillStyle = ink; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = paper; ctx.fillRect(10, 10, c.width - 20, c.height - 20);
  const text = (value, x, y, size = 16, color = ink, family = "system-ui") => {
    ctx.fillStyle = color; ctx.font = `${size}px ${family}`; ctx.fillText(value, x, y);
  };
  const rule = y => { ctx.fillStyle = "#c4ccb4"; ctx.fillRect(32, y, 704, 1); };
  const wrap = (value, width, size = 14) => {
    ctx.font = `${size}px system-ui`;
    const lines = []; let line = "";
    for (const ch of value) {
      if (ctx.measureText(line + ch).width > width) { lines.push(line); line = ""; }
      line += ch;
    }
    if (line) lines.push(line);
    return lines;
  };
  const image = (data, x, y, scale) => {
    const scratch = document.createElement("canvas");
    scratch.width = data.width; scratch.height = data.height;
    scratch.getContext("2d").putImageData(data, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, x, y, data.width * scale, data.height * scale);
  };
  text("W I L D S E E D   /   THE FAMILY ALBUM", 34, 45, 13);
  text(`EGG ${String(child.clutch).padStart(2, "0")}${child.rare ? " · STARLIT" : ""}`, 575, 45, 13);
  rule(61);
  text(child.name, 32, 116, 46, ink, "Georgia");
  text(`${child.species}  ·  ${child.affinity}`, 34, 145, 17);
  const stage = studio(renderer, child, 176, 96, { zoom: 0.95 });
  const [frame] = await film(renderer, stage, [HATCH.ready + hatchOffset(child) + 0.5], 176, 96);
  stage.dispose();
  image(new ImageData(frame, 176, 96), 32, 165, 4);
  text("A little of you. A little of them.", 34, 581, 25, ink, "Georgia");
  const parents = child.parents.map(genomeOf);
  parents.forEach((parent, i) => {
    const x = 34 + i * 365;
    image(portrait(renderer, parent, 64), x, 601, 1.5);
    text(parent.name, x + 108, 629, 24, ink, "Georgia");
    text(parent.species, x + 108, 653, 12);
    const grandparents = (parent.parents ?? []).map(seed => genomeOf(seed).name).join(" × ");
    const caption = grandparents ? `from ${grandparents}` : `from “${parent.seed}”`;
    wrap(caption, 214, 12).slice(0, 3).forEach((line, j) => text(line, x + 108, 673 + j * 14, 12));
  });
  rule(719);
  text("WHAT THEY PASSED ON", 34, 747, 12);
  const leaves = traitLeaves(child.traits);
  const paths = ["eyes", "marking", "ears", "tail", "wings", "voice.contour", ...child.mutations];
  [...new Set(paths)].filter(path => path in leaves).slice(0, 4).forEach((path, i) => {
    const x = 34 + (i % 2) * 365, y = 778 + Math.floor(i / 2) * 33;
    const source = child.origins[path];
    const who = typeof source === "number" ? parents[source].name : source === "mutation" ? "new mutation" : "both parents";
    text(`${path.replace("voice.", "voice ")}: ${leaves[path]} · ${who}`, x, y, 13);
  });
  rule(837);
  Object.entries(child.stats).forEach(([key, value], i) => {
    const x = 34 + i * 181;
    text(key.toUpperCase(), x, 866, 11);
    text(String(value), x, 902, 29, ink, "Georgia");
    ctx.fillStyle = child.palette[0]; ctx.fillRect(x + 49, 884, value, 8);
  });
  rule(925);
  text("ONE LINK HOLDS THE WHOLE FAMILY", 34, 954, 11);
  wrap(child.seed, 695, 16).forEach((line, i) => text(line, 34, 981 + i * 22, 16));
  text("wildseed · a creature only these words could make", 34, 1084, 13, "#68715b", "Georgia");
  return new Promise(resolve => c.toBlob(resolve, "image/png"));
}
