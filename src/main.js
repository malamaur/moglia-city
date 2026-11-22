import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeVehicle, makePerson, animatePerson, speechBubble, CAR_COLORS } from './entities.js';
import { rng, canvasTex, makeLabel } from './util.js';
import { prepareLandmarks, buildLandmarks, prepareMunicipio, buildMunicipio } from './landmarks.js';

const D = JSON.parse(document.getElementById('moglia-data').textContent);
const $ = (id) => document.getElementById(id);
const R = rng(1234);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const SKY = new THREE.Color('#a9cbe6'), FOG = new THREE.Color('#d9dedf');
scene.background = SKY.clone(); scene.fog = new THREE.Fog(SKY.clone(), 220, 1500);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 5000);
const hemi = new THREE.HemisphereLight('#dfeeff', '#6b6a4a', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 600; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(-0.55, 0.75, 0.38).normalize();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

$('loadmsg').textContent = 'A fàbric le vie de Moglia…';
const LM = prepareLandmarks(D), MU = prepareMunicipio(D);
const W = buildWorld(D, scene);
const ADA = buildLandmarks(D, W, scene, LM);
const MUN = buildMunicipio(D, W, scene, MU);
for (const pl of W.places) {
  if (ADA && pl.name === 'Panificio Ada') { pl.rx = ADA.giver.x; pl.rz = ADA.giver.z; pl.label.position.set(ADA.labelPos[0], 8.6, ADA.labelPos[1]); }
  if (MUN && /^Municipio/.test(pl.name)) { pl.label.position.y = MUN.top; }
}
const gv = D.gv;
const vx = (i) => gv[i * 2], vz = (i) => gv[i * 2 + 1];

// ---------------- input ----------------
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); onKey(e.code); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
let camYaw = Math.PI, camPitch = 0.28, lastMouse = -10, camDistIdx = 0;
const canvas = renderer.domElement;
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; if (started && !document.pointerLockElement) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} } });
addEventListener('mouseup', () => dragging = false);
addEventListener('mousemove', (e) => {
  let mx = 0, my = 0;
  if (document.pointerLockElement === canvas) { mx = e.movementX; my = e.movementY; }
  else if (dragging) { mx = e.clientX - lx; my = e.clientY - ly; lx = e.clientX; ly = e.clientY; }
  if (mx || my) { camYaw -= mx * 0.0028; camPitch = clamp(camPitch + my * 0.0025, -0.25, 1.25); lastMouse = now; }
});

// touch controls
const touch = { x: 0, y: 0, active: false };
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
{
  const stick = $('stick'), knob = $('knob'); let id = null, cx = 0, cy = 0;
  stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; id = t.identifier; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; touch.active = true; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === id) { const dx = clamp((t.clientX - cx) / 50, -1, 1), dy = clamp((t.clientY - cy) / 50, -1, 1); touch.x = dx; touch.y = dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; }
      else if (t.identifier === camTouch) { camYaw -= (t.clientX - ctx0) * 0.005; camPitch = clamp(camPitch + (t.clientY - cty0) * 0.004, -0.25, 1.25); ctx0 = t.clientX; cty0 = t.clientY; lastMouse = now; }
    }
  }, { passive: false });
  addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === id) { id = null; touch.x = touch.y = 0; touch.active = false; knob.style.transform = ''; } if (t.identifier === camTouch) camTouch = null; } });
  let camTouch = null, ctx0 = 0, cty0 = 0;
  canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; camTouch = t.identifier; ctx0 = t.clientX; cty0 = t.clientY; }, { passive: true });
  $('btnE').addEventListener('touchstart', (e) => { e.preventDefault(); onKey('KeyE'); });
  const hold = (el, code) => { el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[code] = true; if (code === 'Space') onKey('Space'); }); el.addEventListener('touchend', (e) => { e.preventDefault(); keys[code] = false; }); };
  hold($('btnJ'), 'Space'); hold($('btnH'), 'KeyH');
  $('btnM').addEventListener('touchstart', (e) => { e.preventDefault(); onKey('KeyM'); });
}

// ---------------- audio ----------------
let AC = null, engOsc, engGain, engFilt, skidGain = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engOsc = AC.createOscillator(); engOsc.type = 'sawtooth';
    engFilt = AC.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 500;
    engGain = AC.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilt).connect(engGain).connect(AC.destination); engOsc.start();
    // fruscio degli pneumatici in derapata
    const nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.8;
    const ns = AC.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 5;
    skidGain = AC.createGain(); skidGain.gain.value = 0;
    ns.connect(bp).connect(skidGain).connect(AC.destination); ns.start();
  } catch (_) { AC = null; }
}
function beep(f, d, type = 'square', vol = 0.08) {
  if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.value = vol;
  g.gain.setTargetAtTime(0, AC.currentTime + d * 0.6, d * 0.2); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
}
function horn() { beep(392, 0.35, 'square', 0.06); beep(494, 0.35, 'square', 0.05); }
let muted = false;

// ---------------- vehicles ----------------
const vehicles = [];
let starterCar = null, starterLabel = null;
const TYPES = ['utilitaria', 'utilitaria', 'utilitaria', 'berlina', 'berlina', 'furgone', 'apecar', 'trattore', 'sportiva', 'camion', 'autobus', 'vigili'];
// massa indicativa in kg, usata per gli urti
const MASS = { utilitaria: 950, berlina: 1350, sportiva: 1200, furgone: 2300, apecar: 450, trattore: 3200, vigili: 1450, camion: 6500, autobus: 11000 };
function spawnVehicle(type, x, z, h) {
  const color = type === 'vigili' ? '#f4f6f7' : type === 'trattore' ? (R() < 0.5 ? '#2e7d32' : '#c0392b') : type === 'apecar' ? (R() < 0.5 ? '#2e86c1' : '#d4ac0d') : CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
  const vh = makeVehicle(type, color);
  const car = {
    ...vh, x, z, h, vf: 0, vel: new THREE.Vector2(), steer: 0, ai: null, stun: 0, honkT: 0,
    y: 0, vy: 0, air: 0, tune: 0, speed: 0, baseSpec: { ...vh.spec },
    health: 100, maxHealth: 100, mass: MASS[type] || 1000, dead: false, dmgCool: 0,
    prevVf: 0, accel: 0, slip: 0, skidT: 0, smokeT: 0, wreckT: 0,
  };
  car.origColors = (vh.mesh.userData.bodyMats || []).map((m) => m.color.getHex());
  car.mesh.position.set(x, 0, z); car.mesh.rotation.y = h; scene.add(car.mesh);
  car.mesh.userData.wheels.forEach(w => w.rotation.order = 'YXZ');
  vehicles.push(car); return car;
}
const fwd = (h) => [Math.sin(h), Math.cos(h)];
function carCircles(car) {
  const [fx, fz] = fwd(car.h); const r = car.spec.wid / 2 + 0.05, o = Math.max(0, car.spec.len / 2 - r);
  return [[car.x + fx * o, car.z + fz * o, r], [car.x, car.z, r], [car.x - fx * o, car.z - fz * o, r]];
}

// road speeds (m/s)
const ROAD_V = { primary: 13.5, secondary: 12.5, tertiary: 11, secondary_link: 10, residential: 8.3, unclassified: 10, living_street: 5, service: 5 };
const roadOf = (e) => D.roads[e.r];
function chooseNext(from, to) {
  const opts = W.adj[to].filter(e => e.to !== from);
  const list = opts.length ? opts : W.adj[to];
  if (!list.length) return null;
  // prefer going straight and staying on bigger roads
  const dx = vx(to) - vx(from), dz = vz(to) - vz(from), l = Math.hypot(dx, dz) || 1;
  let best = null, bw = -1;
  for (const e of list) {
    const ex = vx(e.to) - vx(to), ez = vz(e.to) - vz(to), el = Math.hypot(ex, ez) || 1;
    const dot = (dx * ex + dz * ez) / (l * el);
    const w = (0.4 + (dot + 1)) * (ROAD_V[roadOf(e).t] || 6) * (0.3 + R());
    if (w > bw) { bw = w; best = e; }
  }
  return best;
}
function laneTarget(a, b, off) {
  const dx = vx(b) - vx(a), dz = vz(b) - vz(a), l = Math.hypot(dx, dz) || 1;
  return [vx(b) - dz / l * off, vz(b) + dx / l * off];
}
function laneOff(e) { const r = roadOf(e); return r.o ? 0 : Math.min(r.w / 4, 1.8); }
function placeTraffic(car, minD, maxD) {
  for (let tries = 0; tries < 60; tries++) {
    const v = W.driveVerts[Math.floor(R() * W.driveVerts.length)];
    const d = Math.hypot(vx(v) - P.x, vz(v) - P.z);
    if (d < minD || d > maxD) continue;
    const e = W.adj[v][Math.floor(R() * W.adj[v].length)];
    const t = car.type;
    if (t === 'trattore' && !['unclassified', 'tertiary', 'service', 'secondary'].includes(roadOf(e).t)) continue;
    if ((t === 'camion' || t === 'autobus') && !['primary', 'secondary', 'tertiary'].includes(roadOf(e).t)) continue;
    const off = laneOff(e);
    const dx = vx(e.to) - vx(v), dz = vz(e.to) - vz(v), l = Math.hypot(dx, dz) || 1;
    car.x = vx(v) - dz / l * off; car.z = vz(v) + dx / l * off; car.h = Math.atan2(dx, dz);
    car.ai = { from: v, to: e.to, edge: e, next: chooseNext(v, e.to), block: 0 };
    car.vf = (ROAD_V[roadOf(e).t] || 6) * 0.6; car.stun = 0;
    return true;
  }
  return false;
}

// ---------------- people ----------------
const peds = [];
const townVerts = [];
{
  const tmp = [];
  for (let i = 0; i < gv.length / 2; i++) if (W.walkAdj[i].length) { W.bldGrid.query(vx(i), vz(i), 30, tmp); if (tmp.length >= 3) townVerts.push(i); }
}
function spawnPed(mesh) {
  const p = { mesh: mesh || makePerson(R), x: 0, z: 0, h: 0, ai: null, side: R() < 0.5 ? 1 : -1, speed: 1.1 + R() * 0.6, dodge: 0, dvx: 0, dvz: 0, down: 0, y: 0, vy: 0, bubbleT: 0 };
  scene.add(p.mesh); peds.push(p); return p;
}
function placePed(p, minD, maxD) {
  for (let tries = 0; tries < 60; tries++) {
    const v = townVerts[Math.floor(R() * townVerts.length)];
    const d = Math.hypot(vx(v) - P.x, vz(v) - P.z); if (d < minD || d > maxD) continue;
    const e = W.walkAdj[v][Math.floor(R() * W.walkAdj[v].length)];
    const off = pedOff(e, p);
    const [tx, tz] = laneTarget(e.to, v, -off);
    p.x = tx; p.z = tz; p.ai = { from: v, to: e.to, edge: e }; p.down = 0; p.dodge = 0; return true;
  }
  return false;
}
function pedOff(e, p) { const r = D.roads[e.r]; const isPath = ['path', 'footway', 'cycleway', 'track', 'pedestrian'].includes(r.t); return isPath ? p.side * 0.6 : p.side * (r.w / 2 + 1.0); }
const bubbles = [];
function say(obj, text, dur = 2.2) {
  if (obj.bubble) { obj.mesh.remove(obj.bubble); }
  const b = speechBubble(text); const s = obj.mesh.scale.x || 1; b.position.y = (obj.spec ? obj.spec.height + 1.6 : 2.6) / s; b.scale.multiplyScalar(1 / s);
  obj.mesh.add(b); obj.bubble = b; bubbles.push({ obj, b, t: dur });
}
const SHOUTS_DODGE = ['Ohé!', 'Ma te sé mat?!', 'Pian!', 'Ocio!', 'Va\' pian!', 'Eh là!'];
const SHOUTS_HIT = ['Ma va\' là!', 'Ahi!', 'Te gh\'è la patente?', 'Ma dai!'];
const SHOUTS_CAR = ['Ehi! La me macchina!', 'Ladro! Torna chi!', 'Ma còsa fet?!'];
const SHOUTS_HONK = ['Dai, mòvte!', 'Allora?!', 'Sveglia!'];

// ---------------- player ----------------
// Moglia Online: si sceglie l'"omino" prima di entrare in paese.
const CHARACTERS = [
  { id: 'luca', name: 'Luca', tag: 'El véloce', desc: 'El cor piö de tüti', shirt: '#1f6fb2', pants: '#2b2f38', hair: '#3a2a1c', skin: '#e9bf9b', speed: 1.15, maxHp: 100 },
  { id: 'ada', name: 'Ada', tag: 'La furnèra', desc: 'Salute de vendèmia', shirt: '#c0392b', pants: '#5d6d7e', hair: '#2b1d14', skin: '#f1c7a5', speed: 1.0, maxHp: 140 },
  { id: 'gigi', name: 'Gigi', tag: 'El mecànic', desc: 'Officina con isconto', shirt: '#d35400', pants: '#1b2631', hair: '#a87a43', skin: '#e0ac85', speed: 1.0, maxHp: 110, discount: 0.8 },
  { id: 'sara', name: 'Sara', tag: 'La turista', desc: '+200 € in scarsèla', shirt: '#34495e', pants: '#212f3c', hair: '#5a3b22', skin: '#f5d2b8', speed: 1.05, maxHp: 110, bonus: 200 },
];
let charIdx = 0, player;
function spawnPlayerMesh() {
  if (player) scene.remove(player);
  const c = CHARACTERS[charIdx];
  player = makePerson(R, { shirt: c.shirt, pants: c.pants, hair: c.hair, skin: c.skin, scale: 1.0 });
  scene.add(player);
  player.position.set(P.x, 0, P.z);
}
function selectCharacter(i) {
  charIdx = clamp(i, 0, CHARACTERS.length - 1);
  spawnPlayerMesh();
  for (const el of document.querySelectorAll('.char')) el.classList.toggle('sel', +el.dataset.i === charIdx);
  beep(700, 0.08, 'sine', 0.04);
}
const P = { x: 0, z: 0, y: 0, vy: 0, h: 0, car: null, speed: 0 };
// spawn in Piazza Matteotti, next to the Municipio
let spawnPlace = W.places.find(p => /Municipio/.test(p.name)) || { rx: 0, rz: 0 };
{
  const sq = D.roads.find(r => r.n === 'Piazza Giacomo Matteotti');
  const sx = sq ? sq.p[0] : spawnPlace.rx, sz = sq ? sq.p[1] : spawnPlace.rz;
  P.x = sx; P.z = sz;
}
// make sure player isn't inside a building
function unstick(pos, r) { for (let k = 0; k < 4; k++) W.collideCircle(pos, r); if (W.insideBuilding(pos.x, pos.z)) { const v = W.nearestDriveVert(pos.x, pos.z); pos.x = vx(v); pos.z = vz(v); } }
if (MUN) { P.x = MUN.front[0]; P.z = MUN.front[1]; P.h = MUN.faceYaw; }
unstick(P, 0.4);
spawnPlayerMesh();

