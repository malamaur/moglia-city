import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, noise, rng, signedArea } from './util.js';

// ---- helpers ---------------------------------------------------------------
function segDist(x, z, a, b, c, d) {
  const dx = c - a, dz = d - b, l = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / l));
  return Math.hypot(x - a - dx * t, z - b - dz * t);
}
// building (raw data index) whose outline passes closest to a point
export function nearestBuildingIndex(D, x, z, maxD = 12) {
  let best = -1, bd = maxD;
  D.buildings.forEach((b, i) => {
    const p = b.p, n = p.length / 2;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n; const d = segDist(x, z, p[k * 2], p[k * 2 + 1], p[j * 2], p[j * 2 + 1]);
      if (d < bd) { bd = d; best = i; }
    }
  });
  return best;
}
// longest-ish oriented wall edge of a processed building facing a point
function facadeEdge(rec, x, z) {
  const p = rec.p, n = p.length / 2; let best = null, bs = -1e9;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n; const ax = p[k * 2], az = p[k * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
    const nx = -(bz - az) / L, nz = (bx - ax) / L; // outward normal
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const facing = (x - mx) * nx + (z - mz) * nz; if (facing <= 0) continue;
    const score = L * 0.3 - segDist(x, z, ax, az, bx, bz);
    if (score > bs) { bs = score; best = { ax, az, bx, bz, L, nx, nz }; }
  }
  return best;
}
// local frame: X = viewer's right along the facade, Y up, Z = out of the wall
function frameFor(e) {
  const rx = e.nz, rz = -e.nx; // right of a viewer looking at the wall
  const da = e.ax * rx + e.az * rz, db = e.bx * rx + e.bz * rz;
  const ox = da < db ? e.ax : e.bx, oz = da < db ? e.az : e.bz;
  const g = new THREE.Group(); g.position.set(ox, 0, oz); g.rotation.y = Math.atan2(-rz, rx);
  return { g, rx, rz, ox, oz, toWorld: (u, w) => [ox + rx * u + e.nx * w, oz + rz * u + e.nz * w] };
}
function addBoxObstacle(W, cx, cz, hw, hd, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  let pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]);
  if (signedArea(pts.flat()) > 0) pts.reverse();
  for (let i = 0; i < 4; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % 4]; W.segs.push([x0, z0, x1, z1]); W.segGrid.addBox(x0, z0, x1, z1, W.segs.length - 1); }
}
const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
function bx(w, h, d, m, x, y, z, parent) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; }
function plane(w, h, m, x, y, z, parent, rx = 0) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.x = rx; p.receiveShadow = true; parent.add(p); return p; }

