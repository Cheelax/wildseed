// Heirlooms on the head: a part a child of two species takes from its other parent (a wyrmlet's horns, a
// hopple's ears, a pipkin's crest, an inchling's antennae, a drift's antenna), built by the same code as
// on its own species (features.js) and sized to the head it now sits on. See src/genome/species.mjs.
import { heirloomsOf } from "../genome/traits.mjs";
import { antenna, antennae, crest, ears, horns } from "./features.js";

/** Each heirloom on a head whose top is `at`, `k` the head's size to the species' own: how much taller it makes the creature. */
const WEAR = {
  horns: (h, t, m, { at, k }) => horns(h, t, m, { at: [at[0], at[1] - 0.05 * k, at[2] - 0.03], spread: 0.26 * k, out: 0.5, k }),
  ears: (h, t, m, { at, k, ...moves }) => ears(h, t, m, { at: [at[0], at[1] - 0.1 * k, at[2] - 0.06], spread: 0.24 * k, splay: 0.15, k, ...moves }),
  crest: (h, t, m, { at, k, wiggles }) => crest(h, t, m, { at: [at[0], at[1] - 0.03, at[2] - 0.1 * k], k, wiggles }),
  antennae: (h, t, m, { at, k, ...moves }) => antennae(h, t, m, { at: [at[0], at[1] - 0.05 * k, at[2]], spread: 0.18 * k, k, ...moves }),
  antenna: (h, t, m, { at, k, wiggles }) => antenna(h, t, m, { at: [at[0], at[1] - 0.02, at[2] - 0.06], k, wiggles }),
};

/** Puts on a creature's head every heirloom its genome wears; the rig grows to match. */
export function wearHeirlooms(rig, genome, m) {
  const k = rig.top.r / 0.48;
  for (const part of heirloomsOf(genome)) {
    rig.height += WEAR[part](rig.head, genome.traits, m, { at: rig.top.at, k, wiggles: rig.wiggles, flaps: rig.flaps });
  }
}
