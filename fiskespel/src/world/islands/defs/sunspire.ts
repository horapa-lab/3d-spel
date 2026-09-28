/**
 * SUNSPIRE ISLE — sun-baked desert: dunes, layered sandstone mesas and tall spires (spires are
 * meshes placed by the plan). Adobe village + dock face WSW, towards Driftwood.
 */
import { ridged, smax } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 320;

/** Mesas: x, z, radius, height (two terraces). */
export const SUNSPIRE_MESAS: [number, number, number, number][] = [
  [40, -120, 62, 46],
  [150, 20, 44, 32],
  [-40, 20, 30, 22],
  [100, 150, 38, 28],
  [-120, -130, 34, 30],
];

export const sunspire: IslandDef = {
  id: 'sunspire_isle',
  palette: {
    sand: ['#e8c08a', '#d39d64'],
    cover: ['#a79457', '#c7b06e'],
    dirt: ['#a0714a', '#bd8c5d'],
    rock: ['#b5683d', '#dca06c'],
    spec: ['#c9a27a', '#e3c79f'],
    coverKind: 1,
    rockKind: 1,
    specKind: 5,
    sandKind: 0,
    rough: [0.93, 0.95, 0.96, 0.88, 0.9],
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 37, 0.13, 0.2);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 1.4, 20, 1.15);
    const dunes = 7 * ridged(lx / 70 + 3, lz / 55, 3) * s(15, 90, dIn) + 3 * fbmN(lx, lz, 40, 3, 4) * s(10, 60, dIn);
    let land = 3 * s(0, 50, dIn) + dunes;
    for (const [mx, mz, mr, mh] of SUNSPIRE_MESAS) {
      const d = dist(lx, lz, mx, mz) * (1 + 0.12 * fbmN(lx, lz, 25, 3, mx));
      const tier1 = mh * 0.55 * s(mr + 22, mr + 12, d);
      const tier2 = mh * 0.45 * s(mr + 3, mr - 3, d);
      land = smax(land, 3 + tier1 + tier2, 3);
    }
    return coastal(dIn, land, 1.5, 24);
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 3.2,
      rockSlope: 0.3,
      cover: 0.35 * s(-0.2, 0.4, fbmN(si.lx, si.lz, 45, 3, 7)),
      plazaToSpec: true,
    });
  },
};
