/**
 * Fast deterministic 2D noise for terrain + scattering (CPU side).
 * Pure math, no three.js — runs in Node for heightmap previews too.
 */

const PERM = new Uint8Array(512);
const GX = new Float32Array(256);
const GY = new Float32Array(256);
(() => {
  // fixed seed permutation (mulberry32)
  let a = 0x51f3a7c1 >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    const ang = rnd() * Math.PI * 2;
    GX[i] = Math.cos(ang);
    GY[i] = Math.sin(ang);
  }
})();

/** Gradient noise, roughly in [-1, 1]. */
export function noise2(x: number, y: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const xf = x - fx;
  const yf = y - fy;
  const X = fx & 255;
  const Y = fy & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const aa = PERM[PERM[X] + Y];
  const ab = PERM[PERM[X] + Y + 1];
  const ba = PERM[PERM[X + 1] + Y];
  const bb = PERM[PERM[X + 1] + Y + 1];
  const n00 = GX[aa] * xf + GY[aa] * yf;
  const n10 = GX[ba] * (xf - 1) + GY[ba] * yf;
  const n01 = GX[ab] * xf + GY[ab] * (yf - 1);
  const n11 = GX[bb] * (xf - 1) + GY[bb] * (yf - 1);
  const x1 = n00 + u * (n10 - n00);
  const x2 = n01 + u * (n11 - n01);
  return (x1 + v * (x2 - x1)) * 1.42;
}

/** Fractal brownian motion, ~[-1, 1]. */
export function fbm(x: number, y: number, oct = 5, lac = 2.03, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise2(x * f + i * 17.13, y * f - i * 9.71) * amp;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** Ridged multifractal, [0, 1] with sharp crests at 1. */
export function ridged(x: number, y: number, oct = 5, lac = 2.1, gain = 0.5): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  let prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise2(x * f + i * 31.7, y * f + i * 5.3));
    n *= n;
    sum += n * amp * prev;
    prev = Math.min(1, n * 1.6);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
}

/** Periodic noise on an angle (radians) — for coastline radius wobble. */
export function angleNoise(a: number, freq: number, seed: number, oct = 4): number {
  return fbm(Math.cos(a) * freq + seed, Math.sin(a) * freq - seed * 0.7, oct);
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Polynomial smooth max. */
export function smax(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return lerp(b, a, h) + k * h * (1 - h);
}
export function smin(a: number, b: number, k: number): number {
  return -smax(-a, -b, k);
}

/** Deterministic hash → [0,1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((y | 0) + 0x61c88647, 0x85ebca6b) ^ Math.imul(s | 0, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Worley cell-edge distance (F2 - F1), 0 on cell borders. Also returns F1 in out[1]. */
export function worley(x: number, y: number, out?: number[]): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const rx = hash2(cx, cy, 1);
      const ry = hash2(cx, cy, 2);
      const dx = cx + 0.15 + rx * 0.7 - x;
      const dy = cy + 0.15 + ry * 0.7 - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  }
  if (out) out[1] = d1;
  return d2 - d1;
}

/** Distance from point to segment + param t along it. */
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + dx * t - px;
  const cz = az + dz * t - pz;
  return { d: Math.sqrt(cx * cx + cz * cz), t };
}
