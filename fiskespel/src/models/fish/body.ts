/**
 * Fish body: profile curves along the spine + superellipse cross-sections, lofted into a
 * smooth, UV-mapped mesh. Body space: snout at z = +0.5, caudal base at z = -0.5 (s = 0..1).
 */
import type { BodySpec } from './types';
import { bump, clamp, smoothstep } from './util';

export const zOf = (s: number): number => 0.5 - s;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const SAMPLES = 512;

/** Front envelope: p=2 round/blunt, 1 conical, <1 concave/pointed. */
function front(e: number, p: number): number {
  e = clamp(e);
  return Math.pow(Math.max(0, 1 - Math.pow(1 - e, p)), 1 / p);
}

export class BodyProfile {
  readonly spec: BodySpec;
  private top = new Float32Array(SAMPLES + 1);
  private bot = new Float32Array(SAMPLES + 1);
  private wid = new Float32Array(SAMPLES + 1);
  private ym = new Float32Array(SAMPLES + 1);
  private circ = new Float32Array(SAMPLES + 1);
  /** max half circumference */
  maxHalfCirc = 0;

  constructor(spec: BodySpec) {
    this.spec = spec;
    const b = spec;
    const depth = b.depth;
    const maxAtB = b.maxAtB ?? b.maxAt;
    const sn = b.snout ?? 0;
    const snD = b.snoutD ?? 0.2;
    const snW = b.snoutW ?? snD;
    const pedW = b.pedW ?? b.ped * 0.75;
    const noseW = b.noseW ?? (b.noseT + b.noseB) * 0.5;
    const env = (s: number, maxAt: number, nose: number, ped: number, snd: number): number => {
      if (s <= maxAt) {
        if (sn > 0 && s < sn) return snd * front(s / sn, 2.2);
        if (sn > 0) {
          const e = (s - sn) / Math.max(1e-3, maxAt - sn);
          return snd + (1 - snd) * front(e, nose);
        }
        return front(s / maxAt, nose);
      }
      const r = (s - maxAt) / (1 - maxAt);
      return ped + (1 - ped) * Math.pow(Math.max(0, Math.cos((Math.PI / 2) * r)), b.tailP);
    };
    for (let i = 0; i <= SAMPLES; i++) {
      const s = i / SAMPLES;
      const Dt = env(s, b.maxAt, b.noseT, b.ped, snD);
      const Db = env(s, maxAtB, b.noseB, b.ped, snD);
      const Dw = env(s, b.maxAt * 0.95, noseW, pedW, snW);
      const axis =
        (b.mouthY * depth * 0.5) * (1 - smoothstep(0, b.maxAt * 1.1, s)) +
        ((b.tailY ?? 0) * depth * 0.5) * smoothstep(b.maxAt, 1, s);
      let top = axis + depth * b.back * Dt;
      let bot = axis - depth * (1 - b.back) * Db;
      if (b.hump) top += b.hump * depth * bump(s, b.maxAt * 0.75, 0.2) * Dt;
      if (b.sag) bot -= b.sag * depth * bump(s, maxAtB + 0.05, 0.22) * Db;
      const fl = (b.flare ?? 0.35) * b.ped * depth * Math.pow(smoothstep(0.86, 1.0, s), 2);
      top += fl * b.back;
      bot -= fl * (1 - b.back);
      let w = depth * b.wr * 0.5 * Dw;
      if (b.headW) w *= 1 + b.headW * bump(s, 0.14, 0.14);
      this.top[i] = top;
      this.bot[i] = bot;
      this.wid[i] = Math.max(w, 1e-4);
      this.ym[i] = bot + (top - bot) * (b.widest ?? 0.46);
    }
    for (let i = 0; i <= SAMPLES; i++) {
      // Ramanujan ellipse perimeter approximation (per half)
      const a = this.wid[i];
      const bb = (this.top[i] - this.bot[i]) * 0.5;
      const h = ((a - bb) * (a - bb)) / ((a + bb) * (a + bb) + 1e-9);
      const c = Math.PI * (a + bb) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
      this.circ[i] = c * 0.5;
      this.maxHalfCirc = Math.max(this.maxHalfCirc, c * 0.5);
    }
  }

