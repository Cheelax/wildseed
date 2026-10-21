import * as THREE from 'three';

// Geometry and materials are generated at runtime. Each species has its own silhouette.
export function makeCreature(genome, materials) {
  const root = new THREE.Group();
  const torso = new THREE.Group(); root.add(torso);
  const t = genome.traits;
  const parts = { ears: [], wings: [], petals: [], feet: [], pupils: [], eyes: [] };
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  const box = new THREE.BoxGeometry(1, 1, 1);
  function ellipsoid(parent, color, position, scale, geometry = sphere) {
    const mesh = new THREE.Mesh(geometry, materials[color]);
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function group(position, parent = torso) {
    const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g;
  }
  function leaf(position, scale, rotation = 0, color = 2, parent = torso) {
    const pivot = group(position, parent);
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(.23, .23), new THREE.Vector2(.29, .5), new THREE.Vector2(.16, .78), new THREE.Vector2(0, 1)];
    const mesh = ellipsoid(pivot, color, [0, 0, 0], scale, new THREE.LatheGeometry(points, 8));
    pivot.rotation.z = rotation; pivot.userData.rest = rotation;
    return pivot;
  }
  function foot(x, z, scale = 1) {
    const f = ellipsoid(torso, 1, [x, .17, z], [.23 * scale, .17, .32 * scale]);
    parts.feet.push(f); return f;
  }
  function face(head, width, z, y = 0) {
    const f = group([0, y, z], head);
    for (const sign of [-1, 1]) {
      const eye = group([sign * width, .04, 0], f); parts.eyes.push(eye);
      const s = t.eyes;
      ellipsoid(eye, 6, [0, 0, 0], [.18 * s, .24 * s, .04], box);
      const pupil = group([0, 0, .025], eye); parts.pupils.push(pupil);
      ellipsoid(pupil, 4, [-.027, .046, 0], [.059, .071, .025], box);
      ellipsoid(pupil, 3, [.034, -.05, 0], [.029, .034, .025], box);
      ellipsoid(f, 5, [sign * (width + .12), -.105, -.01], [.14, .06, .045], box);
      const brow = ellipsoid(f, 0, [sign * width, .207, -.005], [.15, .035, .035], box);
      brow.rotation.z = sign * -.12;
    }
    // A little stepped W-shaped smile; geometrical pixels, visible from side angles too.
    for (const [x, yy] of [[-.07, -.09], [-.035, -.12], [0, -.09], [.035, -.12], [.07, -.09]])
      ellipsoid(f, 6, [x, yy - .055, .025], [.037, .035, .035], box);
    parts.face = f;
  }
  function markings(parent, radius, y, z) {
    const count = 2 + t.markings;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * .13;
      ellipsoid(parent, 3, [x, y - Math.abs(x) * .2, z - x * x / radius], [.065, .085, .03], box);
    }
  }
  let head;
  switch (genome.species) {
    case 'spriglet': {
      ellipsoid(torso, 2, [0, .72, 0], [.59 * t.width, .66 * t.height, .46]);
      ellipsoid(torso, 3, [0, .64, .405], [.36, .38, .08]);
      head = group([0, 1.39, .035]);
      ellipsoid(head, 2, [0, 0, 0], [.60 * t.head, .49, .47]);
      face(head, .205, .448);
      markings(head, 1, .29, .39);
      for (const sign of [-1, 1]) {
        parts.ears.push(leaf([sign * .3, .29, -.04], [1, .86 * t.ears, .7], sign * -.3, 2, head));
        ellipsoid(torso, 1, [sign * .56 * t.width, .66, .08], [.15, .29, .18]).rotation.z = sign * .28;
        foot(sign * .31, .13);
      }
      leaf([0, 1.82, -.12], [.7, .48, .5], -.35, 7);
      break;
    }
    case 'craggle': {
      ellipsoid(torso, 1, [0, .72, -.06], [.83 * t.width, .54 * t.height, .64], new THREE.IcosahedronGeometry(1, 1));
      head = group([0, .91, .43]);
      ellipsoid(head, 2, [0, 0, 0], [.57 * t.head, .43, .43]);
      face(head, .21, .405, -.025);
      markings(head, 1, .25, .34);
      for (const x of [-.53, .53]) for (const z of [-.35, .35]) foot(x, z, .93);
      for (const [x, y, z, size] of [[-.4, 1.2, -.1, .38], [0, 1.39, -.18, .53], [.4, 1.22, -.18, .33]]) {
        const crystal = ellipsoid(torso, 7, [x, y, z], [size * .46, size, size * .45], new THREE.ConeGeometry(1, 1, 5));
        crystal.rotation.z = -x * .5;
      }
      leaf([-.48, 1.02, -.42], [.65, .45, .55], .7, 3);
      break;
    }
    case 'flutterseed': {
      ellipsoid(torso, 2, [0, 1.10, 0], [.35 * t.width, .58, .30]);
      ellipsoid(torso, 3, [0, .98, .27], [.23, .30, .055]);
      head = group([0, 1.67, .04]);
      ellipsoid(head, 2, [0, 0, 0], [.47 * t.head, .41, .37]);
      face(head, .17, .35);
      for (const sign of [-1, 1]) {
        const wing = group([sign * .25, 1.35, -.1]);
        ellipsoid(wing, 7, [sign * .51, .20, 0], [.66 * t.ears, .37, .065]).rotation.z = sign * .35;
        ellipsoid(wing, 3, [sign * .42, -.24, 0], [.48, .27, .055]).rotation.z = sign * -.45;
        ellipsoid(wing, 5, [sign * .65, .22, .067], [.22, .16, .018]);
        parts.wings.push(wing);
        leaf([sign * .17, .28, 0], [.25, .42, .25], sign * -.4, 0, head);
        ellipsoid(head, 3, [sign * .32, .65, 0], [.09, .09, .09]);
        ellipsoid(torso, 1, [sign * .2, .65, .1], [.13, .17, .17]);
      }
      break;
    }
    case 'mushling': {
      ellipsoid(torso, 3, [0, .78, 0], [.43 * t.width, .66 * t.height, .36]);
      head = group([0, 1.08, .03]);
      ellipsoid(head, 3, [0, 0, 0], [.46 * t.head, .38, .36]);
      face(head, .17, .342, -.04);
      const cap = group([0, 1.47, -.02]); parts.cap = cap;
      ellipsoid(cap, 4, [0, 0, 0], [.92 * t.head, .13, .72], new THREE.SphereGeometry(1, 20, 8));
      ellipsoid(cap, 2, [0, .025, 0], [.98 * t.head, .57 * t.ears, .77], new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
      for (const [x, z] of [[-.5, .18], [.34, .33], [-.1, .52], [.12, -.3], [-.42, -.32], [.5, -.14], [0, .05]].slice(0, 4 + t.markings)) {
        const yy = Math.sqrt(Math.max(0, 1 - (x / .98) ** 2 - (z / .77) ** 2)) * .57 * t.ears;
        ellipsoid(cap, 4, [x * t.head, yy + .022, z], [.16, .025, .12], box);
      }
      for (const sign of [-1, 1]) {
        foot(sign * .26, .07, .8);
        ellipsoid(torso, 3, [sign * .44, .7, .04], [.13, .28, .13]).rotation.z = sign * -.28;
      }
      break;
    }
    case 'bloomkin': {
      ellipsoid(torso, 1, [0, .61, -.06], [.45 * t.width, .4, .40]);
      ellipsoid(torso, 2, [0, 1.17, .01], [.19, .75 * t.height, .19]);
      head = group([0, 1.87, .045]);
      const petalCount = 6 + t.ornament;
      for (let i = 0; i < petalCount; i++) {
        const a = i / petalCount * Math.PI * 2;
        const petal = ellipsoid(head, i % 2 ? 5 : 7, [Math.sin(a) * .43, Math.cos(a) * .43, -.09], [.22, .38 * t.ears, .12]);
        petal.rotation.z = -a; parts.petals.push(petal);
      }
      ellipsoid(head, 3, [0, 0, 0], [.40 * t.head, .38, .32]);
      face(head, .15, .305, -.015);
      for (const sign of [-1, 1]) {
        foot(sign * .29, .16, .74);
        leaf([sign * .12, 1.05, -.03], [.8, .7, .45], sign * -1.05, 2);
      }
      break;
    }
    case 'embercurl': {
      ellipsoid(torso, 2, [0, .76, .02], [.47 * t.width, .66 * t.height, .38]);
      ellipsoid(torso, 3, [0, .67, .345], [.30, .37, .065]);
      head = group([0, 1.4, .075]);
      ellipsoid(head, 2, [0, 0, 0], [.51 * t.head, .43, .38]);
      face(head, .18, .36);
      for (const sign of [-1, 1]) {
        parts.ears.push(leaf([sign * .29, .25, -.03], [.65, .57 * t.ears, .65], sign * -.4, 5, head));
        foot(sign * .27, .12, .84);
        ellipsoid(torso, 1, [sign * .43, .68, .07], [.13, .25, .15]);
      }
      const tail = group([.25, .43, -.25]); parts.tail = tail;
      const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [.4, -.1, -.12], [.78, .15, -.2], [.85, .63, -.17], [.6, .86, -.12], [.36, .68, -.08]].map((p) => new THREE.Vector3(...p)));
      ellipsoid(tail, 1, [0, 0, 0], [t.tail, t.tail, 1], new THREE.TubeGeometry(curve, 18, .13, 7, false));
      leaf([.36 * t.tail, .68 * t.tail, -.08], [.65, .4, .65], -.5, 3, tail);
      markings(head, 1, .23, .32);
      break;
    }
  }
  if (genome.rare) {
    const crown = group([0, .5, 0], head); parts.crown = crown;
    for (let i = -1; i <= 1; i++) {
      const jewel = ellipsoid(crown, 3, [i * .19, .28 + (i === 0 ? .08 : 0), 0], [.09, .15, .09], new THREE.OctahedronGeometry(1));
      jewel.rotation.z = -i * .2;
    }
  }
  root.userData = { genome, torso, head, parts };
  return root;
}

