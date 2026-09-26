// Chunky toy-style gun models (think idle mobile game / Roblox). Everything is
// rounded and oversized: fat barrels, big mags, huge scopes, bright accents.
// All guns point along +Z, +Y is up, the origin is the mount point.

import * as THREE from 'three';
import { Kit, goldColor } from './kit.js';

const PI = Math.PI;
const C = {
  slate: 0x434a5a, slateD: 0x353b48, slateL: 0x5f6879, steel: 0x98a3b3, silver: 0xd3dae4,
  wood: 0xc2743a, woodL: 0xdc944f, woodD: 0x94552a,
  tan: 0xe0bb82, tanD: 0xbf955c,
  olive: 0x86a043, oliveL: 0xa6c255, oliveD: 0x62772f,
  yellow: 0xffcc33, orange: 0xff8c26, red: 0xf04848, lime: 0xbdf23f,
  white: 0xf7f7f7, pink: 0xff8fcf, violet: 0xa35cff, cyan: 0x4de8ff, blue: 0x3d8bff,
  brass: 0xe8b84a, copper: 0xe8894f, lens: 0x5fd8ff,
};

// ------------------------------------------------------------------ part helpers
/** Fat barrel with a rounded muzzle ring. from z0 to z1 */
function barrel(k, r, z0, z1, color, y = 0, x = 0, ring = C.slateD) {
  const len = z1 - z0;
  k.cyl(r, len, color, x, y, z0 + len / 2, { m: 'metal', seg: 16 });
  k.tor(r * 1.02, r * 0.38, ring, x, y, z1 - r * 0.2, { rs: 8, seg: 18, m: 'metal' });
  k.cyl(r * 0.55, 0.03, 0x1b1d24, x, y, z1 + 0.005, { seg: 14 });
}

function grip(k, color, z, y = -0.28, h = 0.6, tilt = 0.28, w = 0.26) {
  k.rbox(w, h, 0.32, 0.12, color, 0, y, z, { rx: tilt, seg: 3 });
}

function trigger(k, color, z, y = -0.02) {
  k.tor(0.13, 0.035, color, 0, y - 0.04, z, { axis: 'x', arc: PI, rz: PI, seg: 10 });
  k.rbox(0.05, 0.13, 0.06, 0.02, 0x2a2d36, 0, y - 0.02, z - 0.02);
}

function scope(k, y, z0, z1, r = 0.14, body = C.slateD, lens = C.lens) {
  const len = z1 - z0;
  k.cyl(r, len, body, 0, y, z0 + len / 2, { m: 'metal', seg: 16 });
  k.cyl(r * 1.35, 0.22, body, 0, y, z1 - 0.05, { r2: r * 1.55, m: 'metal', seg: 16 });
  k.cyl(r * 1.25, 0.16, body, 0, y, z0 + 0.02, { m: 'metal', seg: 16 });
  k.cyl(r * 1.35, 0.02, lens, 0, y, z1 + 0.07, { m: 'glow', seg: 16 });
  k.cyl(r * 1.1, 0.02, lens, 0, y, z0 - 0.07, { m: 'glow', seg: 16 });
  k.cyl(r * 0.5, 0.14, body, 0, y + r + 0.05, z0 + len * 0.5, { axis: 'y', m: 'metal' });
}

function mount2(k, y0, y1, zs, color = C.slateD) {
  for (const z of zs) k.rbox(0.16, y1 - y0, 0.16, 0.05, color, 0, (y0 + y1) / 2, z);
}

function stock(k, color, z, y = 0.02, len = 0.9, h = 0.42, w = 0.26, drop = -0.08) {
  k.rbox(w, h, len, 0.14, color, 0, y, z, { rx: drop, seg: 3 });
  k.rbox(w + 0.02, h + 0.04, 0.1, 0.05, 0x2a2d36, 0, y - (len / 2) * Math.sin(-drop), z - len / 2 - 0.02, { rx: drop });
}

/** Magazine curving forward (AK style). */
function curvedMag(k, color, n, y, z, segLen, w, d, a0, da) {
  let cy = y;
  let cz = z;
  let a = a0;
  for (let i = 0; i < n; i++) {
    const dy = -Math.cos(a);
    const dz = Math.sin(a);
    k.rbox(w, segLen * 1.08, d, Math.min(w, d) * 0.3, color, 0, cy + (dy * segLen) / 2, cz + (dz * segLen) / 2, { rx: -a });
    cy += dy * segLen;
    cz += dz * segLen;
    a += da;
  }
}

// ------------------------------------------------------------------ COMMON
function pistol(k) {
  k.rbox(0.3, 0.3, 1.05, 0.12, C.slate, 0, 0.26, 0.08, { seg: 3, m: 'metal' });
  k.rbox(0.28, 0.2, 0.92, 0.09, C.yellow, 0, 0.05, 0.05, { seg: 3 });
  grip(k, C.yellow, -0.28, -0.26, 0.62, 0.3, 0.28);
  k.rbox(0.3, 0.1, 0.34, 0.04, C.slateD, 0, -0.55, -0.38, { rx: 0.3 });
  for (let i = 0; i < 3; i++) k.rbox(0.31, 0.2, 0.04, 0.015, C.slateD, 0, 0.27, -0.26 - i * 0.08);
  trigger(k, C.yellow, 0.08);
  k.cyl(0.08, 0.04, 0x1b1d24, 0, 0.26, 0.61);
  k.rbox(0.08, 0.08, 0.08, 0.03, C.orange, 0, 0.44, 0.5);
  k.rbox(0.18, 0.08, 0.08, 0.03, C.slateD, 0, 0.44, -0.36);
  k.anchor('muzzle', 0, 0.26, 0.64);
}