  private sample(arr: Float32Array, s: number): number {
    const f = clamp(s) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(f));
    const t = f - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }
  topAt(s: number): number {
    return this.sample(this.top, s);
  }
  botAt(s: number): number {
    return this.sample(this.bot, s);
  }
  widAt(s: number): number {
    return this.sample(this.wid, s);
  }
  ymAt(s: number): number {
    return this.sample(this.ym, s);
  }
  halfCircAt(s: number): number {
    return this.sample(this.circ, s);
  }
  depthAt(s: number): number {
    return this.topAt(s) - this.botAt(s);
  }

  /** Surface point at s and angle th (0 = dorsal, PI/2 = +x flank, PI = ventral). */
  point(s: number, th: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    const b = this.spec;
    const top = this.topAt(s);
    const bot = this.botAt(s);
    const ym = this.ymAt(s);
    let W = this.widAt(s);
    const sx = Math.sin(th);
    const cy = Math.cos(th);
    const n = cy >= 0 ? b.nT : b.nB;
    const ax = Math.pow(Math.abs(sx), 2 / n);
    const ay = Math.pow(Math.abs(cy), 2 / n);
    if (b.keel) W += b.keel * this.widAt(0.5) * bump(s, 0.94, 0.045) * Math.pow(Math.abs(sx), 12);
    out.x = W * Math.sign(sx) * ax;
    out.y = cy >= 0 ? ym + (top - ym) * ay : ym - (ym - bot) * ay;
    out.z = zOf(s);
    return out;
  }

  /** Angle on the +x side whose surface height is at vertical fraction yf (-1 belly .. +1 back). */
  thetaFor(yf: number): number {
    const b = this.spec;
    yf = clamp(yf, -0.999, 0.999);
    if (yf >= 0) return Math.acos(Math.pow(yf, b.nT / 2));
    return Math.PI - Math.acos(Math.pow(-yf, b.nB / 2));
  }

  /** Surface point at vertical fraction yf on side (+1 = +x, -1 = -x). */
  sidePoint(s: number, yf: number, side = 1): Vec3 {
    const th = this.thetaFor(yf);
    const p = this.point(s, side > 0 ? th : -th);
    return p;
  }

  /** Outward surface normal (numerical). */
  normal(s: number, th: number): Vec3 {
    const e = 1e-3;
    const p0 = this.point(s - e, th);
    const p1 = this.point(s + e, th);
    const q0 = this.point(s, th - e);
    const q1 = this.point(s, th + e);
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const az = p1.z - p0.z;
    const bx = q1.x - q0.x;
    const by = q1.y - q0.y;
    const bz = q1.z - q0.z;
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const c = this.point(s, th);
    const ox = c.x;
    const oy = c.y - this.ymAt(s);
    if (nx * ox + ny * oy < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / l, y: ny / l, z: nz / l };
  }
}

export interface LoftOptions {
  rings: number;
  radial: number;
  /** extra ring density near these s positions */
  focus?: { s: number; w: number; k: number }[];
}

export interface LoftResult {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: number[];
  /** s value per vertex */
  sv: Float32Array;
  /** theta per vertex */
  tv: Float32Array;
  ringS: number[];
  radial: number;
}

/** Distribute ring positions along s with extra density at focus points. */
export function ringDistribution(n: number, focus: { s: number; w: number; k: number }[]): number[] {
  const N = 1000;
  const cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const s = (i - 0.5) / N;
    let rho = 1;
    for (const f of focus) rho += f.k * bump(s, f.s, f.w);
    cum[i] = cum[i - 1] + rho;
  }
  const total = cum[N];
  const out: number[] = [];
  let j = 0;
  for (let r = 0; r < n; r++) {
    const target = (r / (n - 1)) * total;
    while (j < N && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = (target - cum[j]) / seg;
    out.push(clamp((j + t) / N));
  }
  out[0] = 0;
  out[n - 1] = 1;
  return out;
}

/**
 * Loft the profile. Displacement callback may modify each surface point (gill step, mouth groove).
 * Returns raw arrays; ring 0 collapses toward the snout tip via a fan, the last ring is capped.
 */
