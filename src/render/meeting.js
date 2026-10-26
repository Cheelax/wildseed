// A child's parents on the stage. They hop in from either side of the island, meet nose to nose under a
// burst of hearts, and the egg is laid between them; they step back to watch it, cheer when their child
// comes out, then stay behind it, alive, so you can see whose ears it has. pose(t) is a function of time,
// like the creature's, so the GIF films the same meeting as the page.
import * as THREE from "three";
import { Creature } from "./creature.js";

/** The meeting, in seconds: they meet, the egg is laid (its hatch starts), they are back in their places. */
export const MEET = { meet: 0.72, laid: 1.12, back: 1.62 };

const smooth = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
const lerp = (a, b, s) => a + (b - a) * s;

/** Where a parent stands, side -1 (left) or 1 (right): coming in, nose to nose, then watching from behind. */
const SPOTS = { from: [2.15, 0.45], meet: [0.52, 0.2], watch: [1.3, -0.42] };

export class Meeting {
  /** `genomes` are the two parents, in the order the child's seed writes them: left, then right. */
  constructor(genomes) {
    this.parents = genomes.map((g) => new Creature(g));
    this.root = new THREE.Group();
    for (const p of this.parents) {
      p.root.scale.setScalar(0.92);
      this.root.add(p.root);
    }
  }

  /** Each parent where it watches the hatch from, for the camera. */
  watching(i) {
    const side = i ? 1 : -1;
    return new THREE.Vector3(side * SPOTS.watch[0], 0, SPOTS.watch[1]);
  }

  /**
   * Poses both parents at t seconds after the meeting began. `cheer` is when their child comes out of the
   * egg (they jump for joy), `pokes` the times each one was poked since.
   */
  pose(t, { cheer = Infinity, cracks = [], pokes = [[], []] } = {}) {
    this.parents.forEach((p, i) => {
      const side = i ? 1 : -1;
      let x, z, turn, y = 0;
      if (t < MEET.meet) {
        // Two hops in from the edge of the island, facing each other.
        const s = t / MEET.meet;
        x = lerp(SPOTS.from[0], SPOTS.meet[0], smooth(s));
        z = lerp(SPOTS.from[1], SPOTS.meet[1], smooth(s));
        y = 0.22 * Math.abs(Math.sin(Math.PI * 2 * s));
        turn = 1.25;
      } else if (t < MEET.laid) {
        // Nose to nose: they lean in and bump, twice.
        const s = (t - MEET.meet) / (MEET.laid - MEET.meet);
        x = SPOTS.meet[0] - 0.08 * Math.sin(Math.PI * 2 * s) ** 2;
        z = SPOTS.meet[1];
        turn = 1.25;
      } else {
        // Back to where they watch from, turning to the egg and to you.
        const s = smooth((t - MEET.laid) / (MEET.back - MEET.laid));
        x = lerp(SPOTS.meet[0], SPOTS.watch[0], s);
        z = lerp(SPOTS.meet[1], SPOTS.watch[1], s);
        y = t < MEET.back ? 0.16 * Math.sin(Math.PI * s) : 0;
        turn = lerp(1.25, 0.45, s);
      }
      // Each knock on the egg makes them jump a little.
      for (const c of cracks) if (t > c && t < c + 0.22) y += 0.1 * Math.sin((Math.PI * (t - c)) / 0.22);
      p.root.position.set(side * x, y, z);
      p.root.rotation.y = -side * turn;
      // Hearts in their eyes as they meet, and again when their child comes out; a poke makes them laugh.
      const since = [MEET.meet, cheer, ...pokes[i]].filter((at) => at <= t);
      const last = since.length ? since.at(-1) : -Infinity;
      const kind = last === MEET.meet ? 2 : 0; // a happy wiggle as they meet, a jump otherwise
      p.pose(t + i * 0.7, { look: t > MEET.back ? { x: side * 0.55, y: -0.25 } : null, react: t - last, pokes: kind, crying: Math.abs(t - MEET.meet - 0.1) < 0.25 });
    });
  }

  /** The parent poked by a ray, or -1. */
  hit(ray) {
    let best = -1, near = Infinity;
    this.parents.forEach((p, i) => {
      const [h] = ray.intersectObject(p.root, true);
      if (h && h.distance < near) [best, near] = [i, h.distance];
    });
    return best;
  }
}
