/** Shared building blocks for island shape functions (local coordinates, metres). */
import { angleNoise, fbm, smoothstep, clamp, noise2 } from '../noise';
import type { SplatIn, SplatOut } from '../terrain';

export const s = smoothstep;

/**
 * Landness field: 1 at the centre, 0 on the coast, negative in the sea (units ≈ radius fractions).
 * Irregular coastline from angular + domain-warped noise.
 */
export function coast(lx: number, lz: number, R: number, seed: number, wob = 0.16, warp = 0.22): number {
  const wx = lx + warp * R * fbm(lx / R * 1.1 + seed * 1.3, lz / R * 1.1 - seed, 3);
  const wz = lz + warp * R * fbm(lx / R * 1.1 - seed * 0.7, lz / R * 1.1 + seed * 2.1, 3);
  const r = Math.sqrt(wx * wx + wz * wz);
  const a = Math.atan2(wz, wx);
  const rr = R * (1 + wob * angleNoise(a, 1.2, seed, 3) + wob * 0.45 * angleNoise(a, 3.4, seed + 9, 2));
  return 1 - r / rr;
}

/** Underwater profile by distance beyond the coast (m): beach slope → shelf → drop-off. */
export function underwater(d: number, shelf = 1): number {
  return -(
    1.8 * s(0, 12, d) +
    8 * shelf * s(6, 90 * shelf, d) +
    35 * s(60 * shelf, 200 * shelf, d) +
    190 * s(140 * shelf, 320 * shelf, d)
  );
}

/** Convert landness c to metres from the coast (+ inland / - offshore). */
export const cToM = (c: number, R: number) => c * R;

/**
 * Standard coastal profile: beach rising to `beachTop` over `beachW` metres, then `land` above.
 * `land` is an extra height (≥0) added progressively inland.
 */
export function coastal(dIn: number, land: number, beachTop = 1.6, beachW = 22, shelf = 1): number {
  if (dIn < 0) return underwater(-dIn, shelf);
  return beachTop * s(0, beachW, dIn) + land;
}

export function fbmN(x: number, z: number, scale: number, oct = 4, seed = 0): number {
  return fbm(x / scale + seed * 7.13, z / scale - seed * 3.71, oct);
}

export interface SplatCfg {
  /** top of the sand beach (m) */
  beach?: number;
  /** slope where rock starts (0..1, 1 - normal.y) */
  rockSlope?: number;
  /** extra rock above this altitude */
  rockAbove?: number;
  /** special layer rule */
  spec?: (si: SplatIn, n: number) => number;
  /** cover amount multiplier (0 = bare) */
  cover?: number;
  /** plaza paint goes to special layer (cobble) */
  plazaToSpec?: boolean;
  /** underwater layer: 'sand' | 'rock' | 'spec' */
  seabedSpec?: number;
}

/** Generic splat used by most biomes. */
export function standardSplat(si: SplatIn, o: SplatOut, cfg: SplatCfg = {}): void {
  const n = noise2(si.lx * 0.045, si.lz * 0.045) * 0.5 + noise2(si.lx * 0.013 + 7, si.lz * 0.013) * 0.5;
  const beach = (cfg.beach ?? 1.7) + n * 0.9;
  const rockSlope = cfg.rockSlope ?? 0.36;
  let rock = s(rockSlope - 0.06, rockSlope + 0.1, si.slope + n * 0.05);
  if (cfg.rockAbove !== undefined) rock = Math.max(rock, s(cfg.rockAbove, cfg.rockAbove + 25, si.h + n * 12) * 0.9);
  let cover = s(beach - 0.4, beach + 0.9, si.h) * (cfg.cover ?? 1);
  // rocky seabed patches
  if (si.h < -3) rock = Math.max(rock, s(0.25, 0.55, n) * 0.8);
  let spec = cfg.spec ? cfg.spec(si, n) : 0;
  let dirt = si.dirt;
  if (cfg.plazaToSpec && si.plaza > 0) spec = Math.max(spec, si.plaza);
  if (cfg.seabedSpec && si.h < -2) spec = Math.max(spec, cfg.seabedSpec * s(-2, -5, si.h) * s(0.0, 0.4, n + 0.3));
  // paths win over cover, rock wins over everything on cliffs
  cover *= 1 - dirt;
  cover *= 1 - rock;
  dirt *= 1 - rock * 0.8;
  spec *= 1 - rock * 0.7;
  cover *= 1 - spec;
  dirt *= 1 - spec * 0.9;
  o.cover = clamp(cover, 0, 1);
  o.dirt = clamp(dirt, 0, 1);
  o.rock = clamp(rock, 0, 1);
  o.spec = clamp(spec, 0, 1);
}

/** Terraced plateau (mesa) helper: returns height contribution at distance d. */
export function mesa(d: number, r: number, h: number, edge = 6): number {
  return h * s(r + edge, r - edge * 0.3, d);
}

/** Radial distance helper. */
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
