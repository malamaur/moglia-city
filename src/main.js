import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeVehicle, makePerson, animatePerson, speechBubble, CAR_COLORS } from './entities.js';
import { rng } from './util.js';
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
const SUN_DIR = new THREE.Vector3(-0.55, 0.75, 0.38).normalize();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

$('loadmsg').textContent = 'Costruisco le vie di Moglia…';
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
let AC = null, engOsc, engGain, engFilt;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engOsc = AC.createOscillator(); engOsc.type = 'sawtooth';
    engFilt = AC.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 500;
    engGain = AC.createGain(); engGain.gain.value = 0;
    engOsc.connect(engFilt).connect(engGain).connect(AC.destination); engOsc.start();
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
const TYPES = ['utilitaria', 'utilitaria', 'utilitaria', 'berlina', 'berlina', 'furgone', 'apecar', 'trattore', 'vigili'];
function spawnVehicle(type, x, z, h) {
  const color = type === 'vigili' ? '#f4f6f7' : type === 'trattore' ? (R() < 0.5 ? '#2e7d32' : '#c0392b') : type === 'apecar' ? (R() < 0.5 ? '#2e86c1' : '#d4ac0d') : CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
  const vh = makeVehicle(type, color);
  const car = { ...vh, x, z, h, vf: 0, vel: new THREE.Vector2(), steer: 0, ai: null, stun: 0, honkT: 0 };
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
const SHOUTS_DODGE = ['Ohé!', 'Ma sei matto?!', 'Piano!', 'Occhio!', 'Va\' pian!', 'Eh là!'];
const SHOUTS_HIT = ['Ma va\' là!', 'Ahia!', 'Te ghe l\'patente?', 'Ma dai!'];
const SHOUTS_CAR = ['Ehi! La mia macchina!', 'Ladro! Torna qui!', 'Ma cosa fai?!'];
const SHOUTS_HONK = ['Dai, muoviti!', 'Allora?!', 'Sveglia!'];

// ---------------- player ----------------
const player = makePerson(R, { shirt: '#1f6fb2', pants: '#2b2f38', hair: '#3a2a1c', skin: '#e9bf9b', scale: 1.0 });
scene.add(player);
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
  // one car right next to the player to get going
  {
    const v = W.nearestDriveVert(P.x, P.z); const e = W.adj[v][0];
    const off = 3.2; const [tx, tz] = e ? laneTarget(v, e.to, off) : [P.x + 3, P.z];
    const car = spawnVehicle('utilitaria', tx, tz, e ? Math.atan2(vx(e.to) - vx(v), vz(e.to) - vz(v)) : 0);
    car.mesh.children[0].material.color.set('#c0392b');
    const pos = { x: car.x, z: car.z }; W.collideCircle(pos, 1.2); car.x = pos.x; car.z = pos.z;
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
    mission = { id: 'pane', title: 'Consegna del pane', steps: [{ x: d.rx, z: d.rz, text: `Porta il pane caldo a: ${d.name}` }], time: Math.round(dist / 9 + 25), reward: Math.round(40 + dist / 12) };
    toast('🥖 Pane caricato! Portalo a ' + d.name);
  } else if (g.id === 'taxi') {
    let pv; for (let k = 0; k < 50; k++) { pv = townVerts[Math.floor(R() * townVerts.length)]; const d = Math.hypot(vx(pv) - P.x, vz(pv) - P.z); if (d > 150 && d < 550) break; }
    const dv = W.nearestDriveVert(vx(pv), vz(pv));
    const cands = DESTS.filter(p => Math.hypot(p.rx - vx(dv), p.rz - vz(dv)) > 250);
    const d = cands[Math.floor(R() * cands.length)] || DESTS[0];
    const dist = Math.hypot(vx(dv) - P.x, vz(dv) - P.z) + Math.hypot(d.rx - vx(dv), d.rz - vz(dv));
    mission = { id: 'taxi', title: 'Taxi di Moglia', needCar: true, steps: [{ x: vx(dv), z: vz(dv), text: 'Vai a prendere il cliente', pickup: true }, { x: d.rx, z: d.rz, text: `Porta il cliente a: ${d.name}` }], time: Math.round(dist / 8 + 30), reward: Math.round(60 + dist / 8) };
    passenger = spawnPed(makePerson(R)); passenger.ai = null; passenger.x = vx(dv) + 3; passenger.z = vz(dv); passenger.waiting = true;
    toast('🚕 Un cliente ti aspetta! Serve un\'auto.');
  } else if (g.id === 'giro') {
    const cx = 0, cz = 0;
    const pts = DESTS.map(p => ({ p, a: Math.atan2(p.rz - cz, p.rx - cx) })).sort((a, b) => a.a - b.a);
    const pick = []; const seen = new Set();
    for (const q of pts) { const k = Math.round(q.p.rx / 60) + ',' + Math.round(q.p.rz / 60); if (!seen.has(k)) { seen.add(k); pick.push(q.p); } }
    let start = 0, bd = 1e9; pick.forEach((p, i) => { const d = Math.hypot(p.rx - P.x, p.rz - P.z); if (d < bd) { bd = d; start = i; } });
    const seq = []; for (let i = 0; i < Math.min(7, pick.length); i++) seq.push(pick[(start + 1 + i) % pick.length]);
    let dist = 0, px = P.x, pz = P.z; for (const s of seq) { dist += Math.hypot(s.rx - px, s.rz - pz); px = s.rx; pz = s.rz; }
    mission = { id: 'giro', title: 'Giro di Moglia', needCar: false, steps: seq.map((s, i) => ({ x: s.rx, z: s.rz, text: `Tappa ${i + 1}/${seq.length}: ${s.name}` })), time: Math.round(dist / 13 + 30), reward: Math.round(100 + dist / 6) };
    toast('🏁 Via! Passa da tutte le tappe prima che scada il tempo.');
  }
  mission.step = 0; mission.left = mission.time; mission.giver = g;
  givers.forEach(gg => gg.beacon.visible = false);
  beep(660, 0.15); beep(880, 0.2);
}
function endMission(ok, msg) {
  if (ok) { money += mission.reward; try { localStorage.setItem('moglia_money', money); } catch (_) {} beep(784, 0.15); setTimeout(() => beep(1046, 0.3), 140); }
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
  if (mission.left <= 0) return endMission(false, '⏱️ Tempo scaduto! Missione fallita.');
  const d = Math.hypot(st.x - P.x, st.z - P.z);
  if (st.pickup && passenger && !passenger.inCar) {
    if (d < 8) {
      if (!P.car) { hint('Ti serve un\'auto per il cliente!'); return; }
      if (P.car.speed > 2) { hint('Fermati per far salire il cliente'); return; }
      passenger.inCar = true; passenger.mesh.visible = false; say(P.car, 'Buongiorno! Andiamo?', 2); mission.step++; beep(700, 0.12);
    }
    return;
  }
  if (d < (P.car ? 7 : 4)) {
    if (mission.id === 'taxi' && P.car && P.car.speed > 2) { hint('Fermati per far scendere il cliente'); return; }
    mission.step++;
    beep(880, 0.12);
    if (mission.step >= mission.steps.length) {
      const bonus = Math.round(mission.left * 1.5); mission.reward += bonus;
      return endMission(true, `✅ ${mission.title} completata! +${mission.reward} € (bonus tempo ${bonus} €)`);
    }
    toast(mission.steps[mission.step].text, 2000);
  }
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
  if (mission) mission.steps.forEach((st, i) => { if (i < mission.step) return; c.beginPath(); c.arc(X(st.x), Y(st.z), i === mission.step ? 10 : 6, 0, 7); c.fillStyle = i === mission.step ? '#3fa9ff' : 'rgba(63,169,255,.5)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); });
  c.save(); c.translate(X(P.x), Y(P.z)); c.rotate(-(P.car ? P.car.h : P.h) + Math.PI);
  c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#ff3b30'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); c.restore();
  c.fillStyle = 'rgba(20,24,30,.8)'; c.fillRect(12, h - 34, 360, 24); c.fillStyle = '#fff'; c.font = '12px system-ui'; c.textAlign = 'left';
  c.fillText('Moglia (MN) · rotella/+/- zoom · trascina per spostare · M per chiudere', 20, h - 22);
  c.textAlign = 'right'; c.fillStyle = 'rgba(20,24,30,.7)'; c.fillText('Dati © OpenStreetMap contributors (ODbL)', w - 12, h - 12);
}
big.addEventListener('wheel', (e) => { bigZoom = clamp(bigZoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.6, 8); drawBigMap(); e.preventDefault(); }, { passive: false });
{ let d = false, ax = 0, ay = 0; big.addEventListener('mousedown', (e) => { d = true; ax = e.clientX; ay = e.clientY; }); addEventListener('mouseup', () => d = false);
  big.addEventListener('mousemove', (e) => { if (!d) return; const s = Math.min(innerWidth / (ex1 - ex0), innerHeight / (ez1 - ez0)) * 0.95 * bigZoom; bigCx -= (e.clientX - ax) / s; bigCz -= (e.clientY - ay) / s; ax = e.clientX; ay = e.clientY; drawBigMap(); }); }

// ---------------- key actions ----------------
let foggy = false, started = false;
function onKey(code) {
  if (!started) return;
  if (code === 'KeyE' || code === 'KeyF' || code === 'Enter') toggleCar();
  if (code === 'KeyM') { bigMap = !bigMap; big.style.display = bigMap ? 'block' : 'none'; if (bigMap) { bigCx = P.x; bigCz = P.z; bigZoom = 1.6; drawBigMap(); if (document.exitPointerLock) document.exitPointerLock(); } }
  if (bigMap && (code === 'Equal' || code === 'NumpadAdd')) { bigZoom = Math.min(8, bigZoom * 1.2); drawBigMap(); }
  if (bigMap && (code === 'Minus' || code === 'NumpadSubtract')) { bigZoom = Math.max(0.6, bigZoom / 1.2); drawBigMap(); }
  if (code === 'KeyN') { foggy = !foggy; toast(foggy ? '🌫️ È arrivata la nebbia della Bassa…' : '☀️ La nebbia si è alzata'); }
  if (code === 'KeyC') camDistIdx = (camDistIdx + 1) % 3;
  if (code === 'KeyH' && P.car) { horn(); for (const p of peds) if (!p.down && Math.hypot(p.x - P.x, p.z - P.z) < 18 && R() < 0.5) say(p, SHOUTS_DODGE[Math.floor(R() * SHOUTS_DODGE.length)]); }
  if (code === 'KeyU') { muted = !muted; toast(muted ? '🔇 Audio disattivato' : '🔊 Audio attivo'); }
  if (code === 'KeyR' && P.car) { P.car.h += 0; P.car.vf = 0; P.car.vel.set(0, 0); const v = W.nearestDriveVert(P.car.x, P.car.z); P.car.x = vx(v); P.car.z = vz(v); toast('🔧 Auto rimessa in strada'); }
  if (code === 'Escape' && bigMap) { bigMap = false; big.style.display = 'none'; }
}
function toggleCar() {
  if (P.car) {
    const car = P.car; if (car.speed > 4) { hint('Rallenta prima di scendere!'); return; }
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
  if (!best) { hint('Nessun veicolo vicino'); return; }
  if (best.ai) {
    // the driver gets out, not amused
    const pd = spawnPed(); const [fx, fz] = fwd(best.h);
    pd.x = best.x - fz * 2; pd.z = best.z + fx * 2; pd.ai = null; pd.fleeT = 4; pd.h = best.h;
    say(pd, SHOUTS_CAR[Math.floor(R() * SHOUTS_CAR.length)], 3);
    best.ai = null;
    if (best.type === 'vigili') toast('🚓 Hai preso l\'auto dei Vigili… non è una bella idea!');
  }
  P.car = best; best.vf = best.vf || 0; player.visible = false; camYaw = best.h; initAudio();
  const names = { utilitaria: 'Utilitaria', berlina: 'Berlina', furgone: 'Furgone', apecar: 'Motocarro', trattore: 'Trattore', vigili: 'Auto della Polizia Locale' };
  toast(names[best.type] || 'Veicolo', 1500);
}

// ---------------- physics ----------------
const tmpPos = { x: 0, z: 0 };
let shake = 0;
function updatePlayerCar(car, dt) {
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
  collideCar(car, true);
  car.speed = Math.hypot(car.vel.x, car.vel.y);
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
      if (-vn > 4) { shake = Math.min(1, -vn / 15); beep(70 + R() * 30, 0.18, 'sawtooth', Math.min(0.2, -vn / 60)); }
    }
  }
  // vehicles against vehicles
  for (const o of vehicles) {
    if (o === car) continue;
    const d0 = Math.hypot(o.x - car.x, o.z - car.z); if (d0 > 7) continue;
    for (const a of carCircles(car)) for (const b of carCircles(o)) {
      const dx = a[0] - b[0], dz = a[1] - b[1], d = Math.hypot(dx, dz), m = a[2] + b[2];
      if (d < m && d > 1e-3) {
        const pen = (m - d), ux = dx / d, uz = dz / d;
        const heavy = o.type === 'trattore' ? 0.85 : 0.5;
        car.x += ux * pen * heavy; car.z += uz * pen * heavy;
        if (isPlayer) {
          o.x -= ux * pen * (1 - heavy); o.z -= uz * pen * (1 - heavy);
          const vn = car.vel.x * ux + car.vel.y * uz;
          if (vn < 0) { car.vel.x -= ux * vn * 1.2; car.vel.y -= uz * vn * 1.2; const [fx, fz] = fwd(car.h); car.vf = (car.vel.x * fx + car.vel.y * fz) * 0.8; if (-vn > 3) { shake = Math.min(1, -vn / 12); beep(90, 0.15, 'square', 0.06); } }
          if (o.ai) { o.stun = 1.2; o.vf *= 0.3; if (o.honkT <= 0) { say(o, SHOUTS_HONK[Math.floor(R() * SHOUTS_HONK.length)]); o.honkT = 4; horn(); } }
          else { o.h += (R() - 0.5) * pen * 0.2; }
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
      hint('Attento ai pedoni!'); return;
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
  let ix = ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0);
  let iz = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
  if (touch.active) { ix = touch.x; iz = -touch.y; }
  const run = keys.ShiftLeft || keys.ShiftRight || (touch.active && Math.hypot(touch.x, touch.y) > 0.9);
  const l = Math.hypot(ix, iz);
  let sp = 0;
  if (l > 0.05) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx; // right vector
    const mx = (fx * iz + rx * ix) / Math.max(1, l), mz = (fz * iz + rz * ix) / Math.max(1, l);
    sp = (run ? 7.2 : 3.4) * Math.min(1, l);
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
    if (v.ai && v.speed > 3) { const dx = P.x - v.x, dz = P.z - v.z; if (Math.hypot(dx, dz) < v.spec.len / 2) { P.vy = 4; } }
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
    const c = P.car; tx = c.x; ty = c.spec.height + 0.6; tz = c.z; dist += c.spec.len * 0.3;
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
    const steps = 2; for (let i = 0; i < steps; i++) updatePlayerCar(P.car, dt / steps);
    P.x = P.car.x; P.z = P.car.z; P.y = 0;
  } else updatePlayerFoot(dt);
  for (const v of vehicles) {
    if (v === P.car) continue;
    if (v.ai) updateTraffic(v, dt);
    else if (v.vf) { v.vf *= Math.max(0, 1 - dt * 2); advanceCarKinematic(v, dt); collideCar(v, false); if (Math.abs(v.vf) < 0.1) v.vf = 0; }
  }
  for (const v of vehicles) {
    v.mesh.position.set(v.x, 0, v.z); v.mesh.rotation.y = v.h;
    const ws = v.mesh.userData.wheels; const spin = (v === P.car ? v.vf : v.vf) * dt / 0.36;
    ws.forEach((w, i) => { w.rotation.x += spin / w.scale.x; if (i < 2 && v.type !== 'trattore') w.rotation.y = v === P.car ? v.steer : 0; if (v.type === 'trattore' && i >= 2) w.rotation.y = 0; });
    if (v.type === 'apecar' && v === P.car) ws[0].rotation.y = v.steer;
    if (v.mesh.userData.siren) { const on = Math.floor(now * 6) % 2; v.mesh.userData.siren[0].material.color.set(on ? '#1e6bff' : '#0a1a40'); v.mesh.userData.siren[1].material.color.set(on ? '#0a1a40' : '#1e6bff'); }
    // body roll
    if (v === P.car) { v.mesh.rotation.z = clamp(-v.steer * v.speed * 0.012, -0.08, 0.08); }
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

  // sun & shadows follow the player
  sun.position.set(P.x + SUN_DIR.x * 250, SUN_DIR.y * 250, P.z + SUN_DIR.z * 250); sun.target.position.set(P.x, 0, P.z);
  // fog
  const fogNear = foggy ? 6 : 220, fogFar = foggy ? 120 : 1500;
  scene.fog.near += (fogNear - scene.fog.near) * Math.min(1, dt * 1.5); scene.fog.far += (fogFar - scene.fog.far) * Math.min(1, dt * 1.5);
  const fc = foggy ? FOG : SKY; scene.fog.color.lerp(fc, Math.min(1, dt * 1.5)); scene.background.copy(scene.fog.color);
  hemi.intensity += ((foggy ? 1.5 : 1.1) - hemi.intensity) * dt; sun.intensity += ((foggy ? 0.5 : 2.0) - sun.intensity) * dt;

  // audio
  if (engGain) {
    if (P.car && !muted) { const s = P.car.speed; const ty = P.car.type; const base = ty === 'trattore' ? 30 : ty === 'apecar' ? 70 : 45; engOsc.frequency.value = base + s * (ty === 'apecar' ? 7 : 3.2) + ((keys.KeyW || keys.ArrowUp) ? 12 : 0); engFilt.frequency.value = 300 + s * 25; engGain.gain.value = 0.035 + Math.min(0.03, s * 0.001); }
    else engGain.gain.value = 0;
  }

  // HUD
  streetT -= dt;
  if (streetT < 0) { streetT = 0.25; const r = W.roadAt(P.x, P.z, 22); $('street').textContent = r ? r.n : 'Moglia'; }
  $('money').textContent = money.toLocaleString('it-IT') + ' €';
  $('speed').style.display = P.car ? 'block' : 'none';
  if (P.car) $('speed').innerHTML = `${Math.round(P.car.speed * 3.6)}<small> km/h</small>`;
  if (mission) {
    $('mission').style.display = 'block';
    const st = mission.steps[mission.step]; const d = Math.round(Math.hypot(st.x - P.x, st.z - P.z));
    const tl = Math.max(0, mission.left), mm = Math.floor(tl / 60), ss = Math.floor(tl % 60);
    $('mission').innerHTML = `<b>${mission.title}</b><br>${st.text}<br><span class="tm ${tl < 15 ? 'low' : ''}">⏱ ${mm}:${String(ss).padStart(2, '0')}</span> · ${d} m · ricompensa ${mission.reward} €`;
  } else $('mission').style.display = 'none';
  // context hint
  if (hintT > 0) hintT -= dt; else {
    let h = '';
    if (!P.car) { let near = vehicles.some(v => Math.hypot(v.x - P.x, v.z - P.z) < v.spec.len / 2 + 2.5); if (near) h = isTouch ? 'Premi 🚗 per salire' : 'Premi E per salire'; }
    else if (P.car.speed < 1 && !mission) h = isTouch ? '' : 'E per scendere · H clacson';
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
  sun.position.set(P.x + SUN_DIR.x * 250, SUN_DIR.y * 250, P.z + SUN_DIR.z * 250); sun.target.position.set(P.x, 0, P.z);
  player.position.set(P.x, 0, P.z);
}
$('loading').style.display = 'none';
$('intro').style.display = 'flex';
$('play').addEventListener('click', () => {
  started = true; $('intro').style.display = 'none'; $('hud').style.display = 'block'; initAudio();
  if (AC && AC.state === 'suspended') AC.resume();
  camYaw = MUN ? MUN.faceYaw : Math.PI; toast('Benvenuto a Moglia! Raggiungi un segnale colorato per iniziare una missione.', 4500);
  if (!isTouch) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
});
requestAnimationFrame(loop);
window.__game = { P, W, vehicles, peds, get fps() { return fps; }, keys, startMission, givers, camera, setYaw: (y) => camYaw = y, setPitch: (p) => { camPitch = p; lastMouse = now + 100; }, toggleCar };
