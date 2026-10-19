#!/usr/bin/env node
import { genomeOf } from '../src/genome.mjs';

try {
  const seeds = process.argv.slice(2);
  if (!seeds.length) throw new Error('No seed given. Usage: node bin/hatch.mjs <seed>…');
  // Validate the whole batch before writing anything: errors must leave stdout empty.
  const lines = seeds.map((seed) => JSON.stringify(genomeOf(seed)));
  process.stdout.write(`${lines.join('\n')}\n`);
} catch (error) {
  console.error(`hatch: ${error.message}`);
  process.exitCode = 2;
}
