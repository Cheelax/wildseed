#!/usr/bin/env node
// node bin/hatch.mjs <seed|lineage>…: prints each genome as one line of JSON. ARCHITECTURE.md, "The command".
// Every argument is checked before anything is printed: one bad lineage and nothing goes to stdout.
import { genomeOf, lineageProblem } from "../src/genome.mjs";

const seeds = process.argv.slice(2);

if (seeds.length === 0) {
  console.error("usage: node bin/hatch.mjs <seed|lineage>…  (give at least one)");
  process.exitCode = 2;
} else {
  const bad = seeds.map((s) => [s, lineageProblem(s)]).find(([, problem]) => problem);
  if (bad) {
    console.error(`hatch: ${JSON.stringify(bad[0])} is not a lineage: ${bad[1]}`);
    process.exitCode = 2;
  } else {
    process.stdout.write(seeds.map((s) => `${JSON.stringify(genomeOf(s))}\n`).join(""));
  }
}
