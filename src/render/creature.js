// A creature on screen: its species builds the body from the genome, then pose(t) keeps it alive.
// It breathes, blinks, looks where it is told, wiggles its ears and tails, and acts out its mood.
// pose() is a pure function of time and of what it is told, so the GIF is the same creature as the page.
import * as THREE from "three";
import { charm, materialsOf } from "./parts.js";
import { graft } from "./heirlooms.js";
import { pipkin } from "./species/pipkin.js";
import { hopple } from "./species/hopple.js";
import { trundle } from "./species/trundle.js";
import { drift } from "./species/drift.js";
import { prickle } from "./species/prickle.js";
import { wyrmlet } from "./species/wyrmlet.js";
import { inchling } from "./species/inchling.js";
import { domeback } from "./species/domeback.js";
import { toadle } from "./species/toadle.js";
import { flutterling } from "./species/flutterling.js";

const BUILDERS = { pipkin, hopple, trundle, drift, prickle, wyrmlet, inchling, domeback, toadle, flutterling };

/**
 * How each mood moves when nobody touches it, and its habit: every `every` seconds, for `for` seconds,
 * a bouncy one hops, a sleepy one naps, a curious one tilts its head, a shy one looks away, a proud one
 * puffs up.
 */
const MOODS = {
  bouncy: { breath: 0.55, wander: 0.5, tilt: 0.05, pitch: 0, habit: "hop", every: 2.6, for: 0.56 },
  sleepy: { breath: 0.3, wander: 0.25, tilt: 0.1, pitch: 0.1, habit: "nap", every: 7, for: 2.6 },
  curious: { breath: 0.45, wander: 1, tilt: 0.12, pitch: -0.04, habit: "tilt", every: 4.5, for: 1.3 },
  shy: { breath: 0.42, wander: 0.4, tilt: 0.08, pitch: 0.14, habit: "peek", every: 5.5, for: 1.8 },
  proud: { breath: 0.4, wander: 0.35, tilt: 0.04, pitch: -0.12, habit: "puff", every: 5, for: 1.3 },
};

const REACT = 1.1; // seconds a reaction to a poke lasts
export const HABIT_START = 1.2; // seconds after the hatch when a creature first shows its habit

/** How long a mood's habit lasts, in seconds. */
export const habitLength = (mood) => MOODS[mood].for;

export class Creature {
  constructor(genome) {
    this.genome = genome;
    this.materials = materialsOf(genome);
    const rig = BUILDERS[genome.species](genome, this.materials);
    // A child of two species carries a part of the other one: a crest, a shell, a tail.
    const heirlooms = graft(rig, genome, this.materials);
    rig.wiggles.push(...heirlooms.wiggles);
    rig.flaps.push(...heirlooms.flaps);
    this.rig = rig;
    const { traits } = genome;
    if (traits.charm !== "none" && rig.charmAt) {
      const c = charm(traits.charm, this.materials);
      c.position.set(...rig.charmAt.at);
      c.rotation.set(...rig.charmAt.rot);
      rig.charmAt.parent.add(c);
    }
    this.root = new THREE.Group(); // where it stands; the hatch scales it
    this.pivot = new THREE.Group(); // hops and squashes
    this.pivot.scale.setScalar(traits.size);
    this.root.add(this.pivot);
    this.pivot.add(rig.body);
    this.height = (rig.height + (rig.hover ?? 0)) * traits.size;
    this.mood = MOODS[traits.mood];
    this.blinkEvery = 2.6 + (traits.voice.pitch % 17) / 10; // a blink rhythm of its own, 2.6 to 4.2 s
    // Everything that moves is moved from where the builder left it.
    this.moving = new Map();
    for (const w of [...rig.wiggles, ...rig.flaps]) {
      const prop = w.move ? "position" : "rotation";
      const key = `${w.obj.uuid}.${prop}`;
      if (!this.moving.has(key)) this.moving.set(key, { obj: w.obj, prop, base: w.obj[prop].clone() });
    }
    this.headBase = rig.head.rotation.clone();
  }

