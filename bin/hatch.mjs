#!/usr/bin/env node
// node bin/hatch.mjs <seed>…: prints each seed's genome as one line of JSON. ARCHITECTURE.md, "The command".
// Every seed is checked before anything is printed: one bad seed and nothing goes to stdout.
import { genomeOf } from "../src/genome.mjs";
import { lineageProblem } from "../src/lineage.mjs";

const seeds = process.argv.slice(2);

if (seeds.length === 0) {
  console.error("usage: node bin/hatch.mjs <seed>…  (give at least one seed)");
  process.exitCode = 2;
} else {
  const bad = seeds.map((s) => [s, lineageProblem(s)]).find(([, problem]) => problem);
  if (bad) {
    console.error(`hatch: ${JSON.stringify(bad[0])} is not a seed: ${bad[1]}`);
    process.exitCode = 2;
  } else {
    process.stdout.write(seeds.map((s) => `${JSON.stringify(genomeOf(s))}\n`).join(""));
  }
}
