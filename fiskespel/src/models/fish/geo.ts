/**
 * Geometry accumulator + primitive helpers for fish parts.
 * All parts are baked into fish space so that one deform shader animates everything coherently.
 */
import * as THREE from 'three';
import type { RGB } from './util';

export type V3 = [number, number, number];

export const v3 = {
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: V3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  /** rotate v around unit axis k by angle */
  rot: (v: V3, k: V3, ang: number): V3 => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
    const cr: V3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
  },
  /** any unit vector perpendicular to a */
  perp: (a: V3): V3 => {
    const t: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const c: V3 = [a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]];
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    return [c[0] / l, c[1] / l, c[2] / l];
  },
};

export class Geo {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  flut: number[] = [];
  idx: number[] = [];

  get count(): number {
    return this.pos.length / 3;
  }

  vert(p: V3, n: V3, uv: [number, number] = [0, 0], c: RGB = [1, 1, 1], f: [number, number, number, number] = [0, 0, 0, 0]): number {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(uv[0], uv[1]);
    this.col.push(c[0], c[1], c[2]);
    this.flut.push(f[0], f[1], f[2], f[3]);
    return this.count - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  merge(g: Geo): void {
    const off = this.count;
    this.pos.push(...g.pos);
    this.nor.push(...g.nor);
    this.uv.push(...g.uv);
    this.col.push(...g.col);
    this.flut.push(...g.flut);
    for (const i of g.idx) this.idx.push(i + off);
  }

  /** Append a grid (rows × cols) of vertices built by fn; normals by finite difference. */
  grid(
    na: number,
    nb: number,
    fn: (a: number, b: number) => V3,
    uvf: (a: number, b: number) => [number, number],
    opts: { color?: RGB; flutter?: (a: number, b: number, p: V3) => [number, number, number, number]; flip?: boolean; normalHint?: V3 } = {},
  ): void {
    const P: V3[] = [];
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) P.push(fn(i / na, j / nb));
    const at = (i: number, j: number): V3 => P[Math.max(0, Math.min(nb, j)) * (na + 1) + Math.max(0, Math.min(na, i))];
    const base = this.count;
    for (let j = 0; j <= nb; j++) {
      for (let i = 0; i <= na; i++) {
        const da = v3.sub(at(i + 1, j), at(i - 1, j));
        let db = v3.sub(at(i, j + 1), at(i, j - 1));
        if (v3.len(db) < 1e-9) db = v3.sub(at(i, j), at(i, j - 2));
        let n = v3.norm(v3.cross(da, db));
        if (v3.len(n) < 0.5 && opts.normalHint) n = opts.normalHint;
        if (opts.flip) n = v3.mul(n, -1);
        const a = i / na;
        const b = j / nb;
        const p = P[j * (na + 1) + i];
        this.vert(p, n, uvf(a, b), opts.color ?? [1, 1, 1], opts.flutter ? opts.flutter(a, b, p) : [0, 0, 0, 0]);
      }
    }
    for (let j = 0; j < nb; j++) {
      for (let i = 0; i < na; i++) {
        const a = base + j * (na + 1) + i;
        const b = a + 1;
        const c = a + (na + 1);
        const d = c + 1;
        if (opts.flip) this.idx.push(a, c, b, b, c, d);
        else this.idx.push(a, b, c, b, d, c);
      }
    }
  }

  /** Mirror a copy of vertices [from..to) across x = 0 (reversing winding). */
  mirrorRange(fromV: number, fromI: number): void {
    const nV = this.count - fromV;
    const off = this.count;
    for (let k = 0; k < nV; k++) {
      const v = fromV + k;
      this.pos.push(-this.pos[v * 3], this.pos[v * 3 + 1], this.pos[v * 3 + 2]);
      this.nor.push(-this.nor[v * 3], this.nor[v * 3 + 1], this.nor[v * 3 + 2]);
      this.uv.push(this.uv[v * 2], this.uv[v * 2 + 1]);
      this.col.push(this.col[v * 3], this.col[v * 3 + 1], this.col[v * 3 + 2]);
      this.flut.push(-this.flut[v * 4], this.flut[v * 4 + 1], this.flut[v * 4 + 2], this.flut[v * 4 + 3]);
    }
    const nI = this.idx.length;
    for (let k = fromI; k < nI; k += 3) {
      const a = this.idx[k] - fromV + off;
      const b = this.idx[k + 1] - fromV + off;
      const c = this.idx[k + 2] - fromV + off;
      this.idx.push(a, c, b);
    }
  }

