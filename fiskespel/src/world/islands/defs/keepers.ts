/**
 * KEEPER'S MONOLITH — a brooding moorland island crowned by a 60 m hooded stone guardian that
 * gazes north-east over the sea. Its night altar stands on the plaza at its feet.
 */
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 230;
export const KEEPER_PLAZA = { x: -20, z: 20, r: 40, y: 22 };

export const keepers: IslandDef = {
  id: 'keepers_monolith',
  palette: {
    sand: ['#b9ae96', '#9f9680'],
    cover: ['#4f6b3a', '#7b8752'],
    dirt: ['#5e5040', '#786856'],
    rock: ['#66625f', '#8f8a83'],
    spec: ['#7a7671', '#9c968d'],
    coverKind: 4,
    rockKind: 0,
    specKind: 5,
    sandKind: 3,
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 113, 0.12, 0.2);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 1.3, 12, 0.95);
    const P = KEEPER_PLAZA;
    const dp = dist(lx, lz, P.x, P.z);
    const hill = P.y * s(190, 50, dp) + 6 * fbmN(lx, lz, 60, 3, 1) * s(10, 60, dIn);
    // SW cliffs
    const cliff = s(-0.2, 0.4, (-lx + lz) / R) * 14 * s(0, 16, dIn);
    return coastal(dIn, hill + cliff + 2 * s(0, 30, dIn), 1.4, 12);
  },
  splat(si, o) {
    standardSplat(si, o, { beach: 1.6, rockSlope: 0.36, plazaToSpec: true });
  },
};
