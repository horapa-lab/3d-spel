/**
 * FROSTPEAK — a tall snowy mountain island. A cirque on the southern flank holds the Frozen Lake
 * (ice sheet with fishing holes). Log-cabin village + dock on the south shore.
 */
import { ridged } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 420;
export const FROST_PEAK = { x: -10, z: -95, h: 272 };
/** Frozen lake (local) — must match SUB_ZONES in layout.ts */
export const FROST_LAKE = { x: 20, z: 40, r: 62, y: 96 };

export const frostpeak: IslandDef = {
  id: 'frostpeak',
  palette: {
    sand: ['#8e8b87', '#a9a59e'],
    cover: ['#f3f6fa', '#c9d5e4'],
    dirt: ['#6c645e', '#8a8279'],
    rock: ['#585d65', '#868b93'],
    spec: ['#ffffff', '#d3dfed'],
    coverKind: 3,
    rockKind: 0,
    specKind: 0,
    sandKind: 3,
    rough: [0.85, 0.75, 0.9, 0.8, 0.7],
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 71, 0.12, 0.18);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 1.2, 12, 0.9);
    const P = FROST_PEAK;
    const dp = dist(lx, lz, P.x, P.z) * (1 + 0.1 * fbmN(lx, lz, 90, 3, 2));
    const cone = P.h * Math.pow(1 - s(0, 380, dp), 1.35);
    const ridges = 46 * ridged(lx / 110 + 1.7, lz / 110 - 0.4, 4) * s(40, 260, 330 - dp) * s(0, 60, dp);
    const land = 5 * s(0, 40, dIn) + (cone + ridges) * s(0, 90, dIn) + 3 * fbmN(lx, lz, 30, 3, 4);
    return coastal(dIn, land, 1.3, 14);
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 1.4,
      rockSlope: 0.46,
      spec: (x, n) => s(30, 70, x.h + n * 20) * (1 - s(0.5, 0.7, x.slope)),
    });
    // snow blankets everything but steep rock and the shingle beach
    o.cover = Math.max(o.cover, 0);
  },
};