  transform(fn: (p: V3, n: V3) => [V3, V3], from = 0): void {
    for (let v = from; v < this.count; v++) {
      const [p, n] = fn([this.pos[v * 3], this.pos[v * 3 + 1], this.pos[v * 3 + 2]], [this.nor[v * 3], this.nor[v * 3 + 1], this.nor[v * 3 + 2]]);
      this.pos[v * 3] = p[0];
      this.pos[v * 3 + 1] = p[1];
      this.pos[v * 3 + 2] = p[2];
      this.nor[v * 3] = n[0];
      this.nor[v * 3 + 1] = n[1];
      this.nor[v * 3 + 2] = n[2];
    }
  }

  get triCount(): number {
    return this.idx.length / 3;
  }

  toBuffer(withColor = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aFlut', new THREE.Float32BufferAttribute(this.flut, 4));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Rotation-minimising frames along a polyline. */
export function frames(pts: V3[]): { t: V3[]; n: V3[]; b: V3[] } {
  const T: V3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    T.push(v3.norm(v3.sub(b, a)));
  }
  const N: V3[] = [v3.perp(T[0])];
  const B: V3[] = [v3.norm(v3.cross(T[0], N[0]))];
  for (let i = 1; i < pts.length; i++) {
    // double reflection
    const v1 = v3.sub(pts[i], pts[i - 1]);
    const c1 = v3.dot(v1, v1) || 1e-12;
    const rL = v3.sub(N[i - 1], v3.mul(v1, (2 / c1) * v3.dot(v1, N[i - 1])));
    const tL = v3.sub(T[i - 1], v3.mul(v1, (2 / c1) * v3.dot(v1, T[i - 1])));
    const v2 = v3.sub(T[i], tL);
    const c2 = v3.dot(v2, v2) || 1e-12;
    const n = v3.norm(v3.sub(rL, v3.mul(v2, (2 / c2) * v3.dot(v2, rL))));
    N.push(n);
    B.push(v3.norm(v3.cross(T[i], n)));
  }
  return { t: T, n: N, b: B };
}

/**
 * Tapered tube along a polyline. radius(t) with t in 0..1 along the path.
 * Optional preferred initial normal to orient flattened tubes.
 */
export function tube(
  g: Geo,
  pts: V3[],
  radius: (t: number) => number,
  radial: number,
  opts: {
    color?: RGB | ((t: number, a: number) => RGB);
    capStart?: boolean;
    capEnd?: boolean;
    flat?: number;
    up?: V3;
    flutter?: (t: number, p: V3) => [number, number, number, number];
    uvScale?: number;
  } = {},
): void {
  const F = frames(pts);
  if (opts.up) {
    // re-orient first frame toward 'up'
    const t0 = F.t[0];
    const upP = v3.norm(v3.sub(opts.up, v3.mul(t0, v3.dot(opts.up, t0))));
    if (v3.len(upP) > 0.5) {
      const ang = Math.atan2(v3.dot(v3.cross(F.n[0], upP), t0), v3.dot(F.n[0], upP));
      for (let i = 0; i < pts.length; i++) {
        F.n[i] = v3.rot(F.n[i], F.t[i], ang);
        F.b[i] = v3.norm(v3.cross(F.t[i], F.n[i]));
      }
    }
  }
  const base = g.count;
  const n = pts.length;
  let total = 0;
  const cum = [0];
  for (let i = 1; i < n; i++) {
    total += v3.len(v3.sub(pts[i], pts[i - 1]));
    cum.push(total);
  }
  const flat = opts.flat ?? 1;
  for (let i = 0; i < n; i++) {
    const t = total > 0 ? cum[i] / total : i / (n - 1);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * flat;
      const off = v3.add(v3.mul(F.n[i], ca * r), v3.mul(F.b[i], sa * r));
      const nn = v3.norm(v3.add(v3.mul(F.n[i], ca / flat), v3.mul(F.b[i], Math.sin(a))));
      const c = typeof opts.color === 'function' ? opts.color(t, j / radial) : opts.color ?? [1, 1, 1];
      const p = v3.add(pts[i], off);
      g.vert(p, nn, [j / radial, t * (opts.uvScale ?? 1)], c, opts.flutter ? opts.flutter(t, p) : [0, 0, 0, 0]);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j;
      const b = a + 1;
      const c = a + radial + 1;
      const d = c + 1;
      g.tri(a, b, c);
      g.tri(b, d, c);
    }
  }
  const capAt = (i: number, dir: number) => {
    const t = total > 0 ? cum[i] / total : i / (n - 1);
    const c = typeof opts.color === 'function' ? opts.color(t, 0) : opts.color ?? [1, 1, 1];
    const centre = g.vert(pts[i], v3.mul(F.t[i], dir), [0.5, t], c, opts.flutter ? opts.flutter(t, pts[i]) : [0, 0, 0, 0]);
    for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j;
      if (dir < 0) g.tri(centre, a + 1, a);
      else g.tri(centre, a, a + 1);
    }
  };
  if (opts.capStart) capAt(0, -1);
  if (opts.capEnd) capAt(n - 1, 1);
}

