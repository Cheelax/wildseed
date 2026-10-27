#!/usr/bin/env node
// node bin/hatch.mjs <lineage>…: prints each lineage's genome as one line of JSON. ARCHITECTURE.md, "The command".
// A lineage is a word (`thomas`) or a cross (`thomas*auri`, `(thomas*auri#2)*noe`). Every lineage is read before
// anything is printed: one bad lineage and nothing goes to stdout.
import { genomeOf, lineageProblem } from "../src/genome.mjs";

const lineages = process.argv.slice(2);

if (lineages.length === 0) {
  console.error("usage: node bin/hatch.mjs <lineage>…  (a word, or a cross such as 'thomas*auri#2')");
  process.exitCode = 2;
} else {
  const bad = lineages.map((s) => [s, lineageProblem(s)]).find(([, problem]) => problem);
  if (bad) {
    console.error(`hatch: ${JSON.stringify(bad[0])} is not a lineage: ${bad[1]}`);
    process.exitCode = 2;
  } else {
    process.stdout.write(lineages.map((s) => `${JSON.stringify(genomeOf(s))}\n`).join(""));
  }
}