export function animateCreature(root, time, reaction = 0, pointer = { x: 0, y: 0 }, reduced = false) {
  const { genome: g, torso, head, parts } = root.userData;
  const phase = g.traits.phase;
  const slow = time * (g.traits.temperament === 'dreamy' ? 1.55 : 2.15) + phase;
  const motion = reduced ? .25 : 1;
  const joy = Math.sin(reaction * Math.PI);
  torso.position.y = (Math.sin(slow) * .025 + Math.abs(Math.sin(reaction * Math.PI * 2)) * .16) * motion;
  torso.rotation.z = Math.sin(slow * .5) * .022 * motion;
  torso.scale.set(1 + Math.sin(slow) * .012, 1 - Math.sin(slow) * .014, 1);
  head.rotation.y = pointer.x * .14 + Math.sin(slow * .39) * .055 * motion;
  head.rotation.z = -pointer.x * .035 + joy * .1;
  const blinkPhase = (time + phase) % 4.9;
  const blink = blinkPhase < .15 ? .12 : 1;
  for (const eye of parts.eyes) eye.scale.y = joy > .6 ? .35 : blink;
  for (const pupil of parts.pupils) { pupil.position.x = pointer.x * .026; pupil.position.y = pointer.y * .024; }
  parts.ears.forEach((ear, i) => { ear.rotation.z = ear.userData.rest + Math.sin(slow * 1.2 + i) * .06 * motion + (i ? -1 : 1) * joy * .2; });
  parts.wings.forEach((wing, i) => { wing.rotation.y = (i ? 1 : -1) * (.2 + Math.sin(time * 8 + phase) * .32) * motion; });
  if (g.species === 'flutterseed') torso.position.y += Math.sin(time * 2 + phase) * .09 * motion;
  if (parts.cap) { parts.cap.rotation.z = Math.sin(slow * .8) * .055 * motion; parts.cap.position.y = 1.47 + joy * .06; }
  if (parts.tail) parts.tail.rotation.y = Math.sin(slow * .8) * .14 * motion + joy * .2;
  parts.petals.forEach((petal, i) => { petal.rotation.x = Math.sin(slow + i * .3) * .08 * motion; });
  if (parts.crown) parts.crown.rotation.y = Math.sin(time) * .2;
}

export function disposeObject(object) {
  const geometries = new Set();
  object.traverse((node) => { if (node.geometry) geometries.add(node.geometry); });
  for (const geometry of geometries) geometry.dispose();
  object.removeFromParent();
}