/** UV sphere (or ellipsoid) with its +pole pointing along dir. */
export function sphere(
  g: Geo,
  c: V3,
  r: V3 | number,
  dir: V3,
  seg: number,
  rings: number,
  color: RGB = [1, 1, 1],
  opts: { thetaMax?: number; flutter?: [number, number, number, number]; up?: V3 } = {},
): void {
  const R: V3 = typeof r === 'number' ? [r, r, r] : r;
  const z = v3.norm(dir);
  const x0 = opts.up ? v3.norm(v3.cross(opts.up, z)) : v3.perp(z);
  const y0 = v3.norm(v3.cross(z, x0));
  const tMax = opts.thetaMax ?? Math.PI;
  const base = g.count;
  for (let i = 0; i <= rings; i++) {
    const th = (i / rings) * tMax;
    const st = Math.sin(th);
    const ct = Math.cos(th);
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2;
      const lx = st * Math.cos(ph);
      const ly = st * Math.sin(ph);
      const lz = ct;
      const p = v3.add(c, v3.add(v3.add(v3.mul(x0, lx * R[0]), v3.mul(y0, ly * R[1])), v3.mul(z, lz * R[2])));
      const nn = v3.norm(v3.add(v3.add(v3.mul(x0, lx / R[0]), v3.mul(y0, ly / R[1])), v3.mul(z, lz / R[2])));
      // uv: u around, v=1 at the +pole (matches SphereGeometry / eye texture convention)
      g.vert(p, nn, [j / seg, 1 - i / rings], color, opts.flutter ?? [0, 0, 0, 0]);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j;
      const b = a + 1;
      const cc = a + seg + 1;
      const d = cc + 1;
      g.tri(a, cc, b);
      g.tri(b, cc, d);
    }
  }
}

/** Cone from base centre along dir (tooth / spine). */
export function cone(g: Geo, base: V3, dir: V3, len: number, r: number, seg: number, color: RGB, curve: V3 = [0, 0, 0]): void {
  const pts: V3[] = [];
  const steps = 3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(v3.add(v3.add(base, v3.mul(dir, len * t)), v3.mul(curve, t * t * len)));
  }
  tube(g, pts, (t) => r * Math.pow(1 - t, 0.9) + 1e-4, seg, { color, capStart: true });
}

/** Lathe around +Y: profile [radius, y][]. */
export function lathe(g: Geo, prof: [number, number][], seg: number, color: RGB | ((t: number, a: number) => RGB), uvV?: (i: number) => number): void {
  const base = g.count;
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const [r, y] = prof[i];
    const pa = prof[Math.max(0, i - 1)];
    const pb = prof[Math.min(n - 1, i + 1)];
    const dr = pb[0] - pa[0];
    const dy = pb[1] - pa[1];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // normal perpendicular to profile tangent
      let nx = -dy;
      let ny = dr;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const c = typeof color === 'function' ? color(i / (n - 1), j / seg) : color;
      g.vert([r * ca, y, r * sa], [nx * ca, ny, nx * sa], [j / seg, uvV ? uvV(i) : i / (n - 1)], c);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j;
      const b = a + 1;
      const c = a + seg + 1;
      const d = c + 1;
      g.tri(a, b, c);
      g.tri(b, d, c);
    }
  }
}
