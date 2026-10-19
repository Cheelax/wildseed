import * as THREE from 'three';

export function buildCreature(genome) {
  const root = new THREE.Group(), face = new THREE.Group(), limbs = [], wings = [];
  const g = genome, t = g.traits, p = g.palette;
  const ramp = new THREE.DataTexture(new Uint8Array([80, 140, 200, 255]), 4, 1, THREE.RedFormat);
  ramp.minFilter = THREE.NearestFilter; ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const material = (index) => new THREE.MeshToonMaterial({ color: p[index], gradientMap: ramp });
  const bodyMat = material(2), lightMat = material(3), darkMat = material(1), pinkMat = material(5);
  const black = new THREE.MeshBasicMaterial({ color: p[0] }), white = new THREE.MeshBasicMaterial({ color: p[4] });
  const sphere = new THREE.SphereGeometry(1, 12, 8), cube = new THREE.BoxGeometry(1, 1, 1);
  const put = (parent, geo, mat, pos, scale) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const ball = (parent, mat, pos, scale) => put(parent, sphere, mat, pos, scale);
  const box = (parent, mat, pos, scale) => put(parent, cube, mat, pos, scale);
  const bodyScale = t.body / 100;
  let bodyY = 0.92, faceY = 1.15, faceZ = 0.6;
  if (g.species === 'tumbletoad') {
    bodyY = 0.65; faceY = 0.86; faceZ = 0.65;
    ball(root, bodyMat, [0, bodyY, 0], [0.86 * bodyScale, 0.52, 0.66]);
    for (const side of [-1, 1]) { ball(root, lightMat, [side * 0.55, 1, 0.24], [0.28, 0.27, 0.26]); ball(root, darkMat, [side * 0.72, 0.22, 0.12], [0.3, 0.2, 0.4]); }
  } else if (g.species === 'bellfin') {
    ball(root, bodyMat, [0, bodyY + 0.08, 0], [0.66, 0.79 * bodyScale, 0.57]);
    for (const side of [-1, 1]) {
      const fin = ball(root, lightMat, [side * 0.7, 0.9, 0], [0.45, 0.13, 0.38]); fin.rotation.z = side * 0.38; wings.push(fin);
    }
    ball(root, darkMat, [0, 0.5, -0.55], [0.32, 0.32, 0.55 * t.tail / 100]);
  } else if (g.species === 'lanternmoth') {
    ball(root, bodyMat, [0, 0.95, 0], [0.4, 0.64 * bodyScale, 0.4]);
    faceY = 1.17; faceZ = 0.4;
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(side * 0.22, 1.05, -0.1); root.add(wing); wings.push(wing);
      ball(wing, lightMat, [side * 0.52, 0.2, 0], [0.66, 0.54, 0.12]);
      ball(wing, darkMat, [side * 0.42, -0.37, 0], [0.48, 0.36, 0.12]);
      ball(wing, pinkMat, [side * 0.65, 0.2, 0.13], [0.2, 0.22, 0.035]);
      const antenna = ball(root, darkMat, [side * 0.2, 1.65, 0], [0.055, 0.36, 0.055]); antenna.rotation.z = -side * 0.3;
      ball(root, lightMat, [side * 0.3, 1.95, 0], [0.1, 0.1, 0.1]);
    }
  } else {
    ball(root, bodyMat, [0, bodyY, 0], [0.66 * bodyScale, 0.7, 0.57]);
    if (g.species === 'bramblebun') {
      for (const side of [-1, 1]) {
        const ear = ball(root, bodyMat, [side * 0.28, 1.95, -0.04], [0.2, 0.64 * t.ears / 100, 0.18]); ear.rotation.z = -side * 0.14;
        ball(ear, pinkMat, [0, 0, 0.8], [0.55, 0.8, 0.25]);
      }
      ball(root, lightMat, [0, 0.6, -0.6], [0.26, 0.26, 0.27]);
    }
    if (g.species === 'pebblepup') {
      for (const side of [-1, 1]) {
        const ear = ball(root, darkMat, [side * 0.62, 1.24, -0.02], [0.23, 0.48 * t.ears / 100, 0.2]); ear.rotation.z = side * 0.3;
      }
      const tail = ball(root, darkMat, [0.2, 0.9, -0.7], [0.16, 0.18, 0.6 * t.tail / 100]); tail.rotation.x = -0.65;
      ball(root, lightMat, [0, 0.97, 0.46], [0.4, 0.28, 0.24]);
    }
    if (g.species === 'sproutling') {
      for (const side of [-1, 1]) {
        const leaf = ball(root, lightMat, [side * 0.24, 1.85, 0], [0.23, 0.53 * t.ears / 100, 0.11]); leaf.rotation.z = -side * 0.6;
      }
      ball(root, darkMat, [0, 1.64, 0], [0.08, 0.4, 0.08]);
      for (const side of [-1, 1]) ball(root, lightMat, [side * 0.65, 0.83, 0], [0.25, 0.12, 0.3]);
    }
  }
  if (g.species !== 'lanternmoth') {
    for (const side of [-1, 1]) limbs.push(ball(root, darkMat, [side * 0.33, 0.2, 0.23], [0.24, 0.22, 0.34]));
    ball(root, lightMat, [0, bodyY - 0.1, 0.43], [0.4, 0.44, 0.15]);
  }
  face.position.set(0, faceY, faceZ); root.add(face);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.x = side * 0.23; face.add(eye); eyes.push(eye);
    box(eye, black, [0, 0, 0], [0.16, 0.22 + t.eyes * 0.025, 0.08]);
    box(eye, white, [-0.025, 0.055, 0.045], [0.055, 0.065, 0.02]);
    box(face, pinkMat, [side * 0.36, -0.12, 0], [0.14, 0.07, 0.05]);
  }
  box(face, black, [0, -0.13, 0.075], [0.09, 0.045, 0.04]);
  box(face, black, [-0.045, -0.17, 0.065], [0.045, 0.04, 0.04]);
  box(face, black, [0.045, -0.17, 0.065], [0.045, 0.04, 0.04]);
  for (let i = 0; i <= t.marking; i++) box(root, darkMat, [(i - t.marking / 2) * 0.14, bodyY + 0.42, 0.4], [0.08, 0.1, 0.06]);
  let halo = null;
  if (g.rare) {
    halo = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.045, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffdb82' }));
    halo.position.y = 2.55; halo.rotation.x = Math.PI / 2; root.add(halo);
  }
  return { root, update(time, { pointer = { x: 0, y: 0 }, reaction = 0, reduced = false } = {}) {
    const breath = reduced ? 1 : 1 + Math.sin(time * 2.6 + t.voice) * 0.025;
    root.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    root.position.y = reduced ? 0 : Math.sin(reaction * Math.PI) * 0.32;
    root.rotation.z = reduced ? 0 : Math.sin(time * 1.5) * 0.018;
    face.rotation.y = pointer.x * 0.16; face.rotation.x = -pointer.y * 0.09;
    const blink = time % (3.2 + t.voice * 0.1) < 0.14;
    eyes.forEach((eye) => { eye.scale.y = blink ? 0.12 : 1; });
    wings.forEach((wing, i) => { wing.rotation.y = Math.sin(time * (g.species === 'lanternmoth' ? 4 : 2)) * 0.15 * (i ? -1 : 1); });
    if (halo) halo.rotation.z = time * 0.4;
  }, dispose() {
    const geometries = new Set(), materials = new Set();
    root.traverse((node) => { if (node.isMesh) { geometries.add(node.geometry); materials.add(node.material); } });
    geometries.forEach((geo) => geo.dispose()); materials.forEach((mat) => mat.dispose()); ramp.dispose();
  } };
}
