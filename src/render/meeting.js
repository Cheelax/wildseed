// The meeting: before a child's egg, its two parents walk onto the island from either side, meet nose to
// nose with a hop and a cry each, step back as the egg pops out between them, then watch it hatch and cheer
// when their child climbs out. Like the creature, the meeting is a function of time.
import * as THREE from "three";
import { Creature } from "./creature.js";

/** The meeting, in seconds: they walk in until `walk`, greet at `greet` (one each), step back over `back`; the egg comes at `laid`. */
export const MEET = { walk: 0.7, greet: [0.78, 0.98], back: [1.2, 1.65], laid: 1.45 };

const SCALE = 0.66; // the parents stand a little back, smaller than the child that hatches in front
const START = 2.3, NEAR = 0.5, FAR = 1.72, DEPTH = -0.5;

const ease = (s) => s * s * (3 - 2 * s);

export class Parents {
  constructor(genomes) {
    this.root = new THREE.Group();
    this.members = genomes.map((genome, i) => {
      const creature = new Creature(genome);
      creature.root.scale.setScalar(SCALE);
      this.root.add(creature.root);
      return { genome, creature, side: i ? 1 : -1, greet: MEET.greet[i], pokes: [] };
    });
  }

  /** Remembers that parent `i` was poked at time t. */
  poke(i, t) {
    this.members[i].pokes.push(t);
  }

  /** Poses both parents at t seconds after the meeting began; their child bursts out of its egg at `cheer`. */
  pose(t, cheer) {
    for (const [i, p] of this.members.entries()) {
      const { creature, side } = p;
      // How far each stands from the middle, and how much it turns to face the other (1) or the camera (0).
      let x = FAR, turn = 0.3, walking = false;
      if (t < MEET.walk) {
        x = START - (START - NEAR) * ease(t / MEET.walk);
        turn = 1;
        walking = true;
      } else if (t < MEET.back[0]) {
        x = NEAR;
        turn = 1;
      } else if (t < MEET.back[1]) {
        const s = ease((t - MEET.back[0]) / (MEET.back[1] - MEET.back[0]));
        x = NEAR + (FAR - NEAR) * s;
        turn = 1 - 0.7 * s;
        walking = true;
      }
      creature.root.position.set(side * x, walking ? 0.06 * Math.abs(Math.sin(t * 13 + i)) : 0, DEPTH);
      creature.root.rotation.y = -side * (Math.PI / 2) * turn;
      // Each one hops and laughs as it greets the other, when its child comes out, and when it is poked.
      const events = [p.greet, cheer + 0.08 + 0.18 * i, ...p.pokes].filter((e) => e <= t).sort((a, b) => a - b);
      creature.pose(t, {
        react: events.length ? t - events.at(-1) : Infinity,
        pokes: events.length - 1,
        crying: t > p.greet && t < p.greet + 0.35,
      });
    }
  }
}
