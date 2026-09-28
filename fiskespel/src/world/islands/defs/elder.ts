/**
 * ELDER ISLE — a big prehistoric jungle island: steep green hills, a temple plateau with ruins,
 * a river that plunges off a cliff into a sea inlet (waterfall), research camp + dock on the west.
 */
import { ridged, segDist } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 450;
/** Waterfall inlet: from the sea (a) to the cliff head (b). Local coords. */
export const ELDER_INLET = { ax: -150, az: -470, bx: -95, bz: -262, width: 44 };
/** Plateau above the falls and the river on it. */
export const ELDER_FALLS = { x: -93, z: -250, top: 34 };
export const ELDER_RIVER: [number, number][] = [
  [-93, -250],
  [-70, -205],
  [-60, -150],
  [-20, -110],
  [10, -60],
];
export const ELDER_TEMPLE = { x: 120, z: 40, r: 42, y: 58 };

export const elder: IslandDef = {
  id: 'elder_isle',
  palette: {
    sand: ['#dfcd9c', '#c9b27f'],
    cover: ['#3a7427', '#6a9934'],
    dirt: ['#5a4330', '#775a3d'],
    rock: ['#63665a', '#8e917f'],
    spec: ['#355f25', '#5a8a30'],
    coverKind: 2,
    rockKind: 3,
    specKind: 2,
    sandKind: 0,
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 97, 0.14, 0.24);
    const dIn = c * R;
    if (dIn < 0) return coastal(dIn, 0, 1.4, 18, 1.1);
    const hills = 105 * s(40, 380, dIn) * (0.45 + 0.55 * fbmN(lx, lz, 170, 4, 3)) + 34 * ridged(lx / 130, lz / 130 + 7, 4) * s(30, 200, dIn);
    let land = 4 * s(0, 40, dIn) + hills;
    // falls plateau: a bench at ~34 m behind the inlet head
    const I = ELDER_INLET;
    const F = ELDER_FALLS;
    const dpl = dist(lx, lz, F.x + 20, F.z + 55);
    land = land + (F.top - land) * s(95, 60, dpl) * 0.9;
    let h = coastal(dIn, land, 1.5, 20);
    // the inlet: a sea-level gorge cut into the cliffs
    const sd = segDist(lx, lz, I.ax, I.az, I.bx, I.bz);
    const wv = I.width * (0.5 + 0.5 * sd.t * 0.7 + 0.3) * 0.5;
    if (sd.d < wv + 40) {
      const gorge = -5 + 4 * s(wv * 0.2, wv, sd.d) + (F.top + 4) * s(wv, wv + 22, sd.d);
      h = Math.min(h, gorge);
    }
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 1.9,
      rockSlope: 0.42,
      spec: (x, n) => (x.h > 3 ? s(0.1, 0.5, n) * 0.55 : 0),
    });
  },
};
