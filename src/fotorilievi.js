// Edifici e arredi di Piazza Marconi ricostruiti dalle foto scattate il 22/11/2026.
// Le sagome restano quelle di OpenStreetMap (collisioni comprese); da ogni foto vengono
// colori, numero di piani, finestre, piano terra, tetto, pensiline e insegne.
// Le foto sono arrivate senza dati EXIF: gli edifici sono stati individuati dalle insegne
// (bar Alice, Intesa Sanpaolo), dalla fontana e dalla rotonda col monumento "Moglia".
import * as THREE from 'three';
import { canvasTex, noise, rng, signedArea } from './util.js';
import { nearestBuildingIndex } from './landmarks.js';

const R = rng(2211);
const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

// ---- schede degli edifici --------------------------------------------------
// anchor: punto vicino alla facciata principale (coordinate del gioco: x = est, z = sud)
// poi: nome di un luogo OSM da usare come ancora, se presente nei dati
const SPECS = [
  {
    id: 'alice', poi: 'Alice', anchor: [114.4, 159.4], face: [140, 175],
    // foto 1: tre piani sopra i negozi, intonaco avorio, tapparelle color mattone, pensilina continua
    h: 13.2, g: 4.0, floorH: 3.07, bay: 3.6,
    wall: '#e9e3d6', ground: 'shops', win: { w: 1.15, h: 1.5, frame: '#f4f1ea', shutter: '#c2633c', open: 0.45 },
    roof: { type: 'eave', color: '#4a4440' }, canopy: { y: 3.7, depth: 2.6, color: '#3f3d3b' }, turf: true,
    signs: [{ text: 'Alice Caffè', at: 0.94, color: '#1f8f9a', fg: '#ffffff', w: 4.2, script: true }, { text: 'ME20 STORE', at: 0.12, round: true }, { text: 'ME20', at: 0.24, round: true }],
  },
  {
    id: 'intesa', poi: 'Intesa Sanpaolo', anchor: [179, 177.7], face: [163, 174],
    // foto 5: zoccolo in pietra grigia, due piani color ocra, cornici in pietra, terrazza con ringhiera
    h: 11.6, g: 4.4, floorH: 3.6, bay: 3.5,
    wall: '#d99f3b', ground: 'stone', win: { w: 1.1, h: 1.65, frame: '#c9c5bb', frameW: 0.22, shutter: '#8b5c4a', open: 0.55 },
    roof: { type: 'parapet', color: '#d0a040', rail: true }, cornice: '#cfc9bc',
    signs: [{ text: 'INTESA  SANPAOLO', at: 0.5, color: null, fg: '#3b3a37', w: 8.5, h: 0.7, y: 3.75, letters: true }],
  },
  {
    id: 'verde', anchor: [157, 183], face: [168, 168],
    // foto 3: palazzina anni '50 verde chiaro, piano terra a mosaico, finestre a nastro all'ultimo piano
    h: 10.6, g: 3.8, floorH: 3.4, bay: 3.2,
    wall: '#dcebd3', ground: 'mosaic', win: { w: 1.25, h: 1.25, frame: '#eef2ea', shutter: '#f1efe8', open: 0.25 }, topWin: { w: 1.3, h: 0.55 },
    roof: { type: 'flat', color: '#e9ece4' }, cornice: '#f4f5f0', canopy: { y: 3.75, depth: 1.1, color: '#2f3331' },
    // la sagoma OSM comprende anche il Bar Ristorante Yang (via De Amicis 6): si divide lungo via De Amicis.
    // o = imbocco della via, t = direzione della via, s = metri dall'imbocco dove finisce la palazzina
    split: { o: [169, 183], t: [0.467, 0.888], s: 4, yang: true },
  },
  {
    id: 'portico', anchor: [166, 154], face: [150, 150],
    // foto 4: edificio in cemento a vista con portico, vetrate al primo piano, tetto aggettante con piante
    h: 9.2, g: 3.6, floorH: 3.8, bay: 4.2,
    wall: '#cbc2b2', ground: 'portico', glazing: true,
    roof: { type: 'slab', color: '#3a3532', plants: true },
  },
];

