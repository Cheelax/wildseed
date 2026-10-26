// Static scenery is baked once, then drawn by material instead of one draw call per pebble or cloud.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function signature(object) {
  const m = object.material, uniforms = m.userData.uniforms ?? m.uniforms;
  return JSON.stringify([m.type, m.side, object.castShadow, object.receiveShadow,
    uniforms ? Object.fromEntries(Object.entries(uniforms).filter(([k]) => k !== "uTime").map(([k, v]) => [k, v.value])) : m.uuid]);
}

function bakedGeometry(object, matrix) {
  const geometry = object.geometry.clone();
  // Keep shared vertices: expanding spheres to triangle soup triples SwiftShader's vertex work.
  if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i));
  geometry.setAttribute("patternPosition", geometry.getAttribute("position").clone());
  geometry.setAttribute("patternNormal", geometry.getAttribute("normal").clone());
  for (const name of Object.keys(geometry.attributes)) {
    if (!["position", "normal", "patternPosition", "patternNormal"].includes(name)) geometry.deleteAttribute(name);
  }
  geometry.applyMatrix4(matrix);
  return geometry;
}

/** Merge only stationary siblings; every object used by pose() remains independently movable. */
export function batchRig(rig) {
  const moving = new Set([rig.body, rig.head, ...rig.wiggles.map(w => w.obj), ...rig.flaps.map(w => w.obj),
    ...rig.face.eyes, ...rig.face.happy, ...rig.face.irises, ...Object.values(rig.face.mouth), ...(rig.puffs ?? [])]);
  rig.body.traverse(o => {
    if (!o.geometry?.getAttribute("normal")) return;
    // Some materials are also used on a moving mesh. Its unbaked coordinates stay available too.
    if (!o.geometry.hasAttribute("patternPosition")) {
      o.geometry.setAttribute("patternPosition", o.geometry.getAttribute("position").clone());
      o.geometry.setAttribute("patternNormal", o.geometry.getAttribute("normal").clone());
    }
  });
  function walk(group) {
    [...group.children].forEach(walk);
    const buckets = new Map();
    for (const object of group.children) {
      if (!object.isMesh || Array.isArray(object.material) || moving.has(object) || !object.visible) continue;
      const key = signature(object);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    }
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const geometries = objects.map(object => { object.updateMatrix(); return bakedGeometry(object, object.matrix); });
      const merged = mergeGeometries(geometries);
      geometries.forEach(g => g.dispose());
      const first = objects[0], material = first.material;
      material.defines = { ...material.defines, BATCHED_PARTS: 1 };
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.matrixAutoUpdate = false;
      objects.forEach(object => { group.remove(object); if (!object.geometry.userData.shared) object.geometry.dispose(); });
      group.add(mesh);
    }
  }
  walk(rig.body);
}

export function batchScenery(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), keep = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    if (Array.isArray(object.material)) { keep.push(object); return; }
    const m = object.material;
    const key = signature(object);
    if (!buckets.has(key)) buckets.set(key, { material: m, cast: object.castShadow, receive: object.receiveShadow, geometries: [] });
    const geometry = bakedGeometry(object, object.matrixWorld);
    buckets.get(key).geometries.push(geometry);
    if (!object.geometry.userData.shared) object.geometry.dispose();
  });
  const result = new THREE.Group();
  for (const item of keep) {
    const matrix = item.matrixWorld.clone();
    item.removeFromParent();
    matrix.decompose(item.position, item.quaternion, item.scale);
    item.updateMatrix();
    result.add(item);
  }
  for (const { material, cast, receive, geometries } of buckets.values()) {
    const merged = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    material.defines = { ...material.defines, BATCHED_PARTS: 1 };
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    result.add(mesh);
  }
  return result;
}
