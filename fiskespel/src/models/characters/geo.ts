/**
 * Procedural geometry helpers shared by characters and boats (OWNER: player author).
 *
 * The workhorse is `surface()`: a parametric (u,v) grid with finite-difference normals and
 * metre-scaled UVs. Tubes, lofts, spheres and patches are thin wrappers around it, so every
 * organic shape (heads, torsos, boots, hulls, sails…) comes out smooth and correctly lit.
 */
import * as THREE from 'three';

export type SurfFn = (u: number, v: number, out: THREE.Vector3) => void;

export interface SurfOpts {
  /** u is periodic (closed tube). The seam column is duplicated for UVs, normals are continuous. */
  wrapU?: boolean;
  /** Flip normals + winding. */
  flip?: boolean;
  /** Metres per UV unit (default 0.1 = one detail tile per 10 cm). */
  uvUnit?: number;
  /** Optional explicit uv lengths (metres) along u and v; otherwise estimated. */
  lenU?: number;
  lenV?: number;
  /** Remap parameters (e.g. denser sampling near the face). */
  mapU?: (s: number) => number;
  mapV?: (s: number) => number;
}

const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _pu = new THREE.Vector3();
const _pv = new THREE.Vector3();

/** Build a parametric surface. u,v in [0,1]. Returns an indexed geometry with position/normal/uv. */
export function surface(fn: SurfFn, nu: number, nv: number, opts: SurfOpts = {}): THREE.BufferGeometry {
  const mapU = opts.mapU ?? ((s: number) => s);
  const mapV = opts.mapV ?? ((s: number) => s);
  const cols = nu + 1;
  const rows = nv + 1;
  const pos = new Float32Array(cols * rows * 3);
  const nor = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  const us: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i <= nu; i++) us.push(mapU(i / nu));
  for (let j = 0; j <= nv; j++) vs.push(mapV(j / nv));

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      fn(us[i], vs[j], _p);
      const k = (j * cols + i) * 3;
      pos[k] = _p.x;
      pos[k + 1] = _p.y;
      pos[k + 2] = _p.z;
    }
  }
  // normals by central differences on the function (robust at poles)
  const e = 1e-3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = us[i];
      let v = vs[j];
      for (let attempt = 0; attempt < 3; attempt++) {
        const u0 = opts.wrapU ? u - e : Math.max(0, u - e);
        const u1 = opts.wrapU ? u + e : Math.min(1, u + e);
        const v0 = Math.max(0, v - e);
        const v1 = Math.min(1, v + e);
        fn(u0, v, _a);
        fn(u1, v, _b);
        fn(u, v0, _c);
        fn(u, v1, _d);
        _pu.subVectors(_b, _a);
        _pv.subVectors(_d, _c);
        if (_pu.lengthSq() > 1e-14 && _pv.lengthSq() > 1e-14) break;
        // degenerate (pole): nudge towards the interior
        v = v < 0.5 ? v + 0.01 : v - 0.01;
      }
      const n = _p.crossVectors(_pv, _pu);
      if (opts.flip) n.negate();
      if (n.lengthSq() < 1e-20) n.set(0, 1, 0);
      n.normalize();
      const k = (j * cols + i) * 3;
      nor[k] = n.x;
      nor[k + 1] = n.y;
      nor[k + 2] = n.z;
    }
  }
  // uv lengths
  let lenU = opts.lenU ?? 0;
  let lenV = opts.lenV ?? 0;
  if (!opts.lenU) {
    let tot = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < nu; i++) {
        const k0 = (j * cols + i) * 3;
        const k1 = k0 + 3;
        tot += Math.hypot(pos[k1] - pos[k0], pos[k1 + 1] - pos[k0 + 1], pos[k1 + 2] - pos[k0 + 2]);
      }
    }
    lenU = tot / rows;
  }
  if (!opts.lenV) {
    let tot = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < nv; j++) {
        const k0 = (j * cols + i) * 3;
        const k1 = ((j + 1) * cols + i) * 3;
        tot += Math.hypot(pos[k1] - pos[k0], pos[k1 + 1] - pos[k0 + 1], pos[k1 + 2] - pos[k0 + 2]);
      }
    }
    lenV = tot / cols;
  }
  const unit = opts.uvUnit ?? 0.1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 2;
      uv[k] = ((i / nu) * lenU) / unit;
      uv[k + 1] = ((j / nv) * lenV) / unit;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const d = a + cols;
      const c = d + 1;
      // vertex normal = cross(Pv, Pu) (negated when flip); winding must match it
      if (opts.flip) idx.push(a, b, d, b, c, d);
      else idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Surface orientation used by the helpers below: u goes around counter-clockwise when viewed
 * from +axis, v goes along the axis. With that convention cross(Pv,Pu) points outward when we
 * use angle = -2πu (i.e. clockwise), so helpers use `ang = -u*2π`… Instead of juggling signs we
 * simply check one sample and flip when needed (see `autoFlip`).
 */
