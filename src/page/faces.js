// The family's faces on the page, drawn by the live renderer once the creature on screen is out of its
// egg, one per frame so the scene stays smooth. Each face is drawn once per page.
import { portrait } from "../share/film.js";

export class Faces {
  constructor(renderer) {
    this.renderer = renderer;
    this.drawn = new Map();
    this.waiting = [];
    this.awake = false;
  }

  /** Draws `genome`'s face, `size` art pixels wide, into `canvas` when the faces are awake. */
  draw(genome, size, canvas) {
    this.waiting.push({ genome, size, canvas });
    if (this.awake && this.waiting.length === 1) this.next();
  }

  /** Stops drawing as a hatch begins (the faces asked for are dropped), or starts once the creature is out. */
  wake(awake) {
    this.awake = awake;
    if (awake) this.next();
    else this.waiting.length = 0;
  }

  next() {
    const job = this.waiting.shift();
    if (!job || !this.renderer) return;
    const key = `${job.size} ${job.genome.seed}`;
    if (!this.drawn.has(key)) this.drawn.set(key, new ImageData(portrait(this.renderer, job.genome, job.size, job.size), job.size, job.size));
    job.canvas.getContext("2d").putImageData(this.drawn.get(key), 0, 0);
    requestAnimationFrame(() => this.awake && this.next());
  }
}
