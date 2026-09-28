/**
 * Heightfield terrain: analytic island shapes + stamps (pads, paths, custom carves) baked into
 * grids. CPU sampling matches the rendered mesh triangulation exactly.
 * No three.js here (runs in Node for previews).
 */
import { fbm, lerp, segDist, smax, smoothstep, clamp } from './noise';
import { DEEP_OCEAN_RADIUS, TRENCH, type IslandLayout } from './layout';

// ─────────────────────────────────────────────────────────── global sea floor

export function seaFloor(x: number, z: number): number {
  let h = -40 + 7 * fbm(x * 0.0013 + 3.1, z * 0.0013 - 1.7, 3);
  const r = Math.sqrt(x * x + z * z);
  const deep = smoothstep(DEEP_OCEAN_RADIUS - 350, DEEP_OCEAN_RADIUS + 350, r);
  if (deep > 0) h = lerp(h, -122 + 18 * fbm(x * 0.0009 + 5, z * 0.0009 + 2, 3), deep);
  const dx = x - TRENCH.x;
  const dz = z - TRENCH.z;
  const dt = Math.sqrt(dx * dx + dz * dz);
  if (dt < TRENCH.radius * 1.6) {
    const wob = 1 + 0.12 * fbm(x * 0.01, z * 0.01, 2);
    const t = 1 - smoothstep(TRENCH.radius * 0.5 * wob, TRENCH.radius * 1.3 * wob, dt);
    h = lerp(h, -600 + 30 * fbm(x * 0.02, z * 0.02, 2), t * t * (3 - 2 * t));
  }
  return h;
}

// ─────────────────────────────────────────────────────────── stamps

export interface PadStamp {
  kind: 'pad';
  x: number;
  z: number;
  r: number;
  fall: number;
  y: number;
  dirt: number;
  plaza: number;
  /** squash (rx/rz) for elliptical pads */
  sx: number;
  bb: [number, number, number, number];
}

export interface PathStamp {
  kind: 'path';
  pts: [number, number][];
  ys: number[];
  width: number;
  fall: number;
  dirt: number;
  plaza: number;
  bb: [number, number, number, number];
  /** keep terrain below the path (for raised causeways set false) */
  carveOnly: boolean;
}

export interface CustomStamp {
  kind: 'custom';
  bb: [number, number, number, number];
  fn: (lx: number, lz: number, h: number, out: EvalOut) => number;
}

export type Stamp = PadStamp | PathStamp | CustomStamp;

export interface EvalOut {
  h: number;
  dirt: number;
  plaza: number;
}

// ─────────────────────────────────────────────────────────── splat

export interface SplatIn {
  lx: number;
  lz: number;
  h: number;
  /** 0 flat .. 1 vertical */
  slope: number;
  dirt: number;
  plaza: number;
}
export interface SplatOut {
  cover: number;
  dirt: number;
  rock: number;
  spec: number;
}

// ─────────────────────────────────────────────────────────── grid

export class HeightGrid {
  /** world coords of vertex (0,0) */
  x0: number;
  z0: number;
  cell: number;
  n: number; // vertices per side
  h: Float32Array;
  dirt: Uint8Array;
  plaza: Uint8Array;
  constructor(x0: number, z0: number, cell: number, n: number) {
    this.x0 = x0;
    this.z0 = z0;
    this.cell = cell;
    this.n = n;
    this.h = new Float32Array(n * n);
    this.dirt = new Uint8Array(n * n);
    this.plaza = new Uint8Array(n * n);
  }
  contains(x: number, z: number): boolean {
    const e = (this.n - 1) * this.cell;
    return x >= this.x0 && z >= this.z0 && x <= this.x0 + e && z <= this.z0 + e;
  }
  /** Exact triangle interpolation matching the mesh (diagonal from (i+1,j) to (i,j+1)). */
  sample(x: number, z: number): number {
    const fx = (x - this.x0) / this.cell;
    const fz = (z - this.z0) / this.cell;
    const n = this.n;
    let i = Math.floor(fx);
    let j = Math.floor(fz);
    if (i < 0) i = 0;
    if (j < 0) j = 0;
    if (i > n - 2) i = n - 2;
    if (j > n - 2) j = n - 2;
    const u = clamp(fx - i, 0, 1);
    const v = clamp(fz - j, 0, 1);
    const H = this.h;
    const a = H[j * n + i];
    const c = H[j * n + i + 1];
    const b = H[(j + 1) * n + i];
    const d = H[(j + 1) * n + i + 1];
    if (u + v <= 1) return a + (c - a) * u + (b - a) * v;
    return d + (b - d) * (1 - u) + (c - d) * (1 - v);
  }
  /** Normal (unnormalised y-up) via central differences. */
  normalAt(i: number, j: number, out: [number, number, number]): void {
    const n = this.n;
    const H = this.h;
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(n - 1, i + 1);
    const j0 = Math.max(0, j - 1);
    const j1 = Math.min(n - 1, j + 1);
    const dx = (H[j * n + i1] - H[j * n + i0]) / ((i1 - i0) * this.cell);
    const dz = (H[j1 * n + i] - H[j0 * n + i]) / ((j1 - j0) * this.cell);
    const l = Math.sqrt(dx * dx + 1 + dz * dz);
    out[0] = -dx / l;
    out[1] = 1 / l;
    out[2] = -dz / l;
  }
}