// world population
function populate() {
  // parked cars along streets in town
  let parked = 0;
  const segIdx = [];
  D.roads.forEach((r, ri) => { if (['residential', 'tertiary', 'secondary', 'unclassified', 'service'].includes(r.t)) segIdx.push(ri); });
  for (let tries = 0; tries < 2000 && parked < 60; tries++) {
    const r = D.roads[segIdx[Math.floor(R() * segIdx.length)]];
    const k = Math.floor(R() * (r.p.length / 2 - 1)) * 2;
    const x0 = r.p[k], z0 = r.p[k + 1], dx = r.p[k + 2] - x0, dz = r.p[k + 3] - z0, l = Math.hypot(dx, dz); if (l < 8) continue;
    const t = 0.2 + R() * 0.6, sd = R() < 0.5 ? 1 : -1, off = r.w / 2 + 0.9;
    const x = x0 + dx * t - dz / l * off * sd, z = z0 + dz * t + dx / l * off * sd;
    if (Math.hypot(x - P.x, z - P.z) > 900) continue;
    const tmp = { x, z }; const c = W.collideCircle(tmp, 2.3); if (c.hit || W.insideBuilding(x, z)) continue;
    if (vehicles.some(v => Math.hypot(v.x - x, v.z - z) < 6)) continue;
    const type = R() < 0.07 ? 'apecar' : R() < 0.12 ? 'furgone' : R() < 0.4 ? 'berlina' : 'utilitaria';
    spawnVehicle(type, x, z, Math.atan2(dx, dz) + (R() < 0.5 ? 0 : Math.PI)); parked++;
  }
  // mezzo di trasporto subito davanti al giocatore, ben visibile
  {
    const [fx, fz] = fwd(P.h);
    let x = P.x + fx * 4.5, z = P.z + fz * 4.5;
    if (W.insideBuilding(x, z)) {
      const v = W.nearestDriveVert(P.x, P.z); const e = W.adj[v][0];
      const off = 2.8; [x, z] = e ? laneTarget(v, e.to, off) : [P.x + 4, P.z];
    }
    const car = spawnVehicle('berlina', x, z, P.h + Math.PI);
    for (const m of car.mesh.userData.bodyMats || []) m.color.set('#ffb020');
    const pos = { x: car.x, z: car.z }; W.collideCircle(pos, 1.4); car.x = pos.x; car.z = pos.z;
    car.mesh.position.set(car.x, 0, car.z);
    starterCar = car;
    starterLabel = makeLabel('🚗 E per salire', { size: 34, scale: 0.014, bg: 'rgba(20,24,30,.86)', color: '#fff', depthTest: false });
    starterLabel.position.y = car.spec.height + 1.8;
    car.mesh.add(starterLabel);
  }
  for (let i = 0; i < 38; i++) { const c = spawnVehicle(TYPES[Math.floor(R() * TYPES.length)], 0, 0, 0); placeTraffic(c, 25, 420); }
  for (let i = 0; i < 55; i++) { const p = spawnPed(); placePed(p, 8, 260); }
}
populate();

// ---------------- missions ----------------
const placeByName = (re) => W.places.find(p => re.test(p.name));
const DESTS = W.places.filter(p => !/Panificio Ada/.test(p.name));
const missionBeaconMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
function makeBeacon(color, h = 40, r = 2.6) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), missionBeaconMat(color)); cyl.position.y = h / 2; g.add(cyl);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r + 0.3, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; g.add(ring);
  scene.add(g); return g;
}
const givers = [];
function addGiver(id, title, color, x, z, desc) {
  const b = makeBeacon(color, 18, 2.2); b.position.set(x, 0, z);
  const lab = (() => { const s = speechBubble(title); s.position.y = 6; s.material.depthTest = true; b.add(s); return s; })();
  givers.push({ id, title, color, x, z, beacon: b, desc, lab });
}
{
  const ada = placeByName(/Panificio Ada/);
  if (ada) addGiver('pane', '🥖 Panificio Ada', '#ffb020', ada.rx, ada.rz, 'Consegne del pane');
  const mz = D.roads.find(r => r.n === 'Piazza Guglielmo Marconi');
  const tx = mz ? mz.p[0] : P.x + 20, tz = mz ? mz.p[1] : P.z;
  addGiver('taxi', '🚕 Taxi di Moglia', '#2ecc71', tx, tz, 'Accompagna i clienti');
  const lib = D.roads.find(r => r.n === 'Piazza della Libertà');
  addGiver('giro', '🏁 Giro di Moglia', '#e74c3c', lib ? lib.p[0] : P.x - 30, lib ? lib.p[1] : P.z, 'Gara a tappe');
}
let mission = null; let money = 0; try { money = +localStorage.getItem('moglia_money') || 0; } catch (_) {}
const targetBeacon = makeBeacon('#3fa9ff', 60, 3.2); targetBeacon.visible = false;
let passenger = null;

function startMission(g) {
  const near = (p) => Math.hypot(p.rx - P.x, p.rz - P.z);
  if (g.id === 'pane') {
    const cands = DESTS.filter(p => near(p) > 120 && near(p) < 1600);
    const d = cands[Math.floor(R() * cands.length)] || DESTS[0];
    const dist = near(d);
    mission = { id: 'pane', title: 'Consegna del pan', steps: [{ x: d.rx, z: d.rz, text: `Porta el pan cald a: ${d.name}` }], time: Math.round(dist / 9 + 25), reward: Math.round(40 + dist / 12) };
    toast('🥖 Pan cargà! Portel a ' + d.name);
  } else if (g.id === 'taxi') {
    let pv; for (let k = 0; k < 50; k++) { pv = townVerts[Math.floor(R() * townVerts.length)]; const d = Math.hypot(vx(pv) - P.x, vz(pv) - P.z); if (d > 150 && d < 550) break; }
    const dv = W.nearestDriveVert(vx(pv), vz(pv));
    const cands = DESTS.filter(p => Math.hypot(p.rx - vx(dv), p.rz - vz(dv)) > 250);
    const d = cands[Math.floor(R() * cands.length)] || DESTS[0];
    const dist = Math.hypot(vx(dv) - P.x, vz(dv) - P.z) + Math.hypot(d.rx - vx(dv), d.rz - vz(dv));
    mission = { id: 'taxi', title: 'Taxi de Moglia', needCar: true, steps: [{ x: vx(dv), z: vz(dv), text: 'Va a tòr el client', pickup: true }, { x: d.rx, z: d.rz, text: `Porta el client a: ${d.name}` }], time: Math.round(dist / 8 + 30), reward: Math.round(60 + dist / 8) };
    passenger = spawnPed(makePerson(R)); passenger.ai = null; passenger.x = vx(dv) + 3; passenger.z = vz(dv); passenger.waiting = true;
    toast('🚕 Un client te speta! Te serve n\'auto.');
  } else if (g.id === 'giro') {
    const cx = 0, cz = 0;
    const pts = DESTS.map(p => ({ p, a: Math.atan2(p.rz - cz, p.rx - cx) })).sort((a, b) => a.a - b.a);
    const pick = []; const seen = new Set();
    for (const q of pts) { const k = Math.round(q.p.rx / 60) + ',' + Math.round(q.p.rz / 60); if (!seen.has(k)) { seen.add(k); pick.push(q.p); } }
    let start = 0, bd = 1e9; pick.forEach((p, i) => { const d = Math.hypot(p.rx - P.x, p.rz - P.z); if (d < bd) { bd = d; start = i; } });
    const seq = []; for (let i = 0; i < Math.min(7, pick.length); i++) seq.push(pick[(start + 1 + i) % pick.length]);
    let dist = 0, px = P.x, pz = P.z; for (const s of seq) { dist += Math.hypot(s.rx - px, s.rz - pz); px = s.rx; pz = s.rz; }
    mission = { id: 'giro', title: 'Giro de Moglia', needCar: false, steps: seq.map((s, i) => ({ x: s.rx, z: s.rz, text: `Tapa ${i + 1}/${seq.length}: ${s.name}` })), time: Math.round(dist / 13 + 30), reward: Math.round(100 + dist / 6) };
    toast('🏁 Via! Passa da tute le tape prima che \'l temp el scada.');
  }
  mission.step = 0; mission.left = mission.time; mission.giver = g;
  givers.forEach(gg => gg.beacon.visible = false);
  beep(660, 0.15); beep(880, 0.2);
}
function endMission(ok, msg) {
  if (ok) { addMoney(mission.reward); stats.missions++; beep(784, 0.15); setTimeout(() => beep(1046, 0.3), 140); }
  else beep(200, 0.5, 'sawtooth');
  toast(msg, 3500);
  if (passenger) { const p = passenger; passenger = null; p.waiting = false; if (P.car && p.inCar) { p.inCar = false; p.mesh.visible = true; const [fx, fz] = fwd(P.car.h); p.x = P.car.x + fz * 2; p.z = P.car.z - fx * 2; } placePed(p, 0, 1e9) || 0; p.x = p.x; }
  mission = null; targetBeacon.visible = false;
  givers.forEach(gg => gg.beacon.visible = true);
}
function updateMission(dt) {
  if (!mission) {
    for (const g of givers) {
      const d = Math.hypot(g.x - P.x, g.z - P.z);
      if (d < 3.5 && !g.cool) { startMission(g); g.cool = true; }
      if (d > 8) g.cool = false;
    }
    return;
  }
  mission.left -= dt;
  const st = mission.steps[mission.step];
  targetBeacon.visible = true; targetBeacon.position.set(st.x, 0, st.z);
  if (mission.left <= 0) return endMission(false, '⏱️ Temp scadù! Mission falida.');
  const d = Math.hypot(st.x - P.x, st.z - P.z);
  if (st.pickup && passenger && !passenger.inCar) {
    if (d < 8) {
      if (!P.car) { hint('Te serve n\'auto per el client!'); return; }
      if (P.car.speed > 2) { hint('Férmte per fàr salì el client'); return; }
      passenger.inCar = true; passenger.mesh.visible = false; say(P.car, 'Bondì! Andèm?', 2); mission.step++; beep(700, 0.12);
    }
    return;
  }
  if (d < (P.car ? 7 : 4)) {
    if (mission.id === 'taxi' && P.car && P.car.speed > 2) { hint('Férmte per fàr scénd el client'); return; }
    mission.step++;
    beep(880, 0.12);
    if (mission.step >= mission.steps.length) {
      const bonus = Math.round(mission.left * 1.5); mission.reward += bonus;
      return endMission(true, `✅ ${mission.title} fata! +${mission.reward} € (bonus temp ${bonus} €)`);
    }
    toast(mission.steps[mission.step].text, 2000);
  }
}

// =====================================================================
//  FUNZIONI IN STILE GTA V
// =====================================================================

// ---- statistiche e obiettivi ----
const stats = { km: 0, missions: 0, stunts: 0, panini: 0, crimes: 0, escapes: 0, busted: 0, earned: 0, tuned: 0 };
function addMoney(n) { money += n; if (n > 0) stats.earned += n; try { localStorage.setItem('moglia_money', money); } catch (_) {} }
const ACHIEVEMENTS = [
  { id: 'first', name: 'Prima consegna', desc: 'Completa na mission', test: () => stats.missions >= 1 },
  { id: 'pro', name: 'Tüt fà', desc: 'Completa 5 mission', test: () => stats.missions >= 5 },
  { id: 'panini10', name: 'Paninèr', desc: 'Cata 10 panin', test: () => stats.panini >= 10 },
  { id: 'panini20', name: 'Fam de Moglia', desc: 'Cata tüti i 20 panin', test: () => stats.panini >= 20 },
  { id: 'stunt1', name: 'Acrobata', desc: 'Fà un salt acrobàtic', test: () => stats.stunts >= 1 },
  { id: 'stunt3', name: 'Cascadùr', desc: 'Fà 3 salt acrobàtic difarènt', test: () => stats.stunts >= 3 },
  { id: 'wanted3', name: 'Ricercà', desc: 'Riva a 3 stèle de ricercà', test: () => wanted.level >= 3 },
  { id: 'escape', name: 'Fantasma', desc: 'Semina la Polizia Locale', test: () => stats.escapes >= 1 },
  { id: 'km5', name: 'Turista', desc: 'Fà 5 km in auto', test: () => stats.km >= 5 },
  { id: 'tune3', name: 'Elaborà', desc: 'Porta un motor al livèl 3', test: () => stats.tuned >= 3 },
];
function checkAchievements() {
  for (const a of ACHIEVEMENTS) if (!a.got && a.test()) {
    a.got = true; toast('🏆 Obietiv sblocà: ' + a.name, 3200);
    beep(1046, 0.12); setTimeout(() => beep(1318, 0.22), 130);
  }
}

// ---- salute e armatura ----
let hp = 100, armor = 0, maxHp = 100;
function damagePlayer(n) {
  if (n <= 0) return;
  if (armor > 0) { const a = Math.min(armor, n); armor -= a; n -= a; }
  hp = Math.max(0, hp - n);
  if (n > 2) { flash('rgba(200,30,30,.35)'); beep(120, 0.12, 'square', 0.08); }
  if (hp <= 0) ko();
}
function ko() {
  const loss = Math.min(money, 100); money -= loss;
  if (P.car) { P.car.vf = 0; P.car.vel.set(0, 0); P.car = null; player.visible = true; }
  hp = maxHp; armor = 0;
  const f = MUN ? MUN.front : [P.x, P.z];
  P.x = f[0]; P.z = f[1]; P.y = 0; P.vy = 0; unstick(P, 0.4);
  clearWanted(true);
  flash('rgba(0,0,0,.85)', '💀 Te s\'è svenù. Te s\'è sveglià in Piazza Matteotti (−' + loss + ' €)');
  beep(160, 0.6, 'sawtooth', 0.15);
  try { localStorage.setItem('moglia_money', money); } catch (_) {}
}
let flashT = 0;
function flash(bg, msg) {
  const el = $('flash'); if (!el) return;
  el.style.background = bg; el.classList.add('on');
  const m = $('flashmsg'); m.textContent = msg || ''; m.style.opacity = msg ? 1 : 0;
  flashT = msg ? 2.4 : 0.18;
}