export function loftBody(
  prof: BodyProfile,
  opt: LoftOptions,
  displace?: (s: number, th: number, p: Vec3) => void,
): LoftResult {
  const focus = opt.focus ?? [];
  const S = ringDistribution(opt.rings, focus);
  S[0] = 0.0035;
  const M = opt.radial;
  const R = S.length;
  const vertsPerRing = M + 1;
  const total = R * vertsPerRing + 2;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const sv = new Float32Array(total);
  const tv = new Float32Array(total);
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < R; i++) {
    const s = S[i];
    for (let j = 0; j <= M; j++) {
      const th = (j / M) * Math.PI * 2;
      prof.point(s, th, p);
      if (displace) displace(s, th, p);
      const k = i * vertsPerRing + j;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      uv[k * 2] = s;
      uv[k * 2 + 1] = j / M;
      sv[k] = s;
      tv[k] = th;
    }
  }
  // grid normals by finite differences (seamless in theta)
  const P = (i: number, j: number, c: number): number => {
    const jj = ((j % M) + M) % M;
    return pos[(i * vertsPerRing + jj) * 3 + c];
  };
  for (let i = 0; i < R; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(R - 1, i + 1);
    for (let j = 0; j < M; j++) {
      const ax = P(i1, j, 0) - P(i0, j, 0);
      const ay = P(i1, j, 1) - P(i0, j, 1);
      const az = P(i1, j, 2) - P(i0, j, 2);
      const bx = P(i, j + 1, 0) - P(i, j - 1, 0);
      const by = P(i, j + 1, 1) - P(i, j - 1, 1);
      const bz = P(i, j + 1, 2) - P(i, j - 1, 2);
      // cross(b, a) → outward for our winding (checked below)
      let nx = by * az - bz * ay;
      let ny = bz * ax - bx * az;
      let nz = bx * ay - by * ax;
      const k = i * vertsPerRing + j;
      const ox = pos[k * 3];
      const oy = pos[k * 3 + 1] - prof.ymAt(S[i]);
      const oz = i === 0 ? 1 : 0;
      if (nx * ox + ny * oy + nz * oz * 0.001 < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[k * 3] = nx / l;
      nor[k * 3 + 1] = ny / l;
      nor[k * 3 + 2] = nz / l;
    }
    // seam copy
    const a = i * vertsPerRing;
    const b = a + M;
    nor[b * 3] = nor[a * 3];
    nor[b * 3 + 1] = nor[a * 3 + 1];
    nor[b * 3 + 2] = nor[a * 3 + 2];
  }
  // Blend the first ring's normals toward forward for a smooth nose.
  for (let j = 0; j <= M; j++) {
    const k = j;
    const nx = nor[k * 3] * 0.6;
    const ny = nor[k * 3 + 1] * 0.6;
    const nz = nor[k * 3 + 2] * 0.6 + 0.4;
    const l = Math.hypot(nx, ny, nz) || 1;
    nor[k * 3] = nx / l;
    nor[k * 3 + 1] = ny / l;
    nor[k * 3 + 2] = nz / l;
  }
  const idx: number[] = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * vertsPerRing + j;
      const b = a + 1;
      const c = a + vertsPerRing;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // nose tip
  const tip = R * vertsPerRing;
  {
    prof.point(0, 0, p);
    const tp: Vec3 = { x: 0, y: p.y, z: p.z };
    if (displace) displace(0, 0, tp);
    tp.x = 0;
    pos[tip * 3] = 0;
    pos[tip * 3 + 1] = tp.y;
    pos[tip * 3 + 2] = tp.z;
    nor[tip * 3 + 2] = 1;
    uv[tip * 2] = 0;
    uv[tip * 2 + 1] = 0.25;
    sv[tip] = 0;
    for (let j = 0; j < M; j++) idx.push(tip, j, j + 1);
  }
  // tail cap
  const cap = tip + 1;
  {
    const i = R - 1;
    const s = S[i];
    pos[cap * 3] = 0;
    pos[cap * 3 + 1] = prof.ymAt(s);
    pos[cap * 3 + 2] = zOf(s);
    nor[cap * 3 + 2] = -1;
    uv[cap * 2] = 1;
    uv[cap * 2 + 1] = 0.25;
    sv[cap] = 1;
    for (let j = 0; j < M; j++) {
      const a = i * vertsPerRing + j;
      idx.push(cap, a + 1, a);
    }
  }
  // Fix winding: ensure first quad faces outward (compare geometric normal with vertex normal)
  {
    const mid = (Math.floor(R / 2) * M + Math.floor(M / 4)) * 6;
    const t = idx.slice(mid, mid + 3);
    const ax = pos[t[1] * 3] - pos[t[0] * 3];
    const ay = pos[t[1] * 3 + 1] - pos[t[0] * 3 + 1];
    const az = pos[t[1] * 3 + 2] - pos[t[0] * 3 + 2];
    const bx = pos[t[2] * 3] - pos[t[0] * 3];
    const by = pos[t[2] * 3 + 1] - pos[t[0] * 3 + 1];
    const bz = pos[t[2] * 3 + 2] - pos[t[0] * 3 + 2];
    const gx = ay * bz - az * by;
    const gy = az * bx - ax * bz;
    const gz = ax * by - ay * bx;
    let dot = 0;
    for (const v of t) dot += gx * nor[v * 3] + gy * nor[v * 3 + 1] + gz * nor[v * 3 + 2];
    if (dot < 0) {
      for (let k = 0; k < idx.length; k += 3) {
        const tmp = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = tmp;
      }
    }
  }
  return { positions: pos, normals: nor, uvs: uv, indices: idx, sv, tv, ringS: S, radial: M };
}
