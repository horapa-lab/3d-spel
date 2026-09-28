/**
 * THE STONE ARCH — two sheer rock towers joined by a colossal natural arch (a mesh feature),
 * with a navigable channel between them, sea stacks and a hermit's ledge.
 */
import { ridged, smax } from '../noise';
import { coastal, dist, fbmN, s, standardSplat, underwater } from './common';
import type { IslandDef } from './types';

/** The arch spans between these tower tops (local). */
export const ARCH = {
  west: { x: -72, z: -6, r: 58, h: 48 },
  east: { x: 74, z: 10, r: 54, h: 40 },
};

const STACKS: [number, number, number, number][] = [
  [-150, 70, 12, 26],
  [150, -95, 10, 20],
  [120, 120, 8, 15],
  [-30, -150, 9, 18],
];

export const stoneArch: IslandDef = {
  id: 'stone_arch',
  palette: {
    sand: ['#aaa190', '#8d8676'],
    cover: ['#5f8a3e', '#93a85c'],
    dirt: ['#6d5a45', '#86705a'],
    rock: ['#7c7a76', '#aba69c'],
    spec: ['#4f6e37', '#6f8c45'],
    coverKind: 4,
    rockKind: 0,
    specKind: 2,
    sandKind: 3,
  },
  shape(lx, lz) {
    const W = ARCH.west;
    const E = ARCH.east;
    const n = fbmN(lx, lz, 30, 3, 5) * 10;
    const d1 = dist(lx, lz, W.x, W.z);
    const d2 = dist(lx, lz, E.x, E.z);
    // low rocky platform around both towers (channel between stays water)
    const plat = Math.max(90 - Math.hypot(lx * 0.8, lz * 1.25), 0);
    let dIn = Math.max(W.r - d1, E.r - d2) + n;
    const shelfIn = plat - 60 + n * 0.8;
    let h: number;
    if (dIn > 0) {
      // sheer towers with ridged tops
      const tw = d1 < d2 ? W : E;
      const top = tw.h + 7 * ridged(lx / 45 + 2, lz / 45, 3) - 4;
      h = 1.5 + (top - 1.5) * s(0, 16, dIn);
      h += 4 * s(20, 45, dIn) * fbmN(lx, lz, 25, 2, 9);
    } else {
      h = underwater(-dIn * 0.55, 0.7);
    }
    // low skerries / shelf where the towers meet the sea
    if (shelfIn > 0) h = Math.max(h, coastal(shelfIn * 0.5 - 6, 0, 1.2, 10));
    // keep channel between towers open
    const ch = Math.abs(lx - 2 + 0.1 * lz) - 16;
    if (ch < 0 && Math.abs(lz) < 110) h = Math.min(h, -6 + 5 * s(-2, 0, ch));
    for (const [sx, sz, sr, sh] of STACKS) {
      const d = dist(lx, lz, sx, sz) * (1 + 0.15 * fbmN(lx, lz, 8, 2, sx));
      if (d < sr * 5) h = smax(h, sh * s(sr, sr * 0.55, d) - 3 * s(sr, sr * 2.2, d) - 20 * s(sr * 2, sr * 5, d), 2);
    }
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 1.3,
      rockSlope: 0.3,
      spec: (x, n) => (x.h > 20 ? s(0.2, 0.6, n + 0.2) * 0.6 : 0),
    });
  },
};
