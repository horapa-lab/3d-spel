/**
 * MIREWOOD BAYOU — low, waterlogged swamp threaded by winding channels, mud flats, hummocks and
 * giant glowing mushrooms (props). Dock faces WNW towards Driftwood.
 */
import { fbm, ridged } from '../noise';
import { coast, coastal, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 380;

export function bayouChannel(lx: number, lz: number): number {
  // 0 on channel centre lines, grows away from them
  const a = Math.abs(fbm(lx / 230 + 3.3, lz / 230 - 1.1, 3));
  const b = Math.abs(fbm(lx / 130 - 7.1, lz / 130 + 2.6, 2));
  return Math.min(a, b * 1.6 + 0.045);
}

export const mirewood: IslandDef = {
  id: 'mirewood_bayou',
  palette: {
    sand: ['#51432f', '#6b5a40'],
    cover: ['#3f5f28', '#6f7c34'],
    dirt: ['#4a3a2a', '#634e38'],
    rock: ['#585b52', '#77786b'],
    spec: ['#34532a', '#5b7430'],
    coverKind: 4,
    rockKind: 0,
    specKind: 2,
    sandKind: 2,
    rough: [0.55, 0.92, 0.8, 0.85, 0.9],
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 67, 0.15, 0.22);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 0.6, 10, 1.3);
    const land = 0.6 * s(0, 30, dIn) + 0.9 * s(0.3, 0.8, fbm(lx / 60, lz / 60, 3) * 0.5 + 0.5) + 2.4 * ridged(lx / 140, lz / 140 + 4, 3) * s(30, 120, dIn);
    // channels + ponds
    const ch = bayouChannel(lx, lz);
    const carve = s(0.075, 0.03, ch) * s(10, 40, dIn);
    const pond = s(0.66, 0.74, fbm(lx / 110 + 11, lz / 110, 2) * 0.5 + 0.5) * s(20, 60, dIn);
    const w = Math.max(carve, pond);
    let h = coastal(dIn, land, 0.7, 14);
    h = h + (-2.4 - h) * w;
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 0.6,
      rockSlope: 0.5,
      spec: (x, n) => (x.h > 0.3 ? s(-0.1, 0.4, n) * 0.85 : 0),
    });
    // muddy banks around every channel
    if (si.h < 0.9) {
      o.cover *= s(0.3, 0.9, si.h);
      o.spec *= s(0.3, 0.9, si.h);
    }
  },
};
