/**
 * Procedural textures for fish (DataTextures — no DOM needed, so they also build in node).
 * Everything is cached: per-species textures by species key, shared tiles by type.
 */
import * as THREE from 'three';
import type { BodyProfile } from './body';
import type { FinLook, FishSpec, PatternLayer, ScaleType } from './types';
import {
  bump,
  clamp,
  fbm,
  fract,
  gnoise,
  hash3,
  hashStr,
  lin,
  lum,
  mixRGB,
  type RGB,
  smoothstep,
  toSrgb,
  worley,
} from './util';

const cache = new Map<string, THREE.Texture>();

function makeTex(
  w: number,
  h: number,
  data: Uint8Array,
  opts: { srgb?: boolean; wrapS?: THREE.Wrapping; wrapT?: THREE.Wrapping; mip?: boolean } = {},
): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = opts.wrapS ?? THREE.ClampToEdgeWrapping;
  t.wrapT = opts.wrapT ?? THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  if (opts.mip !== false) {
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  } else {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const b8 = (x: number): number => Math.round(clamp(x) * 255);

// ─────────────────────────────────────────────────────────── scale lattice

/**
 * Overlapping (imbricate) scale lattice. u runs toward the tail, v around the body.
 * Returns the visible scale's id, local ramp (0 anterior → 1 free posterior edge) and
 * distance to its free edge (in scale units).
 */
export function scaleCell(u: number, v: number, pu = 0, pv = 0): { id: number; ramp: number; edge: number; lx: number; ly: number } {
  const r = 0.74;
  const iu = Math.floor(u);
  for (let i = iu - 1; i <= iu + 1; i++) {
    const off = (((i % 2) + 2) % 2) * 0.5;
    const jv = Math.floor(v - off);
    let best = -1;
    let bestD = 1e9;
    let bx = 0;
    let by = 0;
    for (let j = jv - 1; j <= jv + 1; j++) {
      const cx = i + 0.5;
      const cy = j + 0.5 + off;
      // scales are slightly wider than long; free edge rounded
      const dx = (u - cx) / 1.0;
      const dy = (v - cy) / 1.12;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r && d < bestD) {
        bestD = d;
        const hi = pu ? ((i % pu) + pu) % pu : i;
        const hj = pv ? ((j % pv) + pv) % pv : j;
        best = hash3(hi, hj, 77);
        bx = dx;
        by = dy;
      }
    }
    if (best >= 0) {
      return { id: best, ramp: clamp((bx + r) / (2 * r)), edge: r - bestD, lx: bx, ly: by };
    }
  }
  return { id: 0, ramp: 0.5, edge: 0, lx: 0, ly: 0 };
}

// ─────────────────────────────────────────────────────────── normal tiles

type NormalKind = 'scales' | 'skin' | 'denticle' | 'plate' | 'rough' | 'crystal';

export function normalKindFor(t: ScaleType): NormalKind {
  switch (t) {
    case 'cycloid':
    case 'large':
    case 'fine':
    case 'ctenoid':
      return 'scales';
    case 'smooth':
      return 'skin';
    case 'denticle':
      return 'denticle';
    case 'plate':
      return 'plate';
    case 'rough':
      return 'rough';
    case 'crystal':
      return 'crystal';
  }
}

/** Tiles: 'scales' holds 8×8 scales per tile. */
export const SCALE_TILE = 8;

function heightToNormal(h: Float32Array, n: number, strength: number): Uint8Array {
  const out = new Uint8Array(n * n * 4);
  const H = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const k = (y * n + x) * 4;
      out[k] = b8(nx * 0.5 + 0.5);
      out[k + 1] = b8(ny * 0.5 + 0.5);
      out[k + 2] = b8(nz * 0.5 + 0.5);
      out[k + 3] = 255;
    }
  }
  return out;
}