// ---- texture ---------------------------------------------------------------
function stucco(c, w, h, col, amp = 0.05) { noise(c, w, h, col, amp, Math.floor(w * h / 18), R); }
function windowTile(spec) {
  const s = spec.win, PX = 40; // pixel per metro
  const W = Math.round(spec.bay * PX), H = Math.round(spec.floorH * PX);
  return canvasTex(W, H, (c) => {
    stucco(c, W, H, spec.wall);
    const ww = s.w * PX, wh = s.h * PX, x = (W - ww) / 2, y = H * 0.24, fw = (s.frameW || 0.12) * PX;
    c.fillStyle = s.frame; c.fillRect(x - fw, y - fw, ww + fw * 2, wh + fw * 2.4); // cornice + davanzale
    c.fillStyle = '#2b3036'; c.fillRect(x, y, ww, wh); // vetro
    c.fillStyle = '#5d6a74'; c.fillRect(x + 3, y + wh * 0.5, ww / 2 - 5, wh * 0.45); c.fillRect(x + ww / 2 + 2, y + wh * 0.5, ww / 2 - 5, wh * 0.45);
    c.fillStyle = '#e8e6e0'; c.fillRect(x + ww / 2 - 1.5, y, 3, wh);
    const sh = wh * (1 - s.open); c.fillStyle = s.shutter; c.fillRect(x, y, ww, sh); // tapparella
    for (let k = 0; k < sh; k += 3) { c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x, y + k, ww, 1); }
  });
}
function twoFloorTile(spec) { // palazzina verde: piano con tapparelle bianche + piano con finestre a nastro
  const PX = 40, W = Math.round(spec.bay * PX), H = Math.round(spec.floorH * 2 * PX);
  return canvasTex(W, H, (c) => {
    stucco(c, W, H, spec.wall, 0.04);
    const t = spec.topWin, tw = t.w * PX, th = t.h * PX, tx = (W - tw) / 2, ty = H * 0.16;
    c.fillStyle = '#f1f3ee'; c.fillRect(tx - 4, ty - 4, tw + 8, th + 9); c.fillStyle = '#39424a'; c.fillRect(tx, ty, tw, th);
    c.fillStyle = '#dfe3dd'; c.fillRect(tx + tw / 2 - 1, ty, 2, th);
    const s = spec.win, ww = s.w * PX, wh = s.h * PX, x = (W - ww) / 2, y = H * 0.5 + H * 0.12;
    c.fillStyle = s.frame; c.fillRect(x - 5, y - 5, ww + 10, wh + 12);
    c.fillStyle = '#2b3036'; c.fillRect(x, y, ww, wh);
    const sh = wh * (1 - s.open); c.fillStyle = s.shutter; c.fillRect(x, y, ww, sh);
    for (let k = 0; k < sh; k += 3) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x, y + k, ww, 1); }
  });
}
function groundTile(spec) {
  const PX = 40, W = Math.round(spec.bay * PX), H = Math.round(spec.g * PX);
  const t = spec.ground;
  return canvasTex(W, H, (c) => {
    if (t === 'shops') { // vetrine con telaio scuro e porte a due ante
      stucco(c, W, H, '#ddd5c6', 0.04);
      const x = W * 0.08, w = W * 0.84, y = H * 0.18;
      c.fillStyle = '#2d3135'; c.fillRect(x, y, w, H - y);
      c.fillStyle = '#5a6670'; c.fillRect(x + 5, y + 5, w / 2 - 8, H - y - 5); c.fillRect(x + w / 2 + 3, y + 5, w / 2 - 8, H - y - 5);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 8, y + 8, 10, H - y - 12);
      c.fillStyle = '#2d3135'; c.fillRect(x, y + (H - y) * 0.3, w, 4);
    } else if (t === 'stone') { // pietra grigia a grana, finestre della banca
      noise(c, W, H, '#d3d0c8', 0.12, W * H / 4, R);
      for (let i = 0; i < W * H / 30; i++) { c.fillStyle = R() < 0.5 ? 'rgba(90,85,80,.35)' : 'rgba(255,255,255,.4)'; c.fillRect(R() * W, R() * H, 1.5, 1.5); }
      c.strokeStyle = 'rgba(80,75,70,.25)'; for (let y = 0; y < H; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      const ww = 1.4 * 40, wh = 1.9 * 40, x = (W - ww) / 2, y = H * 0.34;
      c.fillStyle = '#c6c3bb'; c.fillRect(x - 7, y - 7, ww + 14, wh + 14);
      c.fillStyle = '#2f3a40'; c.fillRect(x, y, ww, wh); c.fillStyle = '#5f8f86'; c.fillRect(x + 4, y + wh * 0.35, ww - 8, wh * 0.6);
      c.fillStyle = '#e8e6e0'; c.fillRect(x + 4, y + 4, ww - 8, wh * 0.28);
    } else if (t === 'mosaic') { // tessere verdi del piano terra
      c.fillStyle = '#a9c2ab'; c.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const v = R(); c.fillStyle = v < 0.3 ? '#7fa086' : v < 0.6 ? '#b9d0b8' : v < 0.9 ? '#98b59c' : '#e3ece0'; c.fillRect(x, y, 2.4, 2.4); }
      const x = W * 0.2, w = W * 0.6, y = H * 0.2;
      c.fillStyle = '#f2f2ee'; c.fillRect(x - 4, y - 4, w + 8, H - y + 4); c.fillStyle = '#3b4650'; c.fillRect(x, y, w, H - y);
      c.fillStyle = '#6e7f8a'; c.fillRect(x + 4, y + 4, w / 2 - 6, H - y - 4); c.fillRect(x + w / 2 + 2, y + 4, w / 2 - 6, H - y - 4);
    } else { // portico: vetrine arretrate, in ombra
      c.fillStyle = '#6d6a64'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#2c3237'; c.fillRect(W * 0.1, H * 0.15, W * 0.8, H * 0.85);
      c.fillStyle = '#56636b'; c.fillRect(W * 0.13, H * 0.22, W * 0.35, H * 0.78); c.fillRect(W * 0.52, H * 0.22, W * 0.35, H * 0.78);
    }
  });
}
function glazingTile(spec) { // primo piano a vetrate con montanti grigi
  const PX = 40, W = Math.round(spec.bay * PX), H = Math.round((spec.h - spec.g) * PX);
  return canvasTex(W, H, (c) => {
    stucco(c, W, H, spec.wall, 0.06);
    const y0 = H * 0.08, y1 = H * 0.72;
    c.fillStyle = '#c8b98f'; c.fillRect(W * 0.06, y0, W * 0.88, y1 - y0);
    c.fillStyle = '#2d343a'; c.fillRect(W * 0.08, y0 + 4, W * 0.84, (y1 - y0) * 0.62);
    c.fillStyle = '#6e7880'; for (let k = 1; k < 4; k++) c.fillRect(W * 0.08 + k * W * 0.21, y0, 5, y1 - y0);
    c.fillStyle = '#d8cfbc'; c.fillRect(W * 0.08, y0 + (y1 - y0) * 0.64, W * 0.84, 4);
  });
}
function textTex(text, o = {}) {
  const fs = o.fs || 64, pad = 24;
  const tmp = document.createElement('canvas').getContext('2d');
  const font = o.script ? `italic 700 ${fs}px Georgia, serif` : `${o.weight || 800} ${fs}px ${o.serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
  tmp.font = font; const w = Math.ceil(tmp.measureText(text).width) + pad * 2, h = fs + pad * 2;
  return { tex: canvasTex(w, h, (c) => {
    c.clearRect(0, 0, w, h);
    if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, w, h); }
    c.font = font; c.fillStyle = o.fg || '#222'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2);
  }, false), aspect: w / h };
}
function roundSign(text) {
  return canvasTex(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256); c.strokeStyle = '#f2f2f2'; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, 110, 0, 7); c.stroke();
    c.fillStyle = '#f2f2f2'; c.textAlign = 'center'; c.font = '300 54px Georgia, serif'; c.fillText(text.split(' ')[0], 128, 140);
    if (text.includes(' ')) { c.font = '600 22px system-ui'; c.fillText(text.split(' ').slice(1).join(' '), 128, 182); }
  }, false);
}

// ---- geometria -------------------------------------------------------------
function quad(pos, uv, a, b, c, d) { // a b c d in senso antiorario visti da fuori
  for (const [p, t] of [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]]) { pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); }
}
function meshFrom(pos, uv, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function box(w, h, d, mat, x, y, z, rotY, parent) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.rotation.y = rotY || 0;
  b.castShadow = true; b.receiveShadow = true; parent.add(b); return b;
}
// lati del poligono con normale esterna; il poligono arriva da W.blds (già semplificato)
function edgesOf(p) {
  const n = p.length / 2, out = [];
  let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; } cx /= n; cz /= n;
  const ccw = signedArea(p) > 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = p[i * 2], az = p[i * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L;
    out.push({ ax, az, bx, bz, L, tx, tz, nx: ccw ? tz : -tz, nz: ccw ? -tx : tx, mx: (ax + bx) / 2, mz: (az + bz) / 2 });
  }
  // verifica il verso: in media la normale deve allontanarsi dal centro
  let s = 0; for (const e of out) s += ((e.mx - cx) * e.nx + (e.mz - cz) * e.nz) * e.L;
  for (const e of out) {
    if (s < 0) { e.nx = -e.nx; e.nz = -e.nz; }
    // ordina gli estremi in modo che (lungo × alto) punti verso l'esterno: facce visibili da fuori
    if (-e.tz * e.nx + e.tx * e.nz < 0) { [e.ax, e.bx] = [e.bx, e.ax]; [e.az, e.bz] = [e.bz, e.az]; e.tx = -e.tx; e.tz = -e.tz; }
  }
  return out;
}
const facing = (e, f) => { const dx = f[0] - e.mx, dz = f[1] - e.mz, l = Math.hypot(dx, dz) || 1; return (dx * e.nx + dz * e.nz) / l; };

// ---- preparazione: trova gli edifici e nasconde quelli generici ------------
export function prepareFotorilievi(D) {
  const out = [];
  for (const s of SPECS) {
    const poi = s.poi && D.pois.find(p => p.n === s.poi);
    const [x, z] = poi ? [poi.x, poi.z] : s.anchor;
    const bi = nearestBuildingIndex(D, x, z, 14);
    if (bi < 0 || D.buildings[bi].hidden) continue;
    D.buildings[bi].hidden = true; D.buildings[bi].h = s.h;
    out.push({ spec: s, bi });
  }
  const fountain = D.pois.find(p => p.a === 'fountain' && p.x > 120 && p.x < 180 && p.z > 130 && p.z < 170);
  return { list: out, fountain };
}

// ---- costruzione -----------------------------------------------------------
export function buildFotorilievi(D, W, scene, prep) {
  if (!prep) return null;
  const root = new THREE.Group(); root.name = 'fotorilievi'; scene.add(root);
  const built = [];
  for (const { spec: s, bi } of prep.list) {
    const rec = W.blds.find(b => b.src === bi); if (!rec) continue;
    if (s.split) {
      const a = clipHalf(rec.p, s.split, false), b = clipHalf(rec.p, s.split, true);
      if (a) buildOne(s, { ...rec, p: a }, root);
      if (b && s.split.yang) { buildYang(b, root); built.push({ id: 'yang', bi }); }
    } else buildOne(s, rec, root);
    built.push({ id: s.id, bi, x: rec.cx, z: rec.cz });
  }
  if (prep.fountain) buildFountain(prep.fountain.x, prep.fountain.z, W, root);
  const mon = monumentSpot(D); if (mon) buildMonument(mon, W, root);
  return { built, fountain: !!prep.fountain, monument: !!mon };
}

function buildOne(s, rec, root) {
  const E = edgesOf(rec.p), front = E.filter(e => e.L > 3).sort((a, b) => facing(b, s.face) * Math.min(b.L, 25) - facing(a, s.face) * Math.min(a.L, 25))[0];
  const gTex = groundTile(s);
  const uTex = s.glazing ? glazingTile(s) : s.topWin ? twoFloorTile(s) : windowTile(s);
  const plain = canvasTex(64, 64, (c) => stucco(c, 64, 64, s.wall));
  const gPos = [], gUv = [], uPos = [], uUv = [], pPos = [], pUv = [];
  const upperH = s.glazing ? s.h - s.g : s.topWin ? s.floorH * 2 : s.floorH;
  let u = 0;
  for (const e of E) {
    const short = e.L < s.bay * 0.75;
    const A = (y, uu, v) => [e.ax, y, e.az, uu, v], B = (y, uu, v) => [e.bx, y, e.bz, uu, v];
    // piano terra
    const gu0 = u / s.bay, gu1 = (u + e.L) / s.bay;
    if (short) quad(pPos, pUv, A(0, u / 4, 0), B(0, (u + e.L) / 4, 0), B(s.h, (u + e.L) / 4, s.h / 4), A(s.h, u / 4, s.h / 4));
    else {
      // facciata: le campate partono da un bordo e restano intere
      const nb = Math.max(1, Math.round(e.L / s.bay));
      quad(gPos, gUv, A(0, 0, 0), B(0, nb, 0), B(s.g, nb, 1), A(s.g, 0, 1));
      const top = s.h - (s.roof.type === 'parapet' ? 0.9 : 0);
      quad(uPos, uUv, A(s.g, 0, 0), B(s.g, nb, 0), B(top, nb, (top - s.g) / upperH), A(top, 0, (top - s.g) / upperH));
      if (s.roof.type === 'parapet') quad(pPos, pUv, A(top, u / 4, 0), B(top, (u + e.L) / 4, 0), B(s.h, (u + e.L) / 4, 0.9 / 4), A(s.h, u / 4, 0.9 / 4));
    }
    u += e.L;
  }
  gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping; uTex.wrapS = uTex.wrapT = THREE.RepeatWrapping;
  root.add(meshFrom(gPos, gUv, new THREE.MeshLambertMaterial({ map: gTex })));
  root.add(meshFrom(uPos, uUv, new THREE.MeshLambertMaterial({ map: uTex })));
  if (pPos.length) root.add(meshFrom(pPos, pUv, new THREE.MeshLambertMaterial({ map: plain })));

  // tetto
  const contour = []; for (let i = 0; i < rec.p.length; i += 2) contour.push(new THREE.Vector2(rec.p[i], rec.p[i + 1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const rPos = [], rUv = [];
  const ry = s.roof.type === 'parapet' ? s.h - 0.85 : s.h;
  for (const t of tris) for (const k of t) { const v = contour[k]; rPos.push(v.x, ry, v.y); rUv.push(v.x / 4, v.y / 4); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2)); rg.computeVertexNormals();
  const roofMat = M(s.roof.color, { side: THREE.DoubleSide });
  const rm = new THREE.Mesh(rg, roofMat); rm.receiveShadow = true; root.add(rm);

  const corn = M(s.cornice || s.roof.color), canopyMat = s.canopy ? M(s.canopy.color) : null;
  for (const e of E) {
    if (e.L < 1.5) continue;
    const rot = Math.atan2(-e.tz, e.tx);
    const at = (along, out, y) => [e.ax + e.tx * along + e.nx * out, y, e.az + e.tz * along + e.nz * out];
    // gronda / cornicione / soletta sporgente
    if (s.roof.type === 'eave') { const [x, y, z] = at(e.L / 2, 0.45, s.h + 0.12); box(e.L + 1.0, 0.24, 0.9, corn, x, y, z, rot, root); }
    else if (s.roof.type === 'slab') { const [x, y, z] = at(e.L / 2, 0.7, s.h + 0.2); box(e.L + 1.4, 0.4, 1.4, corn, x, y, z, rot, root); }
    else if (s.cornice) { const [x, y, z] = at(e.L / 2, 0.2, s.roof.type === 'parapet' ? s.h - 0.9 : s.h - 0.1); box(e.L + 0.4, 0.22, 0.4, corn, x, y, z, rot, root); }
    if (s.roof.type === 'parapet' && s.roof.rail) { // pilastrini e ringhiera sulla terrazza
      const n = Math.max(2, Math.round(e.L / 3.5));
      for (let k = 0; k <= n; k++) { const [x, y, z] = at(e.L * k / n, 0.05, s.h + 0.35); box(0.5, 0.7, 0.5, corn, x, y, z, rot, root); }
      const [x, y, z] = at(e.L / 2, 0.05, s.h + 0.55); box(e.L, 0.05, 0.05, M('#3a3d40'), x, y, z, rot, root);
      const [x2, y2, z2] = at(e.L / 2, 0.05, s.h + 0.2); box(e.L, 0.04, 0.04, M('#3a3d40'), x2, y2, z2, rot, root);
    }
    // pensilina sopra i negozi
    if (s.canopy && e.L > 3 && facing(e, s.face) > 0.2) { const [x, y, z] = at(e.L / 2, s.canopy.depth / 2, s.canopy.y); box(e.L, 0.22, s.canopy.depth, canopyMat, x, y, z, rot, root); }
    // portico: pilastri sul filo della facciata principale
    if (s.ground === 'portico' && e === front) {
      const n = Math.max(2, Math.round(e.L / s.bay));
      for (let k = 0; k <= n; k++) { const [x, , z] = at(e.L * k / n, 0.35, 0); box(0.55, s.h, 0.7, M(s.wall), x, s.h / 2, z, rot, root); }
    }
    if (s.turf && facing(e, s.face) > 0.2 && e.L > 3) { const [x, , z] = at(e.L / 2, 1.3, 0); box(e.L, 0.04, 2.4, M('#3f8a3a'), x, 0.05, z, rot, root); }
  }
  // piante in vaso davanti ai negozi e sul tetto
  if (s.turf && front) for (let k = 0; k < 9; k++) {
    const al = 2 + R() * (front.L - 4), [x, , z] = [front.ax + front.tx * al + front.nx * 2.4, 0, front.az + front.tz * al + front.nz * 2.4];
    box(0.5, 0.6, 0.5, M('#2c2f30'), x, 0.3, z, 0, root);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 + R() * 0.4, 8, 6), M(R() < 0.5 ? '#3f7d3c' : '#5c9a4a')); b.position.set(x, 1.1 + R() * 0.5, z); b.scale.y = 1.4; b.castShadow = true; root.add(b);
  }
  if (s.roof.plants && front) for (let k = 0; k < 10; k++) {
    const al = 1 + R() * (front.L - 2), x = front.ax + front.tx * al - front.nx * 1.2, z = front.az + front.tz * al - front.nz * 1.2;
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 5), M('#6f8f4e')); b.position.set(x, s.h + 0.9, z); root.add(b);
  }
  // insegne sulla facciata principale
  if (front) for (const sg of s.signs || []) {
    const rot = Math.atan2(-front.tz, front.tx);
    const along = front.L * sg.at, out = (s.canopy ? 0 : 0) + 0.06;
    const px = front.ax + front.tx * along + front.nx * out, pz = front.az + front.tz * along + front.nz * out;
    if (sg.round) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: roundSign(sg.text), transparent: true }));
      m.position.set(px + front.nx * 0.02, 2.2, pz + front.nz * 0.02); m.rotation.y = rot; root.add(m);
    } else {
      const t = textTex(sg.text, { fg: sg.fg, bg: sg.color, script: sg.script, serif: sg.letters, weight: 600, fs: 72 });
      const w = sg.w, h = sg.h || w / t.aspect, y = sg.y || (s.canopy ? s.canopy.y + 0.75 : s.g - 0.6);
      if (sg.color) box(w + 0.15, h + 0.15, 0.18, M(sg.color), px + front.nx * 0.1, y, pz + front.nz * 0.1, rot, root);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true }));
      m.position.set(px + front.nx * 0.21, y, pz + front.nz * 0.21); m.rotation.y = rot; root.add(m);
    }
  }
}

// ---- fontana con la sfera (foto 4) -----------------------------------------
function islandTex() {
  return canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e9e6df'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = R(); c.fillStyle = v < 0.5 ? '#ffffff' : v < 0.85 ? '#d6d1c8' : '#b9b2a6'; c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 2, 0, 7); c.fill(); } });
}
function porphyry() { return canvasTex(64, 64, (c, w, h) => { noise(c, w, h, '#7d5f55', 0.25, 600, R); c.strokeStyle = 'rgba(40,25,20,.4)'; for (let i = 0; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } }); }
function addCircleObstacle(W, x, z, r, n = 8) {
  const pts = []; for (let k = 0; k < n; k++) { const a = -k / n * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
  if (signedArea(pts.flat()) > 0) pts.reverse();
  for (let i = 0; i < n; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n]; W.segs.push([x0, z0, x1, z1]); W.segGrid.addBox(x0, z0, x1, z1, W.segs.length - 1); }
}
function buildFountain(x, z, W, root) {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  const it = islandTex(); it.repeat.set(3, 3);
  box(9.5, 0.14, 9.5, M('#ffffff', { map: it }), 0, 0.07, 0, Math.PI / 4 * 0.12, g);
  const p = porphyry(); p.repeat.set(6, 1);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.12, 10.3), M('#ffffff', { map: p })); rim.position.y = 0.05; rim.rotation.y = 0.094; g.add(rim);
  const stoneTex = canvasTex(128, 64, (c, w, h) => { noise(c, w, h, '#4b4c47', 0.18, 900, R); for (let i = 0; i < 9; i++) { c.fillStyle = '#1e1f1d'; c.beginPath(); c.ellipse(R() * w, R() * h, 6 + R() * 10, 5 + R() * 8, R() * 3, 0, 7); c.fill(); } for (let i = 0; i < 200; i++) { c.fillStyle = 'rgba(230,230,220,.5)'; c.fillRect(R() * w, R() * h, 1.5, 1.5); } });
  stoneTex.repeat.set(4, 1);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.3, 1.15, 8), M('#ffffff', { map: stoneTex })); basin.position.y = 0.6; basin.castShadow = true; basin.receiveShadow = true; g.add(basin);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.06, 8), new THREE.MeshPhongMaterial({ color: '#6f8e98', shininess: 90, specular: 0xaaccdd })); top.position.y = 1.18; g.add(top);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshPhongMaterial({ color: '#232523', shininess: 60, specular: 0x555555 })); sphere.position.y = 2.25; sphere.castShadow = true; g.add(sphere);
  const film = new THREE.Mesh(new THREE.SphereGeometry(1.29, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshPhongMaterial({ color: '#d9eef2', transparent: true, opacity: 0.28, shininess: 120 })); film.position.y = 2.25; g.add(film);
  for (const k of [[-1, 0.6], [1.2, -0.8]]) { const gr = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.03, 1.4), M('#8c9294')); gr.position.set(k[0] * 2.6, 0.16, k[1] * 3.2); g.add(gr); }
  addCircleObstacle(W, x, z, 3.3);
}

// ---- monumento "Moglia" sull'isola triangolare (foto 3 e 5) ------------------
function monumentSpot(D) {
  // isola tra Piazza Marconi e l'imbocco di via De Amicis: baricentro dei tre nodi stradali
  const deA = D.roads.filter(r => r.n === 'Via Edmondo De Amicis');
  const a = deA.find(r => r.p.length === 8 && Math.abs(r.p[0] - 156) < 4), b = deA.find(r => r.p.length === 8 && Math.abs(r.p[0] - 169) < 4 && r.p[6] < 168);
  if (!a || !b) return null;
  const P = [[a.p[0], a.p[1]], [a.p[6], a.p[7]], [b.p[6], b.p[7]]];
  const cx = (P[0][0] + P[1][0] + P[2][0]) / 3, cz = (P[0][1] + P[1][1] + P[2][1]) / 3;
  return { x: cx, z: cz, P };
}
function buildMonument(m, W, root) {
  const g = new THREE.Group(); g.position.set(m.x, 0, m.z); root.add(g);
  // la scritta guarda verso nord-est (piazza), come nella foto 3
  g.rotation.y = Math.atan2(1, -1) ;
  const it = islandTex(); it.repeat.set(2, 1);
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.14, 3), M('#ffffff', { map: it })); isl.position.y = 0.07; isl.scale.set(1.25, 1, 0.8); isl.receiveShadow = true; g.add(isl);
  const marble = canvasTex(128, 64, (c, w, h) => { noise(c, w, h, '#ece9e4', 0.07, 600, R); c.strokeStyle = 'rgba(150,150,150,.35)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(R() * w, 0); c.bezierCurveTo(R() * w, h / 3, R() * w, h / 2, R() * w, h); c.stroke(); } });
  const blk = box(2.8, 0.9, 1.0, M('#ffffff', { map: marble }), 0, 0.5, 0, 0, g);
  const slab = box(3.3, 0.16, 1.7, M('#d8d4cc', { map: marble }), 0, 1.05, -0.1, 0, g); slab.rotation.x = -0.18;
  const face = canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
    c.fillStyle = '#2b2b2b'; c.font = '500 26px Georgia, serif'; c.textAlign = 'center'; c.fillText('Moglia', w * 0.55, 30);
    c.fillStyle = '#111'; c.fillRect(18, 44, 30, 30); c.fillStyle = '#fff'; for (const [dx, dy] of [[0, -6], [0, 6], [-6, 0], [6, 0]]) { c.beginPath(); c.arc(33 + dx, 59 + dy, 4.5, 0, 7); c.fill(); }
    c.fillStyle = '#b54a2e'; c.beginPath(); c.moveTo(70, 52); c.lineTo(130, 66); c.lineTo(70, 80); c.fill();
    c.strokeStyle = '#8fa3b5'; c.lineWidth = 2; c.beginPath(); c.moveTo(130, 66); c.lineTo(220, 60); c.stroke();
    c.fillStyle = '#555'; c.font = '14px Georgia, serif'; c.fillText('2012', 225, 88);
  }, false);
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.88), new THREE.MeshBasicMaterial({ map: face, transparent: true })); fp.position.set(0, 0.5, 0.51); g.add(fp);
  // due cartelli tondi (retro) come nella foto
  for (const sx of [-2.1, 1.4]) {
    const pole = box(0.06, 1.2, 0.06, M('#555'), sx, 0.6, -0.5 + (sx > 0 ? -0.6 : 0.4), 0, g);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), M('#2a2c2e')); d.rotation.x = Math.PI / 2; d.position.set(sx, 1.25, pole.position.z); g.add(d);
  }
  addCircleObstacle(W, m.x, m.z, 1.6, 6);
}

// ---- divisione di una sagoma con un piano perpendicolare alla strada ---------
function clipHalf(p, sp, beyond) {
  const [ox, oz] = sp.o, [tx, tz] = sp.t, f = (x, z) => ((x - ox) * tx + (z - oz) * tz - sp.s) * (beyond ? 1 : -1);
  const pts = []; for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], fa = f(a[0], a[1]), fb = f(b[0], b[1]);
    if (fb >= 0) { if (fa < 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } out.push(b); }
    else if (fa >= 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out.length >= 3 ? out.flat() : null;
}

// ---- Bar Ristorante Yang, via De Amicis 6 (foto del 23/11/2026) -------------
// casa bassa col tetto in coppi, dehors con fioriere e siepi, porta a pagoda rossa
// a due tetti, tenda a righe con bordo smerlato, lampioni a globo, insegna su palo
function buildYang(p, root) {
  const E = edgesOf(p);
  let cx = 0, cz = 0; for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; } cx /= p.length / 2; cz /= p.length / 2;
  const road = [cx + 0.888 * 30, cz - 0.467 * 30]; // via De Amicis è a nord-est della sagoma
  const F = E.filter(e => e.L > 4).sort((a, b) => facing(b, road) - facing(a, road))[0]; if (!F) return;
  let D = 0; for (let i = 0; i < p.length; i += 2) D = Math.max(D, -((p[i] - F.ax) * F.nx + (p[i + 1] - F.az) * F.nz));
  D = Math.min(D, 16);
  const L = F.L, DD = 3.4, BD = Math.max(5, D - DD - 0.3), WH = 3.6;
  const g = new THREE.Group(); g.position.set(F.ax, 0, F.az); g.rotation.y = Math.atan2(-F.tz, F.tx); root.add(g);
  const add = (o) => { o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const B = (w, h, d, m, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)).position.set(x, y, z);

  // pavimento del dehors
  const tiles = canvasTex(64, 64, (c, w, h) => { noise(c, w, h, '#b9b3ab', 0.08, 300, R); c.strokeStyle = 'rgba(70,65,60,.35)'; for (let k = 0; k <= w; k += 16) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); } });
  tiles.repeat.set(L / 1.6, DD / 1.6);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(L, DD), new THREE.MeshLambertMaterial({ map: tiles })); fl.rotation.x = -Math.PI / 2; fl.position.set(L / 2, 0.05, -DD / 2); fl.receiveShadow = true; g.add(fl);

  // edificio basso
  const wall = M('#e6d9c4');
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, WH, BD), wall); body.position.set(L / 2, WH / 2, -DD - BD / 2); add(body);
  const facade = canvasTex(512, 160, (c, w, h) => {
    stucco(c, w, h, '#e6d9c4', 0.04);
    const door = (x, wd) => { c.fillStyle = '#b3261e'; c.fillRect(x - 6, 30, wd + 12, h - 30); c.fillStyle = '#3b2a22'; c.fillRect(x, 38, wd, h - 38); c.fillStyle = '#6d5a4a'; for (let k = 0; k < 4; k++) c.fillRect(x + 4, 44 + k * 28, wd - 8, 3); };
    const win = (x, wd) => { c.fillStyle = '#5d7a52'; c.fillRect(x - 4, 40, wd + 8, h - 58); c.fillStyle = '#2b3439'; c.fillRect(x, 44, wd, h - 66); c.fillStyle = '#5d7a52'; c.fillRect(x + wd / 2 - 2, 44, 4, h - 66); };
    door(40, 46); win(120, 70); door(230, 52); win(320, 70); win(420, 60);
  });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(L, WH), new THREE.MeshLambertMaterial({ map: facade })); fp.position.set(L / 2, WH / 2, -DD + 0.01); g.add(fp);
  // tetto a padiglione in coppi
  const coppi = canvasTex(64, 64, (c, w, h) => { noise(c, w, h, '#a5573a', 0.12, 400, R); c.fillStyle = 'rgba(60,25,15,.35)'; for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 2); for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 1, h); });
  coppi.repeat.set(3, 3);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4, 1), new THREE.MeshLambertMaterial({ map: coppi }));
  roof.rotation.y = Math.PI / 4; const rg = new THREE.Group(); rg.add(roof); rg.position.set(L / 2, WH + 0.75, -DD - BD / 2); rg.scale.set(L + 0.8, 1.5, BD + 0.8); g.add(rg); roof.castShadow = true;
  B(L + 0.7, 0.18, 0.5, M('#e9e2d4'), L / 2, WH + 0.05, -DD + 0.15); // gronda

  // porta a pagoda
  const red = new THREE.MeshPhongMaterial({ color: '#c3271c', shininess: 40, specular: 0x331111 }), roofRed = M('#a83322');
  const pg = Math.min(4.2, L * 0.33), gz = -0.6;
  for (const sx of [-1, 1]) {
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 3.4, 12), red)); col.position.set(pg + sx * 1.05, 1.7, gz);
    const base = add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), M('#151515'))); base.scale.y = 0.6; base.position.set(pg + sx * 1.05, 0.2, gz);
  }
  B(2.7, 0.26, 0.42, red, pg, 3.15, gz); B(2.4, 0.18, 0.36, red, pg, 2.7, gz);
  const plaque = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#1c1a18'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a44a'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#c9a44a'; for (let k = 0; k < 4; k++) c.fillRect(40 + k * 50, 18, 22, 28); });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), new THREE.MeshBasicMaterial({ map: plaque })); pl.position.set(pg, 3.72, gz + 0.22); g.add(pl);
  B(1.6, 0.5, 0.36, red, pg, 3.72, gz);
  const slats = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#a83322'; c.fillRect(0, 0, w, h); c.fillStyle = '#7d2317'; for (let x = 0; x < w; x += 5) c.fillRect(x, 0, 2, h); });
  const tier = (y, w, d, hgt) => {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4, 1), new THREE.MeshLambertMaterial({ map: slats }));
    t.rotation.y = Math.PI / 4; const tg = new THREE.Group(); tg.add(t); tg.position.set(pg, y + hgt / 2, gz); tg.scale.set(w, hgt, d); g.add(tg); t.castShadow = true;
    // punte rialzate delle falde
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const tip = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.14), roofRed)); tip.position.set(pg + sx * w * 0.5, y + 0.12, gz + sz * d * 0.5); tip.rotation.set(0, sx * sz * Math.PI / 4, sx * 0.45); }
    B(w * 0.98, 0.08, d * 0.98, roofRed, pg, y, gz);
  };
  tier(3.3, 4.0, 2.2, 0.55); tier(4.0, 3.0, 1.7, 0.65);
  B(0.9, 0.12, 0.12, roofRed, pg, 4.66, gz);

  // tenda a righe con bordo smerlato
  const stripes = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#efe4d3'; c.fillRect(0, 0, w, h); const cols = ['#c98a86', '#d9b1a5', '#b8615a']; for (let x = 0, k = 0; x < w; x += 14, k++) { c.fillStyle = cols[k % 3]; c.fillRect(x, 0, k % 2 ? 3 : 6, h); } });
  const scallop = canvasTex(256, 32, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#efe4d3'; c.fillRect(0, 0, w, h * 0.45); for (let x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, h * 0.45, 8, 0, Math.PI); c.fill(); } const cols = ['#c98a86', '#b8615a']; for (let x = 0, k = 0; x < w; x += 14, k++) { c.fillStyle = cols[k % 2]; c.globalCompositeOperation = 'source-atop'; c.fillRect(x, 0, 5, h); c.globalCompositeOperation = 'source-over'; } }, false);
  const ax0 = pg + 1.6, aw = L - ax0 + 0.2, run = DD - 0.5, drop = 0.7, slope = Math.hypot(run, drop);
  stripes.repeat.set(aw / 3, 1);
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(aw, slope), new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide }));
  awn.position.set(ax0 + aw / 2, 3.1 - drop / 2, -DD + run / 2); awn.rotation.x = -Math.PI / 2 + Math.atan2(drop, run); awn.castShadow = true; g.add(awn);
  scallop.wrapS = THREE.RepeatWrapping; scallop.repeat.set(aw / 1.6, 1);
  const val = new THREE.Mesh(new THREE.PlaneGeometry(aw, 0.35), new THREE.MeshLambertMaterial({ map: scallop, transparent: true, side: THREE.DoubleSide, alphaTest: 0.4 }));
  val.position.set(ax0 + aw / 2, 3.1 - drop - 0.17, -DD + run); g.add(val);
  const awn2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), awn.material); awn2.position.set(pg, 2.9, -DD + 0.7); awn2.rotation.x = -Math.PI / 2 + 0.35; g.add(awn2);
  for (const u of [ax0 + 0.1, L - 0.1]) B(0.05, 2.5, 0.05, M('#d8d2c8'), u, 1.25, -0.55);

  // fioriere in graniglia con siepi (varco davanti alla pagoda)
  const grit = canvasTex(64, 32, (c, w, h) => { noise(c, w, h, '#c9c3b8', 0.1, 300, R); for (let k = 0; k < 400; k++) { c.fillStyle = R() < 0.5 ? '#8f877c' : '#efebe4'; c.fillRect(R() * w, R() * h, 1.5, 1.5); } });
  const gritM = new THREE.MeshLambertMaterial({ map: grit });
  const hedge = canvasTex(64, 64, (c, w, h) => { noise(c, w, h, '#3f7a35', 0.3, 1200, R); for (let k = 0; k < 300; k++) { c.fillStyle = R() < 0.5 ? '#2c5a26' : '#6aa452'; c.fillRect(R() * w, R() * h, 3, 2); } });
  const hedgeM = new THREE.MeshLambertMaterial({ map: hedge });
  for (let u = 0.2; u < L - 1.0; u += 1.7) {
    if (u + 1.6 > pg - 0.8 && u < pg + 0.8) continue;
    B(1.6, 0.55, 0.55, gritM, u + 0.8, 0.28, -0.3);
    const hd = add(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.85, 0.6), hedgeM)); hd.position.set(u + 0.8, 0.95, -0.3); hd.scale.set(1, 1 + R() * 0.25, 1);
  }
  // lampioni a globo
  const globe = new THREE.MeshBasicMaterial({ color: '#f6f3ea' });
  for (const u of [pg - 1.7, pg + 1.45, pg + 3.4]) {
    B(0.06, 1.75, 0.06, M('#2a2a2a'), u, 0.9, -0.05);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), globe); s.position.set(u, 1.9, -0.05); g.add(s);
  }
  // tavoli e sedie blu
  const cloth = M('#e9cfc5'), blue = M('#2350b8');
  for (const [u, v] of [[ax0 + 1.0, -2.3], [ax0 + 2.6, -2.3], [ax0 + 4.2, -2.3], [ax0 + 1.8, -1.2], [ax0 + 3.4, -1.2], [pg - 0.4, -2.4]]) {
    if (u > L - 0.6) continue;
    B(0.8, 0.04, 0.8, cloth, u, 0.76, v); B(0.06, 0.74, 0.06, M('#555'), u, 0.37, v);
    for (const d of [-0.62, 0.62]) { B(0.42, 0.06, 0.42, blue, u + d, 0.45, v); B(0.42, 0.45, 0.05, blue, u + d * 1.35, 0.7, v); }
  }
  // insegna su palo
  const signT = canvasTex(256, 300, (c, w, h) => {
    c.fillStyle = '#f2f0ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9aa0a6'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#2a3f8f'; c.textAlign = 'center'; c.font = '700 34px Georgia, serif'; c.fillText('RISTORANTE', w / 2, 62); c.font = '800 44px Georgia, serif'; c.fillText('BAR', w / 2, 118);
    c.font = 'italic 700 64px Georgia, serif'; c.fillText('Yang', w / 2, 190); c.fillStyle = '#c3271c'; c.fillRect(30, 224, w - 60, 6); c.fillStyle = '#2a3f8f'; c.font = '600 22px system-ui'; c.fillText('Via De Amicis 6', w / 2, 266);
  }, false);
  const sm = new THREE.MeshBasicMaterial({ map: signT });
  B(0.09, 4.4, 0.09, M('#8d9196'), -0.4, 2.2, 0.5);
  for (const [z, ry] of [[0.55, 0], [0.45, Math.PI]]) { const pl2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), sm); pl2.position.set(-0.4, 3.4, z); pl2.rotation.y = ry; g.add(pl2); }
  B(1.24, 1.44, 0.08, M('#d9dadc'), -0.4, 3.4, 0.5);
}
