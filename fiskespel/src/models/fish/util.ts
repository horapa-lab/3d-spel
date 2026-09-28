/**
 * Small math / noise / colour helpers for the procedural fish generator.
 * Pure functions, no DOM — everything here also runs in node (vitest).
 */

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const fract = (x: number): number => x - Math.floor(x);
/** Gaussian-ish bump centred at c with half-width w. */
export const bump = (x: number, c: number, w: number): number => {
  const d = (x - c) / w;
  return Math.exp(-d * d);
};

// ───────────────────────────────────────────── hashing / rng

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Integer hash of up to 3 ints + seed → [0,1). */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ (z | 0), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export type Rand = () => number;
export function rng(seed: number): Rand {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────────────────────────── noise

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * 2D gradient noise in ~[-1,1]. Optional integer periods (px, py) make it tile.
 */
export function gnoise(x: number, y: number, seed = 0, px = 0, py = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const g = (ix: number, iy: number, dx: number, dy: number): number => {
    const hx = px ? mod(ix, px) : ix;
    const hy = py ? mod(iy, py) : iy;
    const a = hash3(hx, hy, 17, seed) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const n00 = g(xi, yi, xf, yf);
  const n10 = g(xi + 1, yi, xf - 1, yf);
  const n01 = g(xi, yi + 1, xf, yf - 1);
  const n11 = g(xi + 1, yi + 1, xf - 1, yf - 1);
  return 1.41 * lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/** Fractal gradient noise, ~[-1,1]. */
export function fbm(x: number, y: number, oct = 4, seed = 0, px = 0, py = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * gnoise(x * f, y * f, seed + i * 101, px ? px * f : 0, py ? py * f : 0);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export interface Worley {
  f1: number;
  f2: number;
  /** random id of nearest cell in [0,1) */
  id: number;
  /** offset to nearest feature point */
  dx: number;
  dy: number;
}

/** Cellular noise. jitter 0..1. Optional periods make it tile. */
export function worley(x: number, y: number, seed = 0, jitter = 0.9, px = 0, py = 0): Worley {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 1e9;
  let f2 = 1e9;
  let id = 0;
  let bdx = 0;
  let bdy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const hx = px ? mod(cx, px) : cx;
      const hy = py ? mod(cy, py) : cy;
      const fx = cx + 0.5 + (hash3(hx, hy, 1, seed) - 0.5) * jitter;
      const fy = cy + 0.5 + (hash3(hx, hy, 2, seed) - 0.5) * jitter;
      const dx = fx - x;
      const dy = fy - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash3(hx, hy, 3, seed);
        bdx = dx;
        bdy = dy;
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id, dx: bdx, dy: bdy };
}

// ───────────────────────────────────────────── colour

export type RGB = [number, number, number];

/** '#rrggbb' → sRGB floats 0..1. */
export function hex(c: string): RGB {
  let s = c.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const toSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;

/** '#rrggbb' → linear floats. */
export function lin(c: string): RGB {
  const h = hex(c);
  return [toLin(h[0]), toLin(h[1]), toLin(h[2])];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function mulRGB(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}
export function lum(a: RGB): number {
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
/** Shift a linear colour's brightness in a perceptually nicer way (k>1 brighter). */
export function shade(a: RGB, k: number): RGB {
  return [Math.min(1, a[0] * k), Math.min(1, a[1] * k), Math.min(1, a[2] * k)];
}
/** Linear rgb → hex string. */
export function linToHex(c: RGB): string {
  const v = (x: number) => Math.round(clamp(toSrgb(x)) * 255).toString(16).padStart(2, '0');
  return `#${v(c[0])}${v(c[1])}${v(c[2])}`;
}
/** Saturate / desaturate a linear colour around its luminance. */
export function saturate(c: RGB, k: number): RGB {
  const l = lum(c);
  return [clamp(l + (c[0] - l) * k), clamp(l + (c[1] - l) * k), clamp(l + (c[2] - l) * k)];
}

// ───────────────────────────────────────────── interpolation

/** Monotone cubic (Fritsch–Carlson) interpolator over sorted xs. */
export function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
    );
  };
}