export function normalTile(kind: NormalKind): THREE.Texture {
  const key = `n:${kind}`;
  const c = cache.get(key);
  if (c) return c;
  const n = 256;
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      let val = 0;
      if (kind === 'scales') {
        const su = u * SCALE_TILE;
        const sv = v * SCALE_TILE;
        const cell = scaleCell(su, sv, SCALE_TILE, SCALE_TILE);
        // domed exposed field rising toward free edge, sharp drop at the edge
        const dome = Math.sqrt(clamp(1 - (cell.lx * cell.lx + cell.ly * cell.ly) / 0.55));
        const circ = 0.035 * Math.sin(Math.hypot(cell.lx + 0.6, cell.ly) * 60);
        val = 0.25 + 0.55 * cell.ramp + 0.25 * dome + circ * cell.ramp;
        val -= 0.55 * (1 - smoothstep(0, 0.07, cell.edge)) * cell.ramp;
      } else if (kind === 'skin') {
        val = 0.5 * fbm(u * 8, v * 8, 4, 11, 8, 8) + 0.25 * fbm(u * 32, v * 32, 2, 12, 32, 32);
        const w = worley(u * 40, v * 40, 13, 0.9, 40, 40);
        val -= 0.25 * (1 - smoothstep(0.05, 0.18, w.f1));
      } else if (kind === 'denticle') {
        const w = worley(u * 48, v * 24, 21, 0.8, 48, 24);
        const ridge = Math.sin((v * 24 + (w.id - 0.5) * 0.3) * Math.PI * 2 * 3) * 0.5 + 0.5;
        val = 0.35 * (1 - smoothstep(0.0, 0.45, w.f1)) + 0.12 * ridge * (1 - smoothstep(0.2, 0.5, w.f1));
        val += 0.15 * fbm(u * 8, v * 8, 3, 22, 8, 8);
      } else if (kind === 'plate') {
        const w = worley(u * 6, v * 6, 31, 0.65, 6, 6);
        const edge = w.f2 - w.f1;
        val = 0.6 * smoothstep(0.0, 0.18, edge) + 0.1 * fbm(u * 24, v * 24, 3, 32, 24, 24);
        const w2 = worley(u * 36, v * 36, 33, 0.9, 36, 36);
        val -= 0.1 * (1 - smoothstep(0.05, 0.2, w2.f1));
      } else if (kind === 'rough') {
        const w = worley(u * 16, v * 16, 41, 0.9, 16, 16);
        val = 0.55 * Math.pow(1 - clamp(w.f1 / 0.7), 2) + 0.2 * fbm(u * 16, v * 16, 3, 42, 16, 16);
      } else {
        const w = worley(u * 7, v * 7, 51, 0.85, 7, 7);
        const a = w.id * 6.283;
        val = 0.5 + (Math.cos(a) * w.dx + Math.sin(a) * w.dy) * 0.9 - 0.3 * (1 - smoothstep(0, 0.05, w.f2 - w.f1));
      }
      h[y * n + x] = val;
    }
  }
  const strength = kind === 'scales' ? 5 : kind === 'crystal' ? 3 : kind === 'denticle' ? 5 : 4;
  const t = makeTex(n, n, heightToNormal(h, n, strength), { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  cache.set(key, t);
  return t;
}

// ─────────────────────────────────────────────────────────── body colour

export interface BodyTexSet {
  map: THREE.Texture;
  orm: THREE.Texture;
  emissive: THREE.Texture | null;
  /** scale repeat for the normal tile (u, v) */
  repeat: [number, number];
}

interface PatCtx {
  s: number;
  vp: number;
  X: number;
  Y: number;
  yf: number;
  seed: number;
}

/** evaluate one pattern layer → [mask, mask2] */
function evalPattern(L: PatternLayer, c: PatCtx, spec: FishSpec): [number, number] {
  const s0 = L.s0 ?? 0;
  const s1 = L.s1 ?? 1;
  const v0 = L.v0 ?? 0;
  const v1 = L.v1 ?? 1;
  const seed = c.seed + (L.seed ?? 0) * 131;
  const j = L.j ?? 0.3;
  const n = L.n ?? 6;
  const w = L.w ?? 0.5;
  // soft range masks
  const inS = smoothstep(s0 - 0.03, s0 + 0.02, c.s) * (1 - smoothstep(s1 - 0.02, s1 + 0.03, c.s));
  const inV = smoothstep(v0 - 0.05, v0 + 0.03, c.vp) * (1 - smoothstep(v1 - 0.03, v1 + 0.08, c.vp));
  const { X, Y } = c;
  switch (L.t) {
    case 'bars':
    case 'zebra':
    case 'saddles': {
      const warp = fbm(X * 4, Y * 5, 3, seed) * j * 0.6 + Math.sin(Y * 18 + seed) * j * 0.08;
      const t = ((c.s - s0) / Math.max(0.01, s1 - s0)) * n + warp;
      const ti = Math.floor(t);
      if (L.t !== 'zebra' && (ti < 0 || ti >= n)) return [0, 0];
      const d = Math.abs(fract(t) - 0.5);
      let ww = w * 0.5;
      if (L.t === 'bars') ww *= 1 - 0.45 * smoothstep(0.1, 0.9, c.vp);
      if (L.t === 'saddles') ww *= 1 - 0.8 * smoothstep(0.05, v1, c.vp);
      const m = 1 - smoothstep(ww - 0.05, ww + 0.04, d);
      const edge = L.c2 ? (1 - smoothstep(ww + 0.02, ww + 0.1, d)) * (1 - m) : 0;
      const fadeV = L.t === 'zebra' ? inV : inV;
      return [m * fadeV * (L.t === 'zebra' ? smoothstep(s0 - 0.02, s0 + 0.02, c.s) * (1 - smoothstep(s1 - 0.02, s1 + 0.02, c.s)) : 1), edge * fadeV];
    }
    case 'diagonal': {
      const a = ((L.ang ?? 30) * Math.PI) / 180;
      const warp = fbm(X * 4, Y * 4, 2, seed) * j * 0.5;
      const t = (X * Math.cos(a) + (Y - 0.2) * Math.sin(a)) * n + warp;
      const d = Math.abs(fract(t) - 0.5);
      const m = 1 - smoothstep(w * 0.5 - 0.05, w * 0.5 + 0.04, d);
      return [m * inS * inV, 0];
    }
    case 'stripes':
    case 'lines': {
      const warp = fbm(X * 3, Y * 3, 2, seed) * j * 0.05 + Math.sin(c.s * 20 + seed) * j * 0.01;
      const vp = c.vp + warp;
      const span = v1 - v0;
      const t = ((vp - v0) / Math.max(0.01, span)) * n;
      if (t < 0 || t > n) return [0, 0];
      const d = Math.abs(fract(t) - 0.5) * (span / n);
      const ww = (L.t === 'lines' ? w * 0.02 : w * 0.06) * (0.6 + 0.4 * Math.sin(Math.PI * clamp((c.s - s0) / (s1 - s0))));
      const m = 1 - smoothstep(ww * 0.7, ww * 1.1 + 0.004, d);
      const edge = L.c2 ? (1 - smoothstep(ww * 1.1, ww * 1.8 + 0.006, d)) * (1 - m) : 0;
      return [m * inS, edge * inS];
    }
    case 'spots':
    case 'speckle':
    case 'rosettes': {
      const dens = n * (L.t === 'speckle' ? 4 : 1);
      const wl = worley(X * dens, Y * dens, seed, 0.95);
      const keep = wl.id < (L.k ?? 1) * 1.0 + 0.001 ? 1 : 0;
      const sizeVar = 0.55 + 0.45 * hash3(Math.floor(wl.id * 1e6), 0, 5, seed);
      const r = (L.t === 'speckle' ? w * 0.18 : w * 0.42) * sizeVar;
      const jitterEdge = gnoise(X * dens * 3, Y * dens * 3, seed + 5) * 0.05 * j;
      const f = wl.f1 + jitterEdge;
      if (L.t === 'rosettes') {
        const ring = (1 - smoothstep(r * 0.2, r * 0.2 + 0.06, Math.abs(f - r * 0.95))) * (0.6 + 0.4 * Math.sign(Math.sin(Math.atan2(wl.dy, wl.dx) * 3 + wl.id * 20)));
        const centre = 1 - smoothstep(r * 0.7, r * 0.8, f);
        return [clamp(ring) * inS * inV * keep, centre * inS * inV * keep];
      }
      const m = (1 - smoothstep(r - 0.06, r + 0.02, f)) * keep;
      const halo = L.c2 ? (1 - smoothstep(r * 1.35, r * 1.7 + 0.05, f)) * (1 - m) * keep : 0;
      return [m * inS * inV, halo * inS * inV];
    }
    case 'patches': {
      const f = fbm(X * n + seed * 0.37, Y * n, 4, seed) + 0.25 * fbm(X * n * 3, Y * n * 3, 2, seed + 9) * j;
      const th = 0.25 - (L.k ?? 0.5) * 0.5;
      const m = smoothstep(th - 0.02, th + 0.02, f);
      return [m * inS * inV, 0];
    }
    case 'reticulate':
    case 'cracks': {
      const wl = worley(X * n, Y * n, seed, 0.9);
      const warp = gnoise(X * n * 4, Y * n * 4, seed + 3) * 0.04 * (1 + j);
      const e = wl.f2 - wl.f1 + warp;
      const ww = L.t === 'cracks' ? w * 0.08 : w * 0.18;
      const m = 1 - smoothstep(ww * 0.6, ww * 1.2, e);
      const inner = L.c2 ? smoothstep(ww * 1.2, ww * 3, e) * (1 - smoothstep(0.25, 0.6, wl.f1)) : 0;
      return [m * inS * inV, inner * inS * inV];
    }
    case 'marble': {
      const f = Math.sin((X * n + fbm(X * 3, Y * 3, 4, seed) * 4 * (0.5 + j)) * Math.PI);
      const m = smoothstep(1 - w - 0.1, 1 - w + 0.1, f * 0.5 + 0.5);
      return [m * inS * inV, 0];
    }
    case 'mottle': {
      const f = fbm(X * n, Y * n, 5, seed);
      const m = smoothstep(-0.05 - w * 0.3, 0.15 - w * 0.3, f);
      const f2 = fbm(X * n * 1.7, Y * n * 1.7, 4, seed + 50);
      const m2 = smoothstep(0.18, 0.32, f2);
      return [m * inS * inV, m2 * inS * inV];
    }
    case 'waves': {
      const t = (c.s * n + 0.35 * Math.sin(Y * 22 + fbm(X * 6, Y * 6, 2, seed) * 3) + 0.2 * fbm(X * 5, Y * 8, 2, seed + 1)) ;
      const d = Math.abs(fract(t) - 0.5);
      const m = 1 - smoothstep(w * 0.25, w * 0.25 + 0.06, d);
      return [m * inS * inV, 0];
    }
    case 'ocellus': {
      // eye spot at (s0, v0); w = radius in body units
      const cx = s0;
      const cyv = v0;
      const dx = c.s - cx;
      const dy = (c.vp - cyv) * 0.35;
      const d = Math.hypot(dx, dy);
      const core = 1 - smoothstep(w * 0.62, w * 0.7, d);
      const ring = (1 - smoothstep(w * 0.95, w * 1.05, d)) * (1 - core);
      return [core, ring];
    }
    case 'mosaic': {
      return [0, 0]; // handled with scale lattice
    }
    case 'photophores': {
      // n dots per row, rows between v0..v1 (w = dot radius in body units)
      const rows = Math.max(1, Math.round(L.k ?? 2));
      let m = 0;
      for (let r = 0; r < rows; r++) {
        const vr = rows === 1 ? v0 : v0 + ((v1 - v0) * r) / (rows - 1);
        const t = ((c.s - s0) / Math.max(0.01, s1 - s0)) * n;
        if (t < -0.5 || t > n + 0.5) continue;
        const ds = (Math.abs(fract(t + (r % 2) * 0.5) - 0.5) * (s1 - s0)) / n;
        const dv = (c.vp - vr) * 0.3;
        const d = Math.hypot(ds, dv);
        m = Math.max(m, 1 - smoothstep(w * 0.6, w, d));
      }
      return [m, 0];
    }
    case 'head': {
      const e = s1 + 0.02 * fbm(Y * 10, 0, 2, seed) * j;
      return [(1 - smoothstep(e - 0.02, e + 0.02, c.s)) * inV, 0];
    }
    case 'tail': {
      const e = s0 + 0.02 * fbm(Y * 10, 0, 2, seed) * j;
      return [smoothstep(e - 0.05, e + 0.05, c.s) * inV, 0];
    }
    case 'band': {
      const warp = fbm(X * 4, Y * 4, 2, seed) * 0.03 * j;
      const m = smoothstep(s0 - 0.015, s0 + 0.015, c.s + warp) * (1 - smoothstep(s1 - 0.015, s1 + 0.015, c.s + warp));
      const edge = L.c2
        ? (smoothstep(s0 - 0.03, s0 - 0.01, c.s + warp) * (1 - smoothstep(s1 + 0.01, s1 + 0.03, c.s + warp))) * (1 - m)
        : 0;
      return [m * inV, edge * inV];
    }
    case 'belly': {
      return [smoothstep(v0 - 0.06, v0 + 0.06, c.vp) * inS, 0];
    }
    case 'dorsal': {
      return [(1 - smoothstep(v1 - 0.06, v1 + 0.06, c.vp)) * inS, 0];
    }
    case 'grid': {
      const gx = X * n;
      const gy = Y * n;
      const dx = Math.abs(fract(gx) - 0.5);
      const dy = Math.abs(fract(gy) - 0.5);
      const dot = 1 - smoothstep(w * 0.18, w * 0.18 + 0.05, Math.hypot(dx, dy));
      const line = (1 - smoothstep(0.02, 0.05, Math.abs(fract(gx) - 0.0) < 0.5 ? Math.min(fract(gx), 1 - fract(gx)) : 1)) * 0.6;
      return [Math.max(dot, line * (L.k ?? 0.6)) * inS * inV, 0];
    }
    case 'mask': {
      const e = spec.eye.s;
      const d = Math.abs(c.s - e - (c.vp - 0.3) * (L.ang ?? 0.05));
      const m = 1 - smoothstep(w * 0.5, w * 0.5 + 0.01, d);
      return [m * inV, 0];
    }
  }
  return [0, 0];
}

export function gillEdgeS(gill: number, yf: number): number {
  return gill + 0.028 * (1 - yf * yf) - 0.012;
}

/** Vertical fraction (-1..1) of the mouth line at s. */
export function mouthYf(spec: FishSpec, prof: BodyProfile, s: number): number {
  const m = spec.body.mouth;
  const tipY = prof.ymAt(0.0035);
  const y = tipY + (m.y ?? 0) * prof.depthAt(0.02) * 0.3 - (m.slope ?? 0.25) * s * spec.body.depth * 1.0;
  const ym = prof.ymAt(s);
  const half = y >= ym ? prof.topAt(s) - ym : ym - prof.botAt(s);
  return clamp((y - ym) / Math.max(1e-4, half), -1, 1);
}

export function bodyTextures(key: string, spec: FishSpec, prof: BodyProfile): BodyTexSet {
  const L = spec.look;
  const W = 512;
  const H = 128;
  const scaleRows = Math.max(1, Math.round((L.scaleN * prof.maxHalfCirc * 2 * 1.0) / SCALE_TILE)) * SCALE_TILE;
  const repeat: [number, number] = [L.scaleN / SCALE_TILE, scaleRows / SCALE_TILE];
  const ck = `b:${key}`;
  const cached = cache.get(ck) as THREE.Texture | undefined;
  if (cached) {
    return {
      map: cached,
      orm: cache.get(`o:${key}`)!,
      emissive: cache.get(`e:${key}`) ?? null,
      repeat,
    };
  }
  const seed = spec.seed;
  const col = new Uint8Array(W * H * 4);
  const orm = new Uint8Array(W * H * 4);
  const hasGlow = L.pat.some((p) => (p.glow ?? 0) > 0) || !!spec.ex.lateralLine?.glow || (L.bodyGlow ?? 0) > 0;
  const em = hasGlow ? new Uint8Array(W * H * 4) : null;
  const top = lin(L.top);
  const mid = lin(L.mid);
  const bel = lin(L.belly);
  const cheek = L.cheek ? lin(L.cheek) : null;
  const pats = L.pat.map((p) => ({ p, c: lin(p.c), c2: p.c2 ? lin(p.c2) : null, glowC: lin(L.glowC ?? p.c) }));
  const split = L.split ?? 0.34;
  const split2 = L.split2 ?? 0.66;
  const gill = spec.body.gill;
  const gillOp = (spec.body.gillType ?? 'operculum') === 'operculum';
  const gillSlits = spec.body.gillType === 'slits';
  const mouthLen = spec.body.mouth.len;
  const lipC = lin(spec.body.mouth.lipC ?? '#000000');
  const lateralC = L.lateralC ? lin(L.lateralC) : null;
  const llGlow = spec.ex.lateralLine?.glow ?? 0;
  const llC = spec.ex.lateralLine ? lin(spec.ex.lateralLine.c) : null;
  const mosaic = L.pat.find((p) => p.t === 'mosaic');
  const mosaicC = mosaic ? lin(mosaic.c) : null;
  const mosaicC2 = mosaic?.c2 ? lin(mosaic.c2) : null;
  const glowBase = lin(L.glowC ?? '#ffffff');
  const maxHC = prof.maxHalfCirc;
  const nT = spec.body.nT;
  const nB = spec.body.nB;

  for (let y = 0; y < H; y++) {
    const vp = (y + 0.5) / H; // 0 dorsal → 1 ventral
    const th = vp * Math.PI;
    const cth = Math.cos(th);
    const yf = cth >= 0 ? Math.pow(cth, 2 / nT) : -Math.pow(-cth, 2 / nB);
    for (let x = 0; x < W; x++) {
      const s = (x + 0.5) / W;
      const hc = prof.halfCircAt(s);
      const X = s;
      const Y = (vp - 0.5) * hc + 0.5 * maxHC;
      const ctx: PatCtx = { s, vp, X, Y, yf, seed };
      // countershading with an irregular boundary
      const nb = fbm(X * 6, Y * 6, 3, seed + 1) * 0.07;
      const t1 = smoothstep(split - 0.14, split + 0.14, vp + nb);
      const t2 = smoothstep(split2 - 0.12, split2 + 0.12, vp + nb * 0.7);
      let c: RGB = mixRGB(mixRGB(top, mid, t1), bel, t2);
      // subtle darkening along the dorsal ridge & head top, light ventral
      c = mixRGB(c, [c[0] * 0.78, c[1] * 0.78, c[2] * 0.8], (1 - smoothstep(0.0, 0.12, vp)) * 0.5);
      let rough = L.rough;
      let metal = L.silver * smoothstep(0.12, 0.42, vp) * (1 - 0.35 * smoothstep(0.8, 1.0, vp));
      let e: RGB = [0, 0, 0];
      let patCover = 0;
      for (const P of pats) {
        const [m1, m2] = evalPattern(P.p, ctx, spec);
        const k = P.p.t === 'spots' || P.p.t === 'bars' || P.p.t === 'zebra' ? (P.p.t === 'spots' ? 1 : P.p.k ?? 1) : P.p.k ?? 1;
        const kk = P.p.t === 'spots' || P.p.t === 'speckle' || P.p.t === 'rosettes' ? 1 : k;
        if (m2 > 0 && P.c2) c = mixRGB(c, P.c2, m2 * kk);
        if (m1 > 0) {
          c = mixRGB(c, P.c, m1 * kk);
          patCover = Math.max(patCover, m1 * kk * (lum(P.c) < lum(mid) ? 1 : 0.4));
          if (P.p.glow) {
            e = [e[0] + P.glowC[0] * m1 * P.p.glow, e[1] + P.glowC[1] * m1 * P.p.glow, e[2] + P.glowC[2] * m1 * P.p.glow];
          }
        }
        if (P.p.glow && m2 > 0 && P.c2 && P.p.t !== 'spots') {
          e = [e[0] + P.c2[0] * m2 * P.p.glow * 0.5, e[1] + P.c2[1] * m2 * P.p.glow * 0.5, e[2] + P.c2[2] * m2 * P.p.glow * 0.5];
        }
      }
      // scales: per-scale tint + edge pigment
      if (L.scaleVis > 0 || mosaicC) {
        const cell = scaleCell(s * L.scaleN, (vp * scaleRows) / 2);
        const edgeDark = (1 - smoothstep(0.0, 0.12, cell.edge)) * cell.ramp;
        const vary = (cell.id - 0.5) * 0.12 * L.scaleVis;
        c = [c[0] * (1 + vary), c[1] * (1 + vary), c[2] * (1 + vary)];
        c = mixRGB(c, [c[0] * 0.45, c[1] * 0.45, c[2] * 0.5], edgeDark * L.scaleVis);
        // lighter exposed centres (iridophores)
        c = mixRGB(c, [Math.min(1, c[0] * 1.25), Math.min(1, c[1] * 1.25), Math.min(1, c[2] * 1.25)], (1 - cell.ramp) * 0.3 * L.scaleVis);
        if (mosaicC && mosaic) {
          const pick = hash3(Math.floor(cell.id * 1e6), 3, 9, seed);
          if (pick < (mosaic.k ?? 0.3)) c = mixRGB(c, mosaicC, 0.85 * smoothstep(0.0, 0.08, cell.edge + 0.02));
          else if (mosaicC2 && pick > 1 - (mosaic.k ?? 0.3) * 0.6) c = mixRGB(c, mosaicC2, 0.8);
        }
        metal *= 1 - edgeDark * 0.5;
      }
      // fine noise
      const nz = fbm(X * 40, Y * 40, 2, seed + 7) * 0.05 + fbm(X * 9, Y * 9, 2, seed + 8) * 0.06;
      c = [c[0] * (1 + nz), c[1] * (1 + nz), c[2] * (1 + nz)];
      // lateral line
      if (L.lateral > 0) {
        const llv = 0.36 + 0.12 * smoothstep(0.2, 0.95, s) - 0.05 * bump(s, 0.3, 0.15);
        const d = Math.abs(vp - llv);
        const m = (1 - smoothstep(0.004, 0.012, d)) * smoothstep(gill - 0.02, gill + 0.04, s) * (1 - smoothstep(0.96, 1, s));
        const dash = 0.55 + 0.45 * (Math.sin(s * 420) > -0.3 ? 1 : 0);
        const lc = lateralC ?? (lum(c) > 0.25 ? mixRGB(c, [0, 0, 0], 0.45) : mixRGB(c, [1, 1, 1], 0.45));
        c = mixRGB(c, lc, m * L.lateral * dash);
        if (llGlow && llC) e = [e[0] + llC[0] * m * llGlow, e[1] + llC[1] * m * llGlow, e[2] + llC[2] * m * llGlow];
        rough = rough * (1 - m * 0.3);
      }
      // gill cover (operculum): cheek colour, dark edge shadow behind, rim highlight in front
      if (gillOp && yf > -0.92 && yf < 0.62) {
        const se = gillEdgeS(gill, yf);
        const fadeY = smoothstep(-0.92, -0.75, yf) * (1 - smoothstep(0.45, 0.62, yf));
        const inside = 1 - smoothstep(se - 0.004, se + 0.002, s);
        if (cheek) c = mixRGB(c, cheek, inside * fadeY * 0.55 * smoothstep(0.02, 0.08, s));
        const shadow = bump(s, se + 0.008, 0.009) * fadeY;
        c = mixRGB(c, [c[0] * 0.35, c[1] * 0.35, c[2] * 0.38], shadow * 0.75);
        const rim = bump(s, se - 0.004, 0.004) * fadeY;
        c = mixRGB(c, [Math.min(1, c[0] * 1.4 + 0.03), Math.min(1, c[1] * 1.4 + 0.03), Math.min(1, c[2] * 1.4 + 0.03)], rim * 0.5);
        rough *= 1 - inside * fadeY * 0.3;
        metal = Math.max(metal, inside * fadeY * L.silver * 0.8);
        // preopercle line
        const sp = se - 0.045 + 0.02 * yf * yf;
        const pre = bump(s, sp, 0.0035) * smoothstep(-0.8, -0.5, yf) * (1 - smoothstep(0.1, 0.35, yf));
        c = mixRGB(c, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.62], pre * 0.5);
      }
      if (gillSlits) {
        for (let k = 0; k < 5; k++) {
          const sk = gill - 0.06 + k * 0.018;
          const m = bump(s, sk + yf * 0.006, 0.0035) * smoothstep(-0.6, -0.35, yf) * (1 - smoothstep(0.25, 0.45, yf));
          c = mixRGB(c, [c[0] * 0.35, c[1] * 0.32, c[2] * 0.35], m * 0.8);
        }
      }
      // mouth line
      if (s < mouthLen + 0.03) {
        const myf = mouthYf(spec, prof, s);
        const d = Math.abs(yf - myf);
        const fadeS = 1 - smoothstep(mouthLen * 0.9, mouthLen + 0.01, s);
        const line = (1 - smoothstep(0.05, 0.12, d)) * fadeS;
        const lipBand = (1 - smoothstep(0.1, 0.28, d)) * fadeS * (1 - line);
        if (spec.body.mouth.lipC) c = mixRGB(c, lipC, lipBand * 0.7);
        c = mixRGB(c, [c[0] * 0.18, c[1] * 0.15, c[2] * 0.15], line * 0.9);
        // jaw line (mandible) curving down from the corner
        const jawS = mouthLen + 0.02;
        const jaw = bump(s, jawS - (myf - yf) * 0.03, 0.004) * smoothstep(-0.95, -0.4, yf) * (yf < myf ? 1 : 0);
        c = mixRGB(c, [c[0] * 0.65, c[1] * 0.65, c[2] * 0.65], jaw * 0.35);
      }
      // body glow
      if (L.bodyGlow && em) {
        const g = L.bodyGlow * (0.4 + 0.6 * smoothstep(0.2, 0.8, vp));
        e = [e[0] + glowBase[0] * g, e[1] + glowBase[1] * g, e[2] + glowBase[2] * g];
      }
      rough = clamp(rough * (1 + 0.15 * patCover) + 0.06 * (1 - smoothstep(0.5, 0.9, vp)) - 0.08 * smoothstep(0.6, 0.95, vp), 0.05, 1);
      metal = clamp(metal * (1 - 0.7 * patCover));
      const k = (y * W + x) * 4;
      col[k] = b8(toSrgb(c[0]));
      col[k + 1] = b8(toSrgb(c[1]));
      col[k + 2] = b8(toSrgb(c[2]));
      col[k + 3] = 255;
      orm[k] = 255;
      orm[k + 1] = b8(rough);
      orm[k + 2] = b8(metal);
      orm[k + 3] = 255;
      if (em) {
        em[k] = b8(toSrgb(Math.min(1, e[0])));
        em[k + 1] = b8(toSrgb(Math.min(1, e[1])));
        em[k + 2] = b8(toSrgb(Math.min(1, e[2])));
        em[k + 3] = 255;
      }
    }
  }
  const opts = { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.MirroredRepeatWrapping };
  const map = makeTex(W, H, col, { ...opts, srgb: true });
  const ormT = makeTex(W, H, orm, opts);
  map.repeat.set(1, 2);
  ormT.repeat.set(1, 2);
  cache.set(ck, map);
  cache.set(`o:${key}`, ormT);
  let emT: THREE.Texture | null = null;
  if (em) {
    emT = makeTex(W, H, em, { ...opts, srgb: true });
    emT.repeat.set(1, 2);
    cache.set(`e:${key}`, emT);
  }
  return { map, orm: ormT, emissive: emT, repeat };
}