// ---- textures --------------------------------------------------------------
function makeTextures() {
  const R = rng(99);
  const granite = canvasTex(128, 128, (c, w, h) => {
    noise(c, w, h, '#86564b', 0.0, 0, R);
    for (let i = 0; i < 2600; i++) { const v = R(); c.fillStyle = v < 0.45 ? '#5b3a33' : v < 0.8 ? '#a57565' : '#c9a497'; c.fillRect(R() * w, R() * h, 1 + R() * 1.6, 1 + R() * 1.6); }
    c.strokeStyle = 'rgba(40,20,15,.35)'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1);
  });
  const brick = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#d8c6b2'; c.fillRect(0, 0, w, h);
    const rows = 16, bw = 32, bh = h / rows;
    for (let r = 0; r < rows; r++) for (let k = -1; k < 5; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      const t = R(); c.fillStyle = `hsl(${12 + t * 8},${48 + t * 12}%,${36 + R() * 10}%)`;
      c.fillRect(x + 1, r * bh + 1, bw - 2, bh - 1.6);
    }
  });
  const shutter = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#c8806a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { c.fillStyle = 'rgba(70,25,15,.35)'; c.fillRect(0, y, w, 1); } });
  const brickShutter = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#a8462f'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { c.fillStyle = 'rgba(40,10,5,.35)'; c.fillRect(0, y, w, 1); } });
  const scallop = (c, w, h, stripe) => {
    c.clearRect(0, 0, w, h);
    const sh = h * 0.82;
    if (stripe) { const n = 10; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fbf3ee' : '#e07f7f'; c.fillRect(i * w / n, 0, w / n + 1, sh); } }
    else { c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, w, sh); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, sh - 6, w, 6); }
    const n = 14; for (let i = 0; i < n; i++) { c.beginPath(); c.arc((i + 0.5) * w / n, sh, w / n / 2, 0, Math.PI); c.fillStyle = stripe ? (i % 2 ? '#fbf3ee' : '#e07f7f') : '#f4f2ec'; c.fill(); }
  };
  const awnWhiteVal = canvasTex(256, 32, (c, w, h) => scallop(c, w, h, false), false);
  const awnStripeVal = canvasTex(256, 32, (c, w, h) => scallop(c, w, h, true), false);
  const awnStripe = canvasTex(256, 32, (c, w, h) => { const n = 10; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fbf3ee' : '#e07f7f'; c.fillRect(i * w / n, 0, w / n + 1, h); } }, false);
  const sign = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fillStyle = '#c9b8a8'; c.fill();
    c.beginPath(); c.arc(128, 128, 116, 0, 7); c.fillStyle = '#fbf8f2'; c.fill();
    c.fillStyle = '#6b4a3a'; c.textAlign = 'center';
    c.font = 'italic 600 34px Georgia, serif'; c.fillText('Panificio Ada', 128, 104);
    c.font = '800 25px system-ui, sans-serif'; c.fillText('BOTTEGA', 128, 146); c.fillText('E CUCINA', 128, 174);
    c.fillRect(70, 118, 116, 2);
  }, false);
  const paving = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#9d958b'; c.fillRect(0, 0, w, h);
    const s = 32;
    for (let y = 0; y < h; y += s / 2) for (let x = 0; x < w; x += s) {
      const o = (y / (s / 2)) % 2 ? s / 2 : 0; const t = R();
      c.fillStyle = `hsl(${30 + t * 10},${10 + t * 8}%,${66 + R() * 12}%)`;
      c.fillRect(((x + o) % w) + 1, y + 1, s - 2, s / 2 - 2);
    }
  });
  paving.repeat.set(1, 1);
  const pinkWalk = canvasTex(128, 128, (c, w, h) => { noise(c, w, h, '#c9a196', 0.12, 2500, R); c.strokeStyle = 'rgba(90,50,40,.25)'; for (let i = 0; i <= w; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } });
  const euFlag = canvasTex(96, 64, (c, w, h) => { c.fillStyle = '#1f3f99'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd400'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(48 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 2.6, 0, 7); c.fill(); } }, false);
  const itFlag = canvasTex(96, 64, (c, w, h) => { c.fillStyle = '#009246'; c.fillRect(0, 0, 32, h); c.fillStyle = '#fff'; c.fillRect(32, 0, 32, h); c.fillStyle = '#ce2b37'; c.fillRect(64, 0, 32, h); }, false);
  return { granite, brick, shutter, brickShutter, awnWhiteVal, awnStripeVal, awnStripe, sign, paving, pinkWalk, euFlag, itFlag };
}

// ---- Panificio Ada ---------------------------------------------------------
// Prepare raw data (before the generic city is built): neighbour colours and heights
export function prepareLandmarks(D) {
  const ada = D.pois.find(p => p.n === 'Panificio Ada'); if (!ada) return null;
  const bi = nearestBuildingIndex(D, ada.x, ada.z);
  if (bi < 0) return null;
  D.buildings[bi].h = 7.0; D.buildings[bi].col = '#e9a58f'; D.buildings[bi].flat = true;
  return { ada, bi };
}

export function buildLandmarks(D, W, scene, prep) {
  if (!prep) return null;
  const T = makeTextures();
  const rec = W.blds.find(b => b.src === prep.bi); if (!rec) return null;
  const e = facadeEdge(rec, prep.ada.x, prep.ada.z); if (!e) return null;
  const F = frameFor(e); const g = F.g; scene.add(g);
  const LEN = e.L, LB = Math.min(7, LEN * 0.42), x0 = LB, WB = LEN - LB; // brick house on the left, bakery on the right
  const Z = 0.04; // tiny offset off the wall
  const U = (f) => x0 + f * WB; // bakery local x from fraction

  // === brick house (left neighbour in the photo) ===
  const brickMat = L('#ffffff', { map: T.brick }); T.brick.repeat.set(LB / 1.0, 6.7 / 1.0);
  plane(LB, 6.7, brickMat, LB / 2, 3.35, Z, g);
  const white = L('#f3f0ea');
  bx(LB, 0.34, 0.08, white, LB / 2, 0.17, Z + 0.04, g);           // plinth
  bx(LB, 0.14, 0.12, white, LB / 2, 3.4, Z + 0.06, g);            // string course
  bx(LB + 0.2, 0.25, 0.55, L('#6f6c69'), LB / 2, 6.75, 0.25, g);  // gutter/eave
  const bShut = L('#ffffff', { map: T.brickShutter });
  const glassDark = L('#2a3036');
  for (const f of [0.25, 0.72]) {
    const cx = LB * f;
    // upper window, white frame with small pediment
    bx(1.3, 1.45, 0.08, white, cx, 5.0, Z + 0.04, g); plane(1.06, 1.22, bShut, cx, 5.0, Z + 0.09, g);
    bx(1.4, 0.12, 0.16, white, cx, 5.77, Z + 0.08, g); bx(0.3, 0.16, 0.14, white, cx, 5.9, Z + 0.08, g);
    bx(1.45, 0.08, 0.22, white, cx, 4.24, Z + 0.1, g);
    // ground window with grille
    bx(1.3, 1.6, 0.08, white, cx, 2.05, Z + 0.04, g); plane(1.06, 1.36, glassDark, cx, 2.05, Z + 0.09, g);
    plane(1.06, 0.45, bShut, cx, 2.5, Z + 0.1, g);
    for (let i = 0; i < 8; i++) bx(0.03, 1.3, 0.03, L('#2b2b2b'), cx - 0.46 + i * 0.13, 2.02, Z + 0.15, g);
    for (const yy of [1.5, 2.55]) bx(1.06, 0.03, 0.03, L('#2b2b2b'), cx, yy, Z + 0.15, g);
    bx(1.4, 0.12, 0.16, white, cx, 2.9, Z + 0.08, g); bx(0.3, 0.16, 0.14, white, cx, 3.03, Z + 0.08, g);
    // terracotta lion head
    const lion = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), L('#b5694a')); lion.position.set(cx + (f < 0.5 ? 1.05 : 0.9), 1.85, Z + 0.1); lion.scale.z = 0.5; g.add(lion);
  }
  const dia = bx(0.42, 0.42, 0.05, white, LB * 0.48, 5.85, Z + 0.04, g); dia.rotation.z = Math.PI / 4;
  // planter with palm
  bx(1.5, 0.6, 0.75, L('#c9c4ba'), LB * 0.82, 0.3, 1.1, g);
  for (let i = 0; i < 18; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.0, 4), L(i % 3 ? '#4f7a3a' : '#6d8f45'));
    const a = i / 18 * Math.PI * 2; leaf.position.set(LB * 0.82 + Math.cos(a) * 0.25, 0.95, 1.1 + Math.sin(a) * 0.18);
    leaf.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(leaf);
  }
  // street lamp
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 8), L('#5f6266')); pole.position.set(LB * 0.6, 3.75, 2.0); pole.castShadow = true; g.add(pole);
  bx(0.06, 0.06, 1.0, L('#5f6266'), LB * 0.6, 7.4, 1.6, g); bx(0.35, 0.18, 0.5, L('#4a4c50'), LB * 0.6, 7.3, 1.15, g);

  // === Panificio Ada ===
  const salmon = L('#ec9f88'), whiteW = L('#f6f1ea');
  const graniteMat = L('#ffffff', { map: T.granite }); T.granite.repeat.set(WB / 0.6, 3.45 / 0.6);
  plane(WB, 3.45, graniteMat, x0 + WB / 2, 1.725, Z, g);
  plane(WB, 3.3, salmon, x0 + WB / 2, 3.45 + 1.65 + 0.15, Z, g);
  // shop windows/doors + white scalloped awnings
  const glass = new THREE.MeshPhongMaterial({ color: '#27323a', shininess: 120, specular: 0x9fb4c4 });
  const frame = L('#3a3d40');
  const awnTop = L('#f2efe8', { side: THREE.DoubleSide });
  const awnVal = L('#ffffff', { map: T.awnWhiteVal, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  for (const f of [0.24, 0.75]) {
    const cx = U(f), w = 2.5;
    plane(w, 2.55, glass, cx, 1.3, Z + 0.03, g);
    bx(w + 0.1, 0.1, 0.1, frame, cx, 2.6, Z + 0.05, g); bx(0.08, 2.6, 0.1, frame, cx - w / 2, 1.3, Z + 0.05, g); bx(0.08, 2.6, 0.1, frame, cx + w / 2, 1.3, Z + 0.05, g);
    bx(0.07, 2.5, 0.08, frame, cx + 0.1, 1.25, Z + 0.06, g); bx(0.9, 0.06, 0.06, L('#9aa0a6'), cx + 0.55, 1.1, Z + 0.1, g); // door
    // a hint of the counter inside
    bx(w - 0.4, 0.9, 0.05, L('#c8a27a'), cx, 0.45, Z + 0.02, g);
    // awning: sloped canvas + scalloped valance
    const aw = 3.3, depth = 1.15, drop = 0.45;
    const top = plane(aw, Math.hypot(depth, drop), awnTop, cx, 2.95 - drop / 2, depth / 2 + Z, g, -Math.PI / 2 + Math.atan2(drop, depth));
    top.castShadow = true;
    plane(aw, 0.32, awnVal, cx, 2.95 - drop - 0.14, depth + Z, g);
    for (const sx of [-1, 1]) { const arm = bx(0.03, 0.03, 1.25, L('#bbb'), cx + sx * aw * 0.45, 2.75, 0.6, g); arm.rotation.x = 0.35; }
  }
  // round sign "Panificio Ada – Bottega e Cucina"
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), L('#ffffff', { map: T.sign, transparent: true }));
  sign.position.set(U(0.49), 2.2, Z + 0.06); g.add(sign);
  bx(0.88, 0.88, 0.04, L('#b9a796'), U(0.49), 2.2, Z + 0.03, g).scale.set(1, 1, 1);
  g.children[g.children.length - 1].geometry = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 32).rotateX(Math.PI / 2);
  // balcony slab
  const slabD = 1.25;
  bx(WB, 0.2, slabD, whiteW, x0 + WB / 2, 3.55, slabD / 2, g);
  bx(WB + 0.02, 0.08, 0.02, salmon, x0 + WB / 2, 3.53, slabD + 0.005, g);
  // white parapet panels behind the railing (under the window pairs)
  for (const [a, b] of [[0.08, 0.42], [0.58, 0.92]]) bx(WB * (b - a), 0.75, 0.06, whiteW, U((a + b) / 2), 4.03, slabD - 0.12, g);
  // bellied iron railing (balaustra a pancia)
  {
    const geos = []; const n = Math.floor(WB / 0.13);
    const mk = (u, z0, len, side) => {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(u, 3.68, z0), new THREE.Vector3(u, 4.05, z0 + 0.32), new THREE.Vector3(u, 4.5, z0));
      geos.push(new THREE.TubeGeometry(curve, 6, 0.012, 4));
    };
    for (let i = 0; i <= n; i++) mk(x0 + 0.05 + i * (WB - 0.1) / n, slabD - 0.05);
    for (let i = 0; i <= 8; i++) mk(x0 + 0.02, 0.15 + i * (slabD - 0.25) / 8);
    for (let i = 0; i <= 8; i++) mk(LEN - 0.02, 0.15 + i * (slabD - 0.25) / 8);
    const rail = new THREE.Mesh(mergeGeometries(geos), L('#2f2f31')); rail.castShadow = true; g.add(rail);
    bx(WB, 0.05, 0.05, L('#2f2f31'), x0 + WB / 2, 4.52, slabD - 0.05, g);
    for (const ux of [x0 + 0.02, LEN - 0.02]) bx(0.05, 0.05, slabD, L('#2f2f31'), ux, 4.52, slabD / 2, g);
    for (let k = 1; k < 4; k++) bx(0.04, 0.85, 0.04, L('#2f2f31'), x0 + WB * k / 4, 4.1, slabD - 0.05, g);
  }
  // swing hanging from the balcony
  {
    const sx = U(0.5);
    for (const d of [-0.45, 0.45]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.8, 4), L('#b8956a')); r.position.set(sx + d, 3.45 - 1.4, 0.95); g.add(r); }
    bx(1.05, 0.05, 0.32, L('#9b7350'), sx, 0.64, 0.95, g);
  }
  // upper floor: pilasters, white bays, windows with roller shutters, striped awnings
  const shutM = L('#ffffff', { map: T.shutter });
  const winF = [0.19, 0.34, 0.5, 0.65, 0.8];
  for (const f of winF) {
    const cx = U(f);
    bx(1.12, 0.62, 0.03, whiteW, cx, 6.38, Z + 0.02, g);                         // white panel at the top of the bay
    plane(0.92, 1.55, shutM, cx, 4.95, Z + 0.05, g);                           // tapparella
    bx(1.0, 0.06, 0.06, whiteW, cx, 5.76, Z + 0.06, g); bx(0.05, 1.6, 0.05, whiteW, cx - 0.48, 4.95, Z + 0.06, g); bx(0.05, 1.6, 0.05, whiteW, cx + 0.48, 4.95, Z + 0.06, g);
  }
  const stripeTop = L('#ffffff', { map: T.awnStripe, side: THREE.DoubleSide });
  const stripeVal = L('#ffffff', { map: T.awnStripeVal, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  for (const [a, b] of [[0.19, 0.34], [0.65, 0.8]]) {
    const cx = U((a + b) / 2), aw = WB * (b - a) + 1.35, depth = 0.55, drop = 0.3;
    const t = plane(aw, Math.hypot(depth, drop), stripeTop, cx, 6.02 - drop / 2, depth / 2 + Z, g, -Math.PI / 2 + Math.atan2(drop, depth)); t.castShadow = true;
    plane(aw, 0.22, stripeVal, cx, 6.02 - drop - 0.1, depth + Z, g);
    for (const s of [-1, 1]) { // side flaps
      const fl = plane(0.45, 0.85, stripeTop, cx + s * aw / 2, 5.55, 0.3, g); fl.rotation.y = Math.PI / 2;
    }
  }
  // deep grey eave and flat roof edge
  bx(WB + 0.6, 0.28, 1.15, L('#a9a8a4'), x0 + WB / 2 + 0.25, 6.92, 0.5, g);
  bx(WB + 0.6, 0.06, 1.15, L('#d8d6d0'), x0 + WB / 2 + 0.25, 6.76, 0.5, g);
  // drainpipe at the boundary
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.8, 8), L('#9c9ea2')); pipe.position.set(x0 - 0.05, 3.4, 0.12); g.add(pipe);
  // outdoor furniture: two tall tables with black legs + small tables
  const wood = L('#b48a5e'), black = L('#26282b');
  for (const [a, b] of [[0.42, 0.57], [0.8, 0.95]]) {
    const cx = U((a + b) / 2), w = WB * (b - a);
    bx(w, 0.06, 0.45, wood, cx, 1.08, 2.0, g);
    for (const s of [-1, 1]) { bx(0.06, 1.08, 0.06, black, cx + s * (w / 2 - 0.08), 0.54, 1.82, g); bx(0.06, 1.08, 0.06, black, cx + s * (w / 2 - 0.08), 0.54, 2.18, g); bx(0.06, 0.06, 0.4, black, cx + s * (w / 2 - 0.08), 0.15, 2.0, g); }
    const [wx, wz] = F.toWorld(cx, 2.0); addBoxObstacle(W, wx, wz, w / 2, 0.25, -g.rotation.y);
  }
  for (const f of [0.08, 0.2, 0.62]) { const cx = U(f); bx(0.6, 0.05, 0.6, L('#cbb79a'), cx, 0.72, 0.9, g); for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(0.04, 0.72, 0.04, L('#cbb79a'), cx + s[0] * 0.26, 0.36, 0.9 + s[1] * 0.26, g); }
  for (const f of [0.07, 0.83]) { bx(0.3, 0.6, 0.3, whiteW, U(f) - 0.2, 0.3, 0.35, g); const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), L('#4b7a35', { flatShading: true })); bush.position.set(U(f) - 0.2, 0.85, 0.35); g.add(bush); }
  // gate towards the next building on the right
  {
    const gw = 4.6; const gx = LEN + gw / 2;
    for (let i = 0; i <= 30; i++) bx(0.03, 1.5, 0.03, L('#6d6f73'), LEN + 0.1 + i * (gw - 0.2) / 30, 0.75, 0.1, g);
    for (const y of [0.15, 1.45]) bx(gw, 0.05, 0.05, L('#6d6f73'), gx, y, 0.1, g);
    for (const ux of [LEN + 0.05, LEN + gw - 0.05]) bx(0.12, 1.7, 0.12, L('#6d6f73'), ux, 0.85, 0.1, g);
    const [wx, wz] = F.toWorld(gx, 0.1); addBoxObstacle(W, wx, wz, gw / 2, 0.1, -g.rotation.y);
  }
  // flags on the beige building further right
  {
    const fx = LEN + 4.6 + 3.5;
    for (const [i, tex] of [[0, T.itFlag], [1, T.euFlag]]) {
      const pg = new THREE.Group(); pg.position.set(fx + i * 0.35, 3.6, 0.15); pg.rotation.z = 0.55; pg.rotation.y = -0.25;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 6), L('#ccc')); p.position.y = 1.0; pg.add(p);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), L('#ffffff', { map: tex, side: THREE.DoubleSide })); fl.position.set(0.47, 1.65, 0); pg.add(fl);
      g.add(pg);
    }
  }
  // paving in front: interlocking blocks + pink sidewalk + white hatching
  {
    const pg = new THREE.Group(); pg.position.copy(g.position); pg.rotation.copy(g.rotation); scene.add(pg);
    const len = LEN + 14, mid = LEN / 2 + 2;
    T.paving.repeat.set(len / 2.5, 12 / 2.5);
    plane(len, 12, L('#ffffff', { map: T.paving }), mid, 0.078, 6.0, pg, -Math.PI / 2);
    T.pinkWalk.repeat.set(len / 2, 1);
    plane(len, 2.4, L('#ffffff', { map: T.pinkWalk }), mid, 0.083, 1.2, pg, -Math.PI / 2);
    bx(len, 0.1, 0.18, L('#b7b2aa'), mid, 0.08, 2.45, pg);
    const hatch = L('#f4f4ee');
    for (let i = 0; i < 11; i++) { const s = plane(0.35, 2.2, hatch, -1 + i * 2.0, 0.088, 3.4, pg, -Math.PI / 2); s.rotation.z = -0.9; }
    plane(len, 0.12, hatch, mid, 0.088, 4.55, pg, -Math.PI / 2);
  }
  // collision for planter and lamp
  { const [wx, wz] = F.toWorld(LB * 0.82, 1.1); addBoxObstacle(W, wx, wz, 0.75, 0.38, -g.rotation.y); }
  { const [wx, wz] = F.toWorld(LB * 0.6, 2.0); addBoxObstacle(W, wx, wz, 0.12, 0.12, 0); }

  // where the mission giver should stand: on the pink sidewalk, in front of the shop
  const [gx, gz] = F.toWorld(U(0.5), 4.2);
  return { giver: { x: gx, z: gz }, labelPos: F.toWorld(U(0.49), 0.5) };
}