function revolver(k) {
  barrel(k, 0.11, 0.1, 0.95, C.silver, 0.3, 0, C.steel);
  k.rbox(0.12, 0.1, 0.8, 0.04, C.silver, 0, 0.42, 0.52, { m: 'metal' });
  k.rbox(0.07, 0.12, 0.08, 0.03, C.red, 0, 0.5, 0.9);
  k.rbox(0.26, 0.4, 0.58, 0.1, C.steel, 0, 0.18, -0.06, { m: 'metal', seg: 3 });
  k.cyl(0.25, 0.4, C.slateL, 0, 0.2, 0.0, { m: 'metal', seg: 12 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    k.cyl(0.055, 0.03, 0x1b1d24, Math.cos(a) * 0.14, 0.2 + Math.sin(a) * 0.14, 0.2);
  }
  grip(k, C.wood, -0.36, -0.22, 0.6, 0.5, 0.26);
  k.rbox(0.1, 0.16, 0.12, 0.04, C.slateD, 0, 0.4, -0.34, { rx: -0.5 });
  trigger(k, C.steel, 0.02, 0.0);
  k.anchor('muzzle', 0, 0.3, 0.98);
}

function microsmg(k) {
  k.rbox(0.32, 0.36, 1.0, 0.12, C.slate, 0, 0.2, 0.05, { seg: 3 });
  k.rbox(0.24, 0.1, 0.8, 0.04, C.slateL, 0, 0.4, 0.05);
  barrel(k, 0.08, 0.5, 0.82, C.slateD, 0.2);
  grip(k, C.slateD, 0.02, -0.22, 0.52, 0.12, 0.26);
  k.rbox(0.2, 0.46, 0.22, 0.07, C.orange, 0, -0.62, -0.02, { rx: 0.12 });
  trigger(k, C.slateD, 0.26, 0.02);
  k.rbox(0.05, 0.05, 0.56, 0.02, C.steel, 0.11, 0.14, -0.7, { m: 'metal' });
  k.rbox(0.05, 0.05, 0.56, 0.02, C.steel, -0.11, 0.14, -0.7, { m: 'metal' });
  k.rbox(0.3, 0.28, 0.08, 0.04, C.slateD, 0, 0.1, -0.98);
  k.rbox(0.1, 0.1, 0.1, 0.04, C.orange, 0, 0.46, 0.3);
  k.anchor('muzzle', 0, 0.2, 0.86);
}

function pump(k) {
  barrel(k, 0.1, -0.2, 1.4, C.slateD, 0.24);
  k.cyl(0.09, 1.1, C.slateL, 0, 0.06, 0.5, { m: 'metal' });
  k.rbox(0.28, 0.24, 0.56, 0.1, C.woodL, 0, 0.07, 0.78, { seg: 3 });
  for (let i = 0; i < 4; i++) k.rbox(0.29, 0.25, 0.03, 0.02, C.woodD, 0, 0.07, 0.6 + i * 0.12);
  k.rbox(0.3, 0.4, 0.62, 0.1, C.slate, 0, 0.14, -0.3, { seg: 3 });
  k.rbox(0.31, 0.12, 0.28, 0.04, C.red, 0, 0.22, -0.26);
  stock(k, C.wood, -1.0, -0.02, 0.8, 0.38, 0.24, -0.12);
  grip(k, C.wood, -0.62, -0.14, 0.38, 0.55, 0.22);
  trigger(k, C.slateD, -0.3, -0.06);
  k.sph(0.05, C.yellow, 0, 0.36, 1.3, { m: 'metal' });
  k.anchor('muzzle', 0, 0.24, 1.44);
}

// ------------------------------------------------------------------ UNCOMMON
function handcannon(k) {
  k.rbox(0.36, 0.38, 1.2, 0.12, C.silver, 0, 0.3, 0.12, { seg: 3, m: 'metal' });
  k.rbox(0.2, 0.08, 1.0, 0.04, C.steel, 0, 0.52, 0.18, { m: 'metal' });
  k.cyl(0.1, 0.04, 0x1b1d24, 0, 0.32, 0.73);
  k.rbox(0.32, 0.2, 1.0, 0.08, C.slateL, 0, 0.04, 0.06, { m: 'metal' });
  grip(k, C.slate, -0.34, -0.34, 0.72, 0.3, 0.32);
  k.rbox(0.33, 0.3, 0.2, 0.08, C.red, 0, -0.3, -0.32, { rx: 0.3 });
  for (let i = 0; i < 4; i++) k.rbox(0.37, 0.24, 0.04, 0.015, C.steel, 0, 0.3, -0.3 - i * 0.07);
  trigger(k, C.silver, 0.1, -0.02);
  k.rbox(0.08, 0.1, 0.08, 0.03, C.orange, 0, 0.58, 0.62);
  k.anchor('muzzle', 0, 0.32, 0.76);
}

function tacsmg(k) {
  k.rbox(0.3, 0.36, 1.05, 0.14, C.slate, 0, 0.2, -0.02, { seg: 3 });
  k.cyl(0.09, 0.64, C.slateL, 0, 0.38, 0.32);
  k.rbox(0.36, 0.34, 0.5, 0.15, C.blue, 0, 0.14, 0.7, { seg: 3 });
  k.cyl(0.12, 0.6, C.slateD, 0, 0.2, 1.2, { m: 'metal', seg: 16 });
  k.tor(0.12, 0.04, C.blue, 0, 0.2, 1.48, { m: 'metal' });
  curvedMag(k, C.slateD, 3, 0.04, 0.26, 0.2, 0.2, 0.24, 0.1, 0.17);
  grip(k, C.slateD, -0.3, -0.16, 0.46, 0.32, 0.24);
  trigger(k, C.slateD, -0.06, 0.0);
  k.rbox(0.05, 0.05, 0.62, 0.02, C.steel, 0.1, 0.24, -0.8, { m: 'metal' });
  k.rbox(0.05, 0.05, 0.62, 0.02, C.steel, -0.1, 0.24, -0.8, { m: 'metal' });
  k.rbox(0.26, 0.4, 0.1, 0.05, C.slateD, 0, 0.14, -1.12);
  k.cyl(0.1, 0.12, C.slateD, 0, 0.46, -0.36, { axis: 'x' });
  k.rbox(0.16, 0.16, 0.08, 0.05, C.slateD, 0, 0.44, 0.6);
  k.anchor('muzzle', 0, 0.2, 1.52);
}

function doublebarrel(k) {
  barrel(k, 0.1, -0.2, 1.3, C.slateD, 0.24, -0.11);
  barrel(k, 0.1, -0.2, 1.3, C.slateD, 0.24, 0.11);
  k.rbox(0.36, 0.18, 0.66, 0.08, C.woodL, 0, 0.1, 0.44, { seg: 3 });
  k.rbox(0.38, 0.36, 0.46, 0.1, C.silver, 0, 0.18, -0.4, { m: 'metal', seg: 3 });
  k.rbox(0.39, 0.14, 0.18, 0.05, C.brass, 0, 0.14, -0.42, { m: 'metal' });
  for (const sx of [-1, 1]) k.rbox(0.07, 0.14, 0.12, 0.03, C.slateD, sx * 0.09, 0.4, -0.56, { rx: -0.4 });
  stock(k, C.wood, -1.1, -0.04, 0.9, 0.42, 0.26, -0.12);
  grip(k, C.wood, -0.74, -0.08, 0.36, 0.55, 0.22);
  trigger(k, C.brass, -0.42, -0.04);
  k.anchor('muzzle', 0, 0.24, 1.34);
}

function huntingrifle(k) {
  k.rbox(0.26, 0.26, 1.4, 0.1, C.wood, 0, 0.04, 0.45, { seg: 3 });
  barrel(k, 0.08, 0.0, 2.0, C.slateD, 0.18);
  k.cyl(0.12, 0.66, C.slateL, 0, 0.18, -0.22, { m: 'metal' });
  k.cyl(0.035, 0.24, C.silver, 0.14, 0.18, -0.4, { axis: 'x', m: 'metal' });
  k.sph(0.07, C.brass, 0.27, 0.18, -0.4, { m: 'metal' });
  stock(k, C.wood, -1.0, -0.06, 0.8, 0.44, 0.26, -0.1);
  grip(k, C.woodD, -0.54, -0.1, 0.34, 0.45, 0.22);
  scope(k, 0.52, -0.5, 0.36, 0.1, C.slateD);
  mount2(k, 0.26, 0.44, [-0.3, 0.14]);
  trigger(k, C.slateD, -0.28, -0.1);
  k.rbox(0.28, 0.08, 0.3, 0.03, C.orange, 0, 0.18, 0.9);
  k.anchor('muzzle', 0, 0.18, 2.03);
}

// ------------------------------------------------------------------ RARE
function ak(k) {
  k.rbox(0.3, 0.38, 1.05, 0.1, C.slate, 0, 0.16, -0.1, { seg: 3 });
  k.rbox(0.26, 0.14, 1.0, 0.06, C.slateL, 0, 0.4, -0.12, { m: 'metal' });
  k.rbox(0.32, 0.28, 0.62, 0.12, C.woodL, 0, 0.12, 0.72, { seg: 3 });
  k.rbox(0.24, 0.16, 0.54, 0.07, C.woodL, 0, 0.36, 0.68);
  barrel(k, 0.07, 1.0, 1.84, C.slateD, 0.2);
  k.cyl(0.05, 0.62, C.slateD, 0, 0.36, 1.22, { m: 'metal' });
  k.rbox(0.14, 0.26, 0.12, 0.04, C.slateD, 0, 0.3, 1.05);
  k.rbox(0.08, 0.26, 0.08, 0.03, C.slateD, 0, 0.4, 1.6);
  k.cyl(0.1, 0.2, C.slateD, 0, 0.2, 1.92, { m: 'metal' });
  curvedMag(k, C.orange, 4, 0.0, 0.2, 0.2, 0.2, 0.34, 0.12, 0.17);
  grip(k, C.woodD, -0.36, -0.16, 0.44, 0.38, 0.22);
  stock(k, C.woodL, -1.02, 0.04, 0.9, 0.36, 0.24, -0.12);
  trigger(k, C.slateD, -0.12, -0.02);
  k.rbox(0.14, 0.07, 0.07, 0.03, C.silver, 0.16, 0.3, 0.26, { m: 'metal' });
  k.anchor('muzzle', 0, 0.2, 2.03);
}

function m4(k) {
  k.rbox(0.28, 0.28, 0.95, 0.08, C.slate, 0, 0.28, -0.1, { seg: 3 });
  k.rbox(0.26, 0.28, 0.62, 0.08, C.slate, 0, 0.06, -0.15, { seg: 3 });
  k.rbox(0.36, 0.34, 0.86, 0.14, C.tan, 0, 0.26, 0.78, { seg: 3 });
  for (let i = 0; i < 6; i++) k.rbox(0.16, 0.05, 0.08, 0.02, C.slateD, 0, 0.45, 0.46 + i * 0.13);
  barrel(k, 0.065, 1.2, 1.78, C.slateD, 0.26);
  k.rbox(0.07, 0.3, 0.07, 0.03, C.slateD, 0, 0.48, 1.12);
  k.rbox(0.22, 0.24, 0.3, 0.07, C.slateD, 0, 0.56, 0.0, { seg: 3 });
  k.rbox(0.14, 0.14, 0.03, 0.03, 0xff3344, 0, 0.58, 0.16, { m: 'glow' });
  curvedMag(k, C.tanD, 2, -0.06, 0.12, 0.3, 0.18, 0.28, 0.06, 0.14);
  grip(k, C.slateD, -0.38, -0.14, 0.42, 0.36, 0.22);
  k.cyl(0.09, 0.5, C.slateD, 0, 0.24, -0.8);
  k.rbox(0.24, 0.4, 0.46, 0.1, C.tan, 0, 0.16, -1.02, { seg: 3 });
  k.rbox(0.14, 0.38, 0.14, 0.06, C.slateD, 0, -0.04, 0.9);
  trigger(k, C.slateD, -0.12, -0.04);
  k.anchor('muzzle', 0, 0.26, 1.82);
}

function battlerifle(k) {
  k.rbox(0.34, 0.36, 1.5, 0.12, C.tan, 0, 0.3, 0.22, { seg: 3 });
  k.rbox(0.3, 0.28, 0.58, 0.08, C.slate, 0, 0.06, -0.22, { seg: 3 });
  for (let i = 0; i < 8; i++) k.rbox(0.16, 0.05, 0.1, 0.02, C.slateD, 0, 0.5, -0.3 + i * 0.15);
  barrel(k, 0.075, 0.96, 1.42, C.slateD, 0.28);
  k.cyl(0.11, 0.22, C.slateD, 0, 0.28, 1.5, { m: 'metal' });
  k.rbox(0.28, 0.3, 0.34, 0.08, C.slateD, 0, 0.66, 0.02, { seg: 3 });
  k.rbox(0.2, 0.18, 0.03, 0.03, 0x6ff0ff, 0, 0.68, 0.2, { m: 'glow' });
  k.rbox(0.22, 0.5, 0.28, 0.06, C.slateD, 0, -0.26, 0.08, { rx: -0.08 });
  grip(k, C.slateD, -0.44, -0.14, 0.44, 0.36, 0.22);
  k.rbox(0.28, 0.44, 0.64, 0.12, C.tan, 0, 0.2, -0.98, { seg: 3 });
  k.rbox(0.2, 0.1, 0.44, 0.04, C.slateD, 0, 0.46, -0.98);
  trigger(k, C.slateD, -0.2, -0.04);
  k.rbox(0.16, 0.07, 0.07, 0.03, C.red, -0.18, 0.36, 0.42);
  k.anchor('muzzle', 0, 0.28, 1.62);
}

function drumshotgun(k) {
  k.rbox(0.4, 0.5, 1.45, 0.16, C.slate, 0, 0.24, -0.05, { seg: 3 });
  k.rbox(0.41, 0.1, 0.7, 0.04, C.orange, 0, 0.36, -0.3);
  k.rbox(0.3, 0.3, 0.56, 0.12, C.slateD, 0, 0.3, 0.9, { seg: 3 });
  for (let i = 0; i < 3; i++) k.rbox(0.31, 0.1, 0.1, 0.04, C.orange, 0, 0.3, 0.74 + i * 0.16);
  barrel(k, 0.11, 1.1, 1.36, C.slateD, 0.3);
  k.cyl(0.42, 0.32, C.slateL, 0, -0.28, 0.3, { axis: 'x', m: 'metal', seg: 22 });
  k.cyl(0.26, 0.34, C.orange, 0, -0.28, 0.3, { axis: 'x', seg: 18 });
  k.rbox(0.08, 0.26, 0.08, 0.03, C.slateD, 0, 0.6, 0.3);
  k.rbox(0.08, 0.26, 0.08, 0.03, C.slateD, 0, 0.6, -0.3);
  k.rbox(0.08, 0.08, 0.7, 0.04, C.slateD, 0, 0.72, 0);
  grip(k, C.slateD, -0.52, -0.12, 0.44, 0.3, 0.24);
  k.rbox(0.34, 0.56, 0.4, 0.14, C.slate, 0, 0.16, -0.94, { seg: 3 });
  k.anchor('muzzle', 0, 0.3, 1.4);
}

// ------------------------------------------------------------------ EPIC
function sniper(k) {
  k.rbox(0.3, 0.34, 1.35, 0.12, C.olive, 0, 0.14, 0.1, { seg: 3 });
  barrel(k, 0.08, 0.7, 2.3, C.slateD, 0.24);
  k.rbox(0.2, 0.2, 0.3, 0.06, C.slateD, 0, 0.24, 2.4);
  scope(k, 0.62, -0.45, 0.6, 0.13, C.slateD);
  mount2(k, 0.32, 0.54, [-0.25, 0.3]);
  k.cyl(0.035, 0.24, C.silver, 0.16, 0.24, -0.35, { axis: 'x', m: 'metal' });
  k.sph(0.07, C.slateD, 0.3, 0.24, -0.35);
  k.rbox(0.2, 0.32, 0.3, 0.06, C.slateD, 0, -0.12, 0.1);
  grip(k, C.slateD, -0.52, -0.14, 0.42, 0.3, 0.22);
  k.rbox(0.28, 0.46, 0.84, 0.14, C.olive, 0, 0.1, -1.05, { seg: 3 });
  k.rbox(0.2, 0.14, 0.5, 0.06, C.oliveD, 0, 0.38, -0.98);
  k.rbox(0.3, 0.5, 0.08, 0.04, C.slateD, 0, 0.08, -1.48);
  k.rbox(0.06, 0.66, 0.06, 0.03, C.steel, 0.12, -0.18, 1.02, { rx: -0.35, rz: 0.25, m: 'metal' });
  k.rbox(0.06, 0.66, 0.06, 0.03, C.steel, -0.12, -0.18, 1.02, { rx: -0.35, rz: -0.25, m: 'metal' });
  k.rbox(0.31, 0.1, 0.4, 0.04, C.orange, 0, 0.26, 0.5);
  k.anchor('muzzle', 0, 0.24, 2.56);
}

function lmg(k) {
  k.rbox(0.36, 0.44, 1.15, 0.14, C.slate, 0, 0.24, -0.05, { seg: 3 });
  k.rbox(0.32, 0.14, 0.62, 0.06, C.slateL, 0, 0.5, 0.02);
  k.rbox(0.36, 0.28, 0.52, 0.12, C.slateD, 0, 0.14, 0.74, { seg: 3 });
  barrel(k, 0.085, 0.7, 1.96, C.slateD, 0.24);
  k.rbox(0.18, 0.08, 0.8, 0.03, C.slateL, 0, 0.36, 1.2, { m: 'metal' });
  k.rbox(0.07, 0.26, 0.07, 0.03, C.slateD, 0, 0.44, 1.76);
  k.rbox(0.07, 0.22, 0.07, 0.03, C.slateD, 0, 0.6, 0.62);
  k.rbox(0.07, 0.07, 0.38, 0.03, C.slateD, 0, 0.72, 0.78, { rx: 0.1 });
  k.rbox(0.44, 0.46, 0.5, 0.1, C.olive, -0.02, -0.28, 0.12, { seg: 3 });
  k.rbox(0.45, 0.07, 0.51, 0.03, C.oliveD, -0.02, -0.1, 0.12);
  for (let i = 0; i < 5; i++) k.cyl(0.04, 0.2, C.brass, -0.25, -0.04 + i * 0.07, 0.1, { axis: 'x', m: 'metal' });
  grip(k, C.slateD, -0.42, -0.16, 0.46, 0.3, 0.24);
  k.rbox(0.3, 0.46, 0.74, 0.14, C.slate, 0, 0.16, -0.95, { seg: 3 });
  k.rbox(0.05, 0.05, 0.6, 0.02, C.steel, 0.09, 0.08, 1.42, { m: 'metal' });
  k.rbox(0.05, 0.05, 0.6, 0.02, C.steel, -0.09, 0.08, 1.42, { m: 'metal' });
  k.anchor('muzzle', 0, 0.24, 2.0);
}

function grenadelauncher(k) {
  k.cyl(0.4, 0.6, C.olive, 0, 0.06, 0.16, { seg: 12 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 2;
    k.cyl(0.1, 0.03, 0x1b1d24, Math.cos(a) * 0.24, 0.06 + Math.sin(a) * 0.24, 0.47);
    const b = a + PI / 6;
    k.rbox(0.08, 0.08, 0.56, 0.03, C.oliveD, Math.cos(b) * 0.39, 0.06 + Math.sin(b) * 0.39, 0.16, { rz: b });
  }
  barrel(k, 0.15, 0.42, 1.2, C.slateD, 0.3, 0, C.orange);
  k.rbox(0.16, 0.1, 1.4, 0.04, C.slateD, 0, 0.52, 0.3);
  k.rbox(0.24, 0.24, 0.26, 0.07, C.slateD, 0, 0.7, 0.2, { seg: 3 });
  k.rbox(0.16, 0.14, 0.03, 0.03, 0x6ff0ff, 0, 0.72, 0.34, { m: 'glow' });
  k.rbox(0.28, 0.8, 0.14, 0.06, C.slateD, 0, 0.1, -0.2);
  k.rbox(0.14, 0.44, 0.16, 0.06, C.slateD, 0, -0.14, 0.82, { rx: 0.1 });
  grip(k, C.slateD, -0.44, -0.24, 0.46, 0.3, 0.22);
  k.rbox(0.05, 0.05, 0.56, 0.02, C.steel, 0.08, 0.14, -0.62, { m: 'metal' });
  k.rbox(0.05, 0.05, 0.56, 0.02, C.steel, -0.08, 0.14, -0.62, { m: 'metal' });
  k.rbox(0.24, 0.4, 0.4, 0.1, C.olive, 0, 0.1, -0.98, { seg: 3 });
  k.anchor('muzzle', 0, 0.3, 1.25);
}

function heavysniper(k) {
  k.rbox(0.36, 0.34, 1.7, 0.12, C.slate, 0, 0.34, 0.35, { seg: 3 });
  k.rbox(0.34, 0.34, 0.95, 0.1, C.slateL, 0, 0.06, -0.1, { seg: 3 });
  k.rbox(0.37, 0.1, 1.1, 0.04, C.orange, 0, 0.34, 0.1);
  barrel(k, 0.11, 1.1, 2.5, C.slateD, 0.34);
  k.rbox(0.38, 0.28, 0.4, 0.1, C.slateD, 0, 0.34, 2.64, { seg: 3 });
  k.rbox(0.39, 0.1, 0.08, 0.03, C.orange, 0, 0.34, 2.56);
  k.rbox(0.39, 0.1, 0.08, 0.03, C.orange, 0, 0.34, 2.72);
  scope(k, 0.76, -0.3, 0.85, 0.15, C.slateD);
  mount2(k, 0.5, 0.64, [-0.05, 0.55]);
  k.rbox(0.26, 0.4, 0.42, 0.08, C.slateD, 0, -0.2, 0.2);
  grip(k, C.slateD, -0.42, -0.2, 0.48, 0.3, 0.24);
  k.rbox(0.3, 0.52, 0.74, 0.14, C.slate, 0, 0.08, -0.95, { seg: 3 });
  k.rbox(0.32, 0.56, 0.1, 0.04, C.slateD, 0, 0.06, -1.34);
  k.rbox(0.08, 0.46, 0.08, 0.03, C.steel, 0, -0.34, -1.1, { m: 'metal' });
  k.rbox(0.07, 0.76, 0.07, 0.03, C.steel, 0.14, -0.12, 1.3, { rx: -0.35, rz: 0.3, m: 'metal' });
  k.rbox(0.07, 0.76, 0.07, 0.03, C.steel, -0.14, -0.12, 1.3, { rx: -0.35, rz: -0.3, m: 'metal' });
  k.anchor('muzzle', 0, 0.34, 2.86);
}

// ------------------------------------------------------------------ LEGENDARY
function minigun(k) {
  k.rbox(0.74, 0.74, 0.8, 0.22, C.slateL, 0, 0.24, -0.6, { m: 'metal', seg: 3 });
  k.rbox(0.76, 0.18, 0.4, 0.06, C.yellow, 0, 0.24, -0.6);
  k.cyl(0.42, 0.32, C.slateD, 0, 0.24, -0.04, { m: 'metal', seg: 20 });
  const s = k.sub('spin', 0, 0.24, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    s.cyl(0.085, 2.0, C.slate, Math.cos(a) * 0.21, Math.sin(a) * 0.21, 1.05, { m: 'metal', seg: 12 });
    s.cyl(0.05, 0.03, 0x1b1d24, Math.cos(a) * 0.21, Math.sin(a) * 0.21, 2.06);
  }
  s.cyl(0.1, 2.0, C.steel, 0, 0, 1.05, { m: 'metal' });
  s.cyl(0.34, 0.12, C.slateD, 0, 0, 0.45, { seg: 20, m: 'metal' });
  s.cyl(0.34, 0.12, C.slateD, 0, 0, 1.35, { seg: 20, m: 'metal' });
  s.tor(0.3, 0.06, C.yellow, 0, 0, 1.98, { m: 'metal' });
  for (const sx of [-1, 1]) k.cap(0.06, 0.34, C.slateD, sx * 0.28, 0.24, -1.12);
  k.rbox(0.6, 0.08, 0.08, 0.03, C.slateD, 0, 0.5, -1.12);
  k.rbox(0.08, 0.24, 0.08, 0.03, C.slateD, 0, 0.72, -0.76);
  k.rbox(0.08, 0.24, 0.08, 0.03, C.slateD, 0, 0.72, -0.36);
  k.rbox(0.08, 0.08, 0.52, 0.03, C.slateD, 0, 0.84, -0.56);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    k.rbox(0.16, 0.1, 0.16, 0.04, C.brass, 0.44 + t * 0.26, 0.12 - t * 0.6, -0.45 + Math.sin(t * PI) * 0.14, { rz: -0.6 * t, m: 'metal' });
  }
  k.rbox(0.56, 0.56, 0.68, 0.12, C.olive, 0.74, -0.74, -0.42, { seg: 3 });
  k.rbox(0.57, 0.08, 0.69, 0.03, C.oliveD, 0.74, -0.52, -0.42);
  k.anchor('muzzle', 0, 0.24, 2.08);
}

function bazooka(k) {
  k.cyl(0.28, 2.7, C.olive, 0, 0.3, 0.2, { seg: 20 });
  k.cyl(0.38, 0.36, C.oliveD, 0, 0.3, -1.3, { r2: 0.28, seg: 20 });
  k.tor(0.3, 0.07, C.oliveD, 0, 0.3, 1.52, { seg: 20 });
  k.cyl(0.29, 0.16, C.yellow, 0, 0.3, 1.0, { seg: 20 });
  k.cyl(0.29, 0.08, C.oliveD, 0, 0.3, 0.5, { seg: 20 });
  k.cyl(0.29, 0.08, C.oliveD, 0, 0.3, -0.5, { seg: 20 });
  k.cyl(0.2, 0.18, C.slateL, 0, 0.3, 1.62, { m: 'metal' });
  k.cone(0.2, 0.36, C.red, 0, 0.3, 1.89, { seg: 16 });
  k.rbox(0.18, 0.46, 0.22, 0.07, C.woodD, 0, -0.12, 0.3, { rx: 0.2 });
  k.rbox(0.18, 0.46, 0.22, 0.07, C.woodD, 0, -0.12, -0.3, { rx: 0.25 });
  k.rbox(0.2, 0.22, 0.5, 0.08, C.wood, 0, 0.02, -0.8);
  k.rbox(0.06, 0.3, 0.06, 0.03, C.slateD, -0.3, 0.58, 0.86);
  k.rbox(0.04, 0.2, 0.2, 0.03, C.slateD, -0.3, 0.76, 0.86);
  k.anchor('muzzle', 0, 0.3, 1.8);
}

function rpg(k) {
  k.cyl(0.15, 2.3, C.slateL, 0, 0.26, -0.05, { m: 'metal', seg: 16 });
  k.cyl(0.21, 0.76, C.wood, 0, 0.26, -0.1, { seg: 16 });
  k.cyl(0.32, 0.44, C.slateL, 0, 0.26, -1.38, { r2: 0.15, m: 'metal', seg: 16 });
  k.cyl(0.09, 0.42, C.oliveD, 0, 0.26, 1.28);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    k.rbox(0.03, 0.2, 0.3, 0.01, C.oliveD, Math.cos(a) * 0.14, 0.26 + Math.sin(a) * 0.14, 1.3, { rz: a + PI / 2 });
  }
  k.cyl(0.12, 0.34, C.oliveL, 0, 0.26, 1.64, { r2: 0.34, seg: 18 });
  k.cyl(0.34, 0.26, C.oliveL, 0, 0.26, 1.94, { seg: 18 });
  k.cone(0.34, 0.6, C.oliveL, 0, 0.26, 2.37, { seg: 18 });
  k.sph(0.07, C.red, 0, 0.26, 2.66);
  k.rbox(0.16, 0.44, 0.22, 0.07, C.slateD, 0, -0.1, 0.4, { rx: 0.15 });
  k.rbox(0.16, 0.44, 0.22, 0.07, C.slateD, 0, -0.1, -0.62, { rx: 0.25 });
  k.rbox(0.14, 0.2, 0.36, 0.06, C.slateD, -0.24, 0.42, 0.25);
  k.cyl(0.07, 0.02, C.lens, -0.24, 0.44, 0.44, { m: 'glow' });
  k.anchor('muzzle', 0, 0.26, 1.6);
}

