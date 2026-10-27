import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { genomeOf, SPECIES } from '../src/genome.mjs';
import { cross } from '../src/cross.mjs';
import { SPECIES_DOMAINS } from '../src/genome/traits.mjs';
import { Creature } from '../src/render/creature.js';
import { Courtship, CROSSING } from '../src/render/courtship.js';
import { dispose } from '../src/render/dispose.js';

const parents = Object.fromEntries(Object.keys(SPECIES).map(id => [id, []]));
for (const seed of ['anchor', 'bagel', ...Array.from({ length: 600 }, (_, n) => `body${n}`)]) {
  const g = genomeOf(seed);
  if (parents[g.species].length < 16) parents[g.species].push(g);
}
const choices = {
  hopple: { ears: ['up', 'lop', 'side'] }, trundle: { ears: ['round', 'pointy', 'leaf'], tail: ['tuft', 'curl', 'fluff'], ridge: ['none', 'plates', 'fur'] },
  drift: { antenna: ['none', 'curl', 'bulb'] }, prickle: { spikeTip: ['sharp', 'round'] },
  wyrmlet: { horns: ['nub', 'curl', 'branch'], tailTip: ['spade', 'tuft', 'leaf', 'orb'] },
  inchling: { antennae: ['curl', 'straight', 'bulb'] }, domeback: { shellPattern: ['plates', 'rings', 'spots'] },
  flutterling: { wingShape: ['round', 'pointed', 'swallowtail'], antennae: ['feather', 'club'] },
};

function validBody(g) {
  for (const [path, allowed] of Object.entries(SPECIES_DOMAINS[g.species])) assert.ok(allowed(g.traits[path]), `${g.seed}: ${path}=${g.traits[path]}`);
  for (const [path, values] of Object.entries(choices[g.species] ?? {})) assert.ok(values.includes(g.traits[path]));
  const creature = new Creature(g);
  try {
    for (const t of [0, 0.8, 2]) creature.pose(t);
    const box = new THREE.Box3().setFromObject(creature.root);
    assert.ok([...box.min, ...box.max].every(Number.isFinite), g.seed);
    creature.root.traverse(o => {
      const positions = o.geometry?.attributes.position.array;
      if (positions) assert.ok(positions.every(Number.isFinite), g.seed);
    });
  } finally { dispose(creature.root); }
}

test('all species pairs, same-species eggs and descendants have valid traits and build geometry', () => {
  for (const list of Object.values(parents)) assert.equal(list.length, 16);
  for (const [i, a] of Object.values(parents).entries()) {
    for (const b of Object.values(parents)) {
      for (const clutch of [1, 2, 3]) {
        const child = cross(a[clutch], b[clutch], clutch);
        validBody(child);
        validBody(cross(child, a[(i + clutch) % a.length]));
      }
    }
  }
});

test('256 hopple × trundle children, including anchor*bagel, are valid and renderable', () => {
  let invalid = 0;
  for (const a of parents.hopple) for (const b of parents.trundle) {
    try { validBody(cross(a, b)); } catch { invalid++; }
  }
  const child = genomeOf('anchor*bagel');
  validBody(child);
  assert.ok(['up', 'lop', 'side'].includes(child.traits.ears));
  // Only the hopple parent's ears fit a hopple child, so they come from that parent (or a real mutation).
  const from = child.inherited.ears;
  if (from === 'mutation') assert.ok(child.mutations.includes('ears'));
  else assert.ok(['up', 'lop', 'side'].includes(genomeOf(child.parents[from === 'a' ? 0 : 1]).traits.ears));
  console.log(`P1: 256 hopple × trundle children (including anchor*bagel); invalid children: ${invalid}`);
  assert.equal(invalid, 0);
});

test('courtship keeps full size, greets before the burst, then lays the egg', () => {
  const world = new THREE.Group(), bursts = [];
  const meeting = new Courtship([parents.hopple[0], parents.trundle[0]], world, { burst: (...args) => bursts.push(args) }, false);
  assert.equal(meeting.pose(0.85 - meeting.duration), false);
  for (const c of meeting.parents) {
    assert.equal(c.root.scale.x, 1);
    assert.ok(c.root.position.y > 0);
  }
  assert.equal(bursts[0][0], 'hearts');
  assert.equal(bursts[0][1] + meeting.duration, CROSSING.greeting);
  assert.equal(meeting.pose(1.6 - meeting.duration), true);
  meeting.dispose();
  assert.equal(world.children.length, 0);
});