// ─────────────────────────────────────────────────────────── fins

export interface FinSlot {
  rays: number;
  notch: number;
  look: FinLook;
  /** caudal fans have rays radiating: nothing special for texture */
  kind: string;
}

export const FIN_SLOTS = 8;
/** slot rectangle in UV space: [u0, v0, u1, v1] */
export function finSlotRect(slot: number): [number, number, number, number] {
  const col = slot % 2;
  const row = Math.floor(slot / 2);
  const pad = 3 / 512;
  const u0 = col * 0.5 + pad;
  const u1 = col * 0.5 + 0.5 - pad;
  const v0 = row * 0.25 + pad;
  const v1 = row * 0.25 + 0.25 - pad;
  return [u0, v0, u1, v1];
}

export function finAtlas(key: string, slots: (FinSlot | null)[], seed: number): { tex: THREE.Texture; emissive: THREE.Texture | null } {
  const ck = `f:${key}`;
  const c0 = cache.get(ck);
  if (c0) return { tex: c0, emissive: cache.get(`fe:${key}`) ?? null };
  const W = 512;
  const H = 512;
  const data = new Uint8Array(W * H * 4);
  const hasGlow = slots.some((s) => s && (s.look.glow ?? 0) > 0);
  const em = hasGlow ? new Uint8Array(W * H * 4) : null;
  for (let si = 0; si < FIN_SLOTS; si++) {
    const slot = slots[si];
    if (!slot) continue;
    const col = si % 2;
    const row = Math.floor(si / 2);
    const x0 = col * 256;
    const y0 = row * 128;
    const L = slot.look;
    const base = lin(L.base);
    const edge = lin(L.edge);
    const pc = L.pc ? lin(L.pc) : lin('#1a1a1a');
    const R = Math.max(0, slot.rays);
    for (let yy = 0; yy < 128; yy++) {
      const b = clamp((yy - 3 + 0.5) / (128 - 6)); // 0 base → 1 edge
      for (let xx = 0; xx < 256; xx++) {
        const a = clamp((xx - 3 + 0.5) / (256 - 6));
        let c: RGB = mixRGB(base, edge, smoothstep(0.25, 1.0, b));
        let alpha = L.op * (1 - 0.3 * b);
        let glow = 0;
        // rays
        let ray = 0;
        let dRay = 0.5;
        if (R > 1) {
          const rp = a * (R - 1);
          dRay = Math.abs(rp - Math.round(rp));
          const spiny = slot.notch > 0.05;
          let rw = spiny ? 0.09 : 0.065;
          rw *= 1 - 0.4 * b;
          ray = 1 - smoothstep(rw, rw + 0.05, dRay);
          if (!spiny && b > 0.55) {
            // branching soft rays
            const off = 0.14 * smoothstep(0.55, 1.0, b);
            const d2 = Math.min(Math.abs(dRay - off), Math.abs(dRay + off));
            ray = Math.max(ray * (1 - smoothstep(0.55, 0.7, b)), 1 - smoothstep(rw * 0.8, rw * 0.8 + 0.05, d2));
          }
          // segmented joints
          if (!spiny) ray *= 0.8 + 0.2 * smoothstep(0.15, 0.3, Math.abs(fract(b * 12 + a * 3) - 0.5));
        }
        // spiny notch: membrane recedes between spines
        let memb = 1;
        if (slot.notch > 0) {
          const limit = 1 - slot.notch * Math.pow(smoothstep(0.0, 0.5, dRay), 0.8) * 0.9;
          memb = 1 - smoothstep(limit - 0.04, limit, b);
        }
        // outer rim fade (ragged)
        const rag = gnoise(a * 30, b * 4, seed + si) * 0.02;
        const rim = 1 - smoothstep(0.93 + rag, 1.0, b);
        // patterns
        switch (L.pat ?? 'none') {
          case 'spots': {
            const wl = worley(a * 9, b * 4.5, seed + si * 7, 0.9);
            const m = 1 - smoothstep(0.16, 0.24, wl.f1);
            c = mixRGB(c, pc, m * 0.85 * smoothstep(0.05, 0.2, b));
            break;
          }
          case 'bands': {
            const m = smoothstep(0.35, 0.65, Math.sin(b * Math.PI * 5 + a * 1.5) * 0.5 + 0.5);
            c = mixRGB(c, pc, m * 0.75);
            break;
          }
          case 'barred': {
            const m = smoothstep(0.4, 0.6, Math.sin(b * Math.PI * 7 + Math.sin(a * 9) * 0.6) * 0.5 + 0.5);
            c = mixRGB(c, pc, m * 0.9);
            break;
          }
          case 'edge': {
            const m = bump(b, 0.8, 0.07);
            c = mixRGB(c, pc, m * 0.9);
            break;
          }
          case 'tips': {
            c = mixRGB(c, pc, smoothstep(0.6, 0.85, b));
            break;
          }
          case 'stripes': {
            c = mixRGB(c, pc, ray * 0.9);
            break;
          }
          case 'ocellus': {
            const d = Math.hypot((a - 0.7) * 2, (b - 0.55) * 1);
            c = mixRGB(c, pc, 1 - smoothstep(0.16, 0.2, d));
            c = mixRGB(c, edge, bump(d, 0.23, 0.03));
            break;
          }
          case 'dark': {
            c = mixRGB(c, pc, smoothstep(0.2, 0.9, b) * 0.8);
            break;
          }
          case 'rays':
            break;
          default:
            break;
        }
        // rays darker/opaque
        if (R > 1) {
          const rc = mixRGB(c, lum(c) > 0.3 ? [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55] : [Math.min(1, c[0] * 1.6 + 0.02), Math.min(1, c[1] * 1.6 + 0.02), Math.min(1, c[2] * 1.6 + 0.02)], 0.55);
          c = mixRGB(c, rc, ray);
          alpha = Math.max(alpha * memb, ray * Math.min(1, L.op + 0.35));
        } else alpha *= memb;
        if (L.opaque) alpha = 1;
        alpha *= rim;
        // base: thicker, more opaque
        alpha = Math.max(alpha, (1 - smoothstep(0.0, 0.12, b)) * 0.95 * rim);
        if (L.glow) glow = L.glow * (0.4 + 0.6 * ray) * smoothstep(0.1, 0.9, b);
        const k = ((y0 + yy) * W + (x0 + xx)) * 4;
        data[k] = b8(toSrgb(c[0]));
        data[k + 1] = b8(toSrgb(c[1]));
        data[k + 2] = b8(toSrgb(c[2]));
        data[k + 3] = b8(alpha);
        if (em) {
          em[k] = b8(toSrgb(Math.min(1, c[0] * glow * 1.5)));
          em[k + 1] = b8(toSrgb(Math.min(1, c[1] * glow * 1.5)));
          em[k + 2] = b8(toSrgb(Math.min(1, c[2] * glow * 1.5)));
          em[k + 3] = 255;
        }
      }
    }
  }
  const tex = makeTex(W, H, data, { srgb: true });
  cache.set(ck, tex);
  let emT: THREE.Texture | null = null;
  if (em) {
    emT = makeTex(W, H, em, { srgb: true });
    cache.set(`fe:${key}`, emT);
  }
  return { tex, emissive: emT };
}

