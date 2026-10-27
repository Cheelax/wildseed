import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genomeOf } from '../src/genome.mjs';
import { Creature } from '../src/render/creature.js';
import * as THREE from 'three';
import { batchScenery } from '../src/render/batch.js';
import { dispose } from '../src/render/dispose.js';

test('500 crossed bodies and their descendants build and pose with finite geometry', () => {
  for (let i=0;i<500;i++) for (const seed of [`family${i}*friend${i}`,`(family${i}*friend${i})*fern`]) {
    const g=genomeOf(seed), c=new Creature(g);
    for(const t of [0,1,3]) {
      c.pose(t,{react:0.3});c.root.updateMatrixWorld(true);
      c.root.traverse(o=>{
        assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${seed}: ${o.type} transform`);
        if(o.geometry) assert.ok(o.geometry.attributes.position.array.every(Number.isFinite),`${seed}: geometry`);
      });
    }
    dispose(c.root);
  }
});
test('a hopple can wear the round, leaf or pointed ears inherited from a trundle', () => {
  for(const seed of ['family91*friend91','family166*friend166','family198*friend198']) {
    const g=genomeOf(seed);assert.equal(g.species,'hopple');const c=new Creature(g);c.pose(1);dispose(c.root);
  }
});

test('batching preserves the world transform of nested multi-material scenery', () => {
  const root = new THREE.Group(), distant = new THREE.Group();
  distant.position.set(12, -3, 8); distant.rotation.y = 0.7; distant.scale.setScalar(1.4);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
  distant.add(mesh); root.add(distant);
  const before = new THREE.Box3().setFromObject(root);
  const batched = batchScenery(root), after = new THREE.Box3().setFromObject(batched);
  assert.ok(before.min.distanceTo(after.min) < 1e-6);
  assert.ok(before.max.distanceTo(after.max) < 1e-6);
  dispose(batched);
});