function flamethrower(k) {
  k.rbox(0.36, 0.4, 1.0, 0.12, C.slateL, 0, 0.2, -0.05, { m: 'metal', seg: 3 });
  k.cyl(0.18, 0.8, C.slateD, 0, 0.24, 0.8, { seg: 16 });
  for (let i = 0; i < 5; i++) k.cyl(0.19, 0.05, C.orange, 0, 0.24, 0.48 + i * 0.16, { seg: 16 });
  k.cyl(0.1, 0.44, C.slate, 0, 0.24, 1.36, { m: 'metal' });
  k.cyl(0.14, 0.2, C.brass, 0, 0.24, 1.64, { r2: 0.09, m: 'metal' });
  k.cyl(0.035, 0.3, C.slateD, 0, 0.1, 1.54);
  k.sph(0.08, 0x6fc8ff, 0, 0.1, 1.72, { m: 'glow' });
  k.cyl(0.3, 0.86, C.red, 0, -0.32, -0.2, { seg: 20 });
  k.sph(0.3, C.red, 0, -0.32, 0.23, { sz: 0.5 });
  k.sph(0.3, C.red, 0, -0.32, -0.63, { sz: 0.5 });
  k.cyl(0.305, 0.1, C.yellow, 0, -0.32, -0.38, { seg: 20 });
  k.cyl(0.305, 0.1, 0x2a2d36, 0, -0.32, -0.26, { seg: 20 });
  k.cyl(0.305, 0.1, C.yellow, 0, -0.32, -0.14, { seg: 20 });
  k.cyl(0.06, 0.16, C.silver, 0, 0.02, -0.4, { axis: 'y', m: 'metal' });
  k.rbox(0.16, 0.44, 0.22, 0.07, C.slateD, 0, -0.12, 0.66, { rx: 0.1 });
  k.rbox(0.18, 0.44, 0.24, 0.07, C.slateD, 0, -0.04, -0.82, { rx: 0.3 });
  k.anchor('muzzle', 0, 0.24, 1.76);
}