export function autoFlip(fn: SurfFn, inside: THREE.Vector3, u = 0.37, v = 0.5): boolean {
  const e = 1e-3;
  fn(u - e, v, _a);
  fn(u + e, v, _b);
  fn(u, v - e, _c);
  fn(u, v + e, _d);
  _pu.subVectors(_b, _a);
  _pv.subVectors(_d, _c);
  const n = new THREE.Vector3().crossVectors(_pv, _pu);
  fn(u, v, _p);
  const out = _p.clone().sub(inside);
  return n.dot(out) < 0;
}

/** Surface whose normals face away from `center` (sampled at u,v = 0.37,0.5 unless given). */
export function surfaceOut(
  fn: SurfFn,
  nu: number,
  nv: number,
  center: THREE.Vector3,
  opts: SurfOpts & { sampleU?: number; sampleV?: number; inward?: boolean } = {},
): THREE.BufferGeometry {
  let flip = autoFlip(fn, center, opts.sampleU ?? 0.37, opts.sampleV ?? 0.5);
  if (opts.inward) flip = !flip;
  return surface(fn, nu, nv, { ...opts, flip });
}

/** Superellipse point: exponent p (2 = ellipse, higher = boxier). */
export function superEllipse(ang: number, rx: number, rz: number, p = 2): [number, number] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const e = 2 / p;
  const x = Math.sign(c) * Math.pow(Math.abs(c), e) * rx;
  const z = Math.sign(s) * Math.pow(Math.abs(s), e) * rz;
  return [x, z];
}

export interface Ring {
  /** position along the axis (metres) */
  y: number;
  /** half width (x) */
  rx: number;
  /** front (+z) half depth */
  zf: number;
  /** back (-z) half depth */
  zb: number;
  /** centre offsets */
  cx?: number;
  cz?: number;
  /** superellipse exponent (2 = ellipse) */
  p?: number;
}

