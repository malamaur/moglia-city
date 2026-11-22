import * as THREE from 'three';
import { makeLabel } from './util.js';

// ---------------------------------------------------------------------------
// Veicoli: carrozzerie ricavate da un profilo laterale estruso (spigoli arrotondati),
// abitacolo in vetro, montanti, tetto, passaruota, cerchi a razze, fari, targhe.
// Le geometrie sono condivise per tipo; i materiali della vernice sono per auto.
// ---------------------------------------------------------------------------
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const paint = (c) => new THREE.MeshPhongMaterial({ color: c, shininess: 70, specular: 0x3a3a3a });
const glass = new THREE.MeshPhongMaterial({ color: '#2b3d4a', shininess: 160, specular: 0xc8d6e0 });
const plastic = lam('#1e1f21'), chrome = new THREE.MeshPhongMaterial({ color: '#c9ccd0', shininess: 120, specular: 0xffffff });
const tyreM = lam('#161616'), rimSilver = new THREE.MeshPhongMaterial({ color: '#b9bec4', shininess: 90, specular: 0x888888 });
const rimBlack = new THREE.MeshPhongMaterial({ color: '#202224', shininess: 80, specular: 0x555555 });
const HEAD_COLOR = '#fff6d8', TAIL_COLOR = '#c01818';

const cache = {};
const memo = (k, f) => cache[k] || (cache[k] = f());
const tyreGeo = memo('tyre', () => { const g = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20); g.rotateZ(Math.PI / 2); return g; });
const rimGeo = memo('rim', () => { const g = new THREE.CylinderGeometry(0.24, 0.24, 0.27, 16); g.rotateZ(Math.PI / 2); return g; });
const hubGeo = memo('hub', () => { const g = new THREE.CylinderGeometry(0.06, 0.06, 0.29, 8); g.rotateZ(Math.PI / 2); return g; });
const spokeGeo = memo('spoke', () => new THREE.BoxGeometry(0.03, 0.42, 0.06));

// ruota: figli[0] = pneumatico, figli[1] = cerchio (usati anche dal trattore)
function wheel(x, z, r = 1, rimMat = rimSilver, spokes = 5) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(tyreGeo, tyreM); t.castShadow = true; g.add(t);
  g.add(new THREE.Mesh(rimGeo, rimMat));
  const side = Math.sign(x) || 1;
  for (let k = 0; k < spokes; k++) { const s = new THREE.Mesh(spokeGeo, rimMat); s.position.x = side * 0.14; s.rotation.x = k / spokes * Math.PI * 2; s.position.y = 0; g.add(s); }
  const hub = new THREE.Mesh(hubGeo, chrome); g.add(hub);
  g.scale.setScalar(r); g.position.set(x, 0.36 * r, z); return g;
}

// profilo laterale: x = avanti, y = alto
const CAR_SHAPES = {
  utilitaria: { L: 3.72, W: 1.66, wz: 1.2, r: 0.31, nose: 0.66, belt: 0.96, H: 1.52, ws: 0.72, wt: -0.05, re: -1.5, rw: -1.8, deck: 0.98, hatch: true, b: -0.72 },
  berlina: { L: 4.55, W: 1.8, wz: 1.36, r: 0.33, nose: 0.66, belt: 0.98, H: 1.45, ws: 1.0, wt: 0.15, re: -0.95, rw: -1.55, deck: 1.02, hatch: false, b: -0.45 },
  sportiva: { L: 4.42, W: 1.86, wz: 1.3, r: 0.34, nose: 0.56, belt: 0.88, H: 1.27, ws: 0.82, wt: -0.15, re: -0.85, rw: -1.6, deck: 0.94, hatch: false, b: null },
  compatta: { L: 4.29, W: 1.79, wz: 1.31, r: 0.345, nose: 0.66, belt: 0.98, H: 1.46, ws: 0.82, wt: 0.02, re: -1.55, rw: -1.95, deck: 0.98, hatch: true, b: -0.62 },
};
CAR_SHAPES.vigili = CAR_SHAPES.berlina;

