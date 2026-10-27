// Still portraits share the live renderer, with no extra WebGL contexts or animation loops.
import * as THREE from "three";
import { Creature } from "./creature.js";
import { aim, skyOf } from "./stage.js";
import { dispose } from "./dispose.js";

const cache = new Map();
export function portrait(renderer, genome, size = 72) {
  const key = `${genome.seed}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const creature = new Creature(genome);
  creature.pose(0.7);
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * 0.8);
  sun.position.set(-3.5, 7, 5);
  scene.add(creature.root, sun, new THREE.AmbientLight(0xffffff, Math.PI * 0.3));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const sphere = new THREE.Box3().setFromObject(creature.root).getBoundingSphere(new THREE.Sphere());
  aim(camera, sphere.center, sphere.radius, 1.06);
  const colors = { sky: skyOf(genome.affinity), ink: { creature: genome.palette[5] } };
  const data = new ImageData(renderer.capture({ scene, camera, colors }, size, size), size, size);
  dispose(creature.root);
  if (cache.size >= 40) cache.delete(cache.keys().next().value);
  cache.set(key, data);
  return data;
}

export function drawPortrait(renderer, genome, canvas) {
  if (!renderer) return;
  canvas.getContext("2d").putImageData(portrait(renderer, genome, canvas.width), 0, 0);
}