  /**
   * Poses the creature at `t` seconds of life. `look` is where it looks, from -1 to 1 on each axis;
   * `react` is how long ago it was poked and `pokes` how many times; `crying` opens its mouth. Returns
   * what it is doing, for the effects around it.
   */
  pose(t, { look = null, react = Infinity, pokes = 0, crying = false } = {}) {
    const { rig, mood } = this;
    const size = this.genome.traits.size;
    for (const { obj, prop, base } of this.moving.values()) obj[prop].copy(base);

    // Its habit, first a second after it hatches, then every so often: s goes from 0 to 1 while it lasts.
    const h = (t - HABIT_START + mood.every * 100) % mood.every;
    const habit = t >= HABIT_START && h < mood.for ? mood.habit : null;
    const s = habit ? h / mood.for : 0;
    const bump = Math.sin(s * Math.PI);

    // Where it looks: toward the pointer, or wandering on its own.
    const lx = look ? look.x : mood.wander * (0.55 * Math.sin(t * 0.43) + 0.25 * Math.sin(t * 1.13 + 1));
    const ly = look ? look.y : mood.wander * 0.3 * Math.sin(t * 0.61 + 2);
    rig.head.rotation.set(
      this.headBase.x + mood.pitch - 0.28 * ly + (habit === "nap" ? 0.2 * bump : habit === "puff" ? -0.22 * bump : 0),
      this.headBase.y + 0.5 * lx + (habit === "peek" ? 0.75 * bump : 0),
      this.headBase.z + mood.tilt * Math.sin(t * 0.37) + (habit === "tilt" ? 0.42 * bump : 0),
    );

    const breath = Math.sin(t * mood.breath * Math.PI * 2) * (habit === "nap" ? 1.6 : 1);
    rig.body.scale.set(1 - 0.014 * breath, 1 + 0.03 * breath, 1 - 0.014 * breath);

    let y = rig.hover ? rig.hover + 0.07 * Math.sin(t * 1.7) : 0;
    let squash = habit === "puff" ? -0.07 * bump : 0;
    if (habit === "hop") {
      if (s < 0.75) y += 0.26 * 4 * (s / 0.75) * (1 - s / 0.75);
      else squash = 0.08 * Math.sin(((s - 0.75) / 0.25) * Math.PI);
    }

    // A poke: it hops, spins or wiggles, by turns, laughing all the while.
    const reacting = react < REACT;
    let flap = 0, spin = 0, shake = 0;
    if (reacting) {
      const k = react / REACT;
      const kind = pokes % 3;
      if (kind === 0 || kind === 1) {
        const j = react / 0.6;
        if (j < 1) y += 0.5 * 4 * j * (1 - j);
        else squash = 0.12 * Math.sin(Math.min(1, (react - 0.6) / 0.2) * Math.PI);
      }
      if (kind === 1) spin = Math.PI * 2 * Math.min(1, react / 0.6) ** 0.8;
      if (kind === 2) shake = 0.22 * Math.sin(react * 30) * (1 - k);
      flap = Math.sin(react * 22) * (1 - k);
    }
    this.pivot.position.y = y;
    this.pivot.rotation.y = spin;
    this.pivot.rotation.z = shake;
    this.pivot.scale.set(size * (1 + squash), size * (1 - squash), size * (1 + squash));

    for (const w of rig.wiggles) {
      const target = w.move ? w.obj.position : w.obj.rotation;
      target[w.axis] += w.amp * Math.sin(t * w.speed + w.phase);
    }
    for (const f of rig.flaps) f.obj.rotation[f.axis] += f.amp * flap;

    const blinkT = t % this.blinkEvery;
    const blink = blinkT < 0.13 || (this.blinkEvery > 3.5 && blinkT > 0.3 && blinkT < 0.42);
    const asleep = habit === "nap" && s > 0.08 && s < 0.92;
    for (const eye of rig.face.eyes) {
      eye.visible = !reacting;
      eye.scale.setScalar(habit === "tilt" ? 1 + 0.15 * bump : 1);
      eye.scale.y *= blink || asleep ? 0.12 : 1;
    }
    for (const eye of rig.face.happy) eye.visible = reacting;
    for (const iris of rig.face.irises) iris.position.set(lx * iris.userData.reach, ly * iris.userData.reach * 0.8, 0);

    const open = crying || reacting || (habit === "nap" && s > 0.35 && s < 0.6);
    const m = rig.face.mouth;
    if (m.idle) m.idle.visible = !open;
    if (m.open) m.open.visible = open;
    if (m.jaw) m.jaw.rotation.x = open ? 0.45 : 0;
    for (const p of rig.puffs ?? []) p.scale.setScalar(1 + 0.06 * Math.sin(t * 3.1) + (open ? 0.55 : 0));
    return { habit, s };
  }
}
