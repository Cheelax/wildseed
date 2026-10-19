import * as THREE from 'three';
import { makeCreature, animateCreature, disposeObject } from './creature.js';

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader = `
uniform sampler2D image; uniform sampler2D depth; uniform vec2 texel;
varying vec2 vUv;
void main(){
  vec3 color=texture2D(image,vUv).rgb;
  float d=texture2D(depth,vUv).x;
  float edge=0.;
  edge=max(edge,texture2D(depth,vUv+vec2(texel.x,0.)).x-d);
  edge=max(edge,texture2D(depth,vUv+vec2(0.,texel.y)).x-d);
  edge=max(edge,texture2D(depth,vUv-vec2(texel.x,0.)).x-d);
  edge=max(edge,texture2D(depth,vUv-vec2(0.,texel.y)).x-d);
  color=mix(color,vec3(.055,.085,.073),step(.018,edge)*.94);
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class HatchScene {
  constructor(canvas, onHello, onContextLost) {
    this.canvas = canvas; this.onHello = onHello;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cbd8b9');
    this.camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 30);
    this.yaw = .20; this.pitch = .18; this.zoom = 1; this.pointer = { x: 0, y: 0 };
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    this.target.depthTexture.type = THREE.UnsignedIntType;
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.Camera();
    this.post = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { image: { value: this.target.texture }, depth: { value: this.target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) } } });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.scene.add(new THREE.HemisphereLight('#fff4d5', '#7c967b', 2.4));
    const sun = new THREE.DirectionalLight('#fff2d6', 3);
    sun.position.set(-3, 7, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
    sun.shadow.camera.right = sun.shadow.camera.top = 4;
    sun.shadow.normalBias = .04; sun.shadow.bias = -.001;
    this.scene.add(sun);
    const gradient = new THREE.DataTexture(new Uint8Array([65, 135, 205, 255]), 4, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
    this.gradient = gradient;
    const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    this.groundMaterials = [mat('#657b51'), mat('#9caf78'), mat('#b6c58d'), mat('#ead7a3'), mat('#7b9465')];
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.0, .28, 48), this.groundMaterials[0]);
    ground.position.y = -.20; ground.receiveShadow = true; this.scene.add(ground);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, .055, 48), this.groundMaterials[1]);
    top.position.y = -.035; top.receiveShadow = true; this.scene.add(top);
    // Quiet, low-poly scenery keeps the face dominant and exports self-contained.
    for (let i = 0; i < 15; i++) {
      const a = i * 2.39996, r = 1.65 + (i % 3) * .14;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.06 + i % 3 * .02), this.groundMaterials[i % 2 ? 2 : 3]);
      stone.position.set(Math.sin(a) * r, .025, Math.cos(a) * r); stone.scale.y = .45; stone.castShadow = true; this.scene.add(stone);
      if (i % 3 === 0) {
        const grass = new THREE.Mesh(new THREE.ConeGeometry(.07, .25, 3), this.groundMaterials[4]);
        grass.position.set(Math.sin(a + .12) * r, .1, Math.cos(a + .12) * r); this.scene.add(grass);
      }
    }
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas.parentElement);
    this.bindControls();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; onContextLost?.(); });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  palette(genome) {
    this.materials?.forEach((material) => material.dispose());
    this.materials = genome.palette.map((color) => new THREE.MeshToonMaterial({ color, gradientMap: this.gradient }));
    // Face pixels should stay legible in shadow, using colors from the same genome.
    for (const i of [4, 6]) { this.materials[i].dispose(); this.materials[i] = new THREE.MeshBasicMaterial({ color: genome.palette[i] }); }
  }
  hatch(genome, now) {
    if (this.creature) disposeObject(this.creature);
    if (this.egg) disposeObject(this.egg);
    this.palette(genome); this.genome = genome;
    this.creature = makeCreature(genome, this.materials); this.scene.add(this.creature);
    this.egg = new THREE.Group(); this.scene.add(this.egg);
    for (let i = 0; i < 2; i++) {
      const shell = new THREE.Group();
      const geometry = new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, i ? Math.PI / 2 : 0, Math.PI / 2);
      const piece = new THREE.Mesh(geometry, this.materials[3]);
      piece.scale.set(.62, .80, .57); piece.castShadow = true; shell.add(piece);
      for (let j = 0; j < 4; j++) {
        const spot = new THREE.Mesh(new THREE.BoxGeometry(.11, .09, .04), this.materials[1]);
        spot.position.set((j - 1.5) * .16, i ? -.30 : .28, .51 - Math.abs(j - 1.5) * .035);
        shell.add(spot);
      }
      this.egg.add(shell);
    }
    this.hatchStart = now; this.reactionStart = -100; this.yaw = .20; this.pitch = .18;
    this.resize();
  }
  resize() {
    const parent = this.canvas.parentElement;
    const pixel = parent.clientWidth < 500 ? 3 : 4;
    const width = Math.max(40, Math.floor(parent.clientWidth / pixel));
    const height = Math.max(40, Math.floor(parent.clientHeight / pixel));
    this.pixel = pixel; this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = `${width * pixel}px`; this.canvas.style.height = `${height * pixel}px`;
    this.canvas.style.marginLeft = `${Math.floor((parent.clientWidth - width * pixel) / 2)}px`;
    this.canvas.style.marginTop = `${Math.floor((parent.clientHeight - height * pixel) / 2)}px`;
    this.target.setSize(width, height); this.post.uniforms.texel.value.set(1 / width, 1 / height);
    if (window.__wild) window.__wild.pixel = pixel;
    this.cameraFor(width / height);
  }
  cameraFor(aspect, yaw = this.yaw, pitch = this.pitch) {
    const half = (aspect < 1 ? 2.8 : 2.35) / this.zoom;
    this.camera.left = -half * aspect; this.camera.right = half * aspect;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.position.set(Math.sin(yaw) * 8, 3.1 + pitch * 5, Math.cos(yaw) * 8);
    this.camera.lookAt(0, 1.05, 0); this.camera.updateProjectionMatrix();
  }
  draw(time, hatchTime = time - this.hatchStart, exporting = false) {
    if (!this.creature || this.lost) return false;
    const duration = this.reduced ? .3 : 1.25;
    const progress = Math.min(1, Math.max(0, hatchTime / duration));
    this.egg.visible = progress < 1;
    this.egg.position.set(0, .80, 0);
    this.egg.rotation.z = Math.sin(progress * 34) * .10 * (1 - progress);
    const crack = Math.max(0, (progress - .43) / .57);
    this.egg.children.forEach((shell, i) => {
      shell.position.set((i ? 1 : -1) * crack * .9, crack * (i ? -.35 : .9), 0);
      shell.rotation.z = (i ? -1 : 1) * crack * 1.5;
      shell.scale.setScalar(1 - crack * .45);
    });
    const reveal = Math.max(0, Math.min(1, (progress - .5) * 2));
    this.creature.visible = reveal > 0;
    const ease = 1 - (1 - reveal) ** 3;
    this.creature.scale.setScalar(Math.max(.001, ease));
    const reactionAge = time - this.reactionStart;
    const reaction = reactionAge >= 0 && reactionAge < 1.2 ? reactionAge / 1.2 : 0;
    animateCreature(this.creature, time, reaction, exporting ? { x: 0, y: 0 } : this.pointer, this.reduced);
    this.cameraFor(this.width / this.height, exporting ? .20 : this.yaw, exporting ? .18 : this.pitch);
    this.renderer.setRenderTarget(this.target); this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.postScene, this.postCamera);
    return progress === 1;
  }
  hello(time) { this.reactionStart = time; }
  resetCamera() { this.yaw = .20; this.pitch = .18; this.zoom = 1; }
  bindControls() {
    let press = null;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.busy) return;
      press = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, distance: 0 };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      this.pointer.y = Math.max(-1, Math.min(1, 1 - (event.clientY - rect.top) / rect.height * 2));
      if (!press || this.busy) return;
      const dx = event.clientX - press.x, dy = event.clientY - press.y;
      press.distance = Math.max(press.distance, Math.hypot(dx, dy));
      this.yaw = press.yaw - dx * .009;
      this.pitch = Math.max(-.2, Math.min(.9, press.pitch + dy * .005));
    });
    this.canvas.addEventListener('pointerup', () => { if (press && press.distance < 7 && !this.busy) this.onHello(); press = null; });
    this.canvas.addEventListener('pointercancel', () => { press = null; });
    this.canvas.addEventListener('lostpointercapture', () => { press = null; });
    this.canvas.addEventListener('pointerleave', () => { this.pointer = { x: 0, y: 0 }; });
    this.canvas.addEventListener('keydown', (event) => {
      if (this.busy) return;
      const moves = { ArrowLeft: -.16, ArrowRight: .16 };
      if (event.key in moves) this.yaw += moves[event.key];
      else if (event.key === 'ArrowUp') this.pitch = Math.min(.9, this.pitch + .08);
      else if (event.key === 'ArrowDown') this.pitch = Math.max(-.2, this.pitch - .08);
      else if (event.key === 'Home') this.resetCamera();
      else if (event.key === ' ' || event.key === 'Enter') this.onHello();
      else return;
      event.preventDefault();
    });
  }
  snapshot(time, hatchTime, size = 192) {
    const old = { width: this.width, height: this.height, zoom: this.zoom };
    this.width = this.height = size; this.zoom = 1;
    this.renderer.setSize(size, size, false); this.target.setSize(size, size); this.post.uniforms.texel.value.set(1 / size, 1 / size);
    this.draw(time, hatchTime, true);
    const capture = document.createElement('canvas'); capture.width = capture.height = size;
    capture.getContext('2d').drawImage(this.canvas, 0, 0);
    this.width = old.width; this.height = old.height; this.zoom = old.zoom;
    this.renderer.setSize(old.width, old.height, false); this.target.setSize(old.width, old.height);
    this.post.uniforms.texel.value.set(1 / old.width, 1 / old.height);
    return capture;
  }
}
