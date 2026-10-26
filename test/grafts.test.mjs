// Parts from another species (src/render/grafts.js): every body has a place for every part it can be given.
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { genomeOf } from "../src/genome.mjs";
import { Creature } from "../src/render/creature.js";
import { graftsOf } from "../src/render/grafts.js";

const words = Array.from({ length: 160 }, (_, i) => `graft${i}`);

test("children of two species wear their other parent's parts, each where its body has a place for it", () => {
  const seen = new Set();
  for (let i = 0; i < words.length; i += 2) {
    for (const clutch of [1, 2, 3]) {
      const child = genomeOf(`${words[i]}*${words[i + 1]}#${clutch}`);
      const slots = Object.keys(graftsOf(child));
      const { rig } = new Creature(child);
      for (const slot of slots) {
        assert.ok(rig.places?.[slot], `a ${child.species} has no place for a part on its ${slot} (${child.seed})`);
        seen.add(`${slot} on ${child.species}`);
      }
    }
  }
  assert.ok(seen.size >= 20, `only ${seen.size} kinds of grafts in the sample: ${[...seen].join(", ")}`);
});
