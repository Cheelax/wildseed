import * as THREE from 'three';
import { buildCreature } from './creatures.js';

export const PIXEL = 4;
export const HATCH_SECONDS = 0.85;

export function createScene(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.domElement.dataset.testid = 'scene'; renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Creature diorama. Drag or use left and right arrows to turn; tap or press Enter to greet.');
  renderer.domElement.style.imageRendering = 'pixelated'; host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#dce7d2');
  const camera = new THREE.OrthographicCamera(-3, 3, 2.3, -2.3, 0.1, 30);
  const light = new THREE.DirectionalLight('#fff2cf', 3.1); light.position.set(-3, 7, 5); light.castShadow = true;
  light.shadow.mapSize.set(512, 512); light.shadow.camera.left = -4; light.shadow.camera.right = 4; light.shadow.camera.top = 4; light.shadow.camera.bottom = -4;
  light.shadow.bias = -0.001; scene.add(light, new THREE.HemisphereLight('#f5f4dd', '#52694c', 2));
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.28, 48), new THREE.MeshToonMaterial({ color: '#8caa77' }));
  ground.position.y = -0.18; ground.receiveShadow = true; scene.add(ground);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.36, 0.12, 48), new THREE.MeshToonMaterial({ color: '#647d59' })); ring.position.y = -0.38; scene.add(ring);
  for (let i = 0; i < 16; i++) {
    const theta = i * Math.PI * 2 / 16;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + i % 3 * 0.02), new THREE.MeshToonMaterial({ color: i % 2 ? '#c1cf9b' : '#627e59' }));
    rock.position.set(Math.cos(theta) * 1.8, 0.02, Math.sin(theta) * 1.8); scene.add(rock);
  }
  const egg = new THREE.Group();
  for (const side of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 8, 0, Math.PI * 2, side < 0 ? Math.PI / 2 : 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: side < 0 ? '#e1d8ae' : '#fff4d3' }));
    half.scale.y = 1.25; egg.add(half);
  }
  egg.position.y = 0.85; scene.add(egg);
  const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const outputScene = new THREE.Scene(), outputCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const post = new THREE.ShaderMaterial({
    uniforms: { image: { value: target.texture }, depth: { value: target.depthTexture }, texel: { value: new THREE.Vector2(1, 1) }, ink: { value: new THREE.Color('#203a32') } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D image; uniform sampler2D depth; uniform vec2 texel; uniform vec3 ink;
      void main(){float d=texture2D(depth,vUv).r; float n=min(min(texture2D(depth,vUv+vec2(texel.x,0.)).r,texture2D(depth,vUv-vec2(texel.x,0.)).r),min(texture2D(depth,vUv+vec2(0.,texel.y)).r,texture2D(depth,vUv-vec2(0.,texel.y)).r)); vec3 c=texture2D(image,vUv).rgb; gl_FragColor=vec4(d-n>0.013 ? ink : c,1.);}`,
  });
  outputScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  let creature = null, hatchAt = 0, currentTime = 0, yaw = 0, pointer = { x: 0, y: 0 }, reactionAt = -10, drag = null, interactive = true;
  let captureScene = null, captureOutput = null;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize = () => {
    const width = Math.max(64, Math.floor(host.clientWidth / PIXEL)), height = Math.max(64, Math.floor(host.clientHeight / PIXEL));
    renderer.setSize(width, height, false); renderer.domElement.style.width = `${width * PIXEL}px`; renderer.domElement.style.height = `${height * PIXEL}px`;
    target.setSize(width, height); post.uniforms.texel.value.set(1 / width, 1 / height);
    const aspect = width / height; camera.left = -2.65 * aspect; camera.right = 2.65 * aspect; camera.top = 3.0; camera.bottom = -2.3; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host); resize();
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (event) => { if (!interactive) return; drag = { x: event.clientX, start: event.clientX, yaw }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => {
    if (!interactive) return;
    const box = canvas.getBoundingClientRect(); pointer = { x: (event.clientX - box.left) / box.width * 2 - 1, y: 1 - (event.clientY - box.top) / box.height * 2 };
    if (drag) yaw = drag.yaw - (event.clientX - drag.x) * 0.012;
  });
  canvas.addEventListener('pointerup', (event) => { if (drag && Math.abs(event.clientX - drag.start) < 8) { reactionAt = currentTime; canvas.dispatchEvent(new CustomEvent('greet')); } drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('keydown', (event) => {
    if (!interactive) return;
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault(); yaw += event.code === 'ArrowLeft' ? -0.2 : 0.2; }
    if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); reactionAt = currentTime; canvas.dispatchEvent(new CustomEvent('greet')); }
  });
  return {
    canvas, pixel: PIXEL,
    setInteractive(value) { interactive = value; drag = null; canvas.setAttribute('aria-busy', String(!value)); },
    hatch(genome, time) { if (creature) { scene.remove(creature.root); creature.dispose(); } creature = buildCreature(genome); scene.add(creature.root); hatchAt = time; yaw = 0; reactionAt = -10; },
    draw(time, { exportAge = null, source = target, output = null } = {}) {
      if (exportAge === null) currentTime = time;
      const age = exportAge ?? time - hatchAt, progress = Math.min(1, Math.max(0, age / HATCH_SECONDS));
      const visible = progress > 0.58;
      if (creature) {
        creature.root.visible = visible;
        creature.update(time, { pointer: exportAge === null ? pointer : { x: 0, y: 0 }, reaction: exportAge === null ? Math.max(0, 1 - (time - reactionAt) / 0.7) : 0, reduced: reduced() });
        const grow = visible ? reduced() ? 1 : Math.min(1, (progress - 0.58) / 0.25) : 0;
        creature.root.scale.multiplyScalar(grow);
      }
      egg.visible = progress < 1;
      egg.children.forEach((half, index) => { const split = Math.max(0, (progress - 0.45) / 0.55); half.position.set((index ? 1 : -1) * split * 1.1, -split * 0.8, 0); half.rotation.z = (index ? -1 : 1) * split; });
      egg.rotation.z = progress < 0.5 && !reduced() ? Math.sin(progress * 60) * progress * 0.15 : 0;
      const angle = exportAge === null ? yaw : 0, aspect = source.width / source.height;
      camera.left = -2.65 * aspect; camera.right = 2.65 * aspect; camera.updateProjectionMatrix();
      camera.position.set(Math.sin(angle) * 7, 3.4, Math.cos(angle) * 7); camera.lookAt(0, 1, 0);
      post.uniforms.image.value = source.texture; post.uniforms.depth.value = source.depthTexture;
      post.uniforms.texel.value.set(1 / source.width, 1 / source.height);
      renderer.setRenderTarget(source); renderer.render(scene, camera);
      renderer.setRenderTarget(output); renderer.render(outputScene, outputCamera);
      return progress >= 1;
    },
    capture(time, width, height, age = HATCH_SECONDS) {
      if (renderer.getContext().isContextLost()) throw new Error('The 3D display was interrupted; reload before exporting');
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1024 || height > 1024) throw new Error('Invalid capture dimensions');
      if (!captureScene || captureScene.width !== width || captureScene.height !== height) {
        captureScene?.dispose(); captureOutput?.dispose();
        captureScene = new THREE.WebGLRenderTarget(width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
        captureScene.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
        captureOutput = new THREE.WebGLRenderTarget(width, height);
      }
      this.draw(time, { exportAge: age, source: captureScene, output: captureOutput });
      const pixels = new Uint8Array(width * height * 4), flipped = new Uint8ClampedArray(pixels.length);
      renderer.readRenderTargetPixels(captureOutput, 0, 0, width, height, pixels);
      for (let y = 0; y < height; y++) flipped.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), (height - y - 1) * width * 4);
      const image = document.createElement('canvas'); image.width = width; image.height = height;
      image.getContext('2d').putImageData(new ImageData(flipped, width, height), 0, 0);
      return image;
    },
    greet() { reactionAt = currentTime; },
  };
}
