#!/usr/bin/env node
import { genomeOf } from '../src/genome.mjs';
try {
  const seeds = process.argv.slice(2);
  if (!seeds.length) throw new Error('usage: node bin/hatch.mjs <seed>…');
  const genomes = seeds.map(genomeOf);
  process.stdout.write(genomes.map((genome) => JSON.stringify(genome)).join('\n') + '\n');
} catch (error) {
  console.error(`hatch: ${error.message}`); process.exitCode = 2;
}
