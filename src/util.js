import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function noise(ctx, w, h, base, amp, n, rand) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (rand() - 0.5) * amp;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = 1 + rand() * 2;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

// Geometry builder that accumulates positions/normals/uvs/colors
export class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  v(x, y, z, nx, ny, nz, u, w, c) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w); this.col.push(c.r, c.g, c.b); }
  tri(a, b, c, col) { // a,b,c = [x,y,z,u,v]; normal computed
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) this.v(p[0], p[1], p[2], nx, ny, nz, p[3] || 0, p[4] || 0, col);
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

export function signedArea(p) { let a = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; } return a / 2; }

export function pointInPoly(x, z, p) {
  let inside = false; const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

// remove near-collinear and duplicate vertices
export function simplifyPoly(p) {
  let pts = []; for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      const abx = b[0] - a[0], abz = b[1] - a[1], bcx = c[0] - b[0], bcz = c[1] - b[1];
      const la = Math.hypot(abx, abz), lb = Math.hypot(bcx, bcz);
      if (la < 0.4) { pts.splice(i, 1); changed = true; break; }
      const cross = Math.abs(abx * bcz - abz * bcx) / (la * lb);
      if (cross < 0.2 && (abx * bcx + abz * bcz) > 0) { pts.splice(i, 1); changed = true; break; }
    }
  }
  return pts.flat();
}

// Uniform grid for 2D segment / item lookup
export class Grid {
  constructor(minx, minz, maxx, maxz, cell) {
    this.minx = minx; this.minz = minz; this.cell = cell;
    this.nx = Math.ceil((maxx - minx) / cell) + 1; this.nz = Math.ceil((maxz - minz) / cell) + 1;
    this.cells = new Map();
  }
  key(ix, iz) { return iz * this.nx + ix; }
  addBox(x0, z0, x1, z1, item) {
    const c = this.cell;
    const ix0 = Math.floor((Math.min(x0, x1) - this.minx) / c), ix1 = Math.floor((Math.max(x0, x1) - this.minx) / c);
    const iz0 = Math.floor((Math.min(z0, z1) - this.minz) / c), iz1 = Math.floor((Math.max(z0, z1) - this.minz) / c);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const k = this.key(ix, iz); let a = this.cells.get(k); if (!a) { a = []; this.cells.set(k, a); } a.push(item);
    }
  }
  query(x, z, r, out) {
    const c = this.cell;
    const ix0 = Math.floor((x - r - this.minx) / c), ix1 = Math.floor((x + r - this.minx) / c);
    const iz0 = Math.floor((z - r - this.minz) / c), iz1 = Math.floor((z + r - this.minz) / c);
    out.length = 0;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const a = this.cells.get(this.key(ix, iz)); if (a) for (const it of a) out.push(it);
    }
    return out;
  }
}

export function makeLabel(text, opts = {}) {
  const fs = opts.size || 44;
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + 40; c.width = w; c.height = fs + 30;
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = opts.bg || 'rgba(20,24,30,0.78)';
  const r = 14; ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.fillStyle = opts.color || '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 20, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: opts.depthTest ?? true, transparent: true });
  const s = new THREE.Sprite(m); const sc = opts.scale || 0.05;
  s.scale.set(w * sc, c.height * sc, 1);
  return s;
}
