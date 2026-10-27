// The meeting: before their child hatches, two parents hop in from either side of the island, meet nose to
// nose and laugh, and an egg drops between them. They step back to watch it hatch, and cheer when the child
// is out; then they stay, one on each side of it, a family. Like the creature, a function of time.
import * as THREE from "three";
import { Creature } from "./creature.js";

/** The meeting, in seconds: they arrive, meet, lay the egg, and have stepped back to watch it at `lead`. */
export const MEET = { arrive: 1.0, lay: 1.35, lead: 1.75 };

const FROM = 2.05, GAP = 0.12; // how far out they start, and the gap between their noses when they meet
const WATCH = { gap: 0.2, most: 2.2, z: -0.95, turn: 0.75 }; // where they watch from, beside their child, turned toward it

/**
 * How each mood comes to the meeting: how many hops and how high, a pause on the way (a shy one), and how it
 * laughs when they meet (a hop, a spin or a wiggle: the `pokes` of Creature.pose).
 */
const MANNER = {
  bouncy: { hops: 4, height: 0.32, pause: 0, laugh: 1 },
  curious: { hops: 3, height: 0.22, pause: 0, laugh: 0 },
  proud: { hops: 2, height: 0.14, pause: 0, laugh: 0 },
  shy: { hops: 3, height: 0.14, pause: 0.35, laugh: 2 },
  sleepy: { hops: 2, height: 0.07, pause: 0, laugh: 0 },
};

const ease = (k) => 1 - (1 - k) ** 2;
const clamp01 = (k) => Math.min(1, Math.max(0, k));

export class Meeting {
  constructor(parents) {
    this.parents = parents.map((g) => new Creature(g));
    this.pokes = parents.map(() => []);
    this.root = new THREE.Group();
    for (const p of this.parents) this.root.add(p.root);
    // They meet nose to nose: each stands as far from the middle as its nose is in front of it. They watch
    // their child from beside it, as far out as they are wide.
    const boxes = this.parents.map((p) => {
      p.pose(0);
      return new THREE.Box3().setFromObject(p.root);
    });
    this.reach = boxes.map((b) => THREE.MathUtils.clamp(b.max.z, 0.3, 0.9));
    this.half = boxes.map((b) => Math.max(b.max.x, -b.min.x));
    this.childHalf = 0.7;
  }

  /** Remembers that parent `i` was poked at stage time t. */
  poke(i, t) {
    this.pokes[i].push(t);
  }

  /** Poses the parents at stage time `t`; their child bursts out of the egg at `burst`. */
  pose(t, burst) {
    this.parents.forEach((p, i) => {
      const side = i ? 1 : -1;
      const meet = (GAP / 2 + this.reach[i]) * side;
      let x, z = 0, y = 0, turn = -side * (Math.PI / 2);
      const manner = MANNER[p.genome.traits.mood];
      if (t < MEET.arrive) {
        // Hops in from the edge of the island, in the manner of its mood: a shy one stops halfway.
        let k = t / MEET.arrive;
        const stop = 1 / manner.hops; // where the first hop lands
        const paused = manner.pause && k >= stop && k < stop + manner.pause;
        if (manner.pause && k >= stop) k = paused ? stop : stop + ((1 - stop) * (k - stop - manner.pause)) / (1 - stop - manner.pause);
        x = side * FROM + (meet - side * FROM) * ease(k);
        y = paused ? 0 : manner.height * Math.abs(Math.sin(k * Math.PI * manner.hops));
      } else if (t < MEET.lay) {
        // Nose to nose: they lean in.
        x = meet - 0.06 * side * Math.sin(((t - MEET.arrive) / (MEET.lay - MEET.arrive)) * Math.PI);
      } else {
        // A hop back each, turning to watch the egg.
        const k = ease(clamp01((t - MEET.lay) / (MEET.lead - MEET.lay)));
        const watch = side * Math.min(WATCH.most, this.childHalf + this.half[i] + WATCH.gap);
        x = meet + (watch - meet) * k;
        z = WATCH.z * k;
        y = t < MEET.lead ? 0.18 * Math.sin(k * Math.PI) : 0;
        turn = -side * (Math.PI / 2 + (WATCH.turn - Math.PI / 2) * k);
      }
      p.root.position.set(x, y, z);
      p.root.rotation.y = turn;
      // They laugh when they meet, again when their child is out, and when they are poked.
      const events = [MEET.arrive, burst, ...this.pokes[i]].filter((at) => at <= t);
      const react = events.length ? t - Math.max(...events) : Infinity;
      const look = t >= MEET.lay ? { x: -side * 0.45, y: -0.35 } : { x: 0, y: 0 };
      p.pose(t + 3 * i, { look, react, pokes: manner.laugh });
    });
  }
}
