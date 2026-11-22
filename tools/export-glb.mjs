// Esporta la città OSM in un file .glb importabile in Godot, Unity o in un viewer Three.js.
//   node tools/export-glb.mjs                 legge data/moglia.json, scrive spike/moglia.glb
//   node tools/export-glb.mjs altro.json out.glb
// La geometria è minimale (colori per categoria, niente texture, niente alberi né landmark):
// serve a misurare il caricamento della mappa in motori diversi, non a sostituire il gioco.
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2] || 'data/moglia.json';
const dst = process.argv[3] || 'spike/moglia.glb';
const D = JSON.parse(fs.readFileSync(src, 'utf8'));

const AREA_COLORS = {
  park: '#6f9a4a', pitch: '#4f8f3c', pool: '#4aa3c8', parking: '#8a8a86',
  cemetery: '#8b9b7a', wood: '#4f733a', farm: '#a8a35a', farmyard: '#a39978',
  industrial: '#a29d93', square: '#c9bfae', water: '#3f7fa3',
};
const WALLS = ['#efe3c8', '#f2d9a8', '#e8c49a', '#f0cfb8', '#e5b48f', '#f3e7d0', '#ddc9a3', '#f1dcc0', '#e9d2a0', '#d9a882', '#f4ead9', '#e7c7a5'];
const ROOF = '#a85a3f';

const groups = new Map();
function group(hex) {
  let g = groups.get(hex);
  if (!g) { g = { pos: [], nor: [] }; groups.set(hex, g); }
  return g;
}

function tri(hex, a, b, c) {
  const g = group(hex);
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  g.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  g.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
}
function triUp(hex, a, b, c) {
  // le superfici orizzontali devono guardare verso l'alto
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny < 0) tri(hex, a, c, b); else tri(hex, a, b, c);
}
function quadUp(hex, a, b, c, d) { triUp(hex, a, b, c); triUp(hex, a, c, d); }

function signedArea(p) {
  let a = 0; const n = p.length / 2;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
  return a / 2;
}
function cleanPoly(p) {
  let q = p.slice();
  if (q.length >= 6 && q[0] === q[q.length - 2] && q[1] === q[q.length - 1]) q = q.slice(0, -2);
  if (q.length < 6) return null;
  return signedArea(q) > 0 ? q.slice().reverse() : q;
}
function triangulate(p) {
  const contour = [];
  for (let i = 0; i < p.length; i += 2) contour.push(new THREE.Vector2(p[i], p[i + 1]));
  try { return THREE.ShapeUtils.triangulateShape(contour, []); } catch (_) { return []; }
}

// ---------- terreno ----------
{
  const R = 4500;
  quadUp('#7d9a55', [-R, 0, -R], [R, 0, -R], [R, 0, R], [-R, 0, R]);
}

// ---------- aree ----------
for (const a of D.areas) {
  const col = AREA_COLORS[a.k]; if (!col) continue;
  const p = cleanPoly(a.p); if (!p) continue;
  const y = a.k === 'water' ? 0.03 : 0.025;
  for (const t of triangulate(p)) {
    const A = [p[t[0] * 2], y, p[t[0] * 2 + 1]], B = [p[t[1] * 2], y, p[t[1] * 2 + 1]], C = [p[t[2] * 2], y, p[t[2] * 2 + 1]];
    triUp(col, A, B, C);
  }
}

// ---------- canali e ferrovia ----------
for (const l of D.lines) {
  const col = l.k === 'water' ? '#3f7fa3' : '#8c8577';
  const y = l.k === 'water' ? 0.035 : 0.03;
  ribbon(l.p, l.w, y, col);
}

// ---------- strade ----------
const ROAD_COLORS = {
  primary: '#5a5d61', secondary: '#5a5d61', tertiary: '#5a5d61', secondary_link: '#5a5d61',
  residential: '#5a5d61', unclassified: '#5a5d61', living_street: '#5a5d61', service: '#5a5d61',
  pedestrian: '#d8cdb8', path: '#d9d2c4', footway: '#d9d2c4', cycleway: '#d9d2c4', track: '#c8b89a',
};
for (const r of D.roads) ribbon(r.p, r.w, 0.07, ROAD_COLORS[r.t] || '#5a5d61');

