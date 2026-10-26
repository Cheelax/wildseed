import { traitLeaves } from "./cross.mjs";

export const traitLabel = path => path.replace(/^voice\./, "voice · ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
export function originText(child, path, parents) {
  const origin = child.origins[path];
  return origin === "mutation" ? "New mutation" : origin === "blend" ? "A blend of both" : origin === "both" ? "Both parents" : parents[origin].name;
}

/** The album's short caption balances actual contributions, then offers the full table. */
export function traitHighlights(child, limit = 6) {
  const leaves = traitLeaves(child.traits);
  const preference = ["ears", "tail", "wings", "eyes", "marking", "mouth", "charm", "mood", "voice.contour", ...Object.keys(leaves)];
  const paths = [...new Set(preference)].filter(p => p in leaves);
  const selected = [0, 1, "blend", "mutation"].map(source => paths.find(p => child.origins[p] === source)).filter(Boolean);
  return [...new Set([...selected, ...paths])].slice(0, limit);
}