// ---- ricercato e Polizia Locale ----
const wanted = { level: 0, cool: 0, bustT: 0 };
const cops = [];
let lastSiren = 0;
function setWanted(n) {
  if (n <= 0) return;
  wanted.level = clamp(wanted.level + n, 0, 5);
  wanted.cool = 14; stats.crimes++;
  syncCops();
  toast('🚨 Ricercà: ' + '★'.repeat(wanted.level), 1800);
  beep(920, 0.12); beep(1150, 0.12);
}
function clearWanted(silent) {
  const had = wanted.level > 0;
  wanted.level = 0; wanted.cool = 0; wanted.bustT = 0;
  for (const c of cops) c.gone = true;
  cops.length = 0;
  if (!silent && had) { toast('✅ Ricercà a zéro', 1600); beep(700, 0.1); }
}
function syncCops() {
  for (let i = cops.length - 1; i >= 0; i--) if (cops[i].gone) cops.splice(i, 1);
  const want = Math.min(4, wanted.level);
  while (cops.length < want) {
    let c = null;
    for (let t = 0; t < 4 && !c; t++) c = spawnCop();
    if (!c) break;
    cops.push(c);
  }
  while (cops.length > want) cops.pop().gone = true;
}
function spawnCop() {
  let best = -1, bd = 1e9;
  for (let k = 0; k < 140; k++) {
    const v = W.driveVerts[Math.floor(R() * W.driveVerts.length)];
    const d = Math.hypot(vx(v) - P.x, vz(v) - P.z);
    if (d < 70 || d > 240) continue;
    const score = Math.abs(d - 130);
    if (score < bd) { bd = score; best = v; }
  }
  if (best < 0) return null;
  const e = W.adj[best][Math.floor(R() * W.adj[best].length)];
  const x = vx(best), z = vz(best);
  const car = spawnVehicle('vigili', x, z, e ? Math.atan2(vx(e.to) - x, vz(e.to) - z) : 0);
  car.cop = true; car.ai = null; car.vf = 0; car.speed = 0;
  return car;
}
function placeCopNear(car) {
  const v = W.nearestDriveVert(P.x, P.z);
  const e = W.adj[v] && W.adj[v][0];
  if (!e) return;
  const [tx, tz] = laneTarget(v, e.to, 3);
  car.x = tx; car.z = tz; car.h = Math.atan2(vx(e.to) - vx(v), vz(e.to) - vz(v));
  car.vf = 0; car.stun = 0; car.y = 0; car.vy = 0;
}
function updateCop(car, dt) {
  const dx = P.x - car.x, dz = P.z - car.z, d = Math.hypot(dx, dz);
  if (d > 340) { placeCopNear(car); return; }
  const want = Math.atan2(dx, dz), dh = wrap(want - car.h);
  const turn = (1.8 + Math.min(2.2, car.vf * 0.06)) * dt;
  car.h += clamp(dh, -turn, turn);
  let target = d < 7 ? 0 : Math.min(31, 10 + d * 0.09);
  if (Math.abs(dh) > 1.2) target = Math.min(target, 7);
  car.vf += clamp(target - car.vf, -18 * dt, 12 * dt);
  advanceCarKinematic(car, dt);
  if (car.y < 1) collideCar(car, false);
  if (d < 6.5 && !P.car && car.vf < 5) {
    wanted.bustT += dt;
    if (wanted.bustT > 1.5) getBusted();
  } else if (d > 9) wanted.bustT = Math.max(0, wanted.bustT - dt * 2);
}
function updateWanted(dt) {
  if (wanted.level <= 0) { wanted.bustT = 0; return; }
  if (now - lastSiren > 1.1) { lastSiren = now; beep(760 + (Math.floor(now * 2) % 2) * 240, 0.18, 'square', 0.03); }
  wanted.topT = (wanted.topT || 0) - dt;
  if (wanted.topT <= 0) {
    wanted.topT = 2;
    const want = Math.min(4, wanted.level);
    let alive = 0; for (const c of cops) if (!c.gone) alive++;
    if (alive < want) syncCops();
  }
  let near = false;
  for (const c of cops) if (!c.gone && Math.hypot(c.x - P.x, c.z - P.z) < 55) near = true;
  if (near) { wanted.cool = Math.max(wanted.cool, 6); return; }
  wanted.cool -= dt;
  if (wanted.cool > 0) return;
  wanted.level--;
  if (wanted.level <= 0) {
    stats.escapes++;
    for (const c of cops) c.gone = true;
    cops.length = 0;
    toast('🕶️ Te i è seminar! Ricercà a zéro', 2600);
    beep(700, 0.15); setTimeout(() => beep(980, 0.2), 140);
  } else {
    wanted.cool = 14; syncCops();
    toast('🚨 Ricercà: ' + '★'.repeat(wanted.level), 1500);
  }
}
function getBusted() {
  const fine = Math.min(money, 80 * Math.max(1, wanted.level));
  money -= fine; stats.busted++;
  if (P.car) { P.car.vf = 0; P.car.vel.set(0, 0); P.car = null; player.visible = true; }
  clearWanted(true);
  const f = MUN ? MUN.front : [P.x, P.z];
  P.x = f[0]; P.z = f[1]; P.y = 0; P.vy = 0; unstick(P, 0.4);
  flash('rgba(0,0,0,.82)', '🚔 Arrestà da la Polizia Locale. Multa: ' + fine + ' €');
  beep(180, 0.5, 'sawtooth', 0.15);
  try { localStorage.setItem('moglia_money', money); } catch (_) {}
}

// ---- radio ----
const STATIONS = [
  { name: 'Radio Bassa', bpm: 108, kind: 'folk' },
  { name: 'Moglia FM', bpm: 122, kind: 'pop' },
  { name: 'Riso Dance', bpm: 128, kind: 'dance' },
];
let station = -1, radioNextT = 0, radioStep = 0, radioBus = null, noiseBuf = null;
function ensureRadio() {
  if (!AC || radioBus) return;
  radioBus = AC.createGain(); radioBus.gain.value = 0; radioBus.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.4), AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function rnote(midi, t, dur, type, vol, cutoff) {
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  f.type = 'lowpass'; f.frequency.value = cutoff || 1600;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(radioBus); o.start(t); o.stop(t + dur + 0.02);
}
function rdrum(kind, t, vol) {
  if (kind === 'kick') {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(radioBus); o.start(t); o.stop(t + 0.18); return;
  }
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const g = AC.createGain(), f = AC.createBiquadFilter();
  f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 7000;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'snare' ? 0.16 : 0.05));
  s.connect(f); f.connect(g); g.connect(radioBus); s.start(t); s.stop(t + 0.2);
}
const BASS_PAT = [0, 7, 0, 7, 5, 0, 7, 3];
function scheduleStep(kind, i, t) {
  const bar = Math.floor(i / 16), b = i % 16;
  const roots = kind === 'folk' ? [48, 53, 55, 48] : kind === 'dance' ? [45, 45, 48, 43] : [48, 45, 41, 43];
  const root = roots[bar % roots.length];
  if (b % 8 === 0) rdrum('kick', t, 0.32);
  if (b % 8 === 4) rdrum('snare', t, 0.16);
  if (b % 2 === 0) rdrum('hat', t, kind === 'dance' ? 0.05 : 0.035);
  if (b % 4 === 0) rnote(root - 12, t, 0.24, kind === 'folk' ? 'triangle' : 'sawtooth', 0.09, 600);
  if (kind === 'folk') {
    if (b % 4 === 0) rnote(root + 12 + [0, 4, 7][bar % 3], t, 0.2, 'triangle', 0.045, 1100);
    if (b === 6 || b === 14) rnote(root + 19, t, 0.15, 'triangle', 0.035, 1200);
  } else {
    if (b % 4 === 2) rnote(root + BASS_PAT[(bar + (b >> 2)) % 8], t, 0.16, 'square', 0.03, 900);
    if (b % 4 === 0) rnote(root + [12, 16, 19, 14][(bar + b / 4) % 4], t, 0.3, kind === 'dance' ? 'sawtooth' : 'square', 0.032, 1300);
    if (b === 10) rnote(root + 24, t, 0.2, 'triangle', 0.028, 1600);
  }
  if (kind === 'dance' && b % 4 === 1) rnote(root - 12, t, 0.12, 'sawtooth', 0.055, 500);
}
function radioTick() {
  if (!AC) return;
  ensureRadio(); if (!radioBus) return;
  const inCar = !!P.car;
  radioBus.gain.setTargetAtTime(inCar && station >= 0 && !muted ? 0.13 : 0, AC.currentTime, 0.08);
  if (!inCar || station < 0 || muted) return;
  const s = STATIONS[station], spb = 60 / s.bpm / 4;
  if (radioNextT < AC.currentTime) radioNextT = AC.currentTime + 0.06;
  let guard = 0;
  while (radioNextT < AC.currentTime + 0.2 && guard++ < 40) {
    try { scheduleStep(s.kind, radioStep, radioNextT); } catch (_) { /* la radio non deve mai fermare il gioco */ }
    radioNextT += spb; radioStep = (radioStep + 1) % 64;
  }
}
function radioSwitch(dir = 1) {
  if (!P.car) { hint('La radio la se sent sól in auto'); return; }
  if (AC && AC.state === 'suspended') AC.resume();
  station = (station + dir + STATIONS.length) % STATIONS.length;
  radioNextT = (AC ? AC.currentTime : 0) + 0.05; radioStep = 0;
  toast('📻 ' + STATIONS[station].name, 1600);
  beep(660, 0.08, 'sine', 0.05); beep(880, 0.1, 'sine', 0.05);
  const el = $('radio'); if (el) el.textContent = '📻 ' + STATIONS[station].name;
}

// ---- ciclo giorno/notte ----
let tod = 9.5, clockT = 0;
const DAY_SECONDS = 720;
const skyNow = new THREE.Color('#a9cbe6');
const SKY_KEYS = [[0, '#0b1424'], [5, '#182338'], [6.6, '#e89a63'], [8, '#a9cbe6'], [16.5, '#a9cbe6'], [18.4, '#e88a55'], [19.6, '#222c44'], [24, '#0b1424']].map(([h, c]) => [h, new THREE.Color(c)]);
function skyAt(t) {
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const [h0, c0] = SKY_KEYS[i], [h1, c1] = SKY_KEYS[i + 1];
    if (t >= h0 && t <= h1) return skyNow.copy(c0).lerp(c1, (t - h0) / (h1 - h0));
  }
  return skyNow.set('#0b1424');
}
function updateDayNight(dt) {
  tod = (tod + dt * 24 / DAY_SECONDS) % 24;
  const a = (tod - 6) / 12 * Math.PI, alt = Math.sin(a);
  sunDir.set(Math.cos(a) * 0.8, Math.max(0.12, alt), 0.45).normalize();
  const day = clamp(alt, 0, 1);
  sun.intensity = 0.06 + day * 1.95;
  sun.color.setHSL(0.11, 0.32 + (1 - day) * 0.3, 0.55 + day * 0.35);
  hemi.intensity = 0.25 + day * 0.85;
  if (foggy) { sun.intensity *= 0.35; hemi.intensity = Math.max(hemi.intensity, 1.35); }
  skyAt(tod);
  if (now - clockT > 0.25) {
    clockT = now;
    const hh = Math.floor(tod), mm = Math.floor((tod % 1) * 60);
    const el = $('clock');
    if (el) el.textContent = (tod < 6 || tod > 20 ? '🌙 ' : '☀️ ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
}

// ---- officina ----
// posizione e nome dell'officina: dai dati OpenStreetMap se presenti,
// altrimenti dal punto indicato dal progetto (vedi docs/PROGETTO.md).
function findOsmPlace(re) {
  for (const p of D.pois) if (p.n && re.test(p.n)) return { n: p.n, x: p.x, z: p.z, a: p.a };
  for (const b of W.blds) if (b.n && re.test(b.n)) return { n: b.n, x: b.cx, z: b.cz, a: 'building' };
  return null;
}
const GARAGE_OSM = findOsmPlace(/officina|gasparini|meccanico|autoriparazion|car\s?repair|garage/i);
const garageBase = GARAGE_OSM || (() => {
  const mz = D.roads.find(r => r.n === 'Piazza Guglielmo Marconi');
  return { n: 'Officina Gasparini', x: mz ? mz.p[0] : P.x, z: mz ? mz.p[1] : P.z };
})();
const garage = (() => {
  const v = W.nearestDriveVert(garageBase.x, garageBase.z);
  const p = { x: vx(v), z: vz(v) };
  W.collideCircle(p, 1.2);
  return { x: p.x, z: p.z, name: garageBase.n, osm: !!GARAGE_OSM };
})();
{
  const b = makeBeacon('#2ec4b6', 14, 1.8); b.position.set(garage.x, 0, garage.z);
  const lab = speechBubble('🔧 ' + garage.name); lab.position.y = 5.4; lab.scale.multiplyScalar(0.4); b.add(lab);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.08, 24), new THREE.MeshBasicMaterial({ color: '#2ec4b6', transparent: true, opacity: 0.18, depthWrite: false }));
  pad.position.set(garage.x, 0.11, garage.z); scene.add(pad);
}
let garageOpen = false;
function nearGarage() { return !!P.car && Math.hypot(P.car.x - garage.x, P.car.z - garage.z) < 8; }
function openGarage() {
  if (!P.car) return;
  garageOpen = true; $('garage').style.display = 'block';
  if (document.exitPointerLock) document.exitPointerLock();
  updateGarageUI();
}
function closeGarage() { garageOpen = false; $('garage').style.display = 'none'; }
function paintCar(car, hex) {
  if (!car || !car.mesh) return;
  for (const m of car.mesh.userData.bodyMats || []) m.color.set(hex);
  car.origColors = (car.mesh.userData.bodyMats || []).map((m) => m.color.getHex());
}
function tuneCar(car, lvl) {
  if (!car) return;
  car.tune = clamp(lvl, 0, 3);
  const b = car.baseSpec;
  car.spec = { ...b, maxV: b.maxV * (1 + 0.14 * car.tune), acc: b.acc * (1 + 0.14 * car.tune) };
  stats.tuned = Math.max(stats.tuned, car.tune);
}
const mechMul = () => CHARACTERS[charIdx].discount || 1;
const paintCost = () => Math.round(50 * mechMul());
const tuneCost = () => Math.round(150 * mechMul());
const repairCost = () => Math.round((30 + (P.car ? (100 - P.car.health) * 0.6 : 0)) * mechMul());
function updateGarageUI() {
  if (!P.car) return;
  const names = { utilitaria: 'Utilitaria', berlina: 'Berlina', sportiva: 'Sportiva', furgone: 'Furgon', camion: 'Camion', autobus: 'Autobus', apecar: 'Motocar', trattore: 'Trator', vigili: 'Auto de la Polizia Locale' };
  const el = $('garageInfo');
  if (el) el.textContent = (names[P.car.type] || 'Veicol') + ' · motor ' + P.car.tune + '/3 · ' + money.toLocaleString('it-IT') + ' € in scarsèla · ' + (garage.osm ? 'posizion da OpenStreetMap' : 'posizion dal progèt (ancora nò su OSM)');
  const title = $('garageTitle'); if (title) title.textContent = '🔧 ' + garage.name;
  const gT = $('gTune'), gR = $('gRepair');
  if (gT) gT.textContent = 'Potenzi el motor — ' + tuneCost() + ' €';
  if (gR) gR.textContent = 'Giusta l\'auto — ' + repairCost() + ' €';
}
function buyPaint(hex) {
  if (!P.car) return;
  const cost = paintCost();
  if (money < cost) { hint('Ti servono ' + cost + ' € per la vernis'); return; }
  money -= cost; paintCar(P.car, hex); updateGarageUI(); beep(540, 0.1);
  toast('🎨 Vernis növa! −' + cost + ' €', 1400);
}
function buyTune() {
  if (!P.car) return;
  if (P.car.tune >= 3) { hint('Motor già al màsim'); return; }
  const cost = tuneCost();
  if (money < cost) { hint('Ti servono ' + cost + ' € per el motor'); return; }
  money -= cost; tuneCar(P.car, P.car.tune + 1); updateGarageUI(); beep(660, 0.12);
  toast('🔧 Motor livèl ' + P.car.tune + ' (−' + cost + ' €)', 1500);
}
function buyRepair() {
  if (!P.car) return;
  const cost = repairCost();
  if (money < cost) { hint('Ti servono ' + cost + ' €'); return; }
  money -= cost; P.car.vf = 0; P.car.vel.set(0, 0); P.car.stun = 0; repairCar(P.car); beep(420, 0.1);
  toast('🧰 Auto giustada a nöf (−' + cost + ' €)', 1400); updateGarageUI();
}

