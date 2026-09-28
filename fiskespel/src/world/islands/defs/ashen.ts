/**
 * ASHEN REACH — a smouldering volcano of black sand and basalt. A smoking crater at the summit,
 * lava channels, and the Magma Pools on a terrace of the eastern flank.
 */
import { ridged } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 400;
export const VOLCANO = { x: -40, z: 30, h: 198, crater: 52, floor: 158 };
/** Magma terrace (local) — must match SUB_ZONES ashen_lava. */
export const MAGMA = { x: 150, z: -20, r: 48, y: 34 };
export const MAGMA_POOLS: [number, number, number][] = [
  [140, -28, 17],
  [168, -8, 12],
  [150, 6, 9],
  [124, -2, 8],
];

export const ashen: IslandDef = {
  id: 'ashen_reach',
  palette: {
    sand: ['#2c2a29', '#45403c'],
    cover: ['#4b4744', '#67615a'],
    dirt: ['#3a2d27', '#57402f'],
    rock: ['#262526', '#4a4644'],
    spec: ['#6b6560', '#918980'],
    coverKind: 1,
    rockKind: 2,
    specKind: 1,
    sandKind: 1,
    rough: [0.8, 0.95, 0.95, 0.7, 0.95],
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 127, 0.13, 0.2);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 1.1, 12, 1.0);
    const V = VOLCANO;
    const dv = dist(lx, lz, V.x, V.z) * (1 + 0.06 * fbmN(lx, lz, 60, 3, 1));
    let cone = V.h * Math.pow(1 - s(V.crater * 0.8, 360, dv), 1.5);
    // gullies down the flanks
    cone -= 14 * (1 - ridged(Math.atan2(lz - V.z, lx - V.x) * 3.2, dv / 70, 3)) * s(40, 140, dv) * s(330, 200, dv);
    // crater bowl
    if (dv < V.crater + 25) {
      const bowl = V.floor + (V.h - V.floor + 6) * Math.pow(s(V.crater * 0.35, V.crater + 6, dv), 1.6);
      cone = Math.min(cone, bowl);
    }
    const land = 3 * s(0, 40, dIn) + cone * s(0, 70, dIn) + 3 * fbmN(lx, lz, 25, 3, 7);
    return coastal(dIn, land, 1.2, 14);
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 1.6,
      rockSlope: 0.34,
      cover: 0.6,
      spec: (x, n) => s(-0.1, 0.35, n + (x.h > 60 ? 0.3 : 0)) * 0.8,
    });
  },
};