function extrude(shape, depth, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2); g.rotateY(-Math.PI / 2); // forma: x → avanti (z del mondo), profondità → larghezza (x del mondo)
  g.computeVertexNormals(); return g;
}
function poly(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }

function carGeometries(type) {
  return memo('car:' + type, () => {
    const c = CAR_SHAPES[type], Lf = c.L / 2, ra = c.r + 0.06, cy = c.r, low = 0.24;
    // scocca bassa con i passaruota
    const s = new THREE.Shape();
    s.moveTo(Lf, low + 0.06);
    s.quadraticCurveTo(Lf + 0.02, c.nose - 0.12, Lf - 0.05, c.nose);
    s.quadraticCurveTo(Lf - 0.25, c.nose + 0.1, (Lf + c.ws) / 2, (c.nose + 0.1 + c.belt) / 2 + 0.02);
    s.lineTo(c.ws, c.belt);
    s.lineTo(c.rw, c.belt);
    if (c.hatch) { s.lineTo(-Lf + 0.03, c.deck); s.quadraticCurveTo(-Lf - 0.02, c.deck - 0.05, -Lf, c.deck - 0.25); }
    else { s.quadraticCurveTo(c.rw - 0.25, c.deck + 0.02, -Lf + 0.12, c.deck); s.quadraticCurveTo(-Lf, c.deck, -Lf, c.deck - 0.15); }
    s.lineTo(-Lf, low + 0.08);
    s.quadraticCurveTo(-Lf, low, -Lf + 0.1, low);
    s.lineTo(-c.wz - ra, low); s.lineTo(-c.wz - ra, cy); s.absarc(-c.wz, cy, ra, Math.PI, 0, true); s.lineTo(-c.wz + ra, low);
    s.lineTo(c.wz - ra, low); s.lineTo(c.wz - ra, cy); s.absarc(c.wz, cy, ra, Math.PI, 0, true); s.lineTo(c.wz + ra, low);
    s.lineTo(Lf - 0.1, low); s.quadraticCurveTo(Lf, low, Lf, low + 0.06);
    const body = extrude(s, c.W - 0.12, 0.06);
    // abitacolo in vetro
    const gs = new THREE.Shape(), top = c.H - 0.05;
    gs.moveTo(c.ws + 0.02, c.belt - 0.02); gs.lineTo(c.wt + 0.06, top - 0.04); gs.quadraticCurveTo(c.wt, top, c.wt - 0.12, top);
    gs.lineTo(c.re + 0.1, top); gs.quadraticCurveTo(c.re, top, c.re - 0.05, top - 0.06); gs.lineTo(c.rw, c.belt - 0.02); gs.closePath();
    const cabin = extrude(gs, c.W - 0.26, 0.04);
    // tetto
    const roof = extrude(poly([[c.wt - 0.02, top - 0.03], [c.wt - 0.1, top + 0.03], [c.re + 0.08, top + 0.03], [c.re - 0.02, top - 0.04]]), c.W - 0.3, 0.05);
    // montanti A, B, C (sottili, sui fianchi)
    const pill = [];
    pill.push(poly([[c.ws + 0.03, c.belt], [c.ws - 0.12, c.belt], [c.wt - 0.1, top], [c.wt + 0.02, top]]));
    if (c.b != null) pill.push(poly([[c.b + 0.07, c.belt], [c.b - 0.07, c.belt], [c.b - 0.09, top], [c.b + 0.05, top]]));
    pill.push(c.hatch ? poly([[c.re + 0.42, top], [c.re - 0.04, top], [c.rw - 0.02, c.belt], [c.rw + 0.62, c.belt]])
      : poly([[c.re + 0.18, top], [c.re - 0.04, top], [c.rw - 0.02, c.belt], [c.rw + 0.3, c.belt]]));
    const pillars = pill.map(p => extrude(p, 0.03, 0.01));
    return { body, cabin, roof, pillars, c };
  });
}

