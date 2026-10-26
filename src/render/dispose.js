// Frees what a part of the scene holds on the GPU: its own geometries and materials. The shapes every
// creature shares (unit spheres, cones…) and the materials a whole stage shares (its shadows) are marked
// `shared` and stay.
export function dispose(object) {
  object.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    for (const m of [o.material].flat()) if (m && !m.userData.shared) m.dispose();
  });
}
