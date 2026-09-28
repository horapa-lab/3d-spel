/**
 * GLIMMER GROTTO — a domed rock islet hollowed by a great sea cave. The cave shell is a mesh
 * feature; the heightfield provides the cave floor, the entrance beach and the inner pool.
 */
import { coast, coastal, dist, fbmN, s, standardSplat } from './common';
import type { IslandDef } from './types';

const R = 210;
/** Cave chamber (local): ellipse centre + radii, and the tunnel to the east entrance. */
export const GROTTO = { x: 18, z: 4, rx: 70, rz: 56, floor: 1.3, pool: { x: 0, z: 8, r: 26 }, mouthX: 150, mouthW: 30 };

export function grottoHole(lx: number, lz: number): number {
  const G = GROTTO;
  const e = Math.hypot((lx - G.x) / G.rx, (lz - G.z) / G.rz) - 1; // <0 inside chamber
  const tun = lx > G.x ? (Math.abs(lz - G.z) - G.mouthW * (0.5 + 0.25 * s(G.x + 40, G.mouthX, lx))) / 40 : 1;
  return Math.min(e, tun);
}

export const glimmer: IslandDef = {
  id: 'glimmer_grotto',
  palette: {
    sand: ['#b9b2a3', '#9c9585'],
    cover: ['#4f7453', '#7a9468'],
    dirt: ['#5a5046', '#72665a'],
    rock: ['#434a55', '#6c7482'],
    spec: ['#335a55', '#4f7a6c'],
    coverKind: 4,
    rockKind: 0,
    specKind: 2,
    sandKind: 3,
  },
  shape(lx, lz) {
    const c = coast(lx, lz, R, 101, 0.1, 0.15);
    const dIn = c * R;
    let h: number;
    if (dIn < 0) h = coastal(dIn, 0, 1.2, 10, 0.8);
    else h = coastal(dIn, 52 * Math.pow(s(0, 150, dIn), 0.75) + 5 * fbmN(lx, lz, 30, 3, 2), 1.2, 6);
    // cave floor (inside the shell)
    const hole = grottoHole(lx, lz);
    if (hole < 0.25) {
      const G = GROTTO;
      const w = s(0.25, -0.05, hole);
      let floor = G.floor + 0.6 * fbmN(lx, lz, 12, 2, 5) + 1.2 * s(-0.05, -0.5, hole) * 0;
      const dp = dist(lx, lz, G.pool.x, G.pool.z);
      floor = Math.min(floor, -4.5 + 5.8 * s(G.pool.r * 0.6, G.pool.r + 6, dp));
      // entrance tunnel slopes to the sea
      if (lx > G.x + 50) floor = Math.min(floor, G.floor - 4.5 * s(G.x + 60, G.mouthX + 10, lx) - (Math.abs(lz - G.z) < 9 ? 3 * s(G.x + 70, G.mouthX, lx) : 0));
      h = h + (floor - h) * w;
    }
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, { beach: 1.4, rockSlope: 0.34, spec: (x, n) => (x.h > 10 ? s(0, 0.5, n) * 0.6 : 0) });
    if (grottoHole(si.lx, si.lz) < 0.1) {
      o.cover = 0;
      o.spec = 0;
      o.rock = Math.max(o.rock, 0.35);
    }
  },
};