function plateTex(rand) {
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ', pick = () => L[Math.floor(rand() * L.length)];
  const txt = pick() + pick() + ' ' + String(100 + Math.floor(rand() * 900)) + ' ' + pick() + pick();
  const c = document.createElement('canvas'); c.width = 256; c.height = 56; const x = c.getContext('2d');
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 56); x.fillStyle = '#1d3f9a'; x.fillRect(0, 0, 26, 56); x.fillRect(230, 0, 26, 56);
  x.fillStyle = '#fff'; x.font = '700 16px system-ui'; x.textAlign = 'center'; x.fillText('I', 13, 46);
  x.fillStyle = '#151515'; x.font = '700 38px system-ui, sans-serif'; x.fillText(txt, 128, 42);
  x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 53);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let plateSeed = 7; const plateRand = () => { plateSeed = (plateSeed * 16807) % 2147483647; return plateSeed / 2147483647; };
const plateGeo = memo('plate', () => new THREE.PlaneGeometry(0.52, 0.114));

export const CAR_COLORS = ['#c0392b', '#2e86c1', '#f4f6f7', '#1c2833', '#7f8c8d', '#d4ac0d', '#239b56', '#a04000', '#5b2c6f', '#e8daef', '#aab7b8', '#922b21', '#1a5276', '#9a9e9f', '#2d2d30', '#e5e3dc'];

function buildCar(g, type, color, headM, tailM, wheels) {
  const G = carGeometries(type), c = G.c, Lf = c.L / 2;
  const body = paint(color), sport = type === 'sportiva' || type === 'compatta';
  const roofMat = type === 'compatta' ? new THREE.MeshPhongMaterial({ color: '#141516', shininess: 110, specular: 0x666666 }) : body;
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(G.body, body); add(G.cabin, glass); add(G.roof, roofMat);
  for (const sx of [1, -1]) for (const pg of G.pillars) { const o = add(pg, type === 'compatta' ? roofMat : body); o.position.x = sx * ((c.W - 0.26) / 2 + 0.035); }
  // fondo, minigonne, paraurti in plastica
  g.add(box(c.W - 0.2, 0.18, c.L - 0.5, plastic, 0, 0.3, 0));
  for (const sx of [1, -1]) g.add(box(0.05, 0.1, 2 * c.wz - 2 * (c.r + 0.08), plastic, sx * (c.W / 2 - 0.01), 0.3, 0));
  g.add(box(c.W - 0.1, 0.14, 0.1, plastic, 0, 0.34, Lf + 0.03)); g.add(box(c.W - 0.1, 0.14, 0.1, plastic, 0, 0.34, -Lf - 0.03));
  // griglia e prese d'aria
  g.add(box(c.W * 0.46, 0.13, 0.06, plastic, 0, c.nose - 0.14, Lf + 0.05));
  g.add(box(c.W * 0.62, 0.1, 0.06, plastic, 0, 0.6, Lf + 0.07));
  // fari e luci posteriori
  for (const sx of [1, -1]) {
    g.add(box(0.4, 0.1, 0.1, headM, sx * (c.W / 2 - 0.32), c.nose - 0.1, Lf + 0.03));
    const tl = box(c.hatch ? 0.42 : 0.46, 0.12, 0.08, tailM, sx * (c.W / 2 - 0.3), (c.hatch ? c.deck : c.deck - 0.04) - 0.14, -Lf - 0.05); g.add(tl);
    // specchietti
    g.add(box(0.12, 0.1, 0.18, type === 'compatta' ? roofMat : body, sx * (c.W / 2 + 0.06), c.belt + 0.1, c.ws - 0.18));
    // maniglie
    g.add(box(0.02, 0.03, 0.16, chrome, sx * (c.W / 2 - 0.02), c.belt - 0.12, c.ws - 0.75));
    if (c.b != null) g.add(box(0.02, 0.03, 0.16, chrome, sx * (c.W / 2 - 0.02), c.belt - 0.12, c.b - 0.45));
  }
  // targhe
  const pm = new THREE.MeshBasicMaterial({ map: plateTex(plateRand) });
  const pf = new THREE.Mesh(plateGeo, pm); pf.position.set(0, 0.44, Lf + 0.09); g.add(pf);
  const pr = new THREE.Mesh(plateGeo, pm); pr.position.set(0, c.hatch ? 0.62 : 0.66, -Lf - 0.075); pr.rotation.y = Math.PI; g.add(pr);
  // scarichi
  if (sport) for (const sx of type === 'compatta' ? [0.55, -0.55] : [0.3, 0.45]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), chrome); e.rotation.x = Math.PI / 2; e.position.set(sx, 0.3, -Lf - 0.08); g.add(e); }
  if (type === 'sportiva') { g.add(box(c.W - 0.25, 0.05, 0.36, body, 0, c.deck + 0.18, -Lf + 0.26)); for (const sx of [1, -1]) g.add(box(0.06, 0.18, 0.1, body, sx * (c.W / 2 - 0.3), c.deck + 0.08, -Lf + 0.28)); }
  if (type === 'compatta') { // spoiler sul lunotto e piccolo labbro anteriore
    g.add(box(c.W - 0.36, 0.05, 0.22, roofMat, 0, c.H + 0.0, c.re - 0.05));
    g.add(box(c.W - 0.2, 0.04, 0.12, plastic, 0, 0.27, Lf + 0.08));
  }
  // ruote
  const rimMat = type === 'compatta' ? rimBlack : rimSilver;
  const sc = c.r / 0.36;
  for (const [x, z] of [[-c.W / 2 + 0.17, c.wz], [c.W / 2 - 0.17, c.wz], [-c.W / 2 + 0.17, -c.wz], [c.W / 2 - 0.17, -c.wz]]) {
    const w = wheel(x, z, sc, rimMat, sport ? 10 : 5); g.add(w); wheels.push(w);
  }
  return { body, c };
}