/** Catmull-Rom-ish smooth interpolation of ring tables at t in [0,1] over ring index. */
function sampleRings(rings: Ring[], s: number): Ring {
  const n = rings.length - 1;
  const f = THREE.MathUtils.clamp(s, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const t = f - i;
  const r0 = rings[Math.max(0, i - 1)];
  const r1 = rings[i];
  const r2 = rings[i + 1];
  const r3 = rings[Math.min(n, i + 2)];
  const cr = (a: number, b: number, c: number, d: number) => {
    // centripetal-free uniform catmull-rom, clamped to avoid overshoot
    const v = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const lo = Math.min(b, c);
    const hi = Math.max(b, c);
    const pad = (hi - lo) * 0.15;
    return THREE.MathUtils.clamp(v, lo - pad, hi + pad);
  };
  return {
    y: cr(r0.y, r1.y, r2.y, r3.y),
    rx: cr(r0.rx, r1.rx, r2.rx, r3.rx),
    zf: cr(r0.zf, r1.zf, r2.zf, r3.zf),
    zb: cr(r0.zb, r1.zb, r2.zb, r3.zb),
    cx: cr(r0.cx ?? 0, r1.cx ?? 0, r2.cx ?? 0, r3.cx ?? 0),
    cz: cr(r0.cz ?? 0, r1.cz ?? 0, r2.cz ?? 0, r3.cz ?? 0),
    p: cr(r0.p ?? 2, r1.p ?? 2, r2.p ?? 2, r3.p ?? 2),
  };
}

export interface LoftOpts extends SurfOpts {
  /** Close the bottom / top with a rounded cap (rings collapse smoothly to the axis). */
  capStart?: boolean;
  capEnd?: boolean;
  /** Fraction of v used for each cap dome. */
  capSize?: number;
  /** Per-vertex displacement along the radial direction (metres). u: 0..1 around (0 = front), s: 0..1 along. */
  displace?: (u: number, s: number, ring: Ring) => number;
  /** Angular offset (radians) of u = 0. Default 0 = front (+Z). */
  phase?: number;
}

/**
 * Loft along +Y through a table of elliptical rings. u = 0 is the front (+Z), going around to the
 * character's left (+X) first. Caps are made by extra dome rows that shrink to the axis.
 */
export function loft(rings: Ring[], nu: number, nv: number, o: LoftOpts = {}): THREE.BufferGeometry {
  const cap = o.capSize ?? 0.12;
  const s0 = o.capStart ? cap : 0;
  const s1 = o.capEnd ? 1 - cap : 1;
  const phase = o.phase ?? 0;
  const first = rings[0];
  const last = rings[rings.length - 1];
  const fn: SurfFn = (u, v, out) => {
    let s: number;
    let shrink = 1;
    let yExtra = 0;
    if (v < s0) {
      const t = v / s0; // 0 at pole, 1 at first ring
      s = 0;
      shrink = Math.sin((t * Math.PI) / 2);
      const depth = Math.min(first.rx, (first.zf + first.zb) / 2) * 0.9;
      yExtra = -(1 - Math.cos((1 - t) * Math.PI / 2)) * depth * Math.sign(last.y - first.y || 1);
    } else if (v > s1) {
      const t = (1 - v) / (1 - s1);
      s = 1;
      shrink = Math.sin((t * Math.PI) / 2);
      const depth = Math.min(last.rx, (last.zf + last.zb) / 2) * 0.9;
      yExtra = (1 - Math.cos((1 - t) * Math.PI / 2)) * depth * Math.sign(last.y - first.y || 1);
    } else {
      s = (v - s0) / Math.max(1e-6, s1 - s0);
    }
    const r = sampleRings(rings, s);
    const ang = phase + u * Math.PI * 2; // 0 = +Z front, pi/2 = +X
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const zr = c >= 0 ? r.zf : r.zb;
    const e = 2 / (r.p ?? 2);
    let x = Math.sign(sn) * Math.pow(Math.abs(sn), e) * r.rx;
    let z = Math.sign(c) * Math.pow(Math.abs(c), e) * zr;
    if (o.displace) {
      const d = o.displace(u, s, r);
      const len = Math.hypot(x, z) || 1;
      x += (x / len) * d;
      z += (z / len) * d;
    }
    out.set((r.cx ?? 0) + x * shrink, r.y + yExtra, (r.cz ?? 0) + z * shrink);
  };
  // pick orientation so normals face outward
  const mid = sampleRings(rings, 0.5);
  const flip = autoFlip(fn, new THREE.Vector3(mid.cx ?? 0, mid.y, mid.cz ?? 0), 0.3, 0.5);
  return surface(fn, nu, nv, { ...o, wrapU: true, flip: o.flip ? !flip : flip });
}

/** Tube along an arbitrary 3D curve with a radius profile. u around, v along the curve. */
export function tube(
  curve: (s: number, out: THREE.Vector3) => void,
  radius: (s: number, u: number) => number,
  nu: number,
  nv: number,
  o: SurfOpts & { up?: THREE.Vector3; capStart?: boolean; capEnd?: boolean } = {},
): THREE.BufferGeometry {
  // precompute rotation-minimising frames
  const N = 64;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const p = new THREE.Vector3();
    curve(i / N, p);
    pts.push(p);
  }
  const tans: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    tans.push(b.clone().sub(a).normalize());
  }
  const norms: THREE.Vector3[] = [];
  const up = o.up ?? new THREE.Vector3(0, 1, 0);
  let n0 = new THREE.Vector3().crossVectors(tans[0], up);
  if (n0.lengthSq() < 1e-6) n0 = new THREE.Vector3().crossVectors(tans[0], new THREE.Vector3(1, 0, 0));
  n0.normalize();
  norms.push(n0);
  for (let i = 1; i <= N; i++) {
    const prev = norms[i - 1];
    const t = tans[i];
    const n = prev.clone().sub(t.clone().multiplyScalar(prev.dot(t))).normalize();
    norms.push(n);
  }
  const frame = (s: number) => {
    const f = THREE.MathUtils.clamp(s, 0, 1) * N;
    const i = Math.min(N - 1, Math.floor(f));
    const t = f - i;
    const p = new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], t);
    const tg = new THREE.Vector3().lerpVectors(tans[i], tans[i + 1], t).normalize();
    const n = new THREE.Vector3().lerpVectors(norms[i], norms[i + 1], t).normalize();
    const b = new THREE.Vector3().crossVectors(tg, n).normalize();
    return { p, tg, n, b };
  };
  const cap = 0.08;
  const fn: SurfFn = (u, v, out) => {
    let s = v;
    let shrink = 1;
    let push = 0;
    if (o.capStart && v < cap) {
      const t = v / cap;
      s = 0;
      shrink = Math.sin((t * Math.PI) / 2);
      push = -(1 - Math.cos(((1 - t) * Math.PI) / 2));
    } else if (o.capEnd && v > 1 - cap) {
      const t = (1 - v) / cap;
      s = 1;
      shrink = Math.sin((t * Math.PI) / 2);
      push = 1 - Math.cos(((1 - t) * Math.PI) / 2);
    } else {
      const a = o.capStart ? cap : 0;
      const b = o.capEnd ? 1 - cap : 1;
      s = (v - a) / (b - a);
    }
    const { p, tg, n, b } = frame(s);
    const r = radius(s, u);
    const ang = u * Math.PI * 2;
    out.copy(p)
      .addScaledVector(n, Math.cos(ang) * r * shrink)
      .addScaledVector(b, Math.sin(ang) * r * shrink)
      .addScaledVector(tg, push * r * 0.9);
  };
  const mid = new THREE.Vector3();
  curve(0.5, mid);
  const flip = autoFlip(fn, mid, 0.3, 0.5);
  return surface(fn, nu, nv, { ...o, wrapU: true, flip: o.flip ? !flip : flip });
}