// ---- stunt jump ----
const rampTex = canvasTex(64, 64, (c, w, h) => {
  c.fillStyle = '#f2c200'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a';
  for (let i = -h; i < w; i += 32) { c.beginPath(); c.moveTo(i, h); c.lineTo(i + 16, h); c.lineTo(i + 16 + h, 0); c.lineTo(i + h, 0); c.closePath(); c.fill(); }
});
const rampMat = new THREE.MeshLambertMaterial({ map: rampTex });
const stunts = [];
{
  const cand = [];
  D.roads.forEach((r) => {
    if (!['primary', 'secondary', 'tertiary'].includes(r.t)) return;
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], x1 = r.p[i + 2], z1 = r.p[i + 3], l = Math.hypot(x1 - x0, z1 - z0);
      if (l > 45) cand.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, fx: (x1 - x0) / l, fz: (z1 - z0) / l });
    }
  });
  const picked = [];
  for (const c of cand.sort(() => R() - 0.5)) {
    if (picked.length >= 5) break;
    if (Math.hypot(c.x - P.x, c.z - P.z) < 90) continue;
    if (picked.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 260)) continue;
    picked.push(c);
  }
  for (const c of picked) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 10), rampMat);
    m.rotation.x = -0.22; m.position.y = 0.55; m.castShadow = true; m.receiveShadow = true; g.add(m);
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 9.5), new THREE.MeshLambertMaterial({ color: '#555' }));
      s.rotation.x = -0.22; s.position.set(sx * 3.6, 0.0, 0); g.add(s);
    }
    g.position.set(c.x, 0.2, c.z); g.rotation.y = Math.atan2(c.fx, c.fz); scene.add(g);
    stunts.push({ x: c.x, z: c.z, fx: c.fx, fz: c.fz, cool: 0, done: false });
  }
}
function stuntTick(car, dt) {
  for (const st of stunts) {
    if (st.cool > 0) st.cool -= dt;
    if (car.y > 0.06 || st.cool > 0) continue;
    const dx = car.x - st.x, dz = car.z - st.z;
    if (dx * dx + dz * dz > 30) continue;
    const dot = Math.sin(car.h) * st.fx + Math.cos(car.h) * st.fz;
    if (dot > 0.35 && Math.abs(car.vf) > 9) {
      car.vy = Math.abs(car.vf) * 0.5 + 3.5; car.air = 0; st.cool = 3;
      beep(520, 0.1, 'triangle', 0.07);
    }
  }
}
function landCar(car) {
  if (car.air < 0.5) return;
  let st = null, bd = 60;
  for (const s of stunts) { const d = Math.hypot(s.x - car.x, s.z - car.z); if (d < bd) { bd = d; st = s; } }
  const first = !!st && !st.done;
  if (st) st.done = true;
  if (first) stats.stunts++;
  const r = first ? 150 : 25;
  addMoney(r);
  toast('🤸 Salt acrobàtic! +' + r + ' €', 2200);
  beep(880, 0.1); setTimeout(() => beep(1175, 0.18), 110);
}

// ---- panini & kit: punti presi dai luoghi reali OpenStreetMap ----
function spotNearPoi(p) {
  const v = W.nearestDriveVert(p.x, p.z);
  const e = W.walkAdj[v] && W.walkAdj[v][0];
  if (!e) return null;
  const [tx, tz] = laneTarget(v, e.to, 1.6 + R() * 2.2);
  if (W.insideBuilding(tx, tz)) return null;
  return { x: tx, z: tz };
}
const FOOD_AM = /^(shop:bakery|shop:general|shop:supermarket|bar|restaurant|ice_cream|fast_food|cafe)$/;
const HEALTH_AM = /^(bar|restaurant|ice_cream|fast_food|cafe)$/;
const ARMOR_AM = /^(bank|atm|post_office)$/;
const panini = [];
const PANINI_ICONS = ['🥪', '🥖', '🍞', '🥐'];
function addPanino(x, z, src) {
  const spr = makeLabel(PANINI_ICONS[panini.length % PANINI_ICONS.length], { size: 52, scale: 0.02, bg: 'rgba(255,255,255,0.92)', color: '#111' });
  spr.position.set(x, 1.4, z); scene.add(spr);
  panini.push({ x, z, spr, got: false, src: src || '' });
}
for (const p of D.pois) {
  if (!p.n || !FOOD_AM.test(p.a || '')) continue;
  for (let k = 0; k < 2 && panini.length < 20; k++) {
    const s = spotNearPoi(p);
    if (s && !panini.some(q => Math.hypot(q.x - s.x, q.z - s.z) < 12)) addPanino(s.x, s.z, p.n);
  }
}
for (let guard = 0; panini.length < 20 && guard < 400; guard++) {
  const v = townVerts[Math.floor(R() * townVerts.length)];
  const e = W.walkAdj[v][Math.floor(R() * W.walkAdj[v].length)];
  if (!e) continue;
  const [tx, tz] = laneTarget(v, e.to, 1.6 + R() * 2.6);
  if (W.insideBuilding(tx, tz)) continue;
  if (panini.some(p => Math.hypot(p.x - tx, p.z - tz) < 60)) continue;
  addPanino(tx, tz, '');
}
const pickups = [];
function addPickup(kind, x, z, src) {
  const spr = makeLabel(kind === 'hp' ? '✚' : '🛡️', { size: 48, scale: 0.022, bg: kind === 'hp' ? 'rgba(210,40,40,.92)' : 'rgba(30,90,200,.92)', color: '#fff' });
  spr.position.set(x, 1.1, z); scene.add(spr);
  pickups.push({ kind, x, z, spr, cool: 0, src: src || '' });
}
function placePickup(kind, re) {
  let added = 0;
  if (re) for (const p of D.pois) {
    if (!p.n || !re.test(p.a || '')) continue;
    const s = spotNearPoi(p);
    if (s && !pickups.some(q => Math.hypot(q.x - s.x, q.z - s.z) < 12)) { addPickup(kind, s.x, s.z, p.n); added++; }
  }
  if (added) return;
  for (let k = 0; k < 140; k++) {
    const v = townVerts[Math.floor(R() * townVerts.length)];
    const e = W.walkAdj[v][Math.floor(R() * W.walkAdj[v].length)];
    if (!e) continue;
    const [tx, tz] = laneTarget(v, e.to, 1.6 + R() * 2.4);
    if (W.insideBuilding(tx, tz)) continue;
    if (pickups.some(p => Math.hypot(p.x - tx, p.z - tz) < 80)) continue;
    addPickup(kind, tx, tz, '');
    return;
  }
}
placePickup('hp', HEALTH_AM);
for (let i = 0; i < 3; i++) placePickup('hp', null);
placePickup('ar', ARMOR_AM);
placePickup('ar', null);
function updatePickups(dt) {
  for (const p of panini) if (!p.got) {
    p.spr.position.y = 1.35 + Math.sin(now * 2.4 + p.x) * 0.15;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 2.4) {
      p.got = true; scene.remove(p.spr); stats.panini++; addMoney(25);
      toast('🥪 Panin ' + (p.src ? 'da ' + p.src + ' ' : '') + stats.panini + '/' + panini.length + ' · +25 €', 2200);
      beep(880, 0.1); setTimeout(() => beep(1170, 0.12), 100);
    }
  }
  for (const p of pickups) {
    if (p.cool > 0) { p.cool -= dt; if (p.cool <= 0) p.spr.visible = true; continue; }
    p.spr.position.y = 1.1 + Math.sin(now * 2.6 + p.z) * 0.12;
    if (Math.hypot(p.x - P.x, p.z - P.z) >= 2.3) continue;
    if (p.kind === 'hp' && hp < maxHp) hp = maxHp;
    else if (p.kind === 'ar' && armor < 100) armor = 100;
    else continue;
    p.cool = 40; p.spr.visible = false;
    beep(920, 0.15, 'sine', 0.07);
    hint(p.kind === 'hp' ? '❤️ Salute a post' : '🛡️ Armatura a post');
  }
}

// ---- trucchi ----
let cheatBuf = '', cheatT = 0;
const CHEATS = [
  { code: 'PANE', msg: '+500 €', fn: () => addMoney(500) },
  { code: 'SALUTE', msg: 'salute e armadura al màsim', fn: () => { hp = 100; armor = 100; } },
  { code: 'LIBERTA', msg: 'Polizia Locale distràta', fn: () => clearWanted() },
  { code: 'TURBO', msg: 'motor elaborà', fn: () => { if (P.car) tuneCar(P.car, 3); else toast('Te serve n\'auto', 1500); } },
  { code: 'SOLE', msg: 'matina', fn: () => { tod = 10; } },
  { code: 'NOTTE', msg: 'not fonda', fn: () => { tod = 23; } },
];
function keyCheat(k) {
  if (!/^[a-z]$/i.test(k)) return;
  cheatBuf = (cheatBuf + k.toUpperCase()).slice(-10); cheatT = 2.5;
  for (const c of CHEATS) if (cheatBuf.endsWith(c.code)) {
    c.fn();
    toast('🎮 Truc ativà: ' + c.msg, 2000);
    beep(740, 0.1, 'square', 0.06); beep(988, 0.12, 'square', 0.06);
    cheatBuf = '';
    break;
  }
}

// ---- telefono ----
let phoneOpen = false;
function renderPhone() {
  const list = ACHIEVEMENTS.map(a => '<li class="' + (a.got ? 'on' : '') + '">' + (a.got ? '✅' : '⬜') + ' <b>' + a.name + '</b> — ' + a.desc + '</li>').join('');
  const el = $('phoneBody');
  if (!el) return;
  el.innerHTML =
    '<div class="pstats">🚗 ' + stats.km.toFixed(1) + ' km · 🏁 ' + stats.missions + ' mission · 🥪 ' + stats.panini + '/' + panini.length +
    ' · 🤸 ' + stats.stunts + ' stunt<br>💰 ' + stats.earned + ' € guadagnà · 🚨 ' + stats.crimes + ' reat · 🚔 ' + stats.busted + ' arrest</div>' +
    '<ul class="pach">' + list + '</ul>';
}
function openPhone() {
  if (garageOpen) return;
  phoneOpen = true; $('phone').style.display = 'block'; renderPhone();
  if (document.exitPointerLock) document.exitPointerLock();
}
function closePhone() { phoneOpen = false; $('phone').style.display = 'none'; }
function bribe() {
  if (wanted.level <= 0) { toast('Nissuna ricerca in gir', 1400); return; }
  const cost = 100 * wanted.level;
  if (money < cost) { toast('Ti servono ' + cost + ' € per la multa', 1800); return; }
  money -= cost; clearWanted(true);
  toast('🚔 Multa pagà a la Polizia Locale: −' + cost + ' €', 2400); beep(600, 0.1); updatePhoneMoney();
}
function updatePhoneMoney() { if (phoneOpen) renderPhone(); }
function startMissionById(id) {
  if (mission) { hint('Te gh\'è già na mission in gir'); return; }
  const g = givers.find(q => q.id === id);
  if (!g) return;
  startMission(g); closePhone();
}

