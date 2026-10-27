// Full-sized parents greet, celebrate, then leave an egg between them.
import * as THREE from 'three';
import { Creature } from './creature.js';
import { dispose } from './dispose.js';

export const CROSSING = { approach: 0.6, greeting: 1.15, egg: 1.5, hatch: 1.75, leave: 0.45 };

export class Courtship {
  constructor(parents, world, fx, reduced) {
    this.world = world;
    this.reduced = reduced;
    this.duration = reduced ? 0.2 : CROSSING.hatch;
    this.parents = parents.map(g => new Creature(g));
    this.options = [{ look: { x: 1, y: 0 } }, { look: { x: -1, y: 0 } }];
    this.bounds = new THREE.Box3();
    this.offsets = this.parents.map((c, i) => {
      c.pose(0);
      const box = new THREE.Box3().setFromObject(c.root);
      const offset = box.getSize(new THREE.Vector3()).x / 2 + 0.5;
      c.root.position.x = (i ? 1 : -1) * (offset + 0.6);
      this.bounds.union(new THREE.Box3().setFromObject(c.root));
      world.add(c.root);
      return offset;
    });
    const at = new THREE.Vector3(0, Math.min(...this.parents.map(c => c.height)) * 0.7, 0.5);
    if (!reduced) fx.burst('hearts', CROSSING.greeting - this.duration, at);
  }

  pose(t) {
    const age = t + this.duration;
    const approach = Math.min(1, age / CROSSING.approach);
    const greet = THREE.MathUtils.clamp((age - CROSSING.approach) / (CROSSING.greeting - CROSSING.approach), 0, 1);
    const nuzzle = this.reduced ? 0 : Math.sin(greet * Math.PI);
    for (let i = 0; i < this.parents.length; i++) {
      const c = this.parents[i], side = i ? 1 : -1;
      c.pose(this.reduced ? 0 : age, this.options[i]);
      c.root.position.set(side * (this.offsets[i] + (this.reduced ? 0 : 0.6 * (1 - approach) - 0.14 * nuzzle + Math.max(0, t) * 7)), 0.12 * nuzzle, 0);
      c.root.rotation.set(0, -side * 0.65, side * 0.14 * nuzzle);
    }
    return this.reduced || age >= CROSSING.egg;
  }

  dispose() {
    for (const c of this.parents) { this.world.remove(c.root); dispose(c.root); }
  }
}