// ─────────────────────────────────────────────────────────── eyes

export function eyeTexture(iris: string, pupil: string, style = 0): THREE.Texture {
  const key = `eye:${iris}:${pupil}:${style}`;
  const c = cache.get(key);
  if (c) return c;
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const ic = lin(iris);
  const pc = lin(pupil);
  const dark: RGB = [0.01, 0.01, 0.012];
  for (let y = 0; y < H; y++) {
    // row H-1 = +Y pole = pupil centre
    const ang = (1 - (y + 0.5) / H) * Math.PI; // 0 at pole
    for (let x = 0; x < W; x++) {
      const a = (x / W) * Math.PI * 2;
      const stri = gnoise(Math.cos(a) * 6 + 10, Math.sin(a) * 6 + ang * 3, 7) * 0.5 + 0.5;
      const pupR = style === 1 ? 0.5 : 0.36;
      let c: RGB;
      if (ang < pupR) {
        c = pc;
        // subtle deep reflection
        c = mixRGB(c, [pc[0] + 0.03, pc[1] + 0.03, pc[2] + 0.04], smoothstep(0, pupR, ang) * 0.5);
      } else if (ang < 0.95) {
        const t = (ang - pupR) / (0.95 - pupR);
        c = mixRGB(ic, [ic[0] * 0.45, ic[1] * 0.4, ic[2] * 0.35], smoothstep(0.55, 1.0, t));
        c = mixRGB(c, [Math.min(1, ic[0] * 1.5), Math.min(1, ic[1] * 1.5), Math.min(1, ic[2] * 1.4)], (1 - smoothstep(0.0, 0.18, t)) * 0.8);
        c = [c[0] * (0.75 + 0.5 * stri), c[1] * (0.75 + 0.5 * stri), c[2] * (0.75 + 0.5 * stri)];
        // pupil rim
        c = mixRGB(c, dark, 1 - smoothstep(0.0, 0.06, t));
      } else {
        c = mixRGB([ic[0] * 0.2, ic[1] * 0.2, ic[2] * 0.2], dark, smoothstep(0.95, 1.2, ang));
      }
      const k = (y * W + x) * 4;
      data[k] = b8(toSrgb(c[0]));
      data[k + 1] = b8(toSrgb(c[1]));
      data[k + 2] = b8(toSrgb(c[2]));
      data[k + 3] = 255;
    }
  }
  const t = makeTex(W, H, data, { srgb: true, wrapS: THREE.RepeatWrapping });
  cache.set(key, t);
  return t;
}

