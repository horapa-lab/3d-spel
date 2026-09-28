/**
 * TURTLEBACK ATOLL — a ring of sand around a turquoise lagoon, a channel to the north for boats,
 * and on the south rim a domed hill whose rock plates look like a turtle's shell.
 */
import { fbm, worley } from '../noise';
import { coastal, dist, fbmN, s, standardSplat, underwater } from './common';
import type { IslandDef } from './types';

export const TURTLE_SHELL = { x: 20, z: 196, rx: 78, rz: 58, h: 17 };

export function atollRing(lx: number, lz: number) {
  const wx = lx + 16 * fbm(lx / 110 + 1, lz / 110, 3);
  const wz = lz + 16 * fbm(lx / 110, lz / 110 + 5, 3);
  const r = Math.hypot(wx, wz);
  const a = Math.atan2(wz, wx);
  let da = Math.abs(a + Math.PI / 2); // channel to the north (-z)
  if (da > Math.PI) da = Math.PI * 2 - da;
  return { r, da };
}

export const turtleback: IslandDef = {
  id: 'turtleback_atoll',
  palette: {
    sand: ['#f6ecd2', '#e8d8b0'],
    cover: ['#5fa140', '#a9c25c'],
    dirt: ['#a58b62', '#bea276'],
    rock: ['#8f8672', '#c0b393'],
    spec: ['#e29a86', '#f4dcc2'],
    coverKind: 0,
    rockKind: 3,
    specKind: 4,
    sandKind: 0,
    rough: [0.88, 0.95, 0.95, 0.85, 0.8],
  },
  shape(lx, lz) {
    const { r, da } = atollRing(lx, lz);
    const width = 30 + 10 * fbmN(lx, lz, 60, 2, 3);
    let dIn = width - Math.abs(r - 200);
    dIn -= 60 * s(0.26, 0.12, da); // boat channel
    let h: number;
    if (dIn >= 0) {
      h = coastal(dIn, 2.2 * s(8, 30, dIn) * (0.6 + 0.4 * fbmN(lx, lz, 25, 2, 1)), 1.3, 16);
    } else if (r < 200) {
      // lagoon: shallow turquoise with sand bars
      const d = -dIn;
      h = -0.6 - 3.6 * s(0, 45, d) + 1.6 * s(0.3, 0.7, fbm(lx / 50, lz / 50 + 3, 3) * 0.5 + 0.5);
      h = Math.min(h, -0.35);
      if (da < 0.3) h = Math.min(h, -4.5 + 2 * s(0.3, 0.1, da)); // channel depth
    } else {
      h = underwater(-dIn, 1.0);
    }
    // turtle-shell dome with scute grooves
    const T = TURTLE_SHELL;
    const e = Math.hypot((lx - T.x) / T.rx, (lz - T.z) / T.rz);
    if (e < 1.15) {
      const dome = T.h * Math.sqrt(Math.max(0, 1 - e * e)) * s(1.1, 0.85, e);
      const g = worley((lx - T.x) / 17, (lz - T.z) / 15);
      const groove = (1 - s(0.02, 0.14, g)) * 0.9 * s(1.0, 0.5, e);
      h = Math.max(h, 1.2 + dome - groove);
    }
    return h;
  },
  splat(si, o) {
    const T = TURTLE_SHELL;
    const e = Math.hypot((si.lx - T.x) / T.rx, (si.lz - T.z) / T.rz);
    standardSplat(si, o, {
      beach: 2.4,
      rockSlope: 0.4,
      seabedSpec: 0.9,
      spec: (x) => (x.h < -1 && x.h > -6 ? s(0.35, 0.6, fbm(x.lx / 28 + 2, x.lz / 28, 2) * 0.5 + 0.5) : 0),
    });
    if (e < 0.95) {
      // exposed shell rock with grass in the grooves
      const g = worley((si.lx - T.x) / 17, (si.lz - T.z) / 15);
      const plate = s(0.08, 0.2, g) * s(0.95, 0.6, e);
      o.rock = Math.max(o.rock, plate * 0.9);
      o.cover *= 1 - plate * 0.9;
    }
    if (dist(si.lx, si.lz, 0, 0) > 250) o.cover *= 0.5;
  },
};