// ---- Municipio di Moglia ---------------------------------------------------
export function prepareMunicipio(D) {
  const i = D.buildings.findIndex(b => /^Municipio/.test(b.n || '')); if (i < 0) return null;
  D.buildings[i].hidden = true; // drawn by hand, generic outline kept for collisions
  return { bi: i };
}
export function buildMunicipio(D, W, scene, prep) {
  if (!prep) return null;
  const R = rng(5);
  const p = D.buildings[prep.bi].p;
  // main facade corners (left/right seen from the square) and depth, from the OSM outline
  const left = [p[12], p[13]], right = [p[2], p[3]];
  const dx = right[0] - left[0], dz = right[1] - left[1], Wd = Math.hypot(dx, dz);
  const rx = dx / Wd, rz = dz / Wd, nx = -rz, nz = rx; // n: out of the facade
  // make sure n points away from the building centre
  let cx = 0, cz = 0; for (let k = 0; k < p.length; k += 2) { cx += p[k]; cz += p[k + 1]; } cx /= p.length / 2; cz /= p.length / 2;
  const sgn = ((left[0] - cx) * nx + (left[1] - cz) * nz) > 0 ? 1 : -1;
  const NX = nx * sgn, NZ = nz * sgn;
  let depth = 0; for (let k = 0; k < p.length; k += 2) depth = Math.max(depth, -((p[k] - left[0]) * NX + (p[k + 1] - left[1]) * NZ));
  const g = new THREE.Group(); g.position.set(left[0], 0, left[1]);
  // local X -> (rx,rz), local Z -> (NX,NZ)
  g.rotation.y = Math.atan2(NX, NZ) ; // maps +Z to (NX,NZ)
  // check that local X maps to +r; otherwise mirror build direction
  const xSign = (Math.cos(g.rotation.y) * rx - Math.sin(g.rotation.y) * rz) > 0 ? 1 : -1;
  scene.add(g);
  const X = (u) => xSign > 0 ? u : -u; // positions along the facade
  const WW = Wd, D_ = depth, C = WW / 2;
  const toWorld = (u, w) => [left[0] + rx * u + NX * w, left[1] + rz * u + NZ * w];

  // textures
  const rust = canvasTex(128, 128, (c, w, h) => { noise(c, w, h, '#f2dcd2', 0.06, 1500, R); c.fillStyle = 'rgba(120,80,70,.28)'; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 3); });
  const peach = canvasTex(64, 64, (c, w, h) => noise(c, w, h, '#efc39b', 0.07, 800, R));
  const cream = canvasTex(64, 64, (c, w, h) => noise(c, w, h, '#f1e6d9', 0.06, 800, R));
  const tiles = canvasTex(128, 128, (c, w, h) => { noise(c, w, h, '#c96a4a', 0.22, 3000, R); for (let y = 0; y < h; y += 14) { c.fillStyle = 'rgba(60,20,10,.35)'; c.fillRect(0, y, w, 3); } for (let x = 0; x < w; x += 12) { c.fillStyle = 'rgba(255,200,170,.12)'; c.fillRect(x, 0, 5, h); } });
  const grille = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#20262b'; c.fillRect(0, 0, w, h); c.fillStyle = '#7f8a92'; c.fillRect(6, 6, w - 12, h - 12); c.strokeStyle = '#1b1d20'; c.lineWidth = 3; for (let k = -h; k < h * 2; k += 16) { c.beginPath(); c.moveTo(0, k); c.lineTo(w, k + w); c.stroke(); c.beginPath(); c.moveTo(0, k + w); c.lineTo(w, k); c.stroke(); } c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); }, false);
  const blind = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#2e3a42'; c.fillRect(0, 0, w, h); c.fillStyle = '#4e6170'; c.fillRect(6, 54, 24, 66); c.fillRect(34, 54, 24, 66); c.fillStyle = '#f2f1ec'; c.fillRect(0, 0, w, 50); for (let y = 0; y < 50; y += 4) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, y, w, 1); } c.fillStyle = '#f7f5ef'; c.fillRect(30, 50, 4, 78); c.fillRect(0, 86, w, 3); c.lineWidth = 5; c.strokeStyle = '#f7f5ef'; c.strokeRect(2, 2, w - 4, h - 4); }, false);
  const arched = canvasTex(64, 160, (c, w, h) => { c.fillStyle = '#f2eee6'; c.fillRect(0, 0, w, h); c.fillStyle = '#34424c'; c.beginPath(); c.moveTo(5, h - 4); c.lineTo(5, 30); c.arc(32, 30, 27, Math.PI, 0); c.lineTo(59, h - 4); c.closePath(); c.fill(); c.fillStyle = '#6a8090'; c.fillRect(10, 40, 18, 60); c.fillRect(36, 40, 18, 60); c.fillStyle = '#f2eee6'; c.fillRect(30, 4, 4, h); c.fillRect(0, 106, w, 4); c.fillRect(0, 34, w, 3); }, false);
  const balTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#efe6da'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { const x = i * w / 6; c.fillStyle = '#d9cdbd'; c.fillRect(x + 6, 8, w / 6 - 12, h - 16); c.strokeStyle = '#f7f1e8'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + 8, 10); c.lineTo(x + w / 6 - 8, h - 10); c.moveTo(x + w / 6 - 8, 10); c.lineTo(x + 8, h - 10); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.strokeRect(x + 6, 8, w / 6 - 12, h - 16); } }, false);
  const title = canvasTex(512, 80, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#a5743e'; c.font = '700 62px "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M U N I C I P I O'.replace(/ /g, ' '), w / 2, h / 2 + 2); }, false);
  const rosette = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#efe6da'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9b9a3'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.ellipse(32 + Math.cos(a) * 11, 32 + Math.sin(a) * 11, 8, 4, a, 0, 7); c.fillStyle = '#d8cab6'; c.fill(); } c.beginPath(); c.arc(32, 32, 5, 0, 7); c.fillStyle = '#c5b49c'; c.fill(); }, false);
  const medal = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fillStyle = '#e6dccd'; c.fill(); c.beginPath(); c.arc(32, 32, 22, 0, 7); c.fillStyle = '#d6c8b4'; c.fill(); c.beginPath(); c.arc(32, 30, 11, 0, 7); c.fillStyle = '#c4b29a'; c.fill(); }, false);
  const oculus = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.beginPath(); c.arc(32, 32, 31, 0, 7); c.fillStyle = '#f6f2ea'; c.fill(); c.beginPath(); c.arc(32, 32, 23, 0, 7); c.fillStyle = '#2a3238'; c.fill(); c.strokeStyle = '#8b96a0'; c.lineWidth = 2; for (let k = -30; k < 64; k += 8) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 64, 64); c.stroke(); c.beginPath(); c.moveTo(k + 64, 0); c.lineTo(k, 64); c.stroke(); } c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.arc(32, 32, 31, 0, 7); c.fill(); }, false);
  const cobble = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#6f6a66'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) for (let x = (y / 12 % 2) * 6; x < w; x += 12) { const t = R(); c.fillStyle = `hsl(${15 + t * 20},${6 + t * 8}%,${48 + R() * 16}%)`; c.beginPath(); c.roundRect(x + 1, y + 1, 10, 10, 3); c.fill(); } });

  const M = (o) => new THREE.MeshLambertMaterial(o);
  const rustM = M({ map: rust }), peachM = M({ map: peach }), creamM = M({ map: cream }), white = M({ color: '#f5f1ea' }), stone = M({ color: '#e9e2d8' });
  const B = (w, h, d, m, x, y, z, par = g) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(X(x), y, z); b.castShadow = true; b.receiveShadow = true; par.add(b); return b; };
  const Pl = (w, h, m, x, y, z, ry = 0) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); q.position.set(X(x), y, z); q.rotation.y = ry; q.receiveShadow = true; g.add(q); return q; };

  // heights (from the photo)
  const H0 = 0.95, H1 = 5.65, H2 = 10.5, H3 = 11.9, EAVE = 12.3;
  const AV = 8.6, AVz = 0.45; // central avancorpo width / projection
  // main block: ground (rusticated), upper floor (peach), attic band (peach) — as boxes so the sides are covered too
  const body = (y0, y1, m, inset = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(WW - inset * 2, y1 - y0, D_ - inset * 2), m);
    b.position.set(X(C), (y0 + y1) / 2, -D_ / 2); b.castShadow = true; b.receiveShadow = true; g.add(b);
  };
  rust.repeat.set(WW / 1.6, (H1 - H0) / 1.6); peach.repeat.set(4, 4); cream.repeat.set(2, 2);
  body(0, H0, M({ color: '#ece2d6' }));
  body(H0, H1, rustM); body(H1, H2, peachM); body(H2, H3, peachM);
  // horizontal cornices
  for (const [y, hh, out] of [[H0, 0.12, 0.12], [H1 - 0.05, 0.28, 0.16], [H1 + 0.85, 0.08, 0.06], [H2, 0.26, 0.16], [H3 + 0.12, 0.3, 0.3]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(WW + out * 2, hh, D_ + out * 2), white); b.position.set(X(C), y, -D_ / 2); b.castShadow = true; g.add(b);
  }
  // eave with dentils
  { const b = new THREE.Mesh(new THREE.BoxGeometry(WW + 1.4, 0.22, D_ + 1.4), M({ color: '#6b4a38' })); b.position.set(X(C), EAVE + 0.1, -D_ / 2); b.castShadow = true; g.add(b); }
  // central avancorpo
  B(AV, H3 + 0.2 - H0, AVz * 2, creamM, C, (H3 + 0.2 + H0) / 2, 0);
  for (const s of [-1, 1]) for (const xx of [AV / 2 - 0.35, AV / 2 - 1.3]) B(0.55, H2 - H1 - 0.6, 0.2, white, C + s * xx, (H1 + H2) / 2 + 0.2, AVz + 0.05); // pilasters upper
  for (const s of [-1, 1]) B(0.75, H1 - H0, 0.25, stone, C + s * (AV / 2 - 0.4), (H0 + H1) / 2, AVz + 0.05);
  // attic of avancorpo: MUNICIPIO + rosettes
  { const t = Pl(4.4, 0.69, M({ map: title, transparent: true }), C, H2 + 0.62, AVz + 0.02); }
  for (const s of [-1, 1]) Pl(0.55, 0.55, M({ map: rosette }), C + s * 3.55, H2 + 0.65, AVz + 0.02);
  for (const s of [-1, 1]) { const m = Pl(0.75, 0.75, M({ map: medal, transparent: true }), C + s * 2.4, 9.55, AVz + 0.03); }
  // three tall windows on the main floor
  for (const k of [-1, 0, 1]) {
    const x = C + k * 2.4;
    Pl(1.35, 3.0, M({ map: arched }), x, 7.45, AVz + 0.03);
    B(1.6, 0.16, 0.18, white, x, 9.08, AVz + 0.06);
  }
  // side windows: pediments + white blinds (main floor), grilles (ground floor)
  const sideX = [1.85, 4.55, WW - 4.55, WW - 1.85];
  for (const x of sideX) {
    Pl(1.25, 2.25, M({ map: blind }), x, 7.85, 0.02);
    B(1.55, 2.55, 0.06, white, x, 7.85, 0.0).material = white;
    g.children[g.children.length - 1].position.z = -0.0; // frame behind the window plane
    B(1.65, 0.12, 0.2, white, x, 6.62, 0.08); // sill
    B(1.7, 0.12, 0.2, white, x, 9.2, 0.08);
    // triangular pediment
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0, 0.5); sh.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }), white); ped.position.set(X(x), 9.27, -0.02); ped.castShadow = true; g.add(ped);
    // ground floor window with grille
    Pl(1.15, 2.2, M({ map: grille }), x, 3.15, 0.03);
    B(1.45, 2.5, 0.05, white, x, 3.15, 0.0);
    B(1.55, 0.1, 0.18, white, x, 1.98, 0.07);
    // basement vent
    Pl(0.9, 0.22, M({ color: '#2a2a2a' }), x, 0.45, 0.02);
  }
  // oculi in the attic band
  for (const x of sideX) Pl(0.62, 0.62, M({ map: oculus, transparent: true }), x, H2 + 0.68, 0.02);
  // balcony with X-pattern balustrade, on brackets
  {
    const bw = AV - 0.3, bd = 1.05, y = H1 + 0.05;
    B(bw + 0.3, 0.22, bd + AVz, white, C, y, AVz / 2 + bd / 2 - 0.1);
    const bt = M({ map: balTex }); balTex.repeat.set(1, 1);
    const front = Pl(bw, 0.95, bt, C, y + 0.6, AVz + bd - 0.12);
    B(bw + 0.15, 0.12, 0.3, white, C, y + 1.12, AVz + bd - 0.15);
    for (const s of [-1, 1]) { const sd = Pl(bd - 0.1, 0.95, bt, C + s * (bw / 2), y + 0.6, AVz + bd / 2 - 0.1, Math.PI / 2); B(0.3, 0.12, bd, white, C + s * bw / 2, y + 1.12, AVz + bd / 2 - 0.1); }
    for (const xx of [-3.2, -1.2, 1.2, 3.2]) B(0.28, 0.5, 0.7, white, C + xx, y - 0.35, AVz + 0.3);
    // flags (Italia + Europa)
    const it = canvasTex(96, 64, (c, w, h) => { c.fillStyle = '#009246'; c.fillRect(0, 0, 32, h); c.fillStyle = '#fff'; c.fillRect(32, 0, 32, h); c.fillStyle = '#ce2b37'; c.fillRect(64, 0, 32, h); }, false);
    const eu = canvasTex(96, 64, (c, w, h) => { c.fillStyle = '#1f3f99'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd400'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(48 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 2.6, 0, 7); c.fill(); } }, false);
    [[it, 0.15], [eu, -0.35]].forEach(([tx, off]) => {
      const fg = new THREE.Group(); fg.position.set(X(C + off), y + 1.1, AVz + bd - 0.05); fg.rotation.x = 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), M({ color: '#c9a64a' })); pole.position.y = 0.8; fg.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), M({ map: tx, side: THREE.DoubleSide })); fl.rotation.z = Math.PI / 2; fl.position.set(0.0, 0.35, 0.35); fl.rotation.x = -0.4; fg.add(fl);
      g.add(fg);
    });
  }
  // portico: 3 openings with dark doors, 2 pillars, iron gate
  {
    const y0 = H0, y1 = H1 - 0.35, ox = [-2.35, 0, 2.35];
    for (const k of ox) Pl(2.0, y1 - y0, M({ color: '#2f2420' }), C + k, (y0 + y1) / 2, AVz + 0.03);
    for (const k of ox) for (let i = 0; i < 4; i++) B(0.04, y1 - y0 - 0.2, 0.04, M({ color: '#4a3528' }), C + k - 0.75 + i * 0.5, (y0 + y1) / 2, AVz + 0.06);
    for (const s of [-1, 1]) { B(0.6, y1 - y0, 0.6, stone, C + s * 1.18, (y0 + y1) / 2, AVz + 0.3); B(0.8, 0.22, 0.8, white, C + s * 1.18, y1 + 0.1, AVz + 0.3); }
    B(AV - 0.3, 0.35, 0.3, white, C, y1 + 0.18, AVz + 0.1);
    for (let i = 0; i <= 14; i++) B(0.03, 1.6, 0.03, M({ color: '#1d1f22' }), C - 0.85 + i * 1.7 / 14, H0 + 0.8, AVz + 0.55);
    // steps
    for (let s = 0; s < 4; s++) { const w = 3.2 + s * 0.55, d = 0.42; B(w, H0 / 4, d * (s + 1) + 0.2, stone, C, H0 - (s + 0.5) * H0 / 4, AVz + 0.6 + (d * (s + 1)) / 2 - 0.1); }
    // handrails
    for (const s of [-1, 1]) { const r = B(0.05, 0.05, 2.0, M({ color: '#222' }), C + s * 1.9, 1.2, AVz + 1.4); r.rotation.x = -0.45; }
  }
  // copper drainpipes
  for (const x of [3.3, WW - 3.3]) { const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, EAVE - 1.5, 8), M({ color: '#8a5a3c' })); pp.position.set(X(x), (EAVE + 1.5) / 2, 0.12); g.add(pp); }

  // roof: main hip + front hip over the avancorpo + two dormers
  const tileM = M({ map: tiles, side: THREE.DoubleSide }); tiles.repeat.set(1, 1);
  const roofG = new THREE.BufferGeometry(); const pos = [], uv = [];
  const tri = (a, b, c) => { for (const q of [a, b, c]) { pos.push(X(q[0]), q[1], q[2]); uv.push(q[0] / 3, (q[2] + q[1]) / 3); } };
  const o = 0.7, y = EAVE + 0.2, rise = 3.9;
  const x0 = -o, x1 = WW + o, z0 = o, z1 = -D_ - o;
  const rIn = Math.min((z0 - z1) / 2, (x1 - x0) / 2 - 0.1);
  const zc = (z0 + z1) / 2, ry = y + rise;
  const R1 = [x0 + rIn, ry, zc], R2 = [x1 - rIn, ry, zc];
  tri([x0, y, z0], [x1, y, z0], R2); tri([x0, y, z0], R2, R1);
  tri([x1, y, z1], [x0, y, z1], R1); tri([x1, y, z1], R1, R2);
  tri([x0, y, z1], [x0, y, z0], R1); tri([x1, y, z0], [x1, y, z1], R2);
  // avancorpo roof
  const slope = rise / (z0 - zc);
  const ax0 = C - AV / 2 - 0.35, ax1 = C + AV / 2 + 0.35, az = AVz + 0.8, py = y + 2.1;
  const Pz = 0.2, Qz = z0 - (py - y) / slope;
  const yAt = (z) => y + (z0 - z) * slope;
  const A = [ax0, y, az], Bp = [ax1, y, az], P = [C, py, Pz], Q = [C, py, Qz], RL = [ax0, yAt(Pz - 1.2), Pz - 1.2], RR = [ax1, yAt(Pz - 1.2), Pz - 1.2];
  tri(A, Bp, P); tri(A, P, Q); tri(A, Q, RL); tri(Bp, Q, P); tri(Bp, RR, Q);
  roofG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roofG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); roofG.computeVertexNormals();
  const roof = new THREE.Mesh(roofG, tileM); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  B(AV + 0.9, 0.2, 0.25, M({ color: '#6b4a38' }), C, y - 0.02, az);
  for (const s of [-1, 1]) { const d = B(1.0, 0.55, 1.0, M({ color: '#d9643f' }), C + s * 0.62, ry - 0.55, zc + 1.3); d.rotation.x = -0.3; }
  B(0.6, 1.4, 0.6, M({ color: '#9b8f84' }), C - 6.5, ry - 0.1, zc - 2.5);

  // lamp posts, parking sign
  for (const x of [2.9, WW - 2.6]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 7.2, 10), M({ color: '#2d3236' })); pl.position.set(X(x), 3.6, 3.0); pl.castShadow = true; g.add(pl);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 10), M({ color: '#2d3236' })); base.position.set(X(x), 0.45, 3.0); g.add(base);
    B(0.35, 0.4, 0.35, M({ color: '#3a4046', emissive: '#111' }), x, 7.3, 3.0);
    const [wx, wz] = toWorld(x, 3.0); addBoxObstacle(W, wx, wz, 0.25, 0.25, 0);
  }
  { const s = B(0.05, 2.4, 0.05, M({ color: '#888' }), 4.0, 1.2, 3.2); const sg = Pl(0.4, 0.5, M({ color: '#1f5fbf' }), 4.0, 2.2, 3.23); }
  // porphyry cobbles in front
  { cobble.repeat.set((WW + 16) / 3, 14 / 3); const q = new THREE.Mesh(new THREE.PlaneGeometry(WW + 16, 14), M({ map: cobble })); q.rotation.x = -Math.PI / 2; q.position.set(X(C), 0.079, 7.0); q.receiveShadow = true; g.add(q); }
  // collision for the steps
  { const [wx, wz] = toWorld(C, AVz + 1.3); addBoxObstacle(W, wx, wz, 2.3, 1.1, -Math.atan2(rz, rx)); }
  return { top: EAVE + rise + 1.5, front: toWorld(C, 9), faceYaw: Math.atan2(-NX, -NZ) };
}