// ─────────────────────────────────────────────────────────── island terrain

export interface ShapeDef {
  /** Base local height (before stamps). Must fall far below the sea floor at the domain edge. */
  shape(lx: number, lz: number): number;
  splat(s: SplatIn, out: SplatOut): void;
}

export class IslandTerrain {
  layout: IslandLayout;
  def: ShapeDef;
  stamps: Stamp[] = [];
  /** half size of the square domain (local) */
  half: number;
  coarse: HeightGrid | null = null;
  fine: HeightGrid | null = null;
  private tmp: EvalOut = { h: 0, dirt: 0, plaza: 0 };

  constructor(layout: IslandLayout, def: ShapeDef) {
    this.layout = layout;
    this.def = def;
    this.half = Math.ceil(layout.radius * 1.7 + 120);
  }

  /** Evaluate local height + paint (with stamps, without sea floor). */
  evalLocal(lx: number, lz: number, out: EvalOut, upto = this.stamps.length): EvalOut {
    let h = this.def.shape(lx, lz);
    // guarantee the island vanishes into the sea floor at the domain edge
    const edge = Math.max(Math.abs(lx), Math.abs(lz));
    if (edge > this.half * 0.72) h -= 500 * smoothstep(this.half * 0.72, this.half * 0.97, edge);
    out.dirt = 0;
    out.plaza = 0;
    for (let s = 0; s < upto; s++) {
      const st = this.stamps[s];
      const bb = st.bb;
      if (lx < bb[0] || lx > bb[2] || lz < bb[1] || lz > bb[3]) continue;
      if (st.kind === 'pad') {
        const dx = (lx - st.x) / st.sx;
        const dz = lz - st.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const w = 1 - smoothstep(st.r, st.r + st.fall, d);
        if (w <= 0) continue;
        h = h + (st.y - h) * w;
        if (st.dirt > 0) out.dirt = Math.max(out.dirt, st.dirt * (1 - smoothstep(st.r * 0.85, st.r + 0.8, d)));
        if (st.plaza > 0) out.plaza = Math.max(out.plaza, st.plaza * (1 - smoothstep(st.r - 0.6, st.r + 0.3, d)));
      } else if (st.kind === 'path') {
        let best = 1e9;
        let by = 0;
        const P = st.pts;
        for (let k = 0; k < P.length - 1; k++) {
          const a = P[k];
          const b = P[k + 1];
          const r = segDist(lx, lz, a[0], a[1], b[0], b[1]);
          if (r.d < best) {
            best = r.d;
            by = lerp(st.ys[k], st.ys[k + 1], r.t);
          }
        }
        const hw = st.width * 0.5;
        const w = 1 - smoothstep(hw, hw + st.fall, best);
        if (w <= 0) continue;
        if (!st.carveOnly || by < h) h = h + (by - h) * w;
        if (st.dirt > 0) out.dirt = Math.max(out.dirt, st.dirt * (1 - smoothstep(hw * 0.55, hw + 0.4, best)));
        if (st.plaza > 0) out.plaza = Math.max(out.plaza, st.plaza * (1 - smoothstep(hw * 0.7, hw + 0.2, best)));
      } else {
        h = st.fn(lx, lz, h, out);
      }
    }
    out.h = h;
    return out;
  }

  /** Full world-space height (analytic, including sea floor). */
  heightAnalytic(x: number, z: number): number {
    const o = this.evalLocal(x - this.layout.x, z - this.layout.z, this.tmp);
    return smax(seaFloor(x, z), o.h, 3);
  }

  /** Local height incl. stamps (no sea floor) — used while planning. */
  localHeight(lx: number, lz: number): number {
    return this.evalLocal(lx, lz, this.tmp).h;
  }

  // ── stamp helpers (local coords)

  addPad(lx: number, lz: number, r: number, opts: { y?: number; fall?: number; dirt?: number; plaza?: number; sx?: number } = {}): PadStamp {
    const fall = opts.fall ?? Math.max(4, r * 0.8);
    const sx = opts.sx ?? 1;
    const y = opts.y ?? this.localHeight(lx, lz);
    const R = (r + fall) * Math.max(1, sx);
    const st: PadStamp = {
      kind: 'pad',
      x: lx,
      z: lz,
      r,
      fall,
      y,
      dirt: opts.dirt ?? 0,
      plaza: opts.plaza ?? 0,
      sx,
      bb: [lx - R, lz - R, lx + R, lz + R],
    };
    this.stamps.push(st);
    return st;
  }

