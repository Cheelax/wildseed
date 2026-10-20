// A creature on screen: its species builds the body from the genome, then pose(t) keeps it alive.
// It breathes, blinks, looks where it is told, wiggles its ears and tails, and acts out its mood.
// pose() is a pure function of time and of what it is told, so the GIF is the same creature as the page.
import * as THREE from "three";
import { charm, materialsOf } from "./parts.js";
import { pipkin } from "./species/pipkin.js";
import { hopple } from "./species/hopple.js";
import { trundle } from "./species/trundle.js";
import { drift } from "./species/drift.js";
import { prickle } from "./species/prickle.js";
import { wyrmlet } from "./species/wyrmlet.js";
import { inchling } from "./species/inchling.js";
import { domeback } from "./species/domeback.js";

const BUILDERS = { pipkin, hopple, trundle, drift, prickle, wyrmlet, inchling, domeback };

/** How each mood moves when nobody touches it. */
const MOODS = {
  bouncy: { breath: 0.55, hop: 2.6, hopHeight: 0.26, wander: 0.5, tilt: 0.05, pitch: 0 },
  sleepy: { breath: 0.28, hop: 0, hopHeight: 0, wander: 0.25, tilt: 0.12, pitch: 0.12, droop: true },
  curious: { breath: 0.45, hop: 0, hopHeight: 0, wander: 1, tilt: 0.22, pitch: -0.04 },
  shy: { breath: 0.42, hop: 0, hopHeight: 0, wander: 0.4, tilt: 0.1, pitch: 0.16 },
  proud: { breath: 0.4, hop: 4.4, hopHeight: 0.14, wander: 0.35, tilt: 0.04, pitch: -0.12 },
};

const REACT = 1.1; // seconds a reaction lasts

export class Creature {
  constructor(genome) {
    this.genome = genome;
    this.materials = materialsOf(genome);
    const rig = BUILDERS[genome.species](genome, this.materials);
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
    this.blinkEvery = 2.6 + (traits.voice.pitch % 17) / 10;
    // Everything that moves is moved from where the builder left it.
    this.moving = new Map();
    for (const w of [...rig.wiggles, ...rig.flaps]) {
      const prop = w.move ? "position" : "rotation";
      const key = `${w.obj.uuid}.${prop}`;
      if (!this.moving.has(key)) this.moving.set(key, { obj: w.obj, prop, base: w.obj[prop].clone() });
    }
    this.headBase = rig.head.rotation.clone();
    this.root.traverse((o) => {
      if (o.isMesh) o.userData.creature = this;
    });
  }

  /**
   * Poses the creature at `t` seconds of life. `look` is where it looks, from -1 to 1 on each axis;
   * `react` is how long ago it was poked; `crying` opens its mouth.
   */
  pose(t, { look = null, react = Infinity, crying = false } = {}) {
    const { rig, mood } = this;
    const tau = Math.PI * 2;
    for (const { obj, prop, base } of this.moving.values()) obj[prop].copy(base);

    // Where it looks: told by the pointer, or wandering on its own.
    const wanderX = mood.wander * (0.55 * Math.sin(t * 0.43) + 0.25 * Math.sin(t * 1.13 + 1));
    const wanderY = mood.wander * 0.3 * Math.sin(t * 0.61 + 2);
    const lx = look ? look.x : wanderX;
    const ly = look ? look.y : wanderY;
    rig.head.rotation.set(
      this.headBase.x + mood.pitch - 0.28 * ly + (mood.droop ? 0.06 * Math.sin(t * 0.5) : 0),
      this.headBase.y + 0.5 * lx,
      this.headBase.z + mood.tilt * Math.sin(t * 0.37),
    );

    const breath = Math.sin(t * mood.breath * tau);
    rig.body.scale.set(1 - 0.014 * breath, 1 + 0.03 * breath, 1 - 0.014 * breath);

    let y = rig.hover ? rig.hover + 0.07 * Math.sin(t * 1.7) : 0;
    let squash = 0;
    if (mood.hop) {
      const h = (t + 0.7) % mood.hop;
      if (h < 0.42) y += mood.hopHeight * 4 * (h / 0.42) * (1 - h / 0.42);
      else if (h < 0.56) squash = 0.08 * Math.sin(((h - 0.42) / 0.14) * Math.PI);
    }
    const reacting = react < REACT;
    let flap = 0;
    if (reacting) {
      const s = react / 0.6;
      if (s < 1) y += 0.5 * 4 * s * (1 - s);
      else squash = 0.12 * Math.sin(Math.min(1, (react - 0.6) / 0.2) * Math.PI);
      flap = Math.sin(react * 22) * Math.max(0, 1 - react / REACT);
    }
    this.pivot.position.y = y;
    const size = this.genome.traits.size;
    this.pivot.scale.set(size * (1 + squash), size * (1 - squash), size * (1 + squash));

    for (const w of rig.wiggles) {
      const target = w.move ? w.obj.position : w.obj.rotation;
      target[w.axis] += w.amp * Math.sin(t * w.speed + w.phase);
    }
    for (const f of rig.flaps) f.obj.rotation[f.axis] += f.amp * flap;

    const blinkT = t % this.blinkEvery;
    const blink = blinkT < 0.13 || (this.blinkEvery > 3.5 && blinkT > 0.3 && blinkT < 0.42);
    const droopy = mood.droop && Math.sin(t * 0.3) > 0.4;
    for (const eye of rig.face.eyes) {
      eye.visible = !reacting;
      eye.scale.y = blink ? 0.12 : droopy ? 0.55 : 1;
    }
    for (const eye of rig.face.happy) eye.visible = reacting;

    const open = crying || reacting;
    const m = rig.face.mouth;
    if (m.idle) m.idle.visible = !open;
    if (m.open) m.open.visible = open;
    if (m.jaw) m.jaw.rotation.x = open ? 0.45 : 0;
  }
}
