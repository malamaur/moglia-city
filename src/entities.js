import * as THREE from 'three';
import { makeLabel } from './util.js';

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const glass = new THREE.MeshPhongMaterial({ color: '#1d2a33', shininess: 120, specular: 0x99aabb });
const tyre = lam('#1b1b1b'), rim = lam('#b9bcc0');
const headM = new THREE.MeshBasicMaterial({ color: '#fff6d8' }), tailM = new THREE.MeshBasicMaterial({ color: '#c01818' });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8); rimGeo.rotateZ(Math.PI / 2);

function wheel(x, z, r = 1) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(wheelGeo, tyre); t.castShadow = true; g.add(t); g.add(new THREE.Mesh(rimGeo, rim));
  g.scale.setScalar(r); g.position.set(x, 0.36 * r, z); return g;
}

export const CAR_COLORS = ['#c0392b', '#2e86c1', '#f4f6f7', '#1c2833', '#7f8c8d', '#d4ac0d', '#239b56', '#a04000', '#5b2c6f', '#e8daef', '#aab7b8', '#922b21', '#1a5276'];

export function makeVehicle(type, color) {
  const g = new THREE.Group(); const body = lam(color); const wheels = [];
  let spec;
  if (type === 'trattore') {
    const green = lam(color || '#2e7d32');
    g.add(box(1.4, 1.0, 2.2, green, 0, 1.0, 0.6));
    g.add(box(1.5, 0.15, 1.5, lam('#222'), 0, 2.9, -0.7));
    for (const [x, z] of [[-0.7, -1.2], [0.7, -1.2], [-0.7, -0.2], [0.7, -0.2]]) { const p = box(0.06, 1.4, 0.06, lam('#222'), x, 2.2, z * 0.8 - 0.3); g.add(p); }
    g.add(box(1.2, 0.8, 1.2, green, 0, 1.4, -0.7));
    g.add(box(0.12, 0.9, 0.12, lam('#333'), 0.4, 1.9, 1.3));
    const rw = [wheel(-0.85, -0.8, 2.1), wheel(0.85, -0.8, 2.1), wheel(-0.75, 1.3, 1.25), wheel(0.75, 1.3, 1.25)];
    rw.forEach(w => { w.children[0].material = lam('#151515'); w.children[1].material = lam('#d4a017'); g.add(w); wheels.push(w); });
    spec = { len: 3.6, wid: 1.9, maxV: 7, acc: 2.5, steer: 0.6, height: 3 };
  } else if (type === 'apecar') {
    g.add(box(1.3, 1.25, 1.3, body, 0, 1.0, 1.0));
    g.add(box(1.2, 0.5, 0.05, glass, 0, 1.3, 1.66));
    g.add(box(1.4, 0.45, 1.9, lam('#777'), 0, 0.75, -0.7));
    g.add(box(1.4, 0.4, 0.06, lam('#666'), 0, 1.15, -1.63));
    const w1 = wheel(0, 1.25, 0.8), w2 = wheel(-0.6, -1.0, 0.8), w3 = wheel(0.6, -1.0, 0.8);
    [w1, w2, w3].forEach(w => { g.add(w); wheels.push(w); });
    g.add(box(0.2, 0.12, 0.05, headM, 0, 0.9, 1.67));
    spec = { len: 3.2, wid: 1.4, maxV: 13, acc: 3.5, steer: 0.7, height: 1.6 };
  } else if (type === 'furgone') {
    g.add(box(1.95, 1.7, 4.8, body, 0, 1.3, 0));
    g.add(box(1.8, 0.6, 0.05, glass, 0, 1.75, 2.41));
    g.add(box(0.05, 0.5, 0.9, glass, 0.98, 1.75, 1.7)); g.add(box(0.05, 0.5, 0.9, glass, -0.98, 1.75, 1.7));
    for (const [x, z] of [[-0.85, 1.6], [0.85, 1.6], [-0.85, -1.6], [0.85, -1.6]]) { const w = wheel(x, z); g.add(w); wheels.push(w); }
    g.add(box(0.35, 0.15, 0.05, headM, 0.65, 0.85, 2.41)); g.add(box(0.35, 0.15, 0.05, headM, -0.65, 0.85, 2.41));
    g.add(box(0.2, 0.3, 0.05, tailM, 0.8, 0.9, -2.41)); g.add(box(0.2, 0.3, 0.05, tailM, -0.8, 0.9, -2.41));
    spec = { len: 4.8, wid: 2.0, maxV: 30, acc: 5, steer: 0.55, height: 2.2 };
  } else {
    const sedan = type === 'berlina' || type === 'vigili';
    const L = sedan ? 4.5 : 3.7, Wd = sedan ? 1.8 : 1.65;
    g.add(box(Wd, 0.62, L, body, 0, 0.66, 0));
    const cabL = sedan ? 2.3 : 2.2, cz = sedan ? -0.2 : -0.25;
    g.add(box(Wd - 0.12, 0.58, cabL, glass, 0, 1.25, cz));
    g.add(box(Wd - 0.1, 0.08, cabL - 0.25, body, 0, 1.58, cz - 0.05));
    for (const sx of [1, -1]) g.add(box(0.06, 0.58, 0.12, body, sx * (Wd / 2 - 0.07), 1.25, cz + cabL / 2 - 0.1));
    const wz = L / 2 - 0.75;
    for (const [x, z] of [[-Wd / 2 + 0.15, wz], [Wd / 2 - 0.15, wz], [-Wd / 2 + 0.15, -wz], [Wd / 2 - 0.15, -wz]]) { const w = wheel(x, z); g.add(w); wheels.push(w); }
    g.add(box(0.38, 0.14, 0.05, headM, 0.55, 0.75, L / 2 + 0.01)); g.add(box(0.38, 0.14, 0.05, headM, -0.55, 0.75, L / 2 + 0.01));
    g.add(box(0.36, 0.14, 0.05, tailM, 0.58, 0.78, -L / 2 - 0.01)); g.add(box(0.36, 0.14, 0.05, tailM, -0.58, 0.78, -L / 2 - 0.01));
    g.add(box(Wd + 0.04, 0.16, 0.16, lam('#2a2a2a'), 0, 0.4, L / 2 - 0.05)); g.add(box(Wd + 0.04, 0.16, 0.16, lam('#2a2a2a'), 0, 0.4, -L / 2 + 0.05));
    if (type === 'vigili') {
      g.add(box(Wd + 0.02, 0.18, L - 0.6, lam('#1f5fa8'), 0, 0.72, 0));
      const bar = new THREE.Group(); bar.position.set(0, 1.7, cz);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.25), new THREE.MeshBasicMaterial({ color: '#1e6bff' })); bl.position.x = -0.3;
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.25), new THREE.MeshBasicMaterial({ color: '#1e6bff' })); br.position.x = 0.3;
      bar.add(bl, br); g.add(bar); g.userData.siren = [bl, br];
    }
    spec = sedan ? { len: 4.5, wid: 1.8, maxV: 46, acc: 8.5, steer: 0.6, height: 1.6 } : { len: 3.7, wid: 1.65, maxV: 38, acc: 7.5, steer: 0.65, height: 1.6 };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.wheels = wheels;
  return { mesh: g, spec, type };
}

