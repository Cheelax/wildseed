// The pixel renderer: the scene is drawn at the art resolution (one texel per art pixel), then one pass
// paints the sky and inks a one-pixel outline wherever a part stands in front of what is behind it. The
// canvas holds exactly the art pixels; CSS scales it up without smoothing.
import * as THREE from "three";
import { CLASS } from "./toon.js";

THREE.ColorManagement.enabled = false; // palette colors go to the screen exactly as written

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform vec3 uInk[8];
uniform vec3 uSky[4];
varying vec2 vUv;

float dist(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  return uNear * uFar / (uFar - z * (uFar - uNear));
}
int classOf(vec4 c) { return int(c.a * 255.0 + 0.5); }
// The face sits on the creature: no line between them.
int group(int id) { return id == ${CLASS.face} ? ${CLASS.creature} : id; }
bool outlined(int id) { return id != ${CLASS.sky} && id != ${CLASS.fx}; }

void main() {
  vec4 c = texture2D(tColor, vUv);
  int id = classOf(c);
  float d = dist(vUv);
  float front = d;
  int ink = -1;
  vec2 offs[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + offs[i] * uTexel;
    vec4 cn = texture2D(tColor, uv);
    int n = classOf(cn);
    if (!outlined(n)) continue;
    float dn = dist(uv);
    float gap = group(n) != group(id) ? 0.02 : 0.16 + 0.035 * d;
    if (dn < front - gap) {
      front = dn;
      ink = group(n);
    }
  }
  if (ink >= 0) c.rgb = uInk[ink];
  else if (id == ${CLASS.sky}) {
    float y = vUv.y;
    c.rgb = y > 0.72 ? uSky[0] : y > 0.46 ? uSky[1] : y > 0.22 ? uSky[2] : uSky[3];
  }
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

export class PixelRenderer {
  constructor(canvas) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.shadowMap.type = THREE.BasicShadowMap;
    this.gl.localClippingEnabled = true; // a hatching creature shows only what is out of its shell
    this.gl.setClearColor(0x000000, 0);
    this.kind = "webgl2"; // three.js renders through WebGL 2 only
    this.targets = new Map();
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uInk: { value: Array.from({ length: 8 }, () => new THREE.Color(0x1a1420)) },
        uSky: { value: Array.from({ length: 4 }, () => new THREE.Color(0xbfe3ff)) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(triangle, this.post);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** Sets the art resolution of the canvas. */
  setSize(width, height) {
    this.gl.setSize(width, height, false);
  }

  /** The ink of each outline class and the four bands of the sky, top first. */
  setColors({ ink, sky }) {
    for (const [cls, c] of Object.entries(ink)) this.post.uniforms.uInk.value[CLASS[cls]].set(c);
    sky.forEach((c, i) => this.post.uniforms.uSky.value[i].set(c));
  }

  target(width, height) {
    const key = `${width}x${height}`;
    let t = this.targets.get(key);
    if (!t) {
      t = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthTexture: new THREE.DepthTexture(width, height),
      });
      this.targets.set(key, t);
    }
    return t;
  }

  /** Draws a stage at width × height art pixels into `out` (a render target) or, without one, the canvas. */
  render(stage, width, height, out = null) {
    const { scene, camera, colors } = stage;
    const now = performance.now();
    if (out || this.shadowScene !== scene || now - (this.shadowAt ?? 0) > 100) {
      this.gl.shadowMap.needsUpdate = true;
      this.shadowScene = scene;
      this.shadowAt = now;
    }
    this.setColors(colors);
    const t = this.target(width, height);
    this.gl.setRenderTarget(t);
    this.gl.clear();
    this.gl.render(scene, camera);
    const u = this.post.uniforms;
    u.tColor.value = t.texture;
    u.tDepth.value = t.depthTexture;
    u.uTexel.value.set(1 / width, 1 / height);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    this.gl.setRenderTarget(out);
    this.gl.render(this.postScene, this.postCamera);
    this.gl.setRenderTarget(null);
  }

  /** Renders a stage off screen and returns the RGBA pixels, top row first. */
  capture(stage, width, height) {
    const out = (this.captureTarget?.width === width && this.captureTarget?.height === height)
      ? this.captureTarget
      : (this.captureTarget = new THREE.WebGLRenderTarget(width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }));
    this.render(stage, width, height, out);
    const raw = new Uint8Array(width * height * 4);
    this.gl.readRenderTargetPixels(out, 0, 0, width, height, raw);
    const rows = new Uint8ClampedArray(raw.length);
    const stride = width * 4;
    for (let y = 0; y < height; y++) rows.set(raw.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
    return rows;
  }
}