  /**
   * Path along local points. Heights follow the current terrain, smoothed and grade-limited.
   * `ys` may be given explicitly.
   */
  addPath(
    pts: [number, number][],
    opts: { width?: number; fall?: number; dirt?: number; plaza?: number; ys?: number[]; smooth?: number; carveOnly?: boolean; minY?: number } = {},
  ): PathStamp {
    const width = opts.width ?? 3;
    const fall = opts.fall ?? 3;
    // resample path every ~3 m for smooth heights
    const res: [number, number][] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(len / 3));
      for (let i = 0; i < n; i++) res.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]);
    }
    res.push(pts[pts.length - 1]);
    let ys: number[];
    if (opts.ys && opts.ys.length === pts.length) {
      // interpolate explicit ys along resampled points
      ys = [];
      let acc = 0;
      const segLen: number[] = [];
      for (let k = 0; k < pts.length - 1; k++) segLen.push(Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]));
      let seg = 0;
      let segStart = 0;
      for (let i = 0; i < res.length; i++) {
        if (i > 0) acc += Math.hypot(res[i][0] - res[i - 1][0], res[i][1] - res[i - 1][1]);
        while (seg < segLen.length - 1 && acc > segStart + segLen[seg] + 1e-6) {
          segStart += segLen[seg];
          seg++;
        }
        const t = segLen[seg] > 0 ? clamp((acc - segStart) / segLen[seg], 0, 1) : 0;
        ys.push(lerp(opts.ys[seg], opts.ys[seg + 1], t));
      }
    } else {
      ys = res.map(([x, z]) => this.localHeight(x, z));
      const minY = opts.minY ?? 0.6;
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], minY);
      const it = opts.smooth ?? 4;
      for (let s = 0; s < it; s++) {
        const c = ys.slice();
        for (let i = 1; i < ys.length - 1; i++) ys[i] = (c[i - 1] + c[i] * 2 + c[i + 1]) / 4;
      }
    }
    let minX = 1e9;
    let minZ = 1e9;
    let maxX = -1e9;
    let maxZ = -1e9;
    for (const [x, z] of res) {
      minX = Math.min(minX, x);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxZ = Math.max(maxZ, z);
    }
    const R = width * 0.5 + fall;
    const st: PathStamp = {
      kind: 'path',
      pts: res,
      ys,
      width,
      fall,
      dirt: opts.dirt ?? 1,
      plaza: opts.plaza ?? 0,
      carveOnly: opts.carveOnly ?? false,
      bb: [minX - R, minZ - R, maxX + R, maxZ + R],
    };
    this.stamps.push(st);
    return st;
  }

  addCustom(bb: [number, number, number, number], fn: CustomStamp['fn']): void {
    this.stamps.push({ kind: 'custom', bb, fn });
  }

  // ── baking

  private bake(cell: number, coarse: HeightGrid | null): HeightGrid {
    const L = this.layout;
    const n = Math.ceil((this.half * 2) / cell) + 1;
    const x0 = L.x - ((n - 1) * cell) / 2;
    const z0 = L.z - ((n - 1) * cell) / 2;
    const g = new HeightGrid(x0, z0, cell, n);
    const o = this.tmp;
    for (let j = 0; j < n; j++) {
      const z = z0 + j * cell;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * cell;
        const k = j * n + i;
        if (coarse) {
          // skip analytic evaluation in deep water (interpolate the coarse grid)
          const ci = Math.floor((x - coarse.x0) / coarse.cell);
          const cj = Math.floor((z - coarse.z0) / coarse.cell);
          const cn = coarse.n;
          if (ci >= 1 && cj >= 1 && ci < cn - 2 && cj < cn - 2) {
            let mx = -1e9;
            for (let b = -1; b <= 2; b++) for (let a = -1; a <= 2; a++) mx = Math.max(mx, coarse.h[(cj + b) * cn + ci + a]);
            if (mx < -26) {
              g.h[k] = coarse.sample(x, z);
              continue;
            }
          }
        }
        this.evalLocal(x - L.x, z - L.z, o);
        g.h[k] = smax(seaFloor(x, z), o.h, 3);
        g.dirt[k] = Math.round(clamp(o.dirt, 0, 1) * 255);
        g.plaza[k] = Math.round(clamp(o.plaza, 0, 1) * 255);
      }
    }
    return g;
  }

  bakeCoarse(cell = 6): HeightGrid {
    this.coarse = this.bake(cell, null);
    return this.coarse;
  }

  bakeFine(cell: number): HeightGrid {
    if (!this.coarse) this.bakeCoarse();
    this.fine = this.bake(cell, this.coarse);
    return this.fine;
  }

  /** Best available sampled height (world coords), or null if outside the domain. */
  sample(x: number, z: number): number | null {
    const g = this.fine ?? this.coarse;
    if (g && g.contains(x, z)) return g.sample(x, z);
    return null;
  }

  inDomain(x: number, z: number): boolean {
    return Math.abs(x - this.layout.x) < this.half && Math.abs(z - this.layout.z) < this.half;
  }
}
