/**
 * DRIFTWOOD HARBOR — the starting island. Temperate green hills, a sheltered southern bay with a
 * long pier, a fishing village on the bay's north shore, and a lighthouse on the SE headland.
 */
import { smax } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat, underwater } from './common';
import type { IslandDef } from './types';

const R = 280;

export const driftwood: IslandDef = {
  id: 'driftwood_harbor',
  palette: {
    sand: ['#dccb9f', '#c7b288'],
    cover: ['#5d8a33', '#8ea64a'],
    dirt: ['#7b6045', '#98805f'],
    rock: ['#77736d', '#a39d93'],
    spec: ['#8e8a83', '#b8b1a5'],
    coverKind: 0,
    rockKind: 0,
    specKind: 5,
    sandKind: 0,
  },
  shape(lx, lz) {
    let c = coast(lx, lz, R, 11, 0.1, 0.16);
    // lighthouse headland (SE)
    c = smax(c, 0.32 * (1 - dist(lx, lz, 212, 202) / 78), 0.06);
    // western point
    c = smax(c, 0.22 * (1 - dist(lx, lz, -262, 70) / 70), 0.06);
    let dIn = c * R;
    let h = dIn < 0 ? underwater(-dIn, 1.1) : 0;
    if (dIn >= 0) {
      const hills = 40 * s(40, 250, dIn) * (0.6 + 0.4 * fbmN(lx, lz, 150, 4, 1)) + 6 * fbmN(lx, lz, 55, 4, 2) * s(15, 90, dIn);
      // northern/western cliffs
      const cliffAmt = s(0.1, 0.6, -lz / R - 0.1 + 0.3 * fbmN(lx, lz, 120, 2, 5)) * s(0, 12, dIn);
      const head = 15 * s(64, 30, dist(lx, lz, 214, 204));
      h = coastal(dIn, hills + cliffAmt * 9 + head, 1.5, 26);
    }
    // harbour bay (south) — gentle shelving floor
    const e = Math.hypot((lx - 5) / 138, (lz - 262) / 112);
    const bay = -7.5 + 7.5 * s(0.25, 1.0, e) + 22 * s(1.0, 1.55, e);
    h = Math.min(h, bay);
    // small rocky islet off the west coast
    const di = dist(lx, lz, -330, 190);
    if (di < 160) h = Math.max(h, 7 * s(26, 6, di) + fbmN(lx, lz, 9, 2, 3) * 2 - 1.5 - 60 * s(16, 70, di) - 200 * s(70, 150, di));
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, { beach: 1.9, rockSlope: 0.4, plazaToSpec: true });
  },
};
