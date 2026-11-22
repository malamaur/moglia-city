// Carica spike/moglia.glb in Three.js e misura download, parsing e primo frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9cbe6');
scene.add(new THREE.HemisphereLight('#dfeeff', '#6b6a4a', 1.2));
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
const sunDir = new THREE.Vector3(-0.55, 0.75, 0.38).normalize();
sun.position.copy(sunDir).multiplyScalar(4000);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -1700; sc.right = 1700; sc.top = 1700; sc.bottom = -1700; sc.near = 100; sc.far = 9000;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 4;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 20000);
camera.position.set(1800, 1500, 2200);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 40;
controls.maxDistance = 9000;
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();
let loopStarted = false;
function startLoop() {
  if (loopStarted) return;
  loopStarted = true;
  const tick = () => {
    requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();
}
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const t0 = performance.now();
fetch('../moglia.glb')
  .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
  .then((buf) => {
    const downloadedMs = performance.now() - t0;
    const tParse = performance.now();
    new GLTFLoader().parse(buf, '', (gltf) => {
      const parseMs = performance.now() - tParse;
      let triangles = 0, meshes = 0;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        meshes++;
        o.castShadow = true;
        o.receiveShadow = true;
        const g = o.geometry;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      });
      scene.add(gltf.scene);
      camera.position.set(1900, 1500, 2200);
      camera.lookAt(0, 0, 0);
      const tRender = performance.now();
      renderer.render(scene, camera);
      const firstFrameMs = performance.now() - tRender;
      window.__result = {
        sizeMB: +(buf.byteLength / 1048576).toFixed(2),
        downloadedMs: +downloadedMs.toFixed(1),
        parseMs: +parseMs.toFixed(1),
        firstFrameMs: +firstFrameMs.toFixed(1),
        totalMs: +(performance.now() - t0).toFixed(1),
        triangles: Math.round(triangles),
        meshes,
      };
      status.textContent = JSON.stringify(window.__result, null, 2) + '\n\ntrascina per ruotare · rotella per zoom';
      startLoop();
    }, (err) => {
      window.__result = { error: String((err && err.message) || err) };
      status.textContent = 'errore: ' + window.__result.error;
    });
  })
  .catch((err) => {
    window.__result = { error: String((err && err.message) || err) };
    status.textContent = 'errore: ' + window.__result.error;
  });
