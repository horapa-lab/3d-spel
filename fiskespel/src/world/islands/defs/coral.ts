/**
 * CORAL CRESCENT — a white-sand crescent wrapped around a shallow turquoise bay full of reefs.
 * The bay opens ESE, towards Driftwood Harbor.
 */
import { fbm, worley } from '../noise';
import { coastal, fbmN, s, standardSplat, underwater } from './common';
import type { IslandDef } from './types';

const OPEN = Math.atan2(380, 930); // direction of the bay mouth

export function coralRing(lx: number, lz: number) {
  const wx = lx + 28 * fbm(lx / 160 + 4, lz / 160, 3);
  const wz = lz + 28 * fbm(lx / 160, lz / 160 - 3, 3);
  const r = Math.hypot(wx, wz);
  const a = Math.atan2(wz, wx);
  let da = Math.abs(a - OPEN);
  if (da > Math.PI) da = Math.PI * 2 - da;
  return { r, da };
}

export const coral: IslandDef = {
  id: 'coral_crescent',
  palette: {
    sand: ['#f3e8cc', '#e4d0a4'],
    cover: ['#4f9a3a', '#a2b852'],
    dirt: ['#a08560', '#bb9d72'],
    rock: ['#958b78', '#c3b69a'],
    spec: ['#e8907e', '#f3dcc4'],
    coverKind: 0,
    rockKind: 3,
    specKind: 4,
    sandKind: 0,
    rough: [0.9, 0.95, 0.95, 0.85, 0.8],
  },
  shape(lx, lz) {
    const { r, da } = coralRing(lx, lz);
    // crescent band: widest opposite the mouth, tapering to horn tips
    const back = s(0.4, 2.6, da);
    const half = 22 + 58 * back;
    const mid = 196 + 12 * back;
    let dIn = half - Math.abs(r - mid);
    dIn -= 170 * s(1.02, 0.42, da); // cut the mouth
    let h: number;
    if (dIn >= 0) {
      const hill = 20 * s(20, 70, dIn) * s(1.6, 3.0, da) * (0.6 + 0.4 * fbmN(lx, lz, 60, 3, 2));
      const dunes = 2.2 * s(8, 40, dIn) * (0.5 + 0.5 * fbmN(lx, lz, 30, 3, 1));
      h = coastal(dIn, hill + dunes, 1.4, 20);
    } else if (r < mid) {
      // inner bay: shallow, sandy, with reef heads
      const d = -dIn;
      h = -0.8 - 6.5 * s(0, 70, d) - 5 * s(0.9, 0.3, da) * s(0, 60, d);
      const w = worley(lx / 17, lz / 17);
      const reef = s(0.55, 0.85, fbm(lx / 45 + 9, lz / 45, 3) * 0.5 + 0.5) * (1 - s(0.05, 0.3, w));
      h = Math.max(h, h + reef * 5.2);
      h = Math.max(h, underwater(d, 2.2) - 0.5);
    } else {
      h = underwater(-dIn, 1.2);
    }
    return h;
  },
  splat(si, o) {
    standardSplat(si, o, {
      beach: 2.3,
      rockSlope: 0.42,
      seabedSpec: 1,
      spec: (x) => (x.h < -0.8 && x.h > -6 ? s(0.3, 0.6, fbm(x.lx / 35 + 2, x.lz / 35, 2) * 0.5 + 0.5) : 0),
    });
  },
};