export function makeVehicle(type, color) {
  const g = new THREE.Group(); const wheels = [];
  const headM = new THREE.MeshBasicMaterial({ color: HEAD_COLOR });
  const tailM = new THREE.MeshBasicMaterial({ color: TAIL_COLOR });
  let spec, bodyMat;
  if (type === 'trattore') {
    const green = paint(color || '#2e7d32'); bodyMat = green;
    g.add(box(1.4, 1.0, 2.2, green, 0, 1.0, 0.6));
    g.add(box(1.5, 0.15, 1.5, lam('#222'), 0, 2.9, -0.7));
    for (const [x, z] of [[-0.7, -1.2], [0.7, -1.2], [-0.7, -0.2], [0.7, -0.2]]) { const p = box(0.06, 1.4, 0.06, lam('#222'), x, 2.2, z * 0.8 - 0.3); g.add(p); }
    g.add(box(1.2, 0.8, 1.2, green, 0, 1.4, -0.7));
    g.add(box(1.1, 0.6, 0.04, glass, 0, 2.0, -0.08));
    g.add(box(0.12, 0.9, 0.12, lam('#333'), 0.4, 1.9, 1.3));
    g.add(box(1.0, 0.35, 0.05, plastic, 0, 1.0, 1.72));
    const rw = [wheel(-0.85, -0.8, 2.1), wheel(0.85, -0.8, 2.1), wheel(-0.75, 1.3, 1.25), wheel(0.75, 1.3, 1.25)];
    rw.forEach(w => { w.children[0].material = lam('#151515'); w.children[1].material = lam('#d4a017'); g.add(w); wheels.push(w); });
    g.add(box(0.2, 0.12, 0.05, headM, 0.45, 1.25, 1.72)); g.add(box(0.2, 0.12, 0.05, headM, -0.45, 1.25, 1.72));
    spec = { len: 3.6, wid: 1.9, maxV: 7, acc: 2.5, steer: 0.6, height: 3 };
  } else if (type === 'apecar') {
    const body = paint(color); bodyMat = body;
    g.add(box(1.3, 1.25, 1.3, body, 0, 1.0, 1.0));
    g.add(box(1.2, 0.5, 0.05, glass, 0, 1.3, 1.66));
    g.add(box(1.4, 0.45, 1.9, lam('#777'), 0, 0.75, -0.7));
    g.add(box(1.4, 0.4, 0.06, lam('#666'), 0, 1.15, -1.63));
    const w1 = wheel(0, 1.25, 0.8), w2 = wheel(-0.6, -1.0, 0.8), w3 = wheel(0.6, -1.0, 0.8);
    [w1, w2, w3].forEach(w => { g.add(w); wheels.push(w); });
    g.add(box(0.2, 0.12, 0.05, headM, 0, 0.9, 1.67));
    spec = { len: 3.2, wid: 1.4, maxV: 13, acc: 3.5, steer: 0.7, height: 1.6 };
  } else if (type === 'camion') {
    const body = paint(color); bodyMat = body;
    g.add(box(2.2, 1.9, 2.3, body, 0, 1.55, 2.5));
    g.add(box(1.9, 0.72, 0.05, glass, 0, 2.15, 3.66));
    for (const sx of [1, -1]) g.add(box(0.05, 0.5, 0.9, glass, sx * 1.11, 2.05, 2.7));
    g.add(box(1.6, 0.4, 0.06, plastic, 0, 1.2, 3.66));
    g.add(box(2.35, 2.7, 5.0, lam('#d9dde0'), 0, 2.0, -1.15));
    g.add(box(2.3, 0.25, 4.9, lam('#9aa0a6'), 0, 3.4, -1.15));
    for (const [x, z] of [[-1.0, 2.5], [1.0, 2.5], [-1.0, -2.0], [1.0, -2.0], [-1.0, -3.2], [1.0, -3.2]]) { const w = wheel(x, z, 1.15, rimSilver, 8); g.add(w); wheels.push(w); }
    g.add(box(0.4, 0.16, 0.05, headM, 0.75, 0.95, 3.67)); g.add(box(0.4, 0.16, 0.05, headM, -0.75, 0.95, 3.67));
    g.add(box(0.25, 0.35, 0.05, tailM, 0.9, 1.0, -3.66)); g.add(box(0.25, 0.35, 0.05, tailM, -0.9, 1.0, -3.66));
    spec = { len: 7.6, wid: 2.5, maxV: 28, acc: 4.2, steer: 0.45, height: 3.5 };
  } else if (type === 'autobus') {
    const body = paint(color); bodyMat = body;
    g.add(box(2.45, 2.9, 10.2, body, 0, 1.65, 0));
    for (const sx of [1, -1]) g.add(box(0.04, 0.9, 8.8, glass, sx * 1.23, 2.25, 0.1));
    g.add(box(2.1, 1.1, 0.06, glass, 0, 2.1, 5.11));
    g.add(box(2.1, 1.0, 0.06, glass, 0, 2.1, -5.11));
    g.add(box(2.5, 0.3, 10.25, plastic, 0, 0.45, 0));
    for (const [x, z] of [[-1.05, 3.4], [1.05, 3.4], [-1.05, -3.2], [1.05, -3.2], [-1.05, -4.1], [1.05, -4.1]]) { const w = wheel(x, z, 1.05, rimSilver, 8); g.add(w); wheels.push(w); }
    g.add(box(0.45, 0.18, 0.05, headM, 0.85, 0.9, 5.12)); g.add(box(0.45, 0.18, 0.05, headM, -0.85, 0.9, 5.12));
    g.add(box(0.3, 0.4, 0.05, tailM, 0.9, 1.0, -5.12)); g.add(box(0.3, 0.4, 0.05, tailM, -0.9, 1.0, -5.12));
    spec = { len: 10.2, wid: 2.5, maxV: 25, acc: 3.4, steer: 0.4, height: 3.4 };
  } else if (type === 'furgone') {
    const body = paint(color); bodyMat = body;
    // furgone con muso inclinato
    const s = poly([[2.4, 0.3], [2.42, 0.95], [2.0, 1.25], [1.55, 2.1], [-2.35, 2.12], [-2.4, 0.3]]);
    const mesh = new THREE.Mesh(memo('van', () => extrude(s, 1.83, 0.06)), body); mesh.castShadow = true; g.add(mesh);
    const ws = poly([[2.02, 1.27], [1.58, 2.02], [1.0, 2.02], [1.0, 1.27]]);
    const wm = new THREE.Mesh(memo('vanglass', () => extrude(ws, 1.88, 0.02)), glass); g.add(wm);
    g.add(box(1.95, 0.22, 4.85, plastic, 0, 0.36, 0));
    for (const [x, z] of [[-0.85, 1.6], [0.85, 1.6], [-0.85, -1.6], [0.85, -1.6]]) { const w = wheel(x, z, 0.92); g.add(w); wheels.push(w); }
    g.add(box(0.35, 0.15, 0.05, headM, 0.65, 0.85, 2.44)); g.add(box(0.35, 0.15, 0.05, headM, -0.65, 0.85, 2.44));
    g.add(box(0.2, 0.3, 0.05, tailM, 0.8, 0.9, -2.44)); g.add(box(0.2, 0.3, 0.05, tailM, -0.8, 0.9, -2.44));
    spec = { len: 4.8, wid: 2.0, maxV: 30, acc: 5, steer: 0.55, height: 2.2 };
  } else {
    const shape = CAR_SHAPES[type] ? type : 'utilitaria';
    const r = buildCar(g, shape, color, headM, tailM, wheels); bodyMat = r.body;
    if (type === 'vigili') {
      for (const sx of [1, -1]) g.add(box(0.03, 0.18, r.c.L - 0.9, lam('#1f5fa8'), sx * (r.c.W / 2 + 0.005), 0.72, 0));
      const bar = new THREE.Group(); bar.position.set(0, r.c.H + 0.1, (r.c.wt + r.c.re) / 2);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: '#1e6bff' })); bl.position.x = -0.3;
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: '#1e6bff' })); br.position.x = 0.3;
      bar.add(bl, br, box(1.15, 0.05, 0.3, plastic, 0, -0.07, 0)); g.add(bar); g.userData.siren = [bl, br];
    }
    const c = r.c;
    spec = type === 'sportiva' ? { len: c.L, wid: c.W, maxV: 56, acc: 13, steer: 0.7, height: 1.3 }
      : type === 'compatta' ? { len: c.L, wid: c.W, maxV: 54, acc: 12, steer: 0.7, height: 1.48 }
      : type === 'berlina' || type === 'vigili' ? { len: c.L, wid: c.W, maxV: 46, acc: 8.5, steer: 0.6, height: 1.5 }
      : { len: c.L, wid: c.W, maxV: 38, acc: 7.5, steer: 0.65, height: 1.55 };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.wheels = wheels;
  g.userData.bodyMats = [bodyMat];
  g.userData.headMats = [headM];
  g.userData.tailMats = [tailM];
  return { mesh: g, spec, type };
}

