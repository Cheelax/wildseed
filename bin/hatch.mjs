#!/usr/bin/env node
// node bin/hatch.mjs <lineage>…: prints the genome of each word or lineage as one line of JSON.
// ARCHITECTURE.md, "The command". Every argument is read before anything is printed: one bad one and
// nothing goes to stdout.
import { genomeOf, lineageProblem } from "../src/genome.mjs";

const lineages = process.argv.slice(2);

if (lineages.length === 0) {
  console.error("usage: node bin/hatch.mjs <word or lineage>…  (give at least one: moss, 'thomas*auri', '(thomas*auri)*noe#2')");
  process.exitCode = 2;
} else {
  const bad = lineages.map((text) => [text, lineageProblem(text)]).find(([, problem]) => problem);
  if (bad) {
    console.error(`hatch: ${JSON.stringify(bad[0])} is not a seed or a lineage: ${bad[1]}`);
    process.exitCode = 2;
  } else {
    process.stdout.write(lineages.map((text) => `${JSON.stringify(genomeOf(text))}\n`).join(""));
  }
}
