// A portrait: one creature alone against its affinity's sky, out of its egg and smiling, for the family
// tree. A light scene of its own (no island, egg or effects), drawn off screen by the page's renderer.
import * as THREE from "three";
import { Creature } from "./creature.js";
import { aim, skyOf } from "./stage.js";
import { dispose } from "./dispose.js";

/** The RGBA pixels (top row first) of `genome`'s creature in a w × h picture. */
export function portrait(renderer, genome, w, h) {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.8);
  sun.position.set(-3.5, 7, 5);
  scene.add(sun, sun.target, new THREE.AmbientLight(0xffffff, Math.PI * 0.3));
  const creature = new Creature(genome);
  // Through the same shaders as the creature on the stage (one clipping plane, which keeps everything).
  const keep = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100);
  creature.root.traverse((o) => {
    for (const m of [o.material ?? []].flat()) m.clippingPlanes = [keep];
  });
  creature.pose(1.5); // alive, eyes open
  scene.add(creature.root);
  const sphere = new THREE.Box3().setFromObject(creature.root).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.5, 60);
  aim(camera, sphere.center, sphere.radius, 0.78, { azimuth: 0.4, elevation: 0.12 });
  const pixels = renderer.capture({ scene, camera, colors: { sky: skyOf(genome.affinity), ink: { creature: genome.palette[5] } } }, w, h);
  dispose(scene);
  return pixels;
}