// ---------------------------------------------------------------------------
// Persone: articolazioni a ginocchia e gomiti, testa tonda, capelli, cappotti
// ---------------------------------------------------------------------------
const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d2b8', '#eabf9f'];
const SHIRT = ['#c0392b', '#2471a3', '#f4d03f', '#27ae60', '#ecf0f1', '#8e44ad', '#e67e22', '#34495e', '#16a085', '#d35400', '#7b241c'];
const COAT = ['#2c3138', '#4a3b30', '#6b5844', '#1f2a3a', '#7a7d80', '#8c2f2a', '#3d4a3a', '#b59a7a', '#202020'];
const PANTS = ['#2c3e50', '#1b2631', '#5d6d7e', '#784212', '#283747', '#212f3c', '#3b4c6b', '#4b4b4b'];
const HAIR = ['#2b1d14', '#5a3b22', '#a87a43', '#d0cfcb', '#111', '#7a4a1f', '#c9a066'];
const SHOES = ['#2a2018', '#111111', '#e8e6e0', '#5a3b22'];

const PG = memo('person', () => ({
  thigh: new THREE.CylinderGeometry(0.075, 0.062, 0.46, 9),
  shin: new THREE.CylinderGeometry(0.058, 0.046, 0.44, 9),
  shoe: (() => { const g = new THREE.BoxGeometry(0.11, 0.08, 0.27); g.translate(0, 0, 0.05); return g; })(),
  hips: new THREE.CylinderGeometry(0.165, 0.16, 0.18, 12),
  torso: new THREE.CylinderGeometry(0.19, 0.155, 0.56, 12),
  coat: new THREE.CylinderGeometry(0.2, 0.235, 0.92, 12),
  skirt: new THREE.CylinderGeometry(0.165, 0.25, 0.42, 12),
  neck: new THREE.CylinderGeometry(0.048, 0.052, 0.1, 8),
  head: new THREE.SphereGeometry(0.105, 16, 12),
  hair: new THREE.SphereGeometry(0.113, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  long: new THREE.CylinderGeometry(0.105, 0.12, 0.3, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9),
  upper: new THREE.CylinderGeometry(0.052, 0.046, 0.3, 8),
  fore: new THREE.CylinderGeometry(0.044, 0.036, 0.27, 8),
  hand: new THREE.SphereGeometry(0.045, 8, 6),
  eye: new THREE.SphereGeometry(0.013, 6, 4),
  nose: new THREE.BoxGeometry(0.03, 0.045, 0.04),
  cap: new THREE.CylinderGeometry(0.118, 0.118, 0.07, 14),
  visor: new THREE.BoxGeometry(0.18, 0.015, 0.11),
  scarf: new THREE.TorusGeometry(0.07, 0.035, 6, 12),
}));
const matCache = {};
const ml = (c) => matCache[c] || (matCache[c] = new THREE.MeshLambertMaterial({ color: c }));

export function makePerson(rand, opts = {}) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const g = new THREE.Group();
  const skin = ml(opts.skin || pick(SKIN)), shirt = ml(opts.shirt || pick(SHIRT)), pants = ml(opts.pants || pick(PANTS)), hair = ml(opts.hair || pick(HAIR));
  const longHair = opts.longHair != null ? opts.longHair : rand() < 0.4;
  const skirt = opts.skirt != null ? opts.skirt : (longHair && rand() < 0.35);
  const coat = opts.coat != null ? opts.coat : (!opts.shirt && rand() < 0.55); // novembre: tanti cappotti
  const top = coat ? ml(opts.coatColor || pick(COAT)) : shirt;
  const shoe = ml(pick(SHOES));
  const s = opts.scale || (0.9 + rand() * 0.18);
  const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };

  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.09, 0.95, 0);
    hip.add(M(PG.thigh, skirt ? skin : pants, 0, -0.23, 0));
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    knee.add(M(PG.shin, skirt ? ml('#2b2b2e') : pants, 0, -0.22, 0));
    knee.add(M(PG.shoe, shoe, 0, -0.45, 0));
    legs.push([hip, knee]);
  }
  const torso = new THREE.Group(); torso.position.y = 0.95; g.add(torso);
  torso.add(M(PG.hips, pants, 0, 0.06, 0)).scale.z = 0.68;
  torso.add(M(PG.torso, top, 0, 0.42, 0)).scale.z = 0.62;
  if (coat) torso.add(M(PG.coat, top, 0, 0.18, 0)).scale.z = 0.66;
  else if (skirt) torso.add(M(PG.skirt, pants, 0, -0.1, 0)).scale.z = 0.72;
  if (coat && rand() < 0.4) { const sc = M(PG.scarf, ml(pick(SHIRT)), 0, 0.72, 0); sc.rotation.x = Math.PI / 2; sc.scale.set(1.2, 1.0, 1); torso.add(sc); }
  torso.add(M(PG.neck, skin, 0, 0.74, 0));
  const head = new THREE.Group(); head.position.y = 0.78; torso.add(head);
  const hd = M(PG.head, skin, 0, 0.11, 0); hd.scale.set(0.95, 1.12, 1.02); head.add(hd);
  const hr = M(PG.hair, hair, 0, 0.13, -0.01); hr.rotation.x = -0.25; head.add(hr);
  if (longHair) { const lh = M(PG.long, hair, 0, 0.02, -0.005); head.add(lh); }
  head.add(M(PG.nose, skin, 0, 0.1, 0.105));
  for (const x of [-0.037, 0.037]) head.add(M(PG.eye, ml('#1a1a1a'), x, 0.135, 0.094));
  if (opts.cap) { head.add(M(PG.cap, ml(opts.cap), 0, 0.21, 0)); head.add(M(PG.visor, ml(opts.cap), 0, 0.18, 0.1)); }

  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.215, 0.66, 0); torso.add(sh);
    sh.add(M(PG.upper, top, 0, -0.15, 0));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(M(PG.fore, coat || rand() < 0.5 ? top : skin, 0, -0.135, 0));
    el.add(M(PG.hand, skin, 0, -0.29, 0));
    sh.rotation.z = sx * 0.06;
    arms.push([sh, el]);
  }
  for (const [hip] of legs) g.add(hip);
  g.scale.setScalar(s);
  g.userData = { legL: legs[0][0], legR: legs[1][0], kneeL: legs[0][1], kneeR: legs[1][1], armL: arms[0][0], armR: arms[1][0], elbowL: arms[0][1], elbowR: arms[1][1], head, torso, torsoY: 0.95, phase: rand() * 6 };
  return g;
}