function ribbon(p, w, y, col) {
  const hw = w / 2;
  for (let i = 0; i < p.length - 2; i += 2) {
    const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
    if (l < 0.05) continue;
    const nx = -dz / l * hw, nz = dx / l * hw;
    const A = [x0 + nx, y, z0 + nz], B = [x0 - nx, y, z0 - nz], C = [x1 - nx, y, z1 - nz], E = [x1 + nx, y, z1 + nz];
    quadUp(col, A, B, C, E);
  }
}

// ---------- edifici ----------
D.buildings.forEach((bd, bi) => {
  const p = cleanPoly(bd.p); if (!p) return;
  const h = Math.max(1, bd.h || 3);
  let wallCol = WALLS[bi % WALLS.length];
  if (bd.k === 'i') wallCol = '#b7b2aa';
  if (bd.k === 'c') wallCol = '#e6cfa8';
  if (bd.k === 'x') wallCol = '#9a8f80';
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = p[i * 2], z0 = p[i * 2 + 1], x1 = p[j * 2], z1 = p[j * 2 + 1];
    const A0 = [x0, 0, z0], B0 = [x1, 0, z1], B1 = [x1, h, z1], A1 = [x0, h, z0];
    tri(wallCol, A0, B0, B1); tri(wallCol, A0, B1, A1);
  }
  for (const t of triangulate(p)) {
    const A = [p[t[0] * 2], h, p[t[0] * 2 + 1]], B = [p[t[1] * 2], h, p[t[1] * 2 + 1]], C = [p[t[2] * 2], h, p[t[2] * 2 + 1]];
    triUp(ROOF, A, B, C);
  }
});

// ---------- GLB ----------
function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}
const binParts = [], bufferViews = [], accessors = [], materials = [], primitives = [];
let binLen = 0, triangles = 0;

for (const [hex, g] of groups) {
  if (!g.pos.length) continue;
  const pos = new Float32Array(g.pos), nor = new Float32Array(g.nor);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
  const posOff = binLen; binParts.push(Buffer.from(pos.buffer)); binLen += pos.byteLength;
  bufferViews.push({ buffer: 0, byteOffset: posOff, byteLength: pos.byteLength, target: 34962 });
  accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
  const posAcc = accessors.length - 1;
  const norOff = binLen; binParts.push(Buffer.from(nor.buffer)); binLen += nor.byteLength;
  bufferViews.push({ buffer: 0, byteOffset: norOff, byteLength: nor.byteLength, target: 34962 });
  accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: nor.length / 3, type: 'VEC3' });
  const norAcc = accessors.length - 1;
  const lin = hexToLinear(hex);
  materials.push({ name: hex, doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [...lin, 1], metallicFactor: 0, roughnessFactor: 0.95 } });
  primitives.push({ attributes: { POSITION: posAcc, NORMAL: norAcc }, material: materials.length - 1 });
  triangles += pos.length / 9;
}

const bin = Buffer.concat(binParts);
const binPadded = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]);
const json = {
  asset: { version: '2.0', generator: 'moglia-city tools/export-glb.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'MogliaCity' }],
  meshes: [{ name: 'MogliaCity', primitives }], materials, accessors, bufferViews,
  buffers: [{ byteLength: binPadded.length }],
};
let jsonStr = JSON.stringify(json);
while (jsonStr.length % 4) jsonStr += ' ';
const jsonBuf = Buffer.from(jsonStr, 'utf8');
const total = 12 + 8 + jsonBuf.length + 8 + binPadded.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonBuf.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jsonBuf.copy(out, 20);
const binHeader = 20 + jsonBuf.length;
out.writeUInt32LE(binPadded.length, binHeader); out.writeUInt32LE(0x004e4942, binHeader + 4); binPadded.copy(out, binHeader + 8);

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, out);
console.log(`scritto ${dst}  ${(total / 1024 / 1024).toFixed(1)} MB · ${Math.round(triangles).toLocaleString('it-IT')} triangoli · ${groups.size} materiali`);