// ─────────────────────────────────────────────────────────── mutation overlay tiles

export type OverlayKind = 'spots' | 'cracks' | 'crystals' | 'moss' | 'stars' | 'veins' | 'bands' | 'barnacles' | 'coral';

/** Periodic mask tile (alpha = mask, rgb = shading 0..1 for relief). */
export function overlayTile(kind: OverlayKind): THREE.Texture {
  const key = `ov:${kind}`;
  const c = cache.get(key);
  if (c) return c;
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      let m = 0;
      let sh = 1;
      switch (kind) {
        case 'spots': {
          const w = worley(u * 7, v * 7, 101, 0.9, 7, 7);
          const r = 0.12 + 0.12 * w.id;
          m = (1 - smoothstep(r - 0.04, r, w.f1)) * (w.id > 0.25 ? 1 : 0);
          sh = 0.8 + 0.2 * (1 - w.f1 / r);
          break;
        }
        case 'cracks': {
          const w = worley(u * 6, v * 6, 102, 0.9, 6, 6);
          const w2 = worley(u * 14, v * 14, 103, 0.9, 14, 14);
          const e = Math.min(w.f2 - w.f1 + gnoise(u * 40, v * 40, 104, 40, 40) * 0.035, (w2.f2 - w2.f1) * 1.6 + 0.04);
          m = 1 - smoothstep(0.025, 0.07, e);
          sh = 1;
          break;
        }
        case 'crystals': {
          const w = worley(u * 9, v * 9, 105, 0.85, 9, 9);
          const a = w.id * 6.283;
          const facet = 0.6 + 0.4 * (Math.cos(a) * w.dx + Math.sin(a) * w.dy) * 3;
          m = (1 - smoothstep(0.2, 0.3, w.f1)) * (w.id > 0.35 ? 1 : 0);
          m = Math.max(m * 0.95, 0.35 * (1 - smoothstep(0.02, 0.05, w.f2 - w.f1)));
          sh = clamp(facet);
          break;
        }
        case 'moss': {
          const f = fbm(u * 6, v * 6, 5, 106, 6, 6);
          const f2 = fbm(u * 24, v * 24, 3, 107, 24, 24);
          m = smoothstep(-0.05, 0.12, f + f2 * 0.3);
          sh = 0.6 + 0.4 * (f2 * 0.5 + 0.5);
          break;
        }
        case 'stars': {
          const w = worley(u * 10, v * 10, 108, 0.95, 10, 10);
          const ang = Math.atan2(w.dy, w.dx);
          const star = w.f1 * (0.55 + 0.45 * Math.abs(Math.cos(ang * 2)));
          const big = w.id > 0.8 ? 1.6 : 1;
          m = (1 - smoothstep(0.03 * big, 0.07 * big, star)) * (w.id > 0.3 ? 1 : 0);
          const w2 = worley(u * 30, v * 30, 109, 0.95, 30, 30);
          m = Math.max(m, (1 - smoothstep(0.02, 0.05, w2.f1)) * (w2.id > 0.6 ? 0.8 : 0));
          break;
        }
        case 'veins': {
          const f = fbm(u * 4, v * 4, 4, 110, 4, 4);
          const g = fbm(u * 9 + 3, v * 9, 3, 111, 9, 9);
          const l1 = Math.abs(f);
          const l2 = Math.abs(g);
          m = Math.max(1 - smoothstep(0.012, 0.04, l1), (1 - smoothstep(0.008, 0.028, l2)) * 0.8);
          break;
        }
        case 'bands': {
          const t = u * 5 + fbm(u * 3, v * 3, 3, 112, 3, 3) * 0.6 + Math.sin(v * Math.PI * 2 * 2) * 0.15;
          const d = Math.abs(fract(t) - 0.5);
          m = 1 - smoothstep(0.12, 0.2, d);
          break;
        }
        case 'barnacles': {
          const w = worley(u * 8, v * 8, 113, 0.8, 8, 8);
          const r = 0.22 + 0.12 * w.id;
          const ring = bump(w.f1, r * 0.6, r * 0.28);
          m = (1 - smoothstep(r - 0.03, r, w.f1)) * (w.id > 0.3 ? 1 : 0);
          sh = 0.55 + 0.45 * ring - 0.4 * (1 - smoothstep(0.0, r * 0.3, w.f1));
          break;
        }
        case 'coral': {
          const f = fbm(u * 5, v * 5, 4, 114, 5, 5);
          const w = worley(u * 16, v * 16, 115, 0.9, 16, 16);
          m = smoothstep(0.02, 0.12, f) * (0.7 + 0.3 * (1 - smoothstep(0.1, 0.4, w.f1)));
          sh = 0.6 + 0.4 * (1 - smoothstep(0.0, 0.45, w.f1));
          break;
        }
      }
      const k = (y * n + x) * 4;
      data[k] = b8(sh);
      data[k + 1] = b8(sh);
      data[k + 2] = b8(sh);
      data[k + 3] = b8(m);
    }
  }
  const t = makeTex(n, n, data, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  cache.set(key, t);
  return t;
}

