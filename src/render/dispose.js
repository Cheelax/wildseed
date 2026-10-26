// Frees what a part of the scene holds on the GPU: its own geometries and materials. The shapes every
// creature shares (unit spheres, cones…) are marked `shared` and stay.
export function dispose(object) {
  object.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    for (const m of [o.material].flat()) m?.dispose();
  });
}
