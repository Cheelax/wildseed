// Family cards are DOM only; genomes carry the provenance used here.
import { genomeOf } from './genome.mjs';

function node(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function relative(g, label) {
  const card = node('article', '', 'relative');
  card.style.setProperty('--relative', g.palette[0]);
  card.append(node('small', label), node('strong', g.name), node('span', g.species));
  const colors = node('div', '', 'swatches');
  g.palette.slice(0, 4).forEach(color => {
    const swatch = node('i', '');
    swatch.style.background = color;
    colors.append(swatch);
  });
  card.append(colors);
  card.title = g.seed;
  return card;
}

export function showFamily(container, child) {
  container.replaceChildren();
  container.hidden = !child.parents;
  if (!child.parents) return;
  container.append(node('h3', `Egg ${child.clutch} · Family`));
  const parents = child.parents.map(genomeOf);
  const family = node('div', '', 'family-cards');
  family.append(relative(child, 'Child'));
  parents.forEach(parent => {
    const branch = node('div', '', 'branch');
    branch.append(relative(parent, 'Parent'));
    if (parent.parents) {
      const elders = node('div', '', 'grandparents');
      parent.parents.map(genomeOf).forEach(g => elders.append(relative(g, 'Grandparent')));
      branch.append(elders);
    }
    family.append(branch);
  });
  container.append(family);
  const list = node('div', '', 'inheritance');
  Object.entries(child.inherited).forEach(([path, from]) => {
    const source = from === 'mutation' ? '✦ mutation' : parents[from === 'a' ? 0 : 1].name;
    const row = node('span', `${path} ← ${source}`);
    row.style.borderColor = from === 'mutation' ? '#d19b32' : parents[from === 'a' ? 0 : 1].palette[0];
    list.append(row);
  });
  container.append(node('h4', 'Little pieces of both'), list);
}