const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d2b8'];
const SHIRT = ['#c0392b', '#2471a3', '#f4d03f', '#27ae60', '#ecf0f1', '#8e44ad', '#e67e22', '#34495e', '#16a085', '#d35400', '#7b241c'];
const PANTS = ['#2c3e50', '#1b2631', '#5d6d7e', '#784212', '#283747', '#212f3c'];
const HAIR = ['#2b1d14', '#5a3b22', '#a87a43', '#d0cfcb', '#111', '#7a4a1f'];

export function makePerson(rand, opts = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const g = new THREE.Group();
  const skin = lam(opts.skin || pick(SKIN)), shirt = lam(opts.shirt || pick(SHIRT)), pants = lam(opts.pants || pick(PANTS)), hair = lam(opts.hair || pick(HAIR));
  const s = opts.scale || (0.92 + rand() * 0.16);
  const mk = (w, h, d, m, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y; b.castShadow = true; return b; };
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.13, 0.9, 0); legR.position.set(0.13, 0.9, 0);
  legL.add(mk(0.2, 0.88, 0.22, pants, -0.44)); legR.add(mk(0.2, 0.88, 0.22, pants, -0.44));
  const shoeM = lam('#2a2018'); const shL = mk(0.22, 0.1, 0.32, shoeM, -0.86); shL.position.z = 0.05; legL.add(shL); const shR = shL.clone(); legR.add(shR);
  const torso = mk(0.5, 0.68, 0.3, shirt, 1.25);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.33, 1.55, 0); armR.position.set(0.33, 1.55, 0);
  armL.add(mk(0.15, 0.62, 0.17, shirt, -0.3)); armR.add(mk(0.15, 0.62, 0.17, shirt, -0.3));
  const hL = mk(0.13, 0.13, 0.13, skin, -0.66); armL.add(hL); armR.add(hL.clone());
  const head = new THREE.Group(); head.position.y = 1.78;
  head.add(mk(0.32, 0.34, 0.32, skin, 0));
  head.add(mk(0.34, 0.12, 0.34, hair, 0.16));
  const back = mk(0.34, 0.26, 0.06, hair, 0.04); back.position.z = -0.16; head.add(back);
  if (opts.cap) { head.add(mk(0.36, 0.1, 0.36, lam(opts.cap), 0.2)); const v = mk(0.3, 0.04, 0.18, lam(opts.cap), 0.15); v.position.z = 0.24; head.add(v); }
  const eyeM = lam('#111'); for (const x of [-0.08, 0.08]) { const e = mk(0.05, 0.05, 0.02, eyeM, 0.03); e.position.set(x, 0.03, 0.165); head.add(e); }
  g.add(legL, legR, torso, armL, armR, head);
  g.scale.setScalar(s);
  g.userData = { legL, legR, armL, armR, head, torso, phase: rand() * 6 };
  return g;
}

export function animatePerson(g, speed, dt, airborne = false) {
  const u = g.userData;
  u.phase += dt * (2 + speed * 3.2);
  const amp = Math.min(0.9, speed * 0.28);
  const s = Math.sin(u.phase) * amp;
  if (airborne) { u.legL.rotation.x = -0.5; u.legR.rotation.x = 0.3; u.armL.rotation.x = -2.4; u.armR.rotation.x = -2.4; return; }
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.9; u.armR.rotation.x = s * 0.9;
  u.armL.rotation.z = 0; u.armR.rotation.z = 0;
  u.torso.position.y = 1.25 + Math.abs(Math.cos(u.phase)) * amp * 0.06;
}

export function speechBubble(text) {
  const s = makeLabel(text, { size: 38, scale: 0.035, bg: 'rgba(255,255,255,0.95)', color: '#1a1a1a', depthTest: false });
  s.renderOrder = 10; return s;
}