/** Ellipsoid (optionally displaced). Pole along +Y. */
export function ellipsoid(
  rx: number,
  ry: number,
  rz: number,
  nu: number,
  nv: number,
  displace?: (dir: THREE.Vector3) => number,
  o: SurfOpts = {},
): THREE.BufferGeometry {
  const dir = new THREE.Vector3();
  const fn: SurfFn = (u, v, out) => {
    const th = u * Math.PI * 2;
    const ph = v * Math.PI;
    dir.set(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    const d = displace ? displace(dir) : 0;
    out.set(dir.x * (rx + d), dir.y * (ry + d), dir.z * (rz + d));
  };
  const flip = autoFlip(fn, new THREE.Vector3(), 0.3, 0.5);
  return surface(fn, nu, nv, { ...o, wrapU: true, flip: o.flip ? !flip : flip });
}

/** Rounded box via superellipsoid. */
export function roundBox(sx: number, sy: number, sz: number, round = 0.3, nu = 16, nv = 10): THREE.BufferGeometry {
  const p = 2 / Math.max(0.05, round); // exponent: small round = boxy
  const e = 2 / p;
  const fn: SurfFn = (u, v, out) => {
    const th = u * Math.PI * 2;
    const ph = v * Math.PI;
    const sp = Math.sin(ph);
    const cp = Math.cos(ph);
    const st = Math.sin(th);
    const ct = Math.cos(th);
    const f = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), e);
    out.set(f(sp) * f(st) * sx * 0.5, f(cp) * sy * 0.5, f(sp) * f(ct) * sz * 0.5);
  };
  const flip = autoFlip(fn, new THREE.Vector3(), 0.3, 0.5);
  return surface(fn, nu, nv, { wrapU: true, flip });
}

/** Flat-ish patch from a function on [0,1]². flip decided by a reference "outside" direction. */
export function patch(fn: SurfFn, nu: number, nv: number, outward: THREE.Vector3, o: SurfOpts = {}): THREE.BufferGeometry {
  const e = 1e-3;
  fn(0.5 - e, 0.5, _a);
  fn(0.5 + e, 0.5, _b);
  fn(0.5, 0.5 - e, _c);
  fn(0.5, 0.5 + e, _d);
  _pu.subVectors(_b, _a);
  _pv.subVectors(_d, _c);
  const n = new THREE.Vector3().crossVectors(_pv, _pu);
  const flip = n.dot(outward) < 0;
  return surface(fn, nu, nv, { ...o, flip: o.flip ? !flip : flip });
}

// ─────────────────────────────────────────────────────────── math helpers

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** 1D gaussian bump. */
export const gauss = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
/** 2D gaussian bump. */
export const gauss2 = (x: number, y: number, cx: number, cy: number, wx: number, wy: number) =>
  Math.exp(-(((x - cx) * (x - cx)) / (2 * wx * wx) + ((y - cy) * (y - cy)) / (2 * wy * wy)));

/** Merge simple indexed geometries (position/normal/uv only). */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vc = 0;
  let ic = 0;
  for (const g of geos) {
    vc += g.attributes.position.count;
    ic += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vc * 3);
  const nor = new Float32Array(vc * 3);
  const uv = new Float32Array(vc * 2);
  const idx = new Uint32Array(ic);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i);
      pos[(vo + i) * 3 + 1] = p.getY(i);
      pos[(vo + i) * 3 + 2] = p.getZ(i);
      if (n) {
        nor[(vo + i) * 3] = n.getX(i);
        nor[(vo + i) * 3 + 1] = n.getY(i);
        nor[(vo + i) * 3 + 2] = n.getZ(i);
      }
      if (t) {
        uv[(vo + i) * 2] = t.getX(i);
        uv[(vo + i) * 2 + 1] = t.getY(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function triCount(obj: THREE.Object3D): number {
  let tris = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return Math.round(tris);
}
