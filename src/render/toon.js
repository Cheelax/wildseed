// Materials of the pixel look. Toon parts are lit by three.js (sun, shadows, ambient), then the light
// level picks one of four flat bands of the part's own ramp: no gradients, only palette colors. Markings
// are drawn in object space, so they stick to a part as it moves and come out as pixel shapes.
import * as THREE from "three";

/** Outline classes, written in the alpha channel: the outline pass inks the edges between them. */
export const CLASS = { sky: 0, ground: 1, decor: 2, creature: 3, face: 4, egg: 5, fx: 6 };

/** Marking patterns a toon material can draw. */
export const PATTERN = { none: 0, spots: 1, stripes: 2, patch: 3, mask: 4, socks: 5, rings: 6, zigzag: 7, plates: 8 };

const color = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));

/**
 * The four bands of a color, darkest first: shadows lean cool and highlights warm, as a pixel artist
 * would shade them by hand.
 */
export function ramp(hex) {
  const hsl = {};
  color(hex).getHSL(hsl);
  const shade = (dl, dh, ds) => {
    const h = hsl.h + dh * (hsl.h > 0.12 && hsl.h < 0.62 ? 1 : -1) * (hsl.s > 0.08 ? 1 : 0);
    return new THREE.Color().setHSL((h + 1) % 1, Math.min(1, Math.max(0, hsl.s + ds)), Math.min(0.97, Math.max(0.03, hsl.l + dl)));
  };
  return [shade(-0.24, 0.035, 0.06), shade(-0.11, 0.018, 0.03), color(hex).clone(), shade(0.09, -0.02, -0.02)];
}

const PARS = /* glsl */ `
uniform vec3 uBase[4];
uniform vec3 uMark[4];
uniform vec3 uBelly[4];
uniform vec3 uBands;
uniform vec4 uMarkP;
uniform vec4 uMarkQ;
uniform vec4 uBellyP;
uniform vec3 uBellyAxis;
uniform float uStars;
uniform float uTime;
uniform float uClass;
varying vec3 vObj;
varying vec3 vObjN;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// Distance to the nearest of one random point per cell: round spots of radius r where it is below r.
float cells(vec3 p) {
  vec3 i = floor(p);
  vec3 o = vec3(hash13(i), hash13(i + 17.1), hash13(i + 41.7));
  // A spot sits inside its own cell; no 27-neighbour search in every shaded pixel.
  return length(fract(p) - (0.25 + 0.5 * o));
}

float tri(float x) { return abs(fract(x) - 0.5) * 2.0; }

bool marked(vec3 p, vec3 n) {
  int kind = int(uMarkP.x + 0.5);
  float scale = uMarkP.y, cut = uMarkP.z, off = uMarkP.w;
  if (kind == 1) return n.z < uMarkQ.w && cells(p * scale + off) < cut;
  if (kind == 2) return n.z < 0.35 && fract((p.y + off) * scale) < cut;
  if (kind == 3) return length(p - uMarkQ.xyz) < cut;
  if (kind == 4) return p.z > 0.25 && abs(p.y - uMarkQ.y) < cut;
  if (kind == 5) return p.y < off;
  if (kind == 6) return fract((p.y + off) * scale) < cut;
  if (kind == 7) return abs(p.y - off - 0.13 * (tri(atan(p.z, p.x) * scale / 6.2831853) - 0.5)) < cut;
  if (kind == 8) return cells(p * scale + off) > cut;
  return false;
}

bool belly(vec3 p, vec3 n) {
  return uBellyP.x > 0.5 && dot(n, uBellyAxis) > uBellyP.y && p.y < uBellyP.z && p.y > uBellyP.w;
}
`;

const MAIN = /* glsl */ `
float light = dot(outgoingLight, vec3(0.3333));
int band = light < uBands.x ? 0 : light < uBands.y ? 1 : light < uBands.z ? 2 : 3;
vec3 col = belly(vObj, vObjN) ? uBelly[band] : marked(vObj, vObjN) ? uMark[band] : uBase[band];
if (uStars > 0.0) {
  vec3 q = floor(vObj * 9.0);
  float h = hash13(q);
  float twinkle = step(0.5, fract(h * 7.0 + uTime * (0.4 + h)));
  if (h > 1.0 - uStars * twinkle && fract(hash13(q + 3.3) * 5.0) > 0.4) col = vec3(1.0, 0.95, 0.75);
}
gl_FragColor = vec4(col, uClass / 255.0);
`;

const clock = { value: 0 };
/** Advances the time that animated markings (a rare creature's stars) read. */
export function tick(seconds) {
  clock.value = seconds;
}

/**
 * A toon material. `base` is the part's color; `mark` and `belly` colors with their patterns are
 * optional: { pattern: PATTERN.spots, scale, cut, offset, at: [x, y, z], front }, where spots stay off the
 * front where the normal's z passes `front` (a face); and { nz, top, bottom, axis }: the
 * belly covers the part where the normal leans along `axis` (the front) by more than `nz`.
 */
export function toon(base, { mark = null, belly = null, stars = 0, cls = CLASS.creature, side = THREE.FrontSide, bands = [0.42, 0.66, 0.96] } = {}) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side });
  const baseRamp = ramp(base);
  const uniforms = {
    uBase: { value: baseRamp },
    uMark: { value: mark ? ramp(mark.color) : baseRamp },
    uBelly: { value: belly ? ramp(belly.color) : baseRamp },
    uBands: { value: new THREE.Vector3(...bands) },
    uMarkP: { value: new THREE.Vector4(mark?.pattern ?? 0, mark?.scale ?? 1, mark?.cut ?? 0, mark?.offset ?? 0) },
    uMarkQ: { value: new THREE.Vector4(...(mark?.at ?? [0, 0, 0]), mark?.front ?? 0.92) },
    uBellyP: { value: new THREE.Vector4(belly ? 1 : 0, belly?.nz ?? 0.4, belly?.top ?? 0.3, belly?.bottom ?? -2) },
    uBellyAxis: { value: new THREE.Vector3(...(belly?.axis ?? [0, 0, 1])).normalize() },
    uStars: { value: stars },
    uTime: clock,
    uClass: { value: cls },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;\nvObjN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace("#include <opaque_fragment>", MAIN);
  };
  return m;
}

const FLAT_VERTEX = /* glsl */ `
#include <clipping_planes_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FLAT_FRAGMENT = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uClass;
void main() {
  #include <clipping_planes_fragment>
  gl_FragColor = vec4(uColor, uClass / 255.0);
}`;

/** An unlit color: eyes, mouths, cheeks, sparkles. */
export function flat(c, cls = CLASS.face) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color(c).clone() }, uClass: { value: cls } },
    vertexShader: FLAT_VERTEX,
    fragmentShader: FLAT_FRAGMENT,
    clipping: true,
  });
}
