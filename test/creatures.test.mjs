import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreature } from '../src/creatures.js';
import { genomeOf, SPECIES } from '../src/genome.mjs';

test('all six real mesh species stop body, wing and halo motion with reduced motion', () => {
  const examples = new Map(); let rare;
  for (let i = 0; examples.size < SPECIES.length || !rare; i++) {
    const genome = genomeOf(`motion-${i}`); examples.set(genome.species, genome); if (genome.rare) rare = genome;
  }
  for (const genome of [...examples.values(), rare]) {
    const creature = buildCreature(genome);
    const transforms = () => {
      const values = []; creature.root.traverse((node) => { values.push([...node.position], [...node.rotation].slice(0, 3), [...node.scale]); });
      return values;
    };
    creature.update(1, { reduced: true }); const before = transforms();
    creature.update(2, { reduced: true, reaction: 0.5 }); assert.deepEqual(transforms(), before, genome.species);
    creature.update(2.5, { reduced: false, reaction: 0.5 }); assert.notDeepEqual(transforms(), before, genome.species);
    creature.dispose();
  }
});