// ─────────────────────────────────────────────────────────── particle sprites

export const SPRITES = ['sparkle', 'embers', 'bubbles', 'snow', 'electric', 'smoke', 'petals', 'stardust'] as const;
export type SpriteKind = (typeof SPRITES)[number];

export function spriteAtlas(): THREE.Texture {
  const key = 'sprites';
  const c = cache.get(key);
  if (c) return c;
  const S = 64;
  const W = S * SPRITES.length;
  const data = new Uint8Array(W * S * 4);
  for (let si = 0; si < SPRITES.length; si++) {
    const kind = SPRITES[si];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const px = (x + 0.5) / S * 2 - 1;
        const py = (y + 0.5) / S * 2 - 1;
        const r = Math.hypot(px, py);
        const ang = Math.atan2(py, px);
        let a = 0;
        let col: RGB = [1, 1, 1];
        switch (kind) {
          case 'sparkle': {
            const core = Math.exp(-r * r * 30);
            const rays = Math.exp(-Math.abs(px) * 22) * Math.exp(-Math.abs(py) * 2.2) + Math.exp(-Math.abs(py) * 22) * Math.exp(-Math.abs(px) * 2.2);
            const diag = (Math.exp(-Math.abs(px - py) * 18) + Math.exp(-Math.abs(px + py) * 18)) * Math.exp(-r * 4) * 0.35;
            a = clamp(core + rays * 0.9 + diag);
            break;
          }
          case 'embers': {
            a = clamp(Math.exp(-r * r * 6) * 1.1);
            col = [1, 0.75 + 0.25 * Math.exp(-r * r * 20), 0.5 * Math.exp(-r * r * 30)];
            break;
          }
          case 'bubbles': {
            const ring = bump(r, 0.82, 0.1);
            const fill = (1 - smoothstep(0.8, 0.9, r)) * 0.12;
            const hl = Math.exp(-((px + 0.35) ** 2 + (py - 0.35) ** 2) * 40);
            a = clamp(ring * 0.9 + fill + hl);
            break;
          }
          case 'snow': {
            const arm = Math.abs(Math.cos(ang * 3));
            const flake = Math.exp(-Math.pow(r * (1.15 - 0.35 * Math.pow(arm, 8)), 2) * 5) * (0.5 + 0.5 * Math.pow(arm, 4));
            a = clamp(flake * 1.4 + Math.exp(-r * r * 25) * 0.6);
            break;
          }
          case 'electric': {
            // jagged bolt along x
            const t = (px + 1) / 2;
            const yy = 0.45 * gnoise(t * 5, 3.3, 900) + 0.18 * gnoise(t * 13, 7.1, 901);
            const d = Math.abs(py - yy);
            const env = Math.sin(Math.PI * t);
            a = clamp((Math.exp(-d * d * 900) + Math.exp(-d * d * 60) * 0.35) * env * 1.3);
            col = [0.85, 0.95, 1];
            break;
          }
          case 'smoke': {
            const f = fbm(px * 2 + 5, py * 2, 4, 902) * 0.5 + 0.5;
            a = clamp((1 - smoothstep(0.3, 1.0, r)) * (0.35 + 0.65 * f) * 0.85);
            break;
          }
          case 'petals': {
            // petal shape: pointed ellipse
            const qx = px * 1.0;
            const qy = py * 1.9;
            const shape = qx * qx + qy * qy * (1 + qx * 0.6);
            a = 1 - smoothstep(0.55, 0.62, shape);
            col = mixRGB([1, 0.62, 0.75], [1, 0.9, 0.93], clamp(1 - Math.abs(py) * 1.5 + px * 0.3));
            break;
          }
          case 'stardust': {
            const core = Math.exp(-r * r * 40);
            const star = Math.exp(-Math.abs(px) * 14) * Math.exp(-Math.abs(py) * 3) + Math.exp(-Math.abs(py) * 14) * Math.exp(-Math.abs(px) * 3);
            a = clamp(core + star * 0.6 + Math.exp(-r * r * 6) * 0.25);
            break;
          }
        }
        const k = (y * W + si * S + x) * 4;
        data[k] = b8(col[0]);
        data[k + 1] = b8(col[1]);
        data[k + 2] = b8(col[2]);
        data[k + 3] = b8(a);
      }
    }
  }
  const t = makeTex(W, S, data, { mip: true });
  cache.set(key, t);
  return t;
}

/** Generic cached texture from a key + generator (used by special builders). */
export function cachedTex(key: string, w: number, h: number, fn: (u: number, v: number) => [number, number, number, number], srgb = true, repeat = false): THREE.Texture {
  const c = cache.get(key);
  if (c) return c;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn((x + 0.5) / w, (y + 0.5) / h);
      const k = (y * w + x) * 4;
      data[k] = b8(srgb ? toSrgb(r) : r);
      data[k + 1] = b8(srgb ? toSrgb(g) : g);
      data[k + 2] = b8(srgb ? toSrgb(b) : b);
      data[k + 3] = b8(a);
    }
  }
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  const t = makeTex(w, h, data, { srgb, wrapS: wrap, wrapT: wrap });
  cache.set(key, t);
  return t;
}

export function speciesKey(id: string, extra = ''): string {
  return `${id}:${hashStr(extra).toString(36)}`;
}