// ------------------------------------------------------------------ MYTHIC
function tesla(k) {
  k.rbox(0.5, 0.54, 1.05, 0.18, C.slate, 0, 0.24, -0.35, { m: 'metal', seg: 3 });
  k.rbox(0.51, 0.12, 0.84, 0.05, C.brass, 0, 0.36, -0.35, { m: 'metal' });
  k.cyl(0.1, 1.35, C.cyan, 0, 0.26, 0.8, { m: 'glow' });
  for (let i = 0; i < 6; i++) k.tor(0.22, 0.06, C.copper, 0, 0.26, 0.25 + i * 0.2, { m: 'metal', seg: 20 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    k.rbox(0.05, 0.05, 1.2, 0.02, C.brass, Math.cos(a) * 0.22, 0.26 + Math.sin(a) * 0.22, 0.75, { m: 'metal' });
  }
  k.sph(0.26, C.cyan, 0, 0.26, 1.62, { m: 'glow' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    k.rbox(0.07, 0.07, 0.46, 0.03, C.brass, Math.cos(a) * 0.33, 0.26 + Math.sin(a) * 0.33, 1.52, { m: 'metal' });
    k.sph(0.07, C.cyan, Math.cos(a) * 0.33, 0.26 + Math.sin(a) * 0.33, 1.78, { m: 'glow' });
  }
  for (const sx of [-1, 1]) {
    k.cyl(0.14, 0.56, C.slateL, sx * 0.34, 0.22, -0.4, { m: 'metal' });
    k.rbox(0.03, 0.14, 0.34, 0.02, C.cyan, sx * 0.48, 0.22, -0.4, { m: 'glow' });
  }
  grip(k, C.slateD, -0.58, -0.18, 0.46, 0.3, 0.24);
  k.rbox(0.26, 0.44, 0.52, 0.12, C.slate, 0, 0.16, -1.12, { seg: 3 });
  k.anchor('muzzle', 0, 0.26, 1.66);
}

function plasmagun(k) {
  const body = 0x4a3478;
  const bodyL = 0x6c50b8;
  k.rbox(0.78, 0.76, 0.84, 0.24, body, 0, 0.24, -0.62, { m: 'metal', seg: 3 });
  k.rbox(0.8, 0.14, 0.56, 0.05, C.violet, 0, 0.24, -0.62, { m: 'glow' });
  k.cyl(0.44, 0.32, bodyL, 0, 0.24, -0.06, { m: 'metal', seg: 20 });
  const s = k.sub('spin', 0, 0.24, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    s.cyl(0.085, 1.9, C.slateD, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.0, { m: 'metal', seg: 12 });
    s.rbox(0.05, 0.05, 1.7, 0.02, 0xe07bff, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1.0, { m: 'glow', rz: a });
  }
  s.cyl(0.11, 1.9, C.violet, 0, 0, 1.0, { m: 'glow' });
  s.cyl(0.36, 0.12, bodyL, 0, 0, 0.4, { m: 'metal', seg: 20 });
  s.cyl(0.36, 0.12, bodyL, 0, 0, 1.25, { m: 'metal', seg: 20 });
  s.tor(0.3, 0.06, 0xff4df0, 0, 0, 1.92, { m: 'glow', seg: 20 });
  k.cyl(0.18, 0.56, C.slateD, 0, 0.8, -0.62, { m: 'metal' });
  k.rbox(0.03, 0.16, 0.44, 0.02, 0xff4df0, 0.19, 0.8, -0.62, { m: 'glow' });
  k.rbox(0.03, 0.16, 0.44, 0.02, 0xff4df0, -0.19, 0.8, -0.62, { m: 'glow' });
  for (const sx of [-1, 1]) k.cap(0.065, 0.36, C.slateD, sx * 0.3, 0.24, -1.16);
  k.rbox(0.64, 0.08, 0.08, 0.03, C.slateD, 0, 0.52, -1.16);
  k.anchor('muzzle', 0, 0.24, 2.0);
}

function railgun(k) {
  const white = 0xe8eef5;
  k.rbox(0.62, 0.6, 1.15, 0.2, white, 0, 0.24, -0.4, { seg: 3 });
  k.rbox(0.63, 0.08, 0.9, 0.04, C.cyan, 0, 0.14, -0.4, { m: 'glow' });
  k.rbox(0.1, 0.34, 2.4, 0.04, C.slateD, 0.2, 0.3, 0.95, { m: 'metal' });
  k.rbox(0.1, 0.34, 2.4, 0.04, C.slateD, -0.2, 0.3, 0.95, { m: 'metal' });
  k.rbox(0.12, 0.14, 2.3, 0.04, C.cyan, 0, 0.3, 0.98, { m: 'glow' });
  for (let i = 0; i < 4; i++) k.tor(0.34, 0.06, C.slateL, 0, 0.3, 0.3 + i * 0.55, { m: 'metal', seg: 20 });
  k.rbox(0.14, 0.4, 0.14, 0.05, C.cyan, 0.2, 0.3, 2.18, { m: 'glow' });
  k.rbox(0.14, 0.4, 0.14, 0.05, C.cyan, -0.2, 0.3, 2.18, { m: 'glow' });
  k.rbox(0.28, 0.24, 0.46, 0.07, C.slateD, 0, 0.66, -0.35, { seg: 3 });
  k.rbox(0.2, 0.16, 0.03, 0.03, C.cyan, 0, 0.68, -0.11, { m: 'glow' });
  grip(k, C.slateD, -0.56, -0.18, 0.46, 0.3, 0.24);
  k.rbox(0.3, 0.48, 0.58, 0.14, white, 0, 0.16, -1.2, { seg: 3 });
  k.rbox(0.31, 0.07, 0.44, 0.03, C.cyan, 0, 0.3, -1.2, { m: 'glow' });
  k.anchor('muzzle', 0, 0.3, 2.22);
}

// ------------------------------------------------------------------ SECRET
function nuke(k) {
  const tube = 0x4d5c38;
  k.cyl(0.44, 2.5, tube, 0, 0.4, 0.0, { seg: 22 });
  k.cyl(0.54, 0.44, C.oliveD, 0, 0.4, -1.4, { r2: 0.44, seg: 22 });
  for (let i = 0; i < 6; i++) k.cyl(0.445, 0.13, i % 2 ? 0x2a2d36 : C.yellow, 0, 0.4, -0.8 + i * 0.13, { seg: 22 });
  k.tor(0.44, 0.08, C.oliveD, 0, 0.4, 1.22, { seg: 22 });
  k.sph(0.38, 0xa8b2bd, 0, 0.4, 1.56, { sz: 1.35, m: 'metal', seg: 20, segH: 14 });
  k.cyl(0.39, 0.12, C.yellow, 0, 0.4, 1.54, { seg: 22 });
  k.sph(0.1, C.red, 0, 0.4, 2.06, { m: 'glow' });
  k.rbox(0.2, 0.16, 1.6, 0.05, C.slateD, 0, -0.08, 0.0);
  k.rbox(0.18, 0.5, 0.26, 0.08, C.slateD, 0, -0.34, 0.45, { rx: 0.15 });
  k.rbox(0.18, 0.5, 0.26, 0.08, C.slateD, 0, -0.34, -0.35, { rx: 0.25 });
  k.rbox(0.3, 0.32, 0.46, 0.1, C.slateD, -0.46, 0.66, 0.2, { seg: 3 });
  k.rbox(0.22, 0.2, 0.03, 0.04, C.lime, -0.46, 0.68, 0.44, { m: 'glow' });
  k.sph(0.08, C.lime, 0.14, 0.86, -0.3, { m: 'glow' });
  k.sph(0.08, C.red, -0.04, 0.86, -0.3, { m: 'glow' });
  k.cyl(0.2, 0.03, C.yellow, 0.44, 0.4, 0.4, { axis: 'x' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 - PI / 2;
    k.rbox(0.03, 0.1, 0.08, 0.02, 0x2a2d36, 0.46, 0.4 + Math.sin(a) * 0.1, 0.4 + Math.cos(a) * 0.1, { rx: -a });
  }
  k.anchor('muzzle', 0, 0.4, 2.0);
}

function blackhole(k) {
  const body = 0x251844;
  const bodyL = 0x46307a;
  k.rbox(0.48, 0.5, 1.25, 0.2, body, 0, 0.24, -0.35, { m: 'metal', seg: 3 });
  k.rbox(0.49, 0.07, 1.05, 0.03, C.violet, 0, 0.36, -0.35, { m: 'glow' });
  k.rbox(0.49, 0.07, 1.05, 0.03, C.violet, 0, 0.12, -0.35, { m: 'glow' });
  k.cyl(0.26, 0.34, bodyL, 0, 0.26, 0.34, { r2: 0.36, m: 'metal' });
  k.sph(0.38, 0x07020f, 0, 0.26, 0.84, { seg: 20, segH: 14 });
  k.tor(0.56, 0.06, 0xc58bff, 0, 0.26, 0.84, { m: 'glow', rx: 1.1, seg: 32 });
  k.tor(0.48, 0.04, 0xff7bf3, 0, 0.26, 0.84, { m: 'glow', rx: -0.6, ry: 0.5, seg: 32 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    k.rbox(0.12, 0.12, 0.76, 0.05, bodyL, cx * 0.52, 0.26 + cy * 0.52, 0.84, { m: 'metal', rx: cy * 0.25, ry: -cx * 0.25 });
    k.sph(0.08, C.violet, cx * 0.42, 0.26 + cy * 0.42, 1.22, { m: 'glow' });
  }
  grip(k, C.slateD, -0.56, -0.18, 0.46, 0.3, 0.24);
  k.rbox(0.28, 0.46, 0.56, 0.14, body, 0, 0.16, -1.15, { m: 'metal', seg: 3 });
  k.anchor('muzzle', 0, 0.26, 1.24);
}

function unicorn(k) {
  const rb = [0xff4d4d, 0xff9f1a, 0xffe14d, 0x5ee65e, 0x4db8ff, 0xa66bff];
  k.rbox(0.52, 0.54, 1.0, 0.22, C.white, 0, 0.26, -0.2, { seg: 3 });
  k.rbox(0.42, 0.4, 0.46, 0.18, C.white, 0, 0.18, 0.44, { seg: 3 });
  k.sph(0.045, 0xd65c98, 0.1, 0.18, 0.67);
  k.sph(0.045, 0xd65c98, -0.1, 0.18, 0.67);
  for (const sx of [-1, 1]) {
    k.sph(0.1, 0x2a1d3a, sx * 0.265, 0.38, 0.14, { sx: 0.35, sy: 1.2 });
    k.sph(0.035, C.white, sx * 0.29, 0.42, 0.17, { m: 'glow' });
    k.sph(0.07, 0xff9ccd, sx * 0.265, 0.22, 0.26, { sx: 0.3 });
    k.cone(0.09, 0.2, C.white, sx * 0.15, 0.62, -0.08, { axis: 'y' });
  }
  const hy = 0.52;
  const hz = 0.4;
  const tilt = 0.35;
  const dy = Math.sin(tilt);
  const dz = Math.cos(tilt);
  k.cone(0.12, 0.9, 0xffe26a, 0, hy + dy * 0.45, hz + dz * 0.45, { rx: -tilt, m: 'metal' });
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const d = 0.9 * t * 0.85;
    k.tor(0.12 * (1 - t) + 0.015, 0.02, C.pink, 0, hy + dy * d, hz + dz * d, { rx: -tilt, seg: 14 });
  }
  for (let i = 0; i < 6; i++) k.rbox(0.18, 0.2, 0.2, 0.08, rb[i], 0, 0.56 - i * 0.02, 0.08 - i * 0.16);
  for (let i = 0; i < 6; i++) k.rbox(0.22, 0.08, 0.56, 0.03, rb[i], 0, 0.44 - i * 0.075, -0.95);
  grip(k, C.pink, -0.35, -0.16, 0.46, 0.3, 0.24);
  k.anchor('muzzle', 0, hy + dy * 0.9, hz + dz * 0.9);
}

const BUILDERS = {
  pistol, revolver, microsmg, pump,
  handcannon, tacsmg, doublebarrel, huntingrifle,
  ak, m4, battlerifle, drumshotgun,
  sniper, lmg, grenadelauncher, heavysniper,
  minigun, bazooka, rpg, flamethrower,
  tesla, plasmagun, railgun,
  nuke, blackhole, unicorn,
};

const cache = new Map();

/** Built once per (weapon, gold) and cloned afterwards (geometry is shared). */
export function gunTemplate(id, gold = false) {
  const key = id + (gold ? '*' : '');
  let t = cache.get(key);
  if (!t) {
    const kit = new Kit(gold ? { colorFn: goldColor, forceMat: 'metal' } : {});
    (BUILDERS[id] || BUILDERS.pistol)(kit);
    const obj = kit.build();
    const box = new THREE.Box3().setFromObject(obj);
    t = { obj, muzzle: kit.anchors.muzzle || new THREE.Vector3(0, 0, 1), box };
    cache.set(key, t);
  }
  return t;
}

/** A fresh instance of a gun model. */
export function createGunModel(id, gold = false) {
  const t = gunTemplate(id, gold);
  const obj = t.obj.clone(true);
  return {
    obj,
    muzzle: t.muzzle.clone(),
    spinner: obj.getObjectByName('spin') || null,
    box: t.box,
  };
}

export const GUN_BUILDER_IDS = Object.keys(BUILDERS);
