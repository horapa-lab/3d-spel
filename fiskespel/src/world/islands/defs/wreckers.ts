/**
 * WRECKERS' COVE — a horseshoe of dark cliffs around a sheltered cove, entered through a narrow
 * mouth guarded by Skull Rock. Wrecks litter the cove; the pirate village sits on its beach.
 */
import { ridged } from '../noise';
import { coast, coastal, dist, fbmN, s, standardSplat, underwater } from './common';
import type { IslandDef } from './types';

const R = 290;
export const COVE = { x: -30, z: 30, r: 128 };
/** cove mouth direction (towards Driftwood) */
export const COVE_MOUTH = Math.atan2(1380, -1640);
export const SKULL_ROCK = { x: -30 + Math.cos(Math.atan2(1380, -1640)) * 250 + 38, z: 30 + Math.sin(Math.atan2(1380, -1640)) * 250 + 30 };

export const wreckers: IslandDef = {
  id: 'wreckers_cove',
  palette: {
    sand: ['#d6c294', '#bfa77a'],
    cover: ['#617f37', '#94a04c'],
    dirt: ['#6f5640', '#8d6f52'],
    rock: ['#4f4b47', '#7b746b'],
    spec: ['#7c7870', '#9a958c'],
    coverKind: 0,
    rockKind: 0,
    specKind: 5,
    sandKind: 0,
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 83, 0.1, 0.16);
    const dIn = c * R;
    // cove + mouth channel carve
    const dc = dist(lx, lz, COVE.x, COVE.z) * (1 + 0.08 * fbmN(lx, lz, 40, 2, 3)) - COVE.r;
    const mx = Math.cos(COVE_MOUTH);
    const mz = Math.sin(COVE_MOUTH);
    const px = lx - COVE.x;
    const pz = lz - COVE.z;
    const along = px * mx + pz * mz;
    const across = Math.abs(-px * mz + pz * mx);
    const mouth = along > 0 ? across - 34 - along * 0.05 : 1e9;
    const hole = Math.min(dc, mouth);
    let h: number;
    if (dIn < 0) h = underwater(-dIn, 1.0);
    else {
      const cliffs = 52 * s(0, 70, dIn) * (0.55 + 0.45 * ridged(lx / 90, lz / 90 + 2, 3));
      h = coastal(dIn, cliffs, 1.4, 8);
    }
    if (hole < 70) {
      // inner cove: sheltered water, a beach ring, then the cliffs rise behind
      const hc = hole < 0 ? underwater(-hole * 0.6, 0.6) : 1.6 * s(0, 18, hole) + 1.3 * Math.pow(Math.max(0, hole - 20), 1.1);
      h = Math.min(h, hc);
      if (mouth < 0) h = Math.min(h, -7 - 5 * s(0, -25, mouth));
    }
    // Skull Rock at the mouth
    const sd = dist(lx, lz, SKULL_ROCK.x, SKULL_ROCK.z);
    if (sd < 60) h = Math.max(h, 30 * s(24, 12, sd) - 3 * s(14, 30, sd) - 25 * s(28, 60, sd));
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, { beach: 1.8, rockSlope: 0.33, plazaToSpec: true });
  },
};