// ---- danni, incidenti e particelle ----
const smokeGeo = new THREE.SphereGeometry(0.55, 6, 5);
const fireGeo = new THREE.SphereGeometry(0.7, 6, 5);
const debrisGeo = new THREE.BoxGeometry(0.22, 0.14, 0.28);
const skidGeo = new THREE.PlaneGeometry(0.32, 1.15); skidGeo.rotateX(-Math.PI / 2);
const puffs = [], debris = [], skids = [];
let boomLight = null, boomLightT = 0;

function spawnPuff(x, y, z, fire) {
  if (puffs.length > 150) return;
  const mat = new THREE.MeshBasicMaterial({ color: fire ? '#ff7a1a' : '#3a3a3a', transparent: true, opacity: fire ? 0.9 : 0.45, depthWrite: false });
  const m = new THREE.Mesh(fire ? fireGeo : smokeGeo, mat);
  m.position.set(x + (R() - 0.5) * 0.8, y, z + (R() - 0.5) * 0.8);
  m.scale.setScalar(0.6 + R() * 0.5);
  m.renderOrder = 5;
  scene.add(m);
  puffs.push({ m, life: fire ? 0.5 + R() * 0.35 : 1.2 + R() * 0.7, vy: fire ? 2.0 : 1.0 + R(), fire });
}
function spawnDebris(x, z, power) {
  const n = Math.min(10, 3 + Math.round(power * 8));
  for (let i = 0; i < n && debris.length < 70; i++) {
    const m = new THREE.Mesh(debrisGeo, new THREE.MeshLambertMaterial({ color: R() < 0.5 ? '#2b2b2b' : '#8d8d8d' }));
    m.position.set(x + (R() - 0.5) * 1.4, 0.5 + R() * 0.8, z + (R() - 0.5) * 1.4);
    m.rotation.set(R() * 3, R() * 3, R() * 3);
    m.castShadow = true;
    scene.add(m);
    debris.push({ m, life: 2 + R(), vx: (R() - 0.5) * 8 * power, vy: 3 + R() * 5 * power, vz: (R() - 0.5) * 8 * power, rx: (R() - 0.5) * 12, rz: (R() - 0.5) * 12 });
  }
}
function spawnCrashFx(power, x, z) {
  spawnDebris(Math.min(1.5, Math.abs(power)), x, z);
  for (let i = 0; i < 4; i++) spawnPuff(x, 0.8, z, false);
  for (let i = 0; i < 3; i++) spawnPuff(x, 0.6, z, true);
}
function spawnSmoke(car, fire) {
  spawnPuff(car.x, (car.y || 0) + car.spec.height * 0.7, car.z, fire);
}
function addSkid(x, z, h) {
  if (skids.length > 140) { const old = skids.shift(); scene.remove(old.m); old.m.material.dispose(); }
  const mat = new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: 0.5, depthWrite: false });
  const m = new THREE.Mesh(skidGeo, mat);
  m.position.set(x, 0.09, z); m.rotation.y = h;
  scene.add(m);
  skids.push({ m, life: 6 });
}
function explosionAt(x, z) {
  for (let i = 0; i < 10; i++) spawnPuff(x + (R() - 0.5) * 1.5, 1 + R() * 1.4, z + (R() - 0.5) * 1.5, true);
  for (let i = 0; i < 8; i++) spawnPuff(x + (R() - 0.5) * 2.0, 1.2 + R() * 1.6, z + (R() - 0.5) * 2.0, false);
  spawnDebris(x, z, 1.5);
  shake = Math.min(1.4, shake + 0.9);
  flash('rgba(255,140,30,.25)');
  beep(55, 0.7, 'sawtooth', 0.2); beep(95, 0.45, 'square', 0.1);
  if (!boomLight) { boomLight = new THREE.PointLight('#ff8a2a', 0, 50, 2); scene.add(boomLight); }
  boomLight.position.set(x, 2.5, z); boomLight.intensity = 14; boomLightT = 0.7;
}
function damageCar(car, n, force) {
  if (!car || car.dead || n <= 0) return 0;
  if (!force && car.dmgCool > 0) return 0;
  car.health = Math.max(0, car.health - n);
  car.dmgCool = force ? 0 : 0.25;
  if (car.health <= 0) wreckCar(car);
  return n;
}
function wreckCar(car) {
  if (car.dead) return;
  const hadDriver = !!car.ai || !!car.cop || car === P.car;
  car.dead = true; car.health = 0; car.vf = 0; car.vel.set(0, 0); car.stun = 0; car.ai = null;
  if (car.cop) { const ci = cops.indexOf(car); if (ci >= 0) cops.splice(ci, 1); car.cop = false; }
  if (car === P.car) {
    const [fx, fz] = fwd(car.h);
    P.x = car.x + fz * 1.9; P.z = car.z - fx * 1.9; P.y = 0; P.vy = 0;
    P.car = null; player.visible = true;
    damagePlayer(35);
  } else if (hadDriver) {
    const pd = spawnPed(); const [fx, fz] = fwd(car.h);
    pd.x = car.x + fz * 2.2; pd.z = car.z - fx * 2.2; pd.ai = null; pd.fleeT = 5; pd.h = car.h;
    say(pd, 'La me macchina!', 2.5);
  }
  for (const m of car.mesh.userData.bodyMats || []) m.color.set('#2f2b28');
  for (const p of peds) if (!p.down && Math.hypot(p.x - car.x, p.z - car.z) < 35) { p.fleeT = Math.max(p.fleeT || 0, 4); }
  car.wreckT = 10;
  explosionAt(car.x, car.z);
  toast('💥 Auto distruta!', 2200);
}
function repairCar(car) {
  if (!car) return;
  car.health = car.maxHealth; car.dead = false; car.wreckT = 0; car.stun = 0; car.smokeT = 0;
  const cols = car.origColors || [];
  (car.mesh.userData.bodyMats || []).forEach((m, i) => { if (cols[i] != null) m.color.setHex(cols[i]); });
}
function updateFx(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.life -= dt;
    p.m.position.y += p.vy * dt; p.vy *= Math.max(0, 1 - dt * 0.6);
    const s = p.m.scale.x + dt * (p.fire ? 1.0 : 0.7);
    p.m.scale.setScalar(s);
    p.m.material.opacity = Math.max(0, p.life) * (p.fire ? 0.55 : 0.3);
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1); }
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt;
    d.vy -= 18 * dt;
    d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
    d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
    if (d.m.position.y < 0.12) { d.m.position.y = 0.12; d.vy *= -0.35; d.vx *= 0.7; d.vz *= 0.7; }
    if (d.life <= 0) { scene.remove(d.m); d.m.material.dispose(); debris.splice(i, 1); }
  }
  for (let i = skids.length - 1; i >= 0; i--) {
    const s = skids[i]; s.life -= dt;
    s.m.material.opacity = Math.min(0.5, Math.max(0, s.life) * 0.1);
    if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); skids.splice(i, 1); }
  }
  if (boomLightT > 0) { boomLightT -= dt; if (boomLight) boomLight.intensity = Math.max(0, boomLightT / 0.7 * 14); }
}

// ---------------- HUD helpers ----------------
let toastT = 0, hintT = 0;
function toast(t, ms = 2800) { const el = $('toast'); el.textContent = t; el.classList.add('show'); toastT = ms / 1000; }
function hint(t) { const el = $('hint'); el.textContent = t; el.style.opacity = 1; hintT = 0.3; }

