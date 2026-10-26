// Shadows on the island. Each part that casts one is drawn a second time, slid down along the sun's rays
// onto the island's flat top and painted in the ground's own shadow band: the pixel shadows of a shadow map,
// without its extra pass and its shaders, which a page drawn in software pays for on every frame and
// in seconds before its first one (README, "Speed").
import * as THREE from "three";
import { CLASS } from "./toon.js";

const VERTEX = /* glsl */ `
uniform vec3 uSun;
varying vec2 vGround;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.xyz -= uSun * (world.y / uSun.y);
  vGround = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uRadius;
varying vec2 vGround;
void main() {
  if (dot(vGround, vGround) > uRadius * uRadius) discard;
  gl_FragColor = vec4(uColor, ${CLASS.ground}.0 / 255.0);
}`;

export class Shadows {
  /** Shadows cast away from a sun at `sun`, on an island top of `radius` around the origin. */
  constructor(sun, radius) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sun.clone().normalize() }, uColor: { value: new THREE.Color() }, uRadius: { value: radius } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.material.userData.shared = true;
  }

  /** The color shadows are painted in: the island's darker band. */
  set color(c) {
    this.material.uniforms.uColor.value.set(c);
  }

  /** Makes every mesh of `object` that casts a shadow cast it on the island. Returns the shadows made. */
  cast(object) {
    const casters = [];
    object.traverse((o) => {
      if (o.isMesh && o.castShadow && !o.userData.shadow) casters.push(o);
    });
    return casters.map((o) => {
      const s = new THREE.Mesh(o.geometry, this.material);
      s.userData.shadow = true;
      s.frustumCulled = false;
      s.renderOrder = 1; // after the ground it lies on, which it does not hide from the depth buffer
      s.raycast = () => {};
      o.add(s);
      return s;
    });
  }
}
