import * as THREE from 'three';
import { GeoBuilder, canvasTex, noise, rng, signedArea, simplifyPoly, Grid, pointInPoly, makeLabel } from './util.js';

const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'secondary_link', 'residential', 'unclassified', 'living_street', 'service']);
const WALK = new Set([...DRIVABLE, 'pedestrian', 'footway', 'path', 'cycleway', 'track']);

export function buildWorld(D, scene) {
  const R = rng(42);
  const [ex0, ez0, ex1, ez1] = D.ext;
  const PAD = 400;
  const W = {
    D, ext: D.ext,
    segGrid: new Grid(ex0 - PAD, ez0 - PAD, ex1 + PAD, ez1 + PAD, 16), // building wall segments
    bldGrid: new Grid(ex0 - PAD, ez0 - PAD, ex1 + PAD, ez1 + PAD, 32), // building polygons
    roadGrid: new Grid(ex0 - PAD, ez0 - PAD, ex1 + PAD, ez1 + PAD, 24), // road segments
    segs: [], blds: [], roadSegs: [], gv: D.gv, adj: [], walkAdj: [], places: [],
  };

  // ---------- textures ----------
  const grassTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#7d9a55', 0.22, 9000, R); }); grassTex.repeat.set(1, 1);
  const asphaltTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#5a5d61', 0.25, 12000, R); });
  const walkTex = canvasTex(128, 128, (c, w, h) => {
    noise(c, w, h, '#b7b2a8', 0.15, 3000, R);
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
  });
  const wallTex = canvasTex(128, 128, (c, w, h) => {
    noise(c, w, h, '#f4efe6', 0.10, 2500, R);
    // window with green shutters (persiane), typical of the Bassa
    c.fillStyle = '#e9e2d4'; c.fillRect(18, 20, 92, 84);
    c.fillStyle = '#2d3a44'; c.fillRect(44, 26, 40, 70);
    c.fillStyle = '#4a5c66'; c.fillRect(46, 28, 17, 30); c.fillRect(65, 28, 17, 30);
    c.fillStyle = '#3f5f3a'; c.fillRect(24, 26, 20, 70); c.fillRect(84, 26, 20, 70);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
    for (let y = 30; y < 96; y += 5) { c.beginPath(); c.moveTo(25, y); c.lineTo(43, y); c.moveTo(85, y); c.lineTo(103, y); c.stroke(); }
    c.fillStyle = '#d8d0c0'; c.fillRect(20, 96, 88, 6);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 124, w, 4);
  });
  const groundTex = canvasTex(256, 128, (c, w, h) => {
    noise(c, w, h, '#f4efe6', 0.10, 3000, R);
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, 100, w, 28);
    // bay 1: window with grille and shutters
    c.fillStyle = '#e9e2d4'; c.fillRect(18, 22, 92, 70);
    c.fillStyle = '#2d3a44'; c.fillRect(44, 28, 40, 58);
    c.fillStyle = '#3f5f3a'; c.fillRect(24, 28, 20, 58); c.fillRect(84, 28, 20, 58);
    c.strokeStyle = 'rgba(0,0,0,0.35)'; for (let y = 32; y < 86; y += 5) { c.beginPath(); c.moveTo(25, y); c.lineTo(43, y); c.moveTo(85, y); c.lineTo(103, y); c.stroke(); }
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 2; for (let x = 50; x < 84; x += 8) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x, 86); c.stroke(); }
    // bay 2: wooden door
    c.fillStyle = '#e2d9c8'; c.fillRect(150, 14, 60, 114);
    c.fillStyle = '#5b3a22'; c.fillRect(156, 22, 48, 106);
    c.fillStyle = '#4a2e1a'; c.fillRect(159, 26, 19, 40); c.fillRect(182, 26, 19, 40); c.fillRect(159, 72, 19, 50); c.fillRect(182, 72, 19, 50);
    c.fillStyle = '#c9a54a'; c.fillRect(176, 76, 3, 8);
  });
  const indTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#d6d6d2'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(x, 0, 3, h); }
    c.fillStyle = '#7d9fb0'; c.fillRect(10, 18, 108, 22);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 10; x < 118; x += 18) c.fillRect(x, 18, 2, 22);
  });
  const roofTex = canvasTex(128, 128, (c, w, h) => {
    noise(c, w, h, '#c46a45', 0.18, 3000, R);
    for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(60,20,10,0.35)'; c.fillRect(0, y, w, 3); }
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < w; x += 16) { c.fillStyle = 'rgba(60,20,10,0.25)'; c.fillRect(x, y, 2, 16); }
  });
  const flatRoofTex = canvasTex(64, 64, (c, w, h) => noise(c, w, h, '#8f8a84', 0.2, 1500, R));
  W.tex = { grassTex };

  // ---------- ground ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ map: grassTex }));
  grassTex.repeat.set(9000 / 14, 9000 / 14);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // fields: stripes of crops outside the town to evoke the Po plain
  const fieldB = new GeoBuilder();
  const fieldCols = ['#9aa35a', '#b5a865', '#7f9a4e', '#a59a5c', '#8fa957', '#c2b37a', '#6f8f45'].map(c => new THREE.Color(c));

  // ---------- areas ----------
  const areaCol = { park: '#6f9a4a', pitch: '#4f8f3c', pool: '#4aa3c8', parking: '#8a8a86', cemetery: '#8b9b7a', wood: '#4f733a', farm: '#a8a35a', farmyard: '#a39978', industrial: '#a29d93', residential: null, square: '#c9bfae', water: '#3f7fa3' };
  const areaB = new GeoBuilder(); const waterB = new GeoBuilder();
  W.parkPolys = [];
  for (const a of D.areas) {
    const col = areaCol[a.k]; if (!col) continue;
    const p = a.p; const contour = []; for (let i = 0; i < p.length; i += 2) contour.push(new THREE.Vector2(p[i], p[i + 1]));
    if (contour.length < 3) continue;
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const y = a.k === 'water' ? 0.03 : 0.025 + (a.k === 'parking' || a.k === 'square' ? 0.01 : 0);
    const b = a.k === 'water' ? waterB : areaB; const c = new THREE.Color(col);
    for (const t of tris) {
      const A = contour[t[0]], B = contour[t[1]], C = contour[t[2]];
      const pts = [[A.x, y, A.y, A.x / 8, A.y / 8], [B.x, y, B.y, B.x / 8, B.y / 8], [C.x, y, C.y, C.x / 8, C.y / 8]];
      const ny = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y);
      if (ny >= 0) b.tri(pts[0], pts[1], pts[2], c); else b.tri(pts[0], pts[2], pts[1], c);
    }
    if (a.k === 'park' || a.k === 'wood' || a.k === 'cemetery') W.parkPolys.push(a);
  }
  const areaMesh = new THREE.Mesh(areaB.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTex.clone() }));
  areaMesh.material.map.repeat.set(1, 1); areaMesh.receiveShadow = true; scene.add(areaMesh);

  // ---------- ribbons (roads, canals, rail) ----------
  function ribbon(b, p, w, y, col, uvs = 0.15, joints = true) {
    const hw = w / 2;
    for (let i = 0; i < p.length - 2; i += 2) {
      const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3];
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 0.01) continue;
      const nx = -dz / l * hw, nz = dx / l * hw;
      const A = [x0 + nx, y, z0 + nz, (x0 + nx) * uvs, (z0 + nz) * uvs], B = [x0 - nx, y, z0 - nz, (x0 - nx) * uvs, (z0 - nz) * uvs];
      const C = [x1 - nx, y, z1 - nz, (x1 - nx) * uvs, (z1 - nz) * uvs], E = [x1 + nx, y, z1 + nz, (x1 + nx) * uvs, (z1 + nz) * uvs];
      upQuad(b, A, B, C, E, col);
    }
    if (joints) for (let i = 0; i < p.length; i += 2) disc(b, p[i], p[i + 1], hw, y, col, uvs);
  }
  function upTri(b, A, B, C, col) {
    const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
    if (ny >= 0) b.tri(A, B, C, col); else b.tri(A, C, B, col);
  }
  function upQuad(b, A, B, C, E, col) { upTri(b, A, B, C, col); upTri(b, A, C, E, col); }
  function disc(b, x, z, r, y, col, uvs) {
    const n = 10; const c = [x, y, z, x * uvs, z * uvs];
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
      const P = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], Q = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
      P.push(P[0] * uvs, P[2] * uvs); Q.push(Q[0] * uvs, Q[2] * uvs);
      upTri(b, c, P, Q, col);
    }
  }

  // water lines & rail
  const railB = new GeoBuilder();
  for (const l of D.lines) {
    if (l.k === 'water') {
      ribbon(areaB2(), l.p, l.w + 3, 0.028, new THREE.Color('#5e7f45'));
      ribbon(waterB, l.p, l.w, 0.035, new THREE.Color('#3f7fa3'));
    } else ribbon(railB, l.p, l.w, 0.03, new THREE.Color('#8c8577'), 0.3);
  }
  function areaB2() { return areaB; }
  const waterMesh = new THREE.Mesh(waterB.build(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x88aacc }));
  waterMesh.receiveShadow = true; scene.add(waterMesh);
  scene.add(new THREE.Mesh(railB.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  // rebuild area mesh with canal banks included
  areaMesh.geometry.dispose(); areaMesh.geometry = areaB.build();

  // ---------- buildings (needed before roads for sidewalk decision) ----------
  const palette = ['#efe3c8', '#f2d9a8', '#e8c49a', '#f0cfb8', '#e5b48f', '#f3e7d0', '#ddc9a3', '#f1dcc0', '#e9d2a0', '#d9a882', '#f4ead9', '#e7c7a5'].map(c => new THREE.Color(c));
  const wallB = new GeoBuilder(), gndB = new GeoBuilder(), indB = new GeoBuilder(), roofB = new GeoBuilder(), flatB = new GeoBuilder();
  const white = new THREE.Color(1, 1, 1);
  for (let bi = 0; bi < D.buildings.length; bi++) {
    const bd = D.buildings[bi];
    let p = simplifyPoly(bd.p);
    if (p.length < 6) continue;
    if (signedArea(p) > 0) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); p = q; }
    const n = p.length / 2, h = bd.h;
    const kind = bd.k;
    const isInd = kind === 'i';
    const wb = isInd ? indB : wallB;
    let col = isInd ? new THREE.Color().setHSL(0.08 + R() * 0.5, 0.05 + R() * 0.12, 0.78 + R() * 0.12) : palette[Math.floor(R() * palette.length)].clone();
    if (kind === 'x') col = new THREE.Color('#9a8f80');
    if (kind === 'c') col = new THREE.Color('#e6cfa8');
    if (bd.col) col = new THREE.Color(bd.col);
    const hidden = !!bd.hidden;
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9, cx = 0, cz = 0;
    let u = 0;
    for (let i = 0; i < n; i++) {
      const x0 = p[i * 2], z0 = p[i * 2 + 1], j = (i + 1) % n, x1 = p[j * 2], z1 = p[j * 2 + 1];
      const l = Math.hypot(x1 - x0, z1 - z0);
      const su = isInd ? 1 / 4 : 1 / 3.3, sv = isInd ? 1 / 8 : 1 / 3.1;
      const vOff = isInd ? 0 : 0;
      if (hidden) { /* drawn by a landmark */ }
      else if (!isInd && kind !== 'x' && h > 5) {
        const g = 3.1, gs = 1 / 6.6;
        gndB.quad([x0, 0, z0, u * gs, 0], [x1, 0, z1, (u + l) * gs, 0], [x1, g, z1, (u + l) * gs, 1], [x0, g, z0, u * gs, 1], col);
        wb.quad([x0, g, z0, u * su, 0], [x1, g, z1, (u + l) * su, 0], [x1, h, z1, (u + l) * su, (h - g) * sv], [x0, h, z0, u * su, (h - g) * sv], col);
      } else wb.quad([x0, 0, z0, u * su, vOff], [x1, 0, z1, (u + l) * su, vOff], [x1, h, z1, (u + l) * su, h * sv], [x0, h, z0, u * su, h * sv], col);
      u += l;
      W.segs.push([x0, z0, x1, z1]);
      W.segGrid.addBox(x0, z0, x1, z1, W.segs.length - 1);
      minx = Math.min(minx, x0); maxx = Math.max(maxx, x0); minz = Math.min(minz, z0); maxz = Math.max(maxz, z0); cx += x0; cz += z0;
    }
    cx /= n; cz /= n;
    const rec = { src: bi, p, h, minx, minz, maxx, maxz, cx, cz, n: bd.n, a: bd.a, k: kind };
    W.blds.push(rec); W.bldGrid.addBox(minx, minz, maxx, maxz, W.blds.length - 1);

    // roof
    if (hidden) continue;
    const pitched = !bd.flat && (kind === 'r' || kind === 'c' || kind === 'f') && h >= 3;
    const obb = pitched ? fitOBB(p) : null;
    if (pitched && n === 4 && isRect(p)) hipRoof(roofB, p, h, white);
    else if (obb && obb.ratio > 0.86) hipRoof(roofB, obb.p, h, white);
    else {
      const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const tb = (pitched && kind !== 'x') ? roofB : flatB;
      const rc = (pitched && kind !== 'x') ? new THREE.Color().setHSL(0.03, 0.25, 0.62 + R() * 0.12) : (kind === 'x' ? new THREE.Color('#7b7166') : new THREE.Color().setHSL(0, 0, 0.75 + R() * 0.2));
      const ry = h + (pitched ? 0.05 : 0);
      for (const t of tris) {
        const A = contour[t[0]], B = contour[t[1]], C = contour[t[2]];
        upTri(tb, [A.x, ry, A.y, A.x / 3, A.y / 3], [B.x, ry, B.y, B.x / 3, B.y / 3], [C.x, ry, C.y, C.x / 3, C.y / 3], rc);
      }
    }
  }
  function fitOBB(p) {
    const n = p.length / 2; let best = null;
    const area = Math.abs(signedArea(p));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; const a = Math.atan2(p[j * 2 + 1] - p[i * 2 + 1], p[j * 2] - p[i * 2]);
      const c = Math.cos(a), s = Math.sin(a);
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (let k = 0; k < n; k++) { const x = p[k * 2], z = p[k * 2 + 1]; const u = x * c + z * s, v = -x * s + z * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const A = (u1 - u0) * (v1 - v0);
      if (!best || A < best.A) best = { A, c, s, u0, u1, v0, v1 };
    }
    const { c, s: sn, u0, u1, v0, v1 } = best;
    const back = (u, v) => [u * c - v * sn, u * sn + v * c];
    const q = [back(u0, v0), back(u1, v0), back(u1, v1), back(u0, v1)].flat();
    return { p: q, ratio: area / best.A };
  }
  function isRect(p) {
    for (let i = 0; i < 4; i++) {
      const a = i, b = (i + 1) % 4, c = (i + 2) % 4;
      const ux = p[b * 2] - p[a * 2], uz = p[b * 2 + 1] - p[a * 2 + 1], vx = p[c * 2] - p[b * 2], vz = p[c * 2 + 1] - p[b * 2 + 1];
      const cos = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz));
      if (Math.abs(cos) > 0.25) return false;
    }
    return true;
  }
  function hipRoof(b, p, h, c) {
    // corners A B C D; make AB a long side
    let P = []; for (let i = 0; i < 4; i++) P.push([p[i * 2], p[i * 2 + 1]]);
    const d01 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), d12 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
    if (d12 > d01) P = [P[1], P[2], P[3], P[0]];
    const [A, B, C, Dd] = P;
    const L = Math.max(d01, d12), S = Math.min(d01, d12);
    const M1 = [(A[0] + Dd[0]) / 2, (A[1] + Dd[1]) / 2], M2 = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    const ux = (M2[0] - M1[0]) / L, uz = (M2[1] - M1[1]) / L;
    const ins = Math.min(S / 2, L / 2 - 0.01);
    const R1 = [M1[0] + ux * ins, M1[1] + uz * ins], R2 = [M2[0] - ux * ins, M2[1] - uz * ins];
    const rh = h + Math.min(S * 0.28, 4.5);
    const o = 0.35; // eave overhang
    const cxm = (A[0] + C[0]) / 2, czm = (A[1] + C[1]) / 2;
    const ex = (q) => { const dx = q[0] - cxm, dz = q[1] - czm, l = Math.hypot(dx, dz); return [q[0] + dx / l * o, q[1] + dz / l * o]; };
    const a = ex(A), bb = ex(B), cc = ex(C), dd = ex(Dd);
    const V = (q, y) => [q[0], y, q[1], q[0] / 2.2, (q[1] + y) / 2.2];
    const ye = h - 0.15;
    // orient each face outward/up
    const face = (pts) => { if (pts.length === 3) upTri(b, pts[0], pts[1], pts[2], c); else upQuad(b, pts[0], pts[1], pts[2], pts[3], c); };
    face([V(a, ye), V(bb, ye), V(R2, rh), V(R1, rh)]);
    face([V(cc, ye), V(dd, ye), V(R1, rh), V(R2, rh)]);
    face([V(dd, ye), V(a, ye), V(R1, rh)]);
    face([V(bb, ye), V(cc, ye), V(R2, rh)]);
    // flat cap under eaves so you can't see inside
    upQuad(b, V(a, h - 0.01), V(bb, h - 0.01), V(cc, h - 0.01), V(dd, h - 0.01), new THREE.Color('#8a6a55'));
  }

  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, vertexColors: true });
  const indMat = new THREE.MeshLambertMaterial({ map: indTex, vertexColors: true });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex, vertexColors: true, side: THREE.DoubleSide });
  const flatMat = new THREE.MeshLambertMaterial({ map: flatRoofTex, vertexColors: true });
  const gndMat = new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true });
  for (const [b, m] of [[gndB, gndMat], [wallB, wallMat], [indB, indMat], [roofB, roofMat], [flatB, flatMat]]) {
    const mesh = new THREE.Mesh(b.build(), m); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }

  // ---------- roads ----------
  const roadB = new GeoBuilder(), walkB = new GeoBuilder(), markB = new GeoBuilder();
  const asphalt = new THREE.Color(1, 1, 1), gravel = new THREE.Color('#c8b89a'), markCol = new THREE.Color('#f2f2ea');
  const tmp = [];
  const nearBuildings = (x, z) => { W.bldGrid.query(x, z, 28, tmp); return tmp.length > 0; };
  // sort: minor first so that major roads draw over them (same height, same colour anyway)
  D.roads.forEach((r, ri) => {
    const p = r.p; const isPath = r.t === 'path' || r.t === 'footway' || r.t === 'cycleway' || r.t === 'track';
    for (let i = 0; i < p.length - 2; i += 2) {
      W.roadSegs.push([p[i], p[i + 1], p[i + 2], p[i + 3], ri]);
      W.roadGrid.addBox(p[i], p[i + 1], p[i + 2], p[i + 3], W.roadSegs.length - 1);
    }
    if (isPath) { ribbon(walkB, p, r.w, 0.05, r.t === 'track' ? gravel : new THREE.Color('#d9d2c4'), 0.25); return; }
    // sidewalks only where there are buildings nearby
    for (let i = 0; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2, mz = (p[i + 1] + p[i + 3]) / 2;
      if (r.t !== 'service' && nearBuildings(mx, mz)) ribbon(walkB, [p[i], p[i + 1], p[i + 2], p[i + 3]], r.w + 3.6, 0.05, white, 0.25);
    }
    ribbon(roadB, p, r.w, 0.07, r.t === 'pedestrian' ? new THREE.Color('#d8cdb8') : asphalt, 0.16);
    if (['primary', 'secondary', 'tertiary'].includes(r.t)) {
      // dashed centre line
      let acc = 0;
      for (let i = 0; i < p.length - 2; i += 2) {
        const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, l = Math.hypot(dx, dz);
        const ux = dx / l, uz = dz / l, nx = -uz * 0.08, nz = ux * 0.08;
        for (let s = (7 - acc % 7) % 7; s < l; s += 7) {
          const e = Math.min(s + 3, l);
          const ax = x0 + ux * s, az = z0 + uz * s, bx = x0 + ux * e, bz = z0 + uz * e;
          upQuad(markB, [ax + nx, 0.085, az + nz], [ax - nx, 0.085, az - nz], [bx - nx, 0.085, bz - nz], [bx + nx, 0.085, bz + nz], markCol);
        }
        acc += l;
        // edge lines
        for (const sd of [1, -1]) {
          const off = (r.w / 2 - 0.35) * sd, ox = -uz * off, oz = ux * off;
          const ax = x0 + ox, az = z0 + oz, bx = x0 + dx + ox, bz = z0 + dz + oz;
          upQuad(markB, [ax + nx, 0.085, az + nz], [ax - nx, 0.085, az - nz], [bx - nx, 0.085, bz - nz], [bx + nx, 0.085, bz + nz], markCol);
        }
      }
    }
  });
  const roadMesh = new THREE.Mesh(roadB.build(), new THREE.MeshLambertMaterial({ map: asphaltTex, vertexColors: true }));
  roadMesh.receiveShadow = true; scene.add(roadMesh);
  const walkMesh = new THREE.Mesh(walkB.build(), new THREE.MeshLambertMaterial({ map: walkTex, vertexColors: true }));
  walkMesh.receiveShadow = true; scene.add(walkMesh);
  scene.add(new THREE.Mesh(markB.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));

  // ---------- road graph ----------
  const nv = D.gv.length / 2;
  for (let i = 0; i < nv; i++) { W.adj.push([]); W.walkAdj.push([]); }
  D.roads.forEach((r, ri) => {
    const ids = r.i; if (!ids) return;
    for (let k = 0; k < ids.length - 1; k++) {
      const a = ids[k], b = ids[k + 1];
      if (WALK.has(r.t)) { W.walkAdj[a].push({ to: b, r: ri }); W.walkAdj[b].push({ to: a, r: ri }); }
      if (DRIVABLE.has(r.t)) {
        W.adj[a].push({ to: b, r: ri });
        if (!r.o) W.adj[b].push({ to: a, r: ri });
      }
    }
  });
  W.driveVerts = []; for (let i = 0; i < nv; i++) if (W.adj[i].length) W.driveVerts.push(i);
  W.nearestDriveVert = (x, z, filter) => {
    let best = -1, bd = 1e18;
    for (const i of W.driveVerts) {
      if (filter && !filter(i)) continue;
      const d = (D.gv[i * 2] - x) ** 2 + (D.gv[i * 2 + 1] - z) ** 2; if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // ---------- trees ----------
  const treePos = [];
  const roadTmp = [];
  const freeSpot = (x, z, rr) => {
    W.bldGrid.query(x, z, 2, tmp);
    for (const bi of tmp) { const b = W.blds[bi]; if (x > b.minx - rr && x < b.maxx + rr && z > b.minz - rr && z < b.maxz + rr && pointInPolyPad(x, z, b, rr)) return false; }
    W.roadGrid.query(x, z, 12, roadTmp);
    for (const si of roadTmp) { const s = W.roadSegs[si]; const w = D.roads[s[4]].w; if (segDist(x, z, s) < w / 2 + 2.2 + rr) return false; }
    return true;
  };
  function pointInPolyPad(x, z, b, rr) { return pointInPoly(x, z, b.p) || rr > 0 && (pointInPoly(x + rr, z, b.p) || pointInPoly(x - rr, z, b.p) || pointInPoly(x, z + rr, b.p) || pointInPoly(x, z - rr, b.p)); }
  for (const a of W.parkPolys) {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (let i = 0; i < a.p.length; i += 2) { minx = Math.min(minx, a.p[i]); maxx = Math.max(maxx, a.p[i]); minz = Math.min(minz, a.p[i + 1]); maxz = Math.max(maxz, a.p[i + 1]); }
    const area = (maxx - minx) * (maxz - minz); const cnt = Math.min(400, area / (a.k === 'wood' ? 40 : 160));
    for (let k = 0; k < cnt; k++) {
      const x = minx + R() * (maxx - minx), z = minz + R() * (maxz - minz);
      if (pointInPoly(x, z, a.p) && freeSpot(x, z, 1)) treePos.push([x, z, a.k === 'cemetery' ? 2 : 0]);
    }
  }
  for (const pt of D.pois) if (pt.a === 'tree') treePos.push([pt.x, pt.z, 0]);
  // poplar rows along country roads and scattered farm trees
  D.roads.forEach(r => {
    if (!['primary', 'secondary', 'tertiary', 'unclassified', 'track'].includes(r.t)) return;
    const p = r.p;
    for (let i = 0; i < p.length - 2; i += 2) {
      const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l = Math.hypot(dx, dz);
      for (let s = 0; s < l; s += 9 + R() * 6) {
        if (R() < 0.55) continue;
        const sd = R() < 0.5 ? 1 : -1, off = r.w / 2 + 4 + R() * 2;
        const x = p[i] + dx * s / l - dz / l * off * sd, z = p[i + 1] + dz * s / l + dx / l * off * sd;
        W.bldGrid.query(x, z, 40, tmp); if (tmp.length) continue;
        if (freeSpot(x, z, 1)) treePos.push([x, z, 1]);
      }
    }
  });
  for (let k = 0; k < 2500; k++) {
    const x = ex0 + R() * (ex1 - ex0), z = ez0 + R() * (ez1 - ez0);
    W.bldGrid.query(x, z, 25, tmp); if (tmp.length && R() < 0.85) continue;
    if (R() < 0.6 && freeSpot(x, z, 1.5)) treePos.push([x, z, R() < 0.3 ? 1 : 0]);
  }
  // fields
  for (let k = 0; k < 180; k++) {
    const cx = ex0 - 300 + R() * (ex1 - ex0 + 600), cz = ez0 - 300 + R() * (ez1 - ez0 + 600);
    W.bldGrid.query(cx, cz, 80, tmp); if (tmp.length) continue;
    const ang = R() * Math.PI, w = 60 + R() * 140, hh = 40 + R() * 120;
    const ca = Math.cos(ang), sa = Math.sin(ang); const c = fieldCols[Math.floor(R() * fieldCols.length)];
    const P = [[-w, -hh], [w, -hh], [w, hh], [-w, hh]].map(([a, b]) => [cx + a * ca - b * sa, 0.012, cz + a * sa + b * ca]);
    for (const q of P) q.push(q[0] / 6, q[2] / 6);
    upQuad(fieldB, P[0], P[1], P[2], P[3], c);
  }
  const fieldMesh = new THREE.Mesh(fieldB.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, y, w, 3); } }) }));
  fieldMesh.receiveShadow = true; scene.add(fieldMesh);

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 6); trunkGeo.translate(0, 1.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.4, 1); crownGeo.translate(0, 4.6, 0);
  const poplarGeo = new THREE.CylinderGeometry(0.2, 1.5, 9, 7); poplarGeo.translate(0, 7, 0);
  const cypressGeo = new THREE.ConeGeometry(0.9, 7, 7); cypressGeo.translate(0, 5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#6b4f36' }), treePos.length);
  const groups = [[], [], []]; treePos.forEach(t => groups[t[2]].push(t));
  const crowns = [
    new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: '#4d7a35', flatShading: true }), groups[0].length),
    new THREE.InstancedMesh(poplarGeo, new THREE.MeshLambertMaterial({ color: '#5d8a3a', flatShading: true }), groups[1].length),
    new THREE.InstancedMesh(cypressGeo, new THREE.MeshLambertMaterial({ color: '#2f5a2c', flatShading: true }), groups[2].length),
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const tc = new THREE.Color();
  treePos.forEach((t, i) => {
    const s = 0.75 + R() * 0.6; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
    m4.compose(pv.set(t[0], 0, t[1]), q, sv.set(s, s, s)); trunks.setMatrixAt(i, m4);
  });
  groups.forEach((g, gi) => g.forEach((t, i) => {
    const s = 0.75 + R() * 0.6; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
    m4.compose(pv.set(t[0], 0, t[1]), q, sv.set(s, s * (0.9 + R() * 0.3), s)); crowns[gi].setMatrixAt(i, m4);
    crowns[gi].setColorAt(i, tc.setHSL(0.24 + R() * 0.08, 0.35 + R() * 0.2, 0.28 + R() * 0.12));
  }));
  for (const m of [trunks, ...crowns]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  W.trees = treePos;

  // ---------- named places ----------
  const places = [];
  for (const b of W.blds) if (b.n) places.push({ name: b.n, x: b.cx, z: b.cz, h: b.h, a: b.a });
  for (const pt of D.pois) if (pt.n) places.push({ name: pt.n, x: pt.x, z: pt.z, h: 6, a: pt.a });
  for (const pl of places) {
    pl.frazione = typeof pl.a === 'string' && pl.a.startsWith('place:');
    // frazioni e località: etichetta più grande e alta, visibile da lontano
    const lab = pl.frazione ? makeLabel(pl.name, { size: 56, scale: 0.11, bg: 'rgba(122,40,16,0.82)' }) : makeLabel(pl.name, { size: 40, scale: 0.055 });
    lab.position.set(pl.x, pl.frazione ? 34 : pl.h + 4, pl.z); scene.add(lab); pl.label = lab;
    pl.v = W.nearestDriveVert(pl.x, pl.z);
    pl.rx = D.gv[pl.v * 2]; pl.rz = D.gv[pl.v * 2 + 1];
  }
  W.places = places;

  // ---------- collision helpers ----------
  const qs = [];
  // push circle out of building walls; returns {hit, nx, nz}
  W.collideCircle = (pos, r) => {
    let hit = false, hnx = 0, hnz = 0;
    for (let it = 0; it < 2; it++) {
      W.segGrid.query(pos.x, pos.z, r + 0.5, qs);
      for (const si of qs) {
        const s = W.segs[si];
        const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz;
        let t = ((pos.x - s[0]) * dx + (pos.z - s[1]) * dz) / l2; t = Math.max(0, Math.min(1, t));
        const px = s[0] + dx * t, pz = s[1] + dz * t; let ox = pos.x - px, oz = pos.z - pz; const d = Math.hypot(ox, oz);
        if (d < r) {
          // outward normal of wall (polys are oriented so (-dz, dx) is outward)
          const l = Math.sqrt(l2); let nx = -dz / l, nz = dx / l;
          if (d > 1e-4 && (t <= 0 || t >= 1)) { nx = ox / d; nz = oz / d; }
          else if (ox * nx + oz * nz < 0 && d > 1e-4) { /* inside: keep outward */ }
          const pen = (t <= 0 || t >= 1) ? r - d : r - (ox * nx + oz * nz);
          if (pen > 0) { pos.x += nx * pen; pos.z += nz * pen; hit = true; hnx = nx; hnz = nz; }
        }
      }
    }
    return { hit, nx: hnx, nz: hnz };
  };
  W.insideBuilding = (x, z) => {
    W.bldGrid.query(x, z, 0.1, qs);
    for (const bi of qs) { const b = W.blds[bi]; if (x > b.minx && x < b.maxx && z > b.minz && z < b.maxz && pointInPoly(x, z, b.p)) return b; }
    return null;
  };
  // 2D ray vs walls: returns fraction t in [0,1]
  W.rayWalls = (x0, z0, x1, z1) => {
    let best = 1; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, rr = Math.hypot(x1 - x0, z1 - z0) / 2 + 1;
    W.segGrid.query(mx, mz, rr, qs);
    const rx = x1 - x0, rz = z1 - z0;
    for (const si of qs) {
      const s = W.segs[si]; const sx = s[2] - s[0], sz = s[3] - s[1];
      const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue;
      const t = ((s[0] - x0) * sz - (s[1] - z0) * sx) / den, u = ((s[0] - x0) * rz - (s[1] - z0) * rx) / den;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    }
    return best;
  };
  W.roadAt = (x, z, maxd = 14) => {
    W.roadGrid.query(x, z, maxd, qs); let best = null, bd = maxd;
    for (const si of qs) { const s = W.roadSegs[si]; const d = segDist(x, z, s); if (d < bd && D.roads[s[4]].n) { bd = d; best = D.roads[s[4]]; } }
    return best;
  };
  W.onRoad = (x, z) => {
    W.roadGrid.query(x, z, 8, qs);
    for (const si of qs) { const s = W.roadSegs[si]; const r = D.roads[s[4]]; if (segDist(x, z, s) < r.w / 2 + 0.3) return r; }
    return null;
  };
  return W;
}

export function segDist(x, z, s) {
  const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1;
  let t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t);
}