// ---------------- minimap ----------------
const MAP_PAD = 350, MS = 1.0;
const [ex0, ez0, ex1, ez1] = D.ext;
const mapW = Math.ceil((ex1 - ex0 + MAP_PAD * 2) * MS), mapH = Math.ceil((ez1 - ez0 + MAP_PAD * 2) * MS);
const mapCanvas = document.createElement('canvas'); mapCanvas.width = mapW; mapCanvas.height = mapH;
const mx0 = ex0 - MAP_PAD, mz0 = ez0 - MAP_PAD;
{
  const c = mapCanvas.getContext('2d');
  c.fillStyle = '#a3b97f'; c.fillRect(0, 0, mapW, mapH);
  const poly = (p, fill) => { c.beginPath(); for (let i = 0; i < p.length; i += 2) { const X = (p[i] - mx0) * MS, Y = (p[i + 1] - mz0) * MS; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.closePath(); c.fillStyle = fill; c.fill(); };
  const AC_ = { park: '#7fae58', pitch: '#62a24a', pool: '#5bb5d8', parking: '#b8b5ae', cemetery: '#97a888', wood: '#5f8a45', farm: '#c2bb72', farmyard: '#bdb28d', industrial: '#c9c3b8', square: '#ddd3c2', water: '#5a9cc6' };
  for (const a of D.areas) if (AC_[a.k]) poly(a.p, AC_[a.k]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const l of D.lines) { c.strokeStyle = l.k === 'water' ? '#5a9cc6' : '#8d867a'; c.lineWidth = Math.max(1.5, l.w * MS); c.beginPath(); for (let i = 0; i < l.p.length; i += 2) { const X = (l.p[i] - mx0) * MS, Y = (l.p[i + 1] - mz0) * MS; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); }
  for (const b of W.blds) poly(b.p, b.k === 'i' ? '#b7b2aa' : '#d8c3a5');
  const order = ['track', 'path', 'footway', 'cycleway', 'service', 'pedestrian', 'unclassified', 'residential', 'tertiary', 'secondary_link', 'secondary', 'primary'];
  for (const pass of [0, 1]) for (const t of order) for (const r of D.roads) {
    if (r.t !== t) continue;
    const minor = ['track', 'path', 'footway', 'cycleway'].includes(t);
    if (pass === 0 && minor) continue;
    c.strokeStyle = pass === 0 ? '#6f6a62' : minor ? '#efe6d2' : (t === 'primary' || t === 'secondary' ? '#ffd27a' : '#ffffff');
    c.lineWidth = Math.max(2, (r.w + (pass === 0 ? 2.5 : 0)) * MS);
    c.beginPath(); for (let i = 0; i < r.p.length; i += 2) { const X = (r.p[i] - mx0) * MS, Y = (r.p[i + 1] - mz0) * MS; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke();
  }
}
const mini = $('minimap'), mctx = mini.getContext('2d');
function drawMinimap() {
  const S = mini.width, zoom = P.car ? 0.55 + 0.4 / (1 + P.car.speed / 10) : 1.1;
  mctx.save(); mctx.clearRect(0, 0, S, S);
  mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#a3b97f'; mctx.fillRect(0, 0, S, S);
  mctx.translate(S / 2, S / 2); const rot = camYaw - Math.PI; mctx.rotate(rot); mctx.scale(zoom * 1.4, zoom * 1.4);
  mctx.drawImage(mapCanvas, -(P.x - mx0) * MS, -(P.z - mz0) * MS);
  const dot = (x, z, col, r = 5) => { mctx.beginPath(); mctx.arc((x - P.x) * MS, (z - P.z) * MS, r / (zoom * 1.4), 0, Math.PI * 2); mctx.fillStyle = col; mctx.fill(); mctx.lineWidth = 2 / (zoom * 1.4); mctx.strokeStyle = '#fff'; mctx.stroke(); };
  if (!mission) for (const g of givers) dot(g.x, g.z, g.color, 7);
  for (const v of vehicles) if (v.type === 'vigili' && Math.hypot(v.x - P.x, v.z - P.z) < 200) dot(v.x, v.z, '#1e6bff', 3.5);
  dot(garage.x, garage.z, '#2ec4b6', 5);
  for (const st of stunts) if (Math.hypot(st.x - P.x, st.z - P.z) < 220) dot(st.x, st.z, '#f2c200', 4);
  for (const p of panini) if (!p.got && Math.hypot(p.x - P.x, p.z - P.z) < 120) dot(p.x, p.z, '#e8b64c', 3.5);
  mctx.restore();
  // target indicator (clamped to the edge)
  if (mission) {
    const st = mission.steps[mission.step];
    let dx = (st.x - P.x) * MS * zoom * 1.4, dz = (st.z - P.z) * MS * zoom * 1.4;
    const rot2 = camYaw - Math.PI; const rx = dx * Math.cos(rot2) - dz * Math.sin(rot2), rz = dx * Math.sin(rot2) + dz * Math.cos(rot2);
    let l = Math.hypot(rx, rz), m = Math.min(1, (S / 2 - 10) / (l || 1));
    mctx.beginPath(); mctx.arc(S / 2 + rx * m, S / 2 + rz * m, 7, 0, Math.PI * 2); mctx.fillStyle = '#3fa9ff'; mctx.fill(); mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke();
  }
  // player arrow
  mctx.save(); mctx.translate(S / 2, S / 2); const ph = P.car ? P.car.h : P.h; mctx.rotate(-(ph - camYaw));
  mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fillStyle = '#ff3b30'; mctx.fill(); mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke(); mctx.restore();
  // north marker
  const na = camYaw - Math.PI; const nxp = S / 2 + Math.sin(-na) * (S / 2 - 12) * -1, nyp = S / 2 - Math.cos(-na) * (S / 2 - 12);
  mctx.fillStyle = '#fff'; mctx.font = '700 13px system-ui'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  mctx.beginPath(); mctx.arc(nxp, nyp, 9, 0, Math.PI * 2); mctx.fillStyle = 'rgba(20,24,30,.85)'; mctx.fill(); mctx.fillStyle = '#fff'; mctx.fillText('N', nxp, nyp + 1);
}
// big map
let bigMap = false; const big = $('bigmap'), bctx = big.getContext('2d');
const roadLabels = [];
{
  const seen = new Map();
  for (const r of D.roads) { if (!r.n) continue; let L = 0; for (let i = 0; i < r.p.length - 2; i += 2) L += Math.hypot(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]); const prev = seen.get(r.n); if (!prev || prev.L < L) seen.set(r.n, { r, L }); }
  for (const [n, { r }] of seen) {
    let best = 0, bl = 0; for (let i = 0; i < r.p.length - 2; i += 2) { const l = Math.hypot(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]); if (l > bl) { bl = l; best = i; } }
    const a = Math.atan2(r.p[best + 3] - r.p[best + 1], r.p[best + 2] - r.p[best]);
    roadLabels.push({ n: n.replace(/^Via /, 'V. ').replace(/^Piazza /, 'P.za '), x: (r.p[best] + r.p[best + 2]) / 2, z: (r.p[best + 1] + r.p[best + 3]) / 2, a: (a > Math.PI / 2 || a < -Math.PI / 2) ? a + Math.PI : a, L: bl });
  }
}
let bigZoom = 1, bigCx = 0, bigCz = 0;
function drawBigMap() {
  big.width = innerWidth * devicePixelRatio; big.height = innerHeight * devicePixelRatio; const c = bctx;
  c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const w = innerWidth, h = innerHeight;
  const s = Math.min(w / (ex1 - ex0), h / (ez1 - ez0)) * 0.95 * bigZoom;
  c.fillStyle = '#a3b97f'; c.fillRect(0, 0, w, h);
  const ox = w / 2 - (bigCx - mx0) * s, oy = h / 2 - (bigCz - mz0) * s;
  c.imageSmoothingQuality = 'high'; c.drawImage(mapCanvas, ox, oy, mapW * s / MS, mapH * s / MS);
  const X = (x) => ox + (x - mx0) * s, Y = (z) => oy + (z - mz0) * s;
  c.font = `600 ${Math.max(9, Math.min(14, 11 * Math.sqrt(bigZoom)))}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const l of roadLabels) {
    if (l.L * s < 40) continue;
    c.save(); c.translate(X(l.x), Y(l.z)); c.rotate(l.a); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.strokeText(l.n, 0, 0); c.fillStyle = '#333'; c.fillText(l.n, 0, 0); c.restore();
  }
  c.font = '700 13px system-ui';
  for (const pl of W.places) { c.beginPath(); c.arc(X(pl.x), Y(pl.z), 4, 0, 7); c.fillStyle = '#8e44ad'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText(pl.name, X(pl.x), Y(pl.z) - 12); c.fillStyle = '#4a235a'; c.fillText(pl.name, X(pl.x), Y(pl.z) - 12); }
  if (!mission) for (const g of givers) { c.beginPath(); c.arc(X(g.x), Y(g.z), 9, 0, 7); c.fillStyle = g.color; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#111'; c.strokeText(g.title, X(g.x), Y(g.z) + 20); c.fillText(g.title, X(g.x), Y(g.z) + 20); }
  for (const p of panini) if (!p.got) { c.beginPath(); c.arc(X(p.x), Y(p.z), 3, 0, 7); c.fillStyle = '#e8b64c'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
  for (const st of stunts) { c.beginPath(); c.arc(X(st.x), Y(st.z), 5, 0, 7); c.fillStyle = '#f2c200'; c.fill(); c.strokeStyle = '#333'; c.lineWidth = 1.5; c.stroke(); }
  c.beginPath(); c.arc(X(garage.x), Y(garage.z), 7, 0, 7); c.fillStyle = '#2ec4b6'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  if (mission) mission.steps.forEach((st, i) => { if (i < mission.step) return; c.beginPath(); c.arc(X(st.x), Y(st.z), i === mission.step ? 10 : 6, 0, 7); c.fillStyle = i === mission.step ? '#3fa9ff' : 'rgba(63,169,255,.5)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); });
  c.save(); c.translate(X(P.x), Y(P.z)); c.rotate(-(P.car ? P.car.h : P.h) + Math.PI);
  c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#ff3b30'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); c.restore();
  c.fillStyle = 'rgba(20,24,30,.8)'; c.fillRect(12, h - 34, 360, 24); c.fillStyle = '#fff'; c.font = '12px system-ui'; c.textAlign = 'left';
  c.fillText('Moglia (MN) · rotèla/+/- zoom · tira per spostàr · M per sèr', 20, h - 22);
  c.textAlign = 'right'; c.fillStyle = 'rgba(20,24,30,.7)'; c.fillText('Dati © OpenStreetMap contributors (ODbL)', w - 12, h - 12);
}
big.addEventListener('wheel', (e) => { bigZoom = clamp(bigZoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.6, 8); drawBigMap(); e.preventDefault(); }, { passive: false });
{ let d = false, ax = 0, ay = 0; big.addEventListener('mousedown', (e) => { d = true; ax = e.clientX; ay = e.clientY; }); addEventListener('mouseup', () => d = false);
  big.addEventListener('mousemove', (e) => { if (!d) return; const s = Math.min(innerWidth / (ex1 - ex0), innerHeight / (ez1 - ez0)) * 0.95 * bigZoom; bigCx -= (e.clientX - ax) / s; bigCz -= (e.clientY - ay) / s; ax = e.clientX; ay = e.clientY; drawBigMap(); }); }

// ---------------- key actions ----------------
let foggy = false, started = false;
function onKey(code) {
  if (!started) return;
  if (garageOpen || phoneOpen) {
    if (code === 'Escape' || code === 'KeyK' || code === 'KeyE' || code === 'Enter') { closeGarage(); closePhone(); }
    return;
  }
  if (code === 'KeyE' || code === 'KeyF' || code === 'Enter') { if (P.car && nearGarage()) openGarage(); else toggleCar(); }
  if (code === 'KeyQ') radioSwitch(1);
  if (code === 'KeyZ') radioSwitch(-1);
  if (code === 'KeyK') openPhone();
  if (code === 'KeyT') { tod = (tod + 2) % 24; toast('🕘 Ore ' + String(Math.floor(tod)).padStart(2, '0') + ':00', 1200); }
  if (code === 'KeyM') { bigMap = !bigMap; big.style.display = bigMap ? 'block' : 'none'; if (bigMap) { bigCx = P.x; bigCz = P.z; bigZoom = 1.6; drawBigMap(); if (document.exitPointerLock) document.exitPointerLock(); } }
  if (bigMap && (code === 'Equal' || code === 'NumpadAdd')) { bigZoom = Math.min(8, bigZoom * 1.2); drawBigMap(); }
  if (bigMap && (code === 'Minus' || code === 'NumpadSubtract')) { bigZoom = Math.max(0.6, bigZoom / 1.2); drawBigMap(); }
  if (code === 'KeyN') { foggy = !foggy; toast(foggy ? '🌫️ L\'è rivà la nebbia de la Bassa…' : '☀️ La nebbia la s\'è alzada'); }
  if (code === 'KeyC') camDistIdx = (camDistIdx + 1) % 3;
  if (code === 'KeyH' && P.car) { horn(); for (const p of peds) if (!p.down && Math.hypot(p.x - P.x, p.z - P.z) < 18 && R() < 0.5) say(p, SHOUTS_DODGE[Math.floor(R() * SHOUTS_DODGE.length)]); }
  if (code === 'KeyU') { muted = !muted; toast(muted ? '🔇 Audio smorzà' : '🔊 Audio aces'); }
  if (code === 'KeyR' && P.car) { P.car.h += 0; P.car.vf = 0; P.car.vel.set(0, 0); const v = W.nearestDriveVert(P.car.x, P.car.z); P.car.x = vx(v); P.car.z = vz(v); toast('🔧 Auto rimessa in strada'); }
  if (code === 'Escape' && bigMap) { bigMap = false; big.style.display = 'none'; }
}
function toggleCar() {
  if (P.car) {
    const car = P.car; if (car.speed > 4) { hint('Va pian prima de scénd!'); return; }
    const [fx, fz] = fwd(car.h);
    // driver's door is on the left
    let ok = false;
    for (const sd of [1, -1]) {
      const pos = { x: car.x + fz * (car.spec.wid / 2 + 0.7) * sd, z: car.z - fx * (car.spec.wid / 2 + 0.7) * sd };
      if (!W.insideBuilding(pos.x, pos.z)) { P.x = pos.x; P.z = pos.z; ok = true; break; }
    }
    if (!ok) { P.x = car.x; P.z = car.z; }
    car.vf = 0; car.vel.set(0, 0); P.car = null; P.h = car.h; player.visible = true;
    if (engGain) engGain.gain.value = 0;
    return;
  }
  let best = null, bd = 4.2;
  for (const v of vehicles) { const d = Math.hypot(v.x - P.x, v.z - P.z) - v.spec.len / 2 + 1; if (d < bd) { bd = d; best = v; } }
  if (!best) { hint('Nissun veicol in gir'); return; }
  const wasOccupied = !!best.ai || !!best.cop;
  if (best.ai) {
    // the driver gets out, not amused
    const pd = spawnPed(); const [fx, fz] = fwd(best.h);
    pd.x = best.x - fz * 2; pd.z = best.z + fx * 2; pd.ai = null; pd.fleeT = 4; pd.h = best.h;
    say(pd, SHOUTS_CAR[Math.floor(R() * SHOUTS_CAR.length)], 3);
    best.ai = null;
    if (best.type === 'vigili') toast('🚓 Te gh\'è tölt l\'auto dei Vigili… l\'è mia na bèla idea!');
  }
  if (best.cop) { best.cop = false; const ci = cops.indexOf(best); if (ci >= 0) cops.splice(ci, 1); }
  if (starterLabel) { if (starterLabel.parent) starterLabel.parent.remove(starterLabel); starterLabel = null; }
  P.car = best; best.vf = best.vf || 0; player.visible = false; camYaw = best.h; initAudio();
  if (station < 0) station = 0;
  { const rEl = $('radio'); if (rEl) rEl.textContent = '📻 ' + STATIONS[station].name; }
  if (wasOccupied) setWanted(best.type === 'vigili' ? 2 : 1);
  const names = { utilitaria: 'Utilitaria', berlina: 'Berlina', sportiva: 'Sportiva', furgone: 'Furgon', camion: 'Camion', autobus: 'Autobus', apecar: 'Motocar', trattore: 'Trator', vigili: 'Auto de la Polizia Locale' };
  toast(names[best.type] || 'Veicol', 1500);
}

// ---------------- physics ----------------
const tmpPos = { x: 0, z: 0 };
let shake = 0;
function updatePlayerCar(car, dt) {
  if (garageOpen || phoneOpen) { car.vf *= Math.max(0, 1 - dt * 4); car.speed = Math.abs(car.vf); return; }
  let thr = (keys.KeyW || keys.ArrowUp) ? 1 : 0, brk = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
  let st = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
  if (touch.active) { if (touch.y < -0.2) thr = -touch.y; if (touch.y > 0.2) brk = touch.y; st = -touch.x; }
  const hb = keys.Space;
  const S = car.spec;
  const maxSteer = S.steer / (1 + Math.abs(car.vf) / 16);
  car.steer += (st * maxSteer - car.steer) * Math.min(1, dt * 8);
  if (thr) { if (car.vf < -0.5) car.vf += 14 * dt; else car.vf += S.acc * thr * Math.max(0.05, 1 - car.vf / S.maxV) * dt; }
  if (brk) { if (car.vf > 0.5) car.vf -= 16 * brk * dt; else car.vf = Math.max(-S.maxV * 0.25, car.vf - S.acc * 0.6 * dt); }
  if (!thr && !brk) car.vf -= Math.sign(car.vf) * Math.min(Math.abs(car.vf), (1.2 + Math.abs(car.vf) * 0.05) * dt);
  if (hb) car.vf -= Math.sign(car.vf) * Math.min(Math.abs(car.vf), 6 * dt);
  // off-road slows you down
  const on = W.onRoad(car.x, car.z);
  if (!on && Math.abs(car.vf) > 12) car.vf -= Math.sign(car.vf) * 6 * dt;
  const wb = S.len * 0.62;
  const yaw = car.vf * Math.tan(car.steer) / wb * (hb ? 1.35 : 1);
  car.h += yaw * dt;
  const [fx, fz] = fwd(car.h);
  const grip = hb ? 1.6 : 7.5;
  const k = Math.min(1, grip * dt);
  car.vel.x += (fx * car.vf - car.vel.x) * k; car.vel.y += (fz * car.vf - car.vel.y) * k;
  car.x += car.vel.x * dt; car.z += car.vel.y * dt;
  if (car.y < 1.2) collideCar(car, true);
  car.speed = Math.hypot(car.vel.x, car.vel.y);
  const prevV = car.prevVf == null ? car.vf : car.prevVf;
  const accel = (car.vf - prevV) / Math.max(dt, 1e-3);
  car.accel += (clamp(accel, -30, 30) - car.accel) * Math.min(1, dt * 6);
  car.prevVf = car.vf;
  car.slip = Math.abs(car.vel.x * fz - car.vel.y * fx);
  if (car.y <= 0.06) stuntTick(car, dt);
  if (car.y > 0 || car.vy > 0) {
    car.vy -= 16 * dt;
    car.y += car.vy * dt;
    if (car.y <= 0) { car.y = 0; car.vy = 0; landCar(car); car.air = 0; }
    else car.air += dt;
  }
}
function collideCar(car, isPlayer) {
  let moved = false, nx = 0, nz = 0;
  for (const c of carCircles(car)) {
    tmpPos.x = c[0]; tmpPos.z = c[1];
    const r = W.collideCircle(tmpPos, c[2]);
    if (r.hit) { const dx = tmpPos.x - c[0], dz = tmpPos.z - c[1]; car.x += dx; car.z += dz; nx += dx; nz += dz; moved = true; }
  }
  if (moved && isPlayer) {
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const vn = car.vel.x * nx + car.vel.y * nz;
    if (vn < 0) {
      car.vel.x -= nx * vn * 1.35; car.vel.y -= nz * vn * 1.35;
      const [fx, fz] = fwd(car.h); car.vf = (car.vel.x * fx + car.vel.y * fz) * 0.85;
      if (-vn > 4) {
        shake = Math.min(1, -vn / 15);
        beep(70 + R() * 30, 0.18, 'sawtooth', Math.min(0.2, -vn / 60));
        damagePlayer((-vn - 4) * 1.6);
        damageCar(car, (-vn - 4) * 4);
        if (-vn > 8) spawnCrashFx(Math.min(1.2, -vn / 14), car.x, car.z);
      }
    }
  }
  // vehicles against vehicles
  for (const o of vehicles) {
    if (o === car) continue;
    const d0 = Math.hypot(o.x - car.x, o.z - car.z); if (d0 > 14) continue;
    for (const a of carCircles(car)) for (const b of carCircles(o)) {
      const dx = a[0] - b[0], dz = a[1] - b[1], d = Math.hypot(dx, dz), m = a[2] + b[2];
      if (d < m && d > 1e-3) {
        const pen = (m - d), ux = dx / d, uz = dz / d;
        const heavy = (o.type === 'trattore' || o.type === 'camion' || o.type === 'autobus') ? 0.85 : o.type === 'furgone' ? 0.65 : 0.5;
        car.x += ux * pen * heavy; car.z += uz * pen * heavy;
        if (isPlayer) {
          o.x -= ux * pen * (1 - heavy); o.z -= uz * pen * (1 - heavy);
          const vn = (car.vel.x - (o.vel.x || 0)) * ux + (car.vel.y - (o.vel.y || 0)) * uz;
          if (vn < 0) {
            const m1 = car.mass || 1000, m2 = o.mass || 1000;
            const j = -1.25 * vn / (1 / m1 + 1 / m2);
            car.vel.x += ux * j / m1; car.vel.y += uz * j / m1;
            const [fx, fz] = fwd(car.h); car.vf = (car.vel.x * fx + car.vel.y * fz) * 0.92;
            if (o.ai || o.cop) {
              o.vel.x -= ux * j / m2; o.vel.y -= uz * j / m2;
              const [ofx, ofz] = fwd(o.h); o.vf = (o.vel.x * ofx + o.vel.y * ofz);
              o.stun = Math.min(2, 0.8 + (-vn) * 0.05);
            } else o.vf -= (j / m2) * 0.5;
            const impact = -vn;
            if (impact > 3) {
              shake = Math.min(1, impact / 14);
              beep(70 + R() * 30, 0.18, 'sawtooth', Math.min(0.22, impact / 55));
              beep(180 + R() * 120, 0.1, 'square', 0.05);
              damageCar(car, impact * 1.8 * (m2 / (m1 + m2)) * 1.9);
              damageCar(o, impact * 1.8 * (m1 / (m1 + m2)) * 1.9);
              if (impact > 6) spawnCrashFx(Math.min(1.2, impact / 12), (car.x + o.x) / 2, (car.z + o.z) / 2);
            }
          }
          if (o.ai && (o.dead || o.stun > 0)) { if (o.honkT <= 0) { say(o, SHOUTS_HONK[Math.floor(R() * SHOUTS_HONK.length)]); o.honkT = 4; horn(); } }
          else if (!o.ai && !o.dead) { o.h += (R() - 0.5) * pen * 0.2; }
        }
      }
    }
  }
}

function updateTraffic(car, dt) {
  const ai = car.ai;
  car.honkT -= dt;
  if (car.stun > 0) { car.stun -= dt; car.vf *= Math.max(0, 1 - dt * 3); advanceCarKinematic(car, dt); return; }
  if (!ai.edge) return;
  const off = laneOff(ai.edge);
  const [tx, tz] = laneTarget(ai.from, ai.to, off);
  const dx = tx - car.x, dz = tz - car.z, dist = Math.hypot(dx, dz);
  let target = ROAD_V[roadOf(ai.edge).t] || 6;
  if (car.type === 'trattore') target = Math.min(target, 6.5);
  if (car.type === 'apecar') target = Math.min(target, 9);
  if (ai.next) {
    const ax = vx(ai.to) - vx(ai.from), az = vz(ai.to) - vz(ai.from), bx = vx(ai.next.to) - vx(ai.to), bz = vz(ai.next.to) - vz(ai.to);
    const cos = (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1);
    if (cos < 0.8 && dist < 25) target = Math.min(target, 3.5 + (cos + 1) * 3.5);
  }
  // look ahead for obstacles
  const [fx, fz] = fwd(car.h);
  let ahead = 1e9;
  const check = (ox, oz, rr) => { const rx = ox - car.x, rz = oz - car.z; const along = rx * fx + rz * fz; if (along < 0 || along > 16) return; const lat = Math.abs(rx * fz - rz * fx); if (lat < rr) ahead = Math.min(ahead, along); };
  for (const o of vehicles) if (o !== car && Math.abs(o.x - car.x) < 18 && Math.abs(o.z - car.z) < 18) check(o.x, o.z, 2.0);
  if (!P.car) check(P.x, P.z, 1.4);
  for (const p of peds) if (Math.abs(p.x - car.x) < 14 && Math.abs(p.z - car.z) < 14 && !p.down) check(p.x, p.z, 1.3);
  if (ahead < 1e9) {
    target = Math.min(target, Math.max(0, (ahead - car.spec.len / 2 - 3.5) * 0.9));
    if (target < 0.5) { ai.block += dt; if (ai.block > 2.5 && car.honkT <= 0 && P.car && Math.hypot(P.x - car.x, P.z - car.z) < 14) { say(car, SHOUTS_HONK[Math.floor(R() * SHOUTS_HONK.length)]); horn(); car.honkT = 5; } }
  } else ai.block = 0;
  if (ai.block > 12) { // give up: respawn elsewhere
    if (Math.hypot(car.x - P.x, car.z - P.z) > 60) { placeTraffic(car, 120, 420); return; }
  }
  car.vf += clamp(target - car.vf, -9 * dt, 3.2 * dt);
  // steer toward target
  const want = Math.atan2(dx, dz); const dh = wrap(want - car.h);
  const rate = 0.6 + car.vf / 3.2;
  car.h += clamp(dh, -rate * dt, rate * dt);
  advanceCarKinematic(car, dt);
  if (dist < Math.max(2.2, car.vf * 0.35) || (dist < 8 && Math.abs(dh) > 1.6)) {
    if (!ai.next) { placeTraffic(car, 120, 420); return; }
    ai.from = ai.to; ai.edge = ai.next; ai.to = ai.next.to; ai.next = chooseNext(ai.from, ai.to);
  }
}
function advanceCarKinematic(car, dt) {
  const [fx, fz] = fwd(car.h);
  car.x += fx * car.vf * dt; car.z += fz * car.vf * dt;
  car.vel.set(fx * car.vf, fz * car.vf); car.speed = Math.abs(car.vf);
}

function updatePed(p, dt) {
  if (p.bubbleT) p.bubbleT -= dt;
  if (p.down > 0) {
    p.down -= dt;
    p.mesh.rotation.z = p.down > 0.6 ? Math.min(Math.PI / 2, p.mesh.rotation.z + dt * 8) : p.mesh.rotation.z * 0.85;
    p.x += p.dvx * dt; p.z += p.dvz * dt; p.dvx *= 0.9; p.dvz *= 0.9;
    if (p.down <= 0) { p.mesh.rotation.z = 0; say(p, SHOUTS_HIT[Math.floor(R() * SHOUTS_HIT.length)]); }
    animatePerson(p.mesh, 0, dt); return;
  }
  // danger from the player's car
  if (P.car && P.car.speed > 3) {
    const c = P.car; const rx = p.x - c.x, rz = p.z - c.z, d = Math.hypot(rx, rz);
    const [fx, fz] = [c.vel.x / c.speed, c.vel.y / c.speed];
    const along = rx * fx + rz * fz, lat = rx * fz - rz * fx;
    if (d < c.spec.len / 2 + 0.7 && Math.abs(lat) < c.spec.wid / 2 + 0.4 && along > -c.spec.len / 2) {
      // knocked over (cartoon style): pushed aside, then gets back up
      p.down = 2.2; const s = Math.sign(lat) || 1; p.dvx = fz * s * c.speed * 0.6 + fx * c.speed * 0.4; p.dvz = -fx * s * c.speed * 0.6 + fz * c.speed * 0.4;
      p.vy = 3 + c.speed * 0.15; c.vf *= 0.85; beep(140, 0.12, 'triangle', 0.1);
      setWanted(1);
      hint('Ocio ai pedón!'); return;
    }
    if (along > 0 && along < 6 + c.speed * 0.6 && Math.abs(lat) < 2.2 && p.dodge <= 0) {
      const s = Math.sign(lat) || (R() < 0.5 ? 1 : -1);
      p.dvx = fz * s * 6.5; p.dvz = -fx * s * 6.5; p.dodge = 0.55; p.vy = 4.2;
      if (R() < 0.6) say(p, SHOUTS_DODGE[Math.floor(R() * SHOUTS_DODGE.length)]);
    }
  }
  if (p.dodge > 0) {
    p.dodge -= dt; p.x += p.dvx * dt; p.z += p.dvz * dt; p.h = Math.atan2(p.dvx, p.dvz);
    W.collideCircle(p, 0.35);
    animatePerson(p.mesh, 3, dt, p.y > 0.1); return;
  }
  let sp = 0;
  if (p.waiting) { p.h = Math.atan2(P.x - p.x, P.z - p.z); animatePerson(p.mesh, 0, dt); if (!p.waveT || p.waveT < 0) { p.mesh.userData.armR.rotation.x = -2.6; } return; }
  if (p.fleeT > 0) {
    p.fleeT -= dt; const ax = p.x - P.x, az = p.z - P.z, l = Math.hypot(ax, az) || 1;
    p.x += ax / l * 3.5 * dt; p.z += az / l * 3.5 * dt; p.h = Math.atan2(ax, az); sp = 3.5; W.collideCircle(p, 0.35);
    if (p.fleeT <= 0) placePed(p, 0, 400) || 0;
    animatePerson(p.mesh, sp, dt); return;
  }
  if (!p.ai) { if (!placePed(p, 20, 260)) return; }
  const ai = p.ai; const off = pedOff(ai.edge, p);
  const [tx, tz] = laneTarget(ai.from, ai.to, off);
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.6) {
    const opts = W.walkAdj[ai.to].filter(e => e.to !== ai.from);
    const list = opts.length ? opts : W.walkAdj[ai.to];
    const e = list[Math.floor(R() * list.length)];
    ai.from = ai.to; ai.to = e.to; ai.edge = e;
  } else {
    sp = p.speed; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt;
    const want = Math.atan2(dx, dz); p.h += wrap(want - p.h) * Math.min(1, dt * 6);
  }
  animatePerson(p.mesh, sp, dt);
}

function updatePlayerFoot(dt) {
  if (garageOpen || phoneOpen) { P.speed = 0; player.position.set(P.x, P.y, P.z); player.rotation.y = P.h; return; }
  let ix = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  let iz = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
  if (touch.active) { ix = touch.x; iz = -touch.y; }
  const run = keys.ShiftLeft || keys.ShiftRight || (touch.active && Math.hypot(touch.x, touch.y) > 0.9);
  const l = Math.hypot(ix, iz);
  let sp = 0;
  if (l > 0.05) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx; // right vector
    const mx = (fx * iz + rx * ix) / Math.max(1, l), mz = (fz * iz + rz * ix) / Math.max(1, l);
    sp = (run ? 7.2 : 3.4) * Math.min(1, l) * (CHARACTERS[charIdx].speed || 1);
    P.x += mx * sp * dt; P.z += mz * sp * dt;
    const want = Math.atan2(mx, mz); P.h += wrap(want - P.h) * Math.min(1, dt * 12);
  }
  if (keys.Space && P.y <= 0.001) { P.vy = 5.2; }
  P.vy -= 16 * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) P.vy = Math.max(0, P.vy);
  W.collideCircle(P, 0.38);
  // can't walk through cars
  for (const v of vehicles) {
    if (Math.abs(v.x - P.x) > 6 || Math.abs(v.z - P.z) > 6) continue;
    for (const c of carCircles(v)) { const dx = P.x - c[0], dz = P.z - c[1], d = Math.hypot(dx, dz), m = c[2] + 0.38; if (d < m && d > 1e-3 && P.y < v.spec.height * 0.7) { P.x += dx / d * (m - d); P.z += dz / d * (m - d); } }
    if (v.ai && v.speed > 3) { const dx = P.x - v.x, dz = P.z - v.z; if (Math.hypot(dx, dz) < v.spec.len / 2) { P.vy = 4; if (!v.hitCool) { damagePlayer(12); v.hitCool = 1.5; } } }
  }
  P.speed = sp;
  player.position.set(P.x, P.y, P.z); player.rotation.y = P.h;
  animatePerson(player, sp, dt, P.y > 0.15);
}

// ---------------- camera ----------------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  let tx, ty, tz, dist;
  const dists = P.car ? [8.5, 13, 5.5] : [5, 8, 3.2];
  dist = dists[camDistIdx];
  if (P.car) {
    const c = P.car; tx = c.x; ty = c.spec.height + 0.6 + c.y; tz = c.z; dist += c.spec.len * 0.3;
    if (now - lastMouse > 1.2) { const back = c.vf < -1 ? c.h + Math.PI : c.h; camYaw += wrap(back - camYaw) * Math.min(1, dt * 3.2); camPitch += (0.22 - camPitch) * Math.min(1, dt * 2); }
    dist += Math.min(4, c.speed * 0.08);
  } else { tx = P.x; ty = P.y + 1.65; tz = P.z; }
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const dx = -Math.sin(camYaw) * cp, dz = -Math.cos(camYaw) * cp;
  let cx = tx + dx * dist, cz = tz + dz * dist, cy = ty + sp * dist;
  const t = W.rayWalls(tx, tz, cx, cz);
  if (t < 1) { const f = Math.max(0.15, t - 0.08); cx = tx + dx * dist * f; cz = tz + dz * dist * f; cy = ty + sp * dist * f; }
  cy = Math.max(0.6, cy);
  const target = new THREE.Vector3(cx, cy, cz);
  if (!camInit) { camPos.copy(target); camInit = true; }
  camPos.lerp(target, Math.min(1, dt * (P.car ? 10 : 14)));
  if (t < 1) camPos.copy(target);
  camLook.set(tx, ty - (P.car ? 0.4 : 0.1), tz);
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (R() - 0.5) * shake * 0.6; camera.position.y += (R() - 0.5) * shake * 0.4; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(camLook);
  const fovT = 62 + (P.car ? Math.min(14, P.car.speed * 0.35) : 0);
  camera.fov += (fovT - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix();
}

// direction arrow above the player
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), new THREE.MeshBasicMaterial({ color: '#3fa9ff' }));
arrow.geometry.rotateX(Math.PI / 2); scene.add(arrow); arrow.visible = false;

// ---------------- main loop ----------------
let now = 0; let last = performance.now();
let respawnT = 0, fps = 60, fpsAcc = 0, fpsN = 0, streetT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (t - last) / 1000); last = t; now += dt;
  fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (!started) { idleCam(dt); renderer.render(scene, camera); return; }
  if (bigMap) { renderer.render(scene, camera); return; }

  if (P.car) {
    const steps = 2; for (let i = 0; i < steps && P.car; i++) updatePlayerCar(P.car, dt / steps);
    if (P.car) { P.x = P.car.x; P.z = P.car.z; P.y = 0; }
  } else updatePlayerFoot(dt);
  for (const v of vehicles) {
    if (v.gone) continue;
    if (v.dmgCool) v.dmgCool = Math.max(0, v.dmgCool - dt);
    if (v === P.car) continue;
    if (v.hitCool) v.hitCool = Math.max(0, v.hitCool - dt);
    if (v.dead) { v.vf = 0; v.vel.set(0, 0); continue; }
    if (v.cop) updateCop(v, dt);
    else if (v.ai) updateTraffic(v, dt);
    else if (v.vf) { v.vf *= Math.max(0, 1 - dt * 2); advanceCarKinematic(v, dt); collideCar(v, false); if (Math.abs(v.vf) < 0.1) v.vf = 0; }
  }
  // fumo, fuoco e rottami dei veicoli danneggiati
  for (const v of vehicles) {
    if (v.gone) continue;
    const dx = v.x - P.x, dz = v.z - P.z, d2 = dx * dx + dz * dz;
    if (v.health < 50 && d2 < 160 * 160) {
      v.smokeT = (v.smokeT || 0) - dt;
      if (v.smokeT <= 0) { v.smokeT = v.dead ? 0.07 : 0.24; spawnSmoke(v, v.dead); }
    }
    if (v.dead) {
      v.wreckT = (v.wreckT || 0) - dt;
      if (v.wreckT <= 0 && v !== P.car && d2 > 80 * 80) v.gone = true;
    }
  }
  // segni di gomma quando si slitta o si usa il freno a mano
  if (P.car) {
    const c = P.car;
    const drifting = (c.slip || 0) > 3 || (keys.Space && c.speed > 4);
    if (drifting) {
      c.skidT = (c.skidT || 0) - dt;
      if (c.skidT <= 0) {
        c.skidT = 0.05;
        const [fx, fz] = fwd(c.h); const sx = fz, sz = -fx;
        const back = c.spec.len * 0.35, hw = c.spec.wid / 2 - 0.15;
        addSkid(c.x - fx * back + sx * hw, c.z - fz * back + sz * hw, c.h);
        addSkid(c.x - fx * back - sx * hw, c.z - fz * back - sz * hw, c.h);
      }
    } else c.skidT = 0;
  }
  updateFx(dt);
  for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].gone) { scene.remove(vehicles[i].mesh); if (P.car === vehicles[i]) P.car = null; vehicles.splice(i, 1); }
  for (const v of vehicles) {
    v.mesh.position.set(v.x, v.y || 0, v.z); v.mesh.rotation.y = v.h;
    const ws = v.mesh.userData.wheels; const spin = (v === P.car ? v.vf : v.vf) * dt / 0.36;
    ws.forEach((w, i) => { w.rotation.x += spin / w.scale.x; if (i < 2 && v.type !== 'trattore') w.rotation.y = v === P.car ? v.steer : 0; if (v.type === 'trattore' && i >= 2) w.rotation.y = 0; });
    if (v.type === 'apecar' && v === P.car) ws[0].rotation.y = v.steer;
    if (v.mesh.userData.siren) { const on = Math.floor(now * 6) % 2; v.mesh.userData.siren[0].material.color.set(on ? '#1e6bff' : '#0a1a40'); v.mesh.userData.siren[1].material.color.set(on ? '#0a1a40' : '#1e6bff'); }
    // rollio, beccheggio e stop
    if (v === P.car) {
      v.mesh.rotation.z = clamp(-v.steer * v.speed * 0.012, -0.08, 0.08);
      v.mesh.rotation.x = clamp(-(v.accel || 0) * 0.0035, -0.05, 0.05);
      const braking = keys.KeyS || keys.ArrowDown || keys.Space;
      for (const m of v.mesh.userData.tailMats || []) m.color.set(braking ? '#ff3a3a' : '#c01818');
    } else {
      v.mesh.rotation.x = 0; v.mesh.rotation.z = 0;
    }
  }
  for (const p of peds) {
    updatePed(p, dt);
    if (p.vy || p.y > 0) { p.vy -= 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) p.vy = 0; }
    p.mesh.position.set(p.x, p.y, p.z); p.mesh.rotation.y = p.h;
  }
  if (passenger && passenger.inCar && P.car) { passenger.x = P.car.x; passenger.z = P.car.z; }
  // recycle far traffic / peds
  respawnT -= dt;
  if (respawnT < 0) {
    respawnT = 0.5;
    for (const v of vehicles) if (v.ai && Math.hypot(v.x - P.x, v.z - P.z) > 470) placeTraffic(v, 160, 430);
    for (const p of peds) if (p !== passenger && !p.waiting && Math.hypot(p.x - P.x, p.z - P.z) > 300) placePed(p, 90, 280);
    // parked cars left far away get recycled into traffic? keep them: they are "real" parking
  }
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.t -= dt; if (b.t <= 0) { b.obj.mesh.remove(b.b); if (b.obj.bubble === b.b) b.obj.bubble = null; bubbles.splice(i, 1); } }

  updateMission(dt);
  updateWanted(dt);
  updatePickups(dt);
  checkAchievements();
  radioTick();
  if (P.car) stats.km += (P.car.speed || 0) * dt / 1000;
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) { const f = $('flash'); if (f) f.classList.remove('on'); const m = $('flashmsg'); if (m) m.style.opacity = 0; } }
  updateCamera(dt);

  // labels only when close
  for (const pl of W.places) { const d = Math.hypot(pl.x - P.x, pl.z - P.z); pl.label.visible = d < 160; }
  for (const g of givers) { g.beacon.children[0].material.opacity = 0.25 + Math.sin(now * 3) * 0.08; }
  targetBeacon.children[0].material.opacity = 0.28 + Math.sin(now * 4) * 0.1;
  if (mission) {
    const st = mission.steps[mission.step]; arrow.visible = true;
    const ay = P.car ? P.car.spec.height + 2.0 : P.y + 2.5; arrow.scale.setScalar(P.car ? 1.4 : 0.7); arrow.position.set(P.x, ay + Math.sin(now * 4) * 0.12, P.z);
    arrow.rotation.y = Math.atan2(st.x - P.x, st.z - P.z);
  } else arrow.visible = false;

  // ciclo giorno/notte, sole e ombre
  updateDayNight(dt);
  sun.position.set(P.x + sunDir.x * 250, sunDir.y * 250, P.z + sunDir.z * 250); sun.target.position.set(P.x, 0, P.z);
  // fog
  const fogNear = foggy ? 6 : 220, fogFar = foggy ? 120 : 1500;
  scene.fog.near += (fogNear - scene.fog.near) * Math.min(1, dt * 1.5); scene.fog.far += (fogFar - scene.fog.far) * Math.min(1, dt * 1.5);
  const fc = foggy ? FOG : skyNow; scene.fog.color.lerp(fc, Math.min(1, dt * 1.5)); scene.background.copy(scene.fog.color);

  // audio
  if (engGain) {
    if (P.car && !muted) { const s = P.car.speed || 0; const ty = P.car.type; const base = ty === 'trattore' ? 30 : ty === 'apecar' ? 70 : 45; engOsc.frequency.value = base + s * (ty === 'apecar' ? 7 : 3.2) + ((keys.KeyW || keys.ArrowUp) ? 12 : 0); engFilt.frequency.value = 300 + s * 25; engGain.gain.value = 0.035 + Math.min(0.03, s * 0.001); }
    else engGain.gain.value = 0;
  }
  if (skidGain) skidGain.gain.value = (P.car && !muted && (P.car.slip || 0) > 3) ? Math.min(0.055, (P.car.slip || 0) * 0.011) : 0;

  // HUD
  streetT -= dt;
  if (streetT < 0) { streetT = 0.25; const r = W.roadAt(P.x, P.z, 22); $('street').textContent = r ? r.n : 'Moglia'; }
  $('money').textContent = money.toLocaleString('it-IT') + ' €';
  $('speed').style.display = P.car ? 'block' : 'none';
  if (P.car) $('speed').innerHTML = `${Math.round(P.car.speed * 3.6)}<small> km/h</small>`;
  const hpEl = $('hpfill'); if (hpEl) hpEl.style.width = Math.max(0, Math.min(100, hp / maxHp * 100)) + '%';
  const arEl = $('arfill'); if (arEl) arEl.style.width = armor + '%';
  const carBarEl = $('carbar'); if (carBarEl) carBarEl.style.display = P.car ? 'block' : 'none';
  const carFillEl = $('carfill'); if (carFillEl) carFillEl.style.width = (P.car ? Math.max(0, P.car.health) : 100) + '%';
  const wEl = $('wanted'); if (wEl) { wEl.textContent = wanted.level ? '★'.repeat(wanted.level) + '☆'.repeat(5 - wanted.level) : ''; wEl.style.opacity = wanted.level ? 1 : 0; }
  const pkEl = $('pickups'); if (pkEl) pkEl.textContent = '🥪 ' + stats.panini + '/' + panini.length;
  const rdEl = $('radio'); if (rdEl) { rdEl.style.display = P.car ? 'block' : 'none'; if (P.car && station >= 0) rdEl.textContent = '📻 ' + STATIONS[station].name; }
  if (mission) {
    $('mission').style.display = 'block';
    const st = mission.steps[mission.step]; const d = Math.round(Math.hypot(st.x - P.x, st.z - P.z));
    const tl = Math.max(0, mission.left), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60);
    $('mission').innerHTML = `<b>${mission.title}</b><br>${st.text}<br><span class="tm ${tl < 15 ? 'low' : ''}">⏱ ${mm}:${String(ss).padStart(2, '0')}</span> · ${d} m · premi ${mission.reward} €`;
  } else $('mission').style.display = 'none';
  // context hint
  if (hintT > 0) hintT -= dt; else {
    let h = '';
    if (!P.car) { let near = vehicles.some(v => Math.hypot(v.x - P.x, v.z - P.z) < v.spec.len / 2 + 2.5); if (near) h = isTouch ? 'Prem 🚗 per salì' : 'Prem E per salì'; }
    else if (nearGarage() && P.car.speed < 2) h = 'E per andà in officina';
    else if (P.car.speed < 1 && !mission) h = isTouch ? '' : 'E per scénd · H clacson · Q radio';
    $('hint').textContent = h; $('hint').style.opacity = h ? 1 : 0;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  drawMinimap();
  renderer.render(scene, camera);
}

let idleA = 0;
function idleCam(dt) {
  idleA += dt * 0.06; const r = 260;
  camera.position.set(P.x + Math.cos(idleA) * r, 140, P.z + Math.sin(idleA) * r); camera.lookAt(P.x, 0, P.z);
  sun.position.set(P.x + sunDir.x * 250, sunDir.y * 250, P.z + sunDir.z * 250); sun.target.position.set(P.x, 0, P.z);
  player.position.set(P.x, 0, P.z);
}
// ---- collega i pannelli di officina e telefono ----
{
  const sw = $('swatches');
  if (sw) for (const c of ['#c0392b', '#2e86c1', '#e8e8e8', '#1c2833', '#d4ac0d', '#239b56', '#8e44ad', '#ff7a00']) {
    const b = document.createElement('button'); b.className = 'sw'; b.style.background = c;
    b.title = c; b.addEventListener('click', () => buyPaint(c)); sw.appendChild(b);
  }
  const charsEl = $('chars');
  if (charsEl) {
    charsEl.innerHTML = CHARACTERS.map((c, i) =>
      '<button class="char' + (i === charIdx ? ' sel' : '') + '" data-i="' + i + '">' +
      '<span class="avatar" style="background:linear-gradient(180deg,' + c.shirt + ' 58%,' + c.pants + ' 58%)"><i style="background:' + c.skin + '"></i></span>' +
      '<span class="cname"><b>' + c.name + '</b><small>' + c.tag + '</small></span>' +
      '<em>' + c.desc + '</em></button>').join('');
    charsEl.querySelectorAll('.char').forEach(b => b.addEventListener('click', () => selectCharacter(+b.dataset.i)));
  }
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  on('gTune', buyTune); on('gRepair', buyRepair); on('gClose', closeGarage);
  on('pTaxi', () => startMissionById('taxi'));
  on('pPane', () => startMissionById('pane'));
  on('pGiro', () => startMissionById('giro'));
  on('pPolice', bribe);
  on('pMeteo', () => { foggy = !foggy; toast(foggy ? '🌫️ L\'è rivà la nebbia de la Bassa…' : '☀️ La nebbia la s\'è alzada', 2000); });
  on('pClose', closePhone);
}
addEventListener('keydown', (e) => { if (started && !garageOpen && !phoneOpen) keyCheat(e.key); });

$('loading').style.display = 'none';
$('intro').style.display = 'flex';
$('play').addEventListener('click', () => {
  started = true; $('intro').style.display = 'none'; $('hud').style.display = 'block'; initAudio();
  if (AC && AC.state === 'suspended') AC.resume();
  const c = CHARACTERS[charIdx];
  maxHp = c.maxHp; hp = maxHp; armor = 0;
  if (c.bonus) addMoney(c.bonus);
  camYaw = MUN ? MUN.faceYaw : Math.PI; toast('Benvegnù a Moglia, ' + c.name + '! Gh\'è un\'auto davanti: prem E per salì.', 5000);
  if (!isTouch) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
});
requestAnimationFrame(loop);
window.__game = {
  P, W, vehicles, peds, get fps() { return fps; }, keys, startMission, givers, camera,
  setYaw: (y) => camYaw = y, setPitch: (p) => { camPitch = p; lastMouse = now + 100; }, toggleCar,
  stats, wanted, cops, panini, stunts, pickups, garage, ACHIEVEMENTS, STATIONS, CHARACTERS, selectCharacter,
  damage: damagePlayer, damageCar, repairCar, crime: setWanted, clearWanted, addMoney, tuneCar, paintCar, radioSwitch,
  get hp() { return hp; }, get armor() { return armor; }, get maxHp() { return maxHp; }, get charIdx() { return charIdx; }, get money() { return money; },
  get tod() { return tod; }, setTod: (t) => { tod = t; }, get sunIntensity() { return sun.intensity; },
  get starterCar() { return starterCar; },
  get station() { return station; }, get phoneOpen() { return phoneOpen; }, get garageOpen() { return garageOpen; },
  openGarage, closeGarage, openPhone, closePhone,
};