export function animatePerson(g, speed, dt, airborne = false) {
  const u = g.userData;
  u.phase += dt * (2 + speed * 3.2);
  const amp = Math.min(0.85, speed * 0.27);
  const s = Math.sin(u.phase) * amp, c = Math.cos(u.phase);
  if (airborne) {
    u.legL.rotation.x = -0.6; u.legR.rotation.x = 0.2; if (u.kneeL) { u.kneeL.rotation.x = 0.9; u.kneeR.rotation.x = 0.4; }
    u.armL.rotation.x = -2.4; u.armR.rotation.x = -2.4; if (u.elbowL) { u.elbowL.rotation.x = -0.3; u.elbowR.rotation.x = -0.3; } return;
  }
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  if (u.kneeL) { // il ginocchio si piega quando la gamba torna avanti
    u.kneeL.rotation.x = Math.max(0, -Math.sin(u.phase - 0.9)) * amp * 1.3 + 0.03;
    u.kneeR.rotation.x = Math.max(0, Math.sin(u.phase - 0.9)) * amp * 1.3 + 0.03;
    u.elbowL.rotation.x = -0.18 - amp * 0.45; u.elbowR.rotation.x = -0.18 - amp * 0.45;
  }
  u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
  u.torso.position.y = (u.torsoY || 1.25) + Math.abs(c) * amp * 0.05;
  u.torso.rotation.y = s * 0.12; u.torso.rotation.x = Math.min(0.12, speed * 0.02);
  if (u.head) u.head.rotation.y = -s * 0.1;
}

export function speechBubble(text) {
  const s = makeLabel(text, { size: 38, scale: 0.035, bg: 'rgba(255,255,255,0.95)', color: '#1a1a1a', depthTest: false });
  s.renderOrder = 10; return s;
}
