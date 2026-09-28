/**
 * Geometry helpers for gear models: custom lathe / swept tubes with world-unit UVs, transforms,
 * and a Kit that collects parts and merges them per material (few draw calls per model).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];
export type Geo = THREE.BufferGeometry;

const TAU = Math.PI * 2;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export interface Xf {
  p?: V3;
  /** Euler XYZ radians. */
  r?: V3;
  s?: V3 | number;
  q?: THREE.Quaternion;
}

/** Apply a transform to a geometry in place (returns it). Rotation before translation. */
export function xf(g: Geo, t: Xf): Geo {
  if (t.q) _q.copy(t.q);
  else if (t.r) _q.setFromEuler(_e.set(t.r[0], t.r[1], t.r[2]));
  else _q.identity();
  if (t.s === undefined) _s.set(1, 1, 1);
  else if (typeof t.s === 'number') _s.set(t.s, t.s, t.s);
  else _s.set(t.s[0], t.s[1], t.s[2]);
  _v.set(t.p?.[0] ?? 0, t.p?.[1] ?? 0, t.p?.[2] ?? 0);
  _m.compose(_v, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/** Quaternion rotating +Y onto dir. */
export function alignY(dir: THREE.Vector3 | V3): THREE.Quaternion {
  const d = Array.isArray(dir) ? new THREE.Vector3(dir[0], dir[1], dir[2]) : dir.clone();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

export interface LatheOpts {
  /** World-unit texture tile size (metres). u repeats round(2πr/tile) times, v = arclength/tile. */
  tile?: number;
  uRep?: number;
  phi0?: number;
  phiLen?: number;
}

/**
 * Lathe around +Y. profile = [[r, y], ...] bottom→top. A repeated point creates a hard crease.
 * Analytic smooth normals (no seam), UVs in world units when `tile` is set.
 */
export function lathe(profile: [number, number][], segs = 16, o: LatheOpts = {}): Geo {
  const n = profile.length;
  const phi0 = o.phi0 ?? 0;
  const phiLen = o.phiLen ?? TAU;
  const nr = new Float32Array(n);
  const ny = new Float32Array(n);
  const same = (a?: [number, number], b?: [number, number]) => !!a && !!b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  for (let j = 0; j < n; j++) {
    const p = profile[j];
    const prev = profile[j - 1];
    const next = profile[j + 1];
    let tr: number;
    let ty: number;
    if (same(p, next) && prev) {
      tr = p[0] - prev[0];
      ty = p[1] - prev[1];
    } else if (same(p, prev) && next) {
      tr = next[0] - p[0];
      ty = next[1] - p[1];
    } else if (!prev) {
      tr = next[0] - p[0];
      ty = next[1] - p[1];
    } else if (!next) {
      tr = p[0] - prev[0];
      ty = p[1] - prev[1];
    } else {
      let ar = p[0] - prev[0];
      let ay = p[1] - prev[1];
      let br = next[0] - p[0];
      let by = next[1] - p[1];
      const la = Math.hypot(ar, ay) || 1;
      const lb = Math.hypot(br, by) || 1;
      ar /= la;
      ay /= la;
      br /= lb;
      by /= lb;
      tr = ar + br;
      ty = ay + by;
    }
    const l = Math.hypot(tr, ty) || 1;
    nr[j] = ty / l;
    ny[j] = -tr / l;
  }
  // arc length along profile
  const vArr = new Float32Array(n);
  let acc = 0;
  for (let j = 1; j < n; j++) {
    acc += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
    vArr[j] = acc;
  }
  let rAvg = 0;
  for (const p of profile) rAvg += p[0];
  rAvg /= n;
  const tile = o.tile;
  const uRep = o.uRep ?? (tile ? Math.max(1, Math.round((TAU * rAvg * (phiLen / TAU)) / tile)) : 1);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const phi = phi0 + (i / segs) * phiLen;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    for (let j = 0; j < n; j++) {
      const [r, y] = profile[j];
      pos.push(r * s, y, r * c);
      nor.push(nr[j] * s, ny[j], nr[j] * c);
      uv.push((i / segs) * uRep, tile ? vArr[j] / tile : acc > 0 ? vArr[j] / acc : 0);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < n - 1; j++) {
      if (same(profile[j], profile[j + 1])) continue;
      const a = i * n + j;
      const b = a + n;
      const c = b + 1;
      const d = a + 1;
      idx.push(a, b, d, c, d, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Cylinder / cone section along +Y from y0 to y1 (open unless caps). */
export function cyl(y0: number, y1: number, r0: number, r1: number, segs = 12, o: LatheOpts & { cap0?: boolean; cap1?: boolean } = {}): Geo {
  const p: [number, number][] = [];
  if (o.cap0) p.push([0, y0], [r0, y0], [r0, y0]);
  else p.push([r0, y0]);
  if (o.cap1) p.push([r1, y1], [r1, y1], [0, y1]);
  else p.push([r1, y1]);
  return lathe(p, segs, o);
}

/** Rounded band (wrap / ferrule) at y with height h and radius r (small bevel). */
export function band(y0: number, y1: number, r: number, bevel: number, segs = 12, o: LatheOpts = {}): Geo {
  const b = Math.min(bevel, (y1 - y0) * 0.45);
  return lathe(
    [
      [r - b * 1.2, y0],
      [r - b * 0.3, y0 + b * 0.25],
      [r, y0 + b],
      [r, y1 - b],
      [r - b * 0.3, y1 - b * 0.25],
      [r - b * 1.2, y1],
    ],
    segs,
    o,
  );
}

export interface TubeOpts {
  cap0?: boolean;
  cap1?: boolean;
  closed?: boolean;
  tile?: number;
  /** Flatten the cross-section (scale along binormal). */
  flat?: number;
  /** Fixed up vector for the frames (avoids Frenet flips on planar curves). */
  up?: V3;
}

/** Curve through points (centripetal Catmull-Rom). */
export function path(pts: V3[], closed = false): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    closed,
    'centripetal',
  );
}

/** Swept tube with variable radius r(t), t in 0..1. */
export function tube(curve: THREE.Curve<THREE.Vector3>, radius: number | ((t: number) => number), tubular = 16, radial = 6, o: TubeOpts = {}): Geo {
  const rf = typeof radius === 'number' ? () => radius : radius;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const len = curve.getLength();
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  let frames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] };
  if (o.up) {
    const up = new THREE.Vector3(o.up[0], o.up[1], o.up[2]).normalize();
    frames = { tangents: [], normals: [], binormals: [] };
    for (let i = 0; i <= tubular; i++) {
      const t = curve.getTangentAt(i / tubular, new THREE.Vector3());
      let b = new THREE.Vector3().crossVectors(t, up);
      if (b.lengthSq() < 1e-8) b = new THREE.Vector3(1, 0, 0);
      b.normalize();
      const nn = new THREE.Vector3().crossVectors(b, t).normalize();
      frames.tangents.push(t);
      frames.normals.push(nn);
      frames.binormals.push(b);
    }
  } else frames = curve.computeFrenetFrames(tubular, !!o.closed);
  const flat = o.flat ?? 1;
  const tile = o.tile;
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(o.closed && i === tubular ? 0 : t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = rf(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const sn = Math.sin(a);
      const cs = -Math.cos(a);
      nrm.set(cs * N.x + sn * B.x * flat, cs * N.y + sn * B.y * flat, cs * N.z + sn * B.z * flat);
      pos.push(P.x + r * (cs * N.x + sn * B.x * flat), P.y + r * (cs * N.y + sn * B.y * flat), P.z + r * (cs * N.z + sn * B.z * flat));
      // normal for flattened ellipse: scale binormal comp inversely
      const nx = cs * N.x + (sn * B.x) / flat;
      const ny = cs * N.y + (sn * B.y) / flat;
      const nz = cs * N.z + (sn * B.z) / flat;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / l, ny / l, nz / l);
      uv.push(j / radial, tile ? (t * len) / tile : t);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < tubular; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + j + 1;
      const d = i * row + j + 1;
      idx.push(a, b, d, b, c, d);
    }
  const cap = (i: number, sign: number) => {
    const t = i / tubular;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    const ci = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    nor.push(T.x * sign, T.y * sign, T.z * sign);
    uv.push(0.5, 0.5);
    const base = pos.length / 3;
    for (let j = 0; j <= radial; j++) {
      const k = i * row + j;
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      nor.push(T.x * sign, T.y * sign, T.z * sign);
      uv.push(0.5 + 0.5 * Math.cos((j / radial) * TAU), 0.5 + 0.5 * Math.sin((j / radial) * TAU));
    }
    for (let j = 0; j < radial; j++) {
      if (sign < 0) idx.push(ci, base + j, base + j + 1);
      else idx.push(ci, base + j + 1, base + j);
    }
  };
  if (o.cap0 && rf(0) > 1e-5) cap(0, -1);
  if (o.cap1 && rf(1) > 1e-5) cap(tubular, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Torus ring lying in XZ plane (axis Y). */
export function ring(R: number, r: number, radial = 6, tubular = 16, arc = TAU): Geo {
  const g = new THREE.TorusGeometry(R, r, radial, tubular, arc);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Rounded box with world-unit planar UVs (grain along `grain` axis). */
export function rbox(w: number, h: number, d: number, radius: number, segs = 2, tile = 0.3, grain: 'x' | 'y' | 'z' = 'y'): Geo {
  const g = new RoundedBoxGeometry(w, h, d, segs, Math.min(radius, Math.min(w, h, d) * 0.49));
  planarUV(g, tile, grain);
  return g;
}

/** Plain box (sharp) with planar UVs. */
export function box(w: number, h: number, d: number, tile = 0.3, grain: 'x' | 'y' | 'z' = 'y'): Geo {
  const g = new THREE.BoxGeometry(w, h, d);
  planarUV(g, tile, grain);
  return g;
}

/**
 * Re-map UVs by dominant normal axis to world units. The texture's V axis follows `grain`
 * where possible (wood grain along planks).
 */
export function planarUV(g: Geo, tile: number, grain: 'x' | 'y' | 'z' = 'y'): Geo {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    const x = p.getX(i) / tile;
    const y = p.getY(i) / tile;
    const z = p.getZ(i) / tile;
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      // face on YZ plane
      if (grain === 'z') [u, v] = [y, z];
      else [u, v] = [z, y];
    } else if (ay >= az) {
      if (grain === 'x') [u, v] = [z, x];
      else [u, v] = [x, z];
    } else {
      if (grain === 'x') [u, v] = [y, x];
      else [u, v] = [x, y];
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Extruded 2D shape (in XY), depth along +Z centred, bevelled. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0.002, curveSegs = 8, bevelSegs = 1, tile = 0.1): Geo {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevelSegs,
    curveSegments: curveSegs,
  });
  g.translate(0, 0, -depth / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return g;
}

/** Star shape (points, outer, inner radius). */
export function starShape(points: number, R: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU + Math.PI / 2;
    const rr = i % 2 === 0 ? R : r;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Low-poly faceted gem (octahedron-ish brilliant). */
export function gemGeo(r: number, kind: 'round' | 'oct' | 'drop' | 'shard' = 'round'): Geo {
  if (kind === 'oct') return new THREE.OctahedronGeometry(r, 0);
  if (kind === 'shard') {
    const g = lathe(
      [
        [0, -r * 0.6],
        [r * 0.45, -r * 0.3],
        [r * 0.5, r * 0.9],
        [0, r * 1.8],
      ],
      6,
    );
    return g.toNonIndexed();
  }
  if (kind === 'drop') {
    const g = lathe(
      [
        [0, -r],
        [r * 0.7, -r * 0.35],
        [r * 0.75, r * 0.05],
        [r * 0.5, r * 0.45],
        [0, r * 0.9],
      ],
      8,
    );
    return g.toNonIndexed();
  }
  // round brilliant: pavilion + crown + table
  const g = lathe(
    [
      [0, -r * 0.62],
      [r, 0],
      [r * 0.98, r * 0.08],
      [r * 0.62, r * 0.36],
      [0, r * 0.38],
    ],
    8,
  );
  return g.toNonIndexed();
}

/** Assign a per-vertex colour gradient along an axis (for vertexColors materials). */
export function gradient(g: Geo, axis: 'x' | 'y' | 'z', a: number, b: number, stops: string[]): Geo {
  const p = g.attributes.position;
  const cols = stops.map((s) => new THREE.Color(s));
  const out = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const v = axis === 'x' ? p.getX(i) : axis === 'y' ? p.getY(i) : p.getZ(i);
    const t = Math.min(1, Math.max(0, (v - a) / (b - a))) * (cols.length - 1);
    const k = Math.min(cols.length - 2, Math.floor(t));
    c.copy(cols[k]).lerp(cols[k + 1], t - k);
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

function normalise(g: Geo, withColor: boolean): Geo {
  let h = g;
  if (!h.index) {
    const n = h.attributes.position.count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    h.setIndex(idx);
  }
  for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') h.deleteAttribute(k);
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  if (withColor && !h.attributes.color) {
    const c = new Float32Array(h.attributes.position.count * 3).fill(1);
    h.setAttribute('color', new THREE.BufferAttribute(c, 3));
  } else if (!withColor && h.attributes.color) h.deleteAttribute('color');
  h.morphAttributes = {};
  h.clearGroups();
  return h;
}

export function triCount(g: Geo): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/**
 * Collects geometry per material and merges it. Use `node()` for parts that must stay separate
 * (animated pieces, lids) — they get their own sub-kit.
 */
export class Kit {
  private groups = new Map<THREE.Material, Geo[]>();
  readonly root = new THREE.Group();
  add(g: Geo, mat: THREE.Material, t?: Xf): this {
    if (t) xf(g, t);
    const arr = this.groups.get(mat) ?? [];
    arr.push(g);
    this.groups.set(mat, arr);
    return this;
  }
  get tris(): number {
    let n = 0;
    for (const arr of this.groups.values()) for (const g of arr) n += triCount(g);
    return n;
  }
  /** Merge everything added so far into meshes under `into` (default root). */
  flush(into: THREE.Object3D = this.root, name = 'part'): THREE.Object3D {
    for (const [mat, arr] of this.groups) {
      const wantColor = (mat as THREE.MeshStandardMaterial).vertexColors === true;
      const geos = arr.map((g) => normalise(g, wantColor));
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = name;
      into.add(mesh);
    }
    this.groups.clear();
    return into;
  }
}
