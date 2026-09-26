// Procedural, toy-like models for every weapon. All guns point along +Z,
// +Y is up and the origin is the mount point (roughly the grip).

import * as THREE from 'three';
import { Kit, goldColor } from './kit.js';

const PI = Math.PI;
const P = {
  black: 0x1d2026, dark: 0x2c3139, gun: 0x454c57, steel: 0x7d8693, silver: 0xbfc6cf, chrome: 0xe2e7ee,
  wood: 0xa2582a, woodL: 0xc98244, woodD: 0x6e3a1c,
  tan: 0xc8a068, tanD: 0x9f7b48,
  olive: 0x6b7a3a, oliveL: 0x8d9c4c, oliveD: 0x4c5628,
  yellow: 0xffc62e, yellowD: 0xe0a51a, orange: 0xff8a1f, red: 0xe53935, lime: 0xb6ff3a,
  white: 0xf5f5f5, pink: 0xff8fc8, violet: 0xb26bff, cyan: 0x45e8ff,
  copper: 0xd9824a, brass: 0xd8ad45, glass: 0x9fe4ff,
};

/** Magazine that curves forward while going down (AK, MP5...). */
function curvedMag(k, color, n, x, y, z, segLen, w, d, a0, da, o = {}) {
  let cy = y;
  let cz = z;
  let a = a0;
  for (let i = 0; i < n; i++) {
    const dy = -Math.cos(a);
    const dz = Math.sin(a);
    k.box(w, segLen * 1.04, d, color, x, cy + (dy * segLen) / 2, cz + (dz * segLen) / 2, { ...o, rx: -a });
    cy += dy * segLen;
    cz += dz * segLen;
    a += da;
  }
}

// ------------------------------------------------------------------ COMMON
function pistol(k) {
  k.rbox(0.2, 0.2, 1.0, 0.035, P.dark, 0, 0.2, 0.06, { m: 'metal' });
  k.rbox(0.18, 0.13, 0.86, 0.035, P.yellow, 0, 0.05, 0.04);
  k.rbox(0.18, 0.52, 0.27, 0.05, P.yellow, 0, -0.2, -0.3, { rx: 0.3 });
  k.box(0.19, 0.28, 0.16, P.yellowD, 0, -0.22, -0.31, { rx: 0.3 });
  k.box(0.2, 0.06, 0.28, P.black, 0, -0.46, -0.38, { rx: 0.3 });
  k.box(0.07, 0.04, 0.3, P.yellow, 0, -0.1, 0.04);
  k.box(0.07, 0.14, 0.05, P.yellow, 0, -0.04, 0.18);
  k.box(0.04, 0.1, 0.04, P.black, 0, -0.03, 0.02, { rx: 0.2 });
  k.cyl(0.055, 0.03, P.black, 0, 0.2, 0.565);
  k.box(0.05, 0.05, 0.06, P.black, 0, 0.32, 0.5);
  k.box(0.12, 0.05, 0.06, P.black, 0, 0.32, -0.38);
  for (let i = 0; i < 4; i++) k.box(0.205, 0.13, 0.025, P.black, 0, 0.2, -0.26 - i * 0.05);
  k.anchor('muzzle', 0, 0.2, 0.6);
}

function revolver(k) {
  k.cyl(0.075, 0.85, P.silver, 0, 0.24, 0.47, { m: 'metal', seg: 12 });
  k.box(0.07, 0.07, 0.85, P.silver, 0, 0.3, 0.47, { m: 'metal' });
  k.box(0.035, 0.09, 0.07, P.dark, 0, 0.36, 0.86);
  k.rbox(0.17, 0.32, 0.5, 0.04, P.steel, 0, 0.14, -0.06, { m: 'metal' });
  k.cyl(0.19, 0.34, P.gun, 0, 0.17, 0.0, { m: 'metal', seg: 12 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    k.cyl(0.04, 0.02, P.black, Math.cos(a) * 0.11, 0.17 + Math.sin(a) * 0.11, 0.17);
  }
  k.rbox(0.16, 0.5, 0.24, 0.07, P.wood, 0, -0.2, -0.36, { rx: 0.5 });
  k.box(0.06, 0.12, 0.09, P.dark, 0, 0.32, -0.31, { rx: -0.5 });
  k.tor(0.09, 0.022, P.dark, 0, -0.04, 0.02, { axis: 'x' });
  k.box(0.03, 0.09, 0.03, P.dark, 0, -0.02, 0.0);
  k.anchor('muzzle', 0, 0.24, 0.9);
}

function microsmg(k) {
  k.rbox(0.22, 0.27, 0.95, 0.035, P.black, 0, 0.16, 0.05);
  k.box(0.16, 0.06, 0.75, P.dark, 0, 0.31, 0.05);
  k.cyl(0.085, 0.07, P.gun, 0, 0.16, 0.55, { m: 'metal' });
  k.cyl(0.05, 0.22, P.dark, 0, 0.16, 0.66, { m: 'metal' });
  k.rbox(0.18, 0.46, 0.22, 0.05, P.black, 0, -0.18, 0.02, { rx: 0.12 });
  k.box(0.13, 0.34, 0.15, P.gun, 0, -0.52, -0.02, { rx: 0.12 });
  k.box(0.06, 0.035, 0.32, P.black, 0, -0.02, 0.25);
  k.box(0.06, 0.12, 0.04, P.black, 0, 0.03, 0.4);
  k.box(0.035, 0.09, 0.035, P.gun, 0, 0.0, 0.2);
  k.box(0.035, 0.035, 0.52, P.gun, 0.085, 0.12, -0.66, { m: 'metal' });
  k.box(0.035, 0.035, 0.52, P.gun, -0.085, 0.12, -0.66, { m: 'metal' });
  k.box(0.22, 0.22, 0.045, P.gun, 0, 0.06, -0.93, { m: 'metal' });
  k.box(0.07, 0.06, 0.07, P.gun, 0, 0.37, 0.22);
  k.box(0.04, 0.09, 0.04, P.dark, 0, 0.37, 0.46);
  k.anchor('muzzle', 0, 0.16, 0.78);
}

function pump(k) {
  k.cyl(0.07, 1.62, P.dark, 0, 0.19, 0.53, { m: 'metal' });
  k.cyl(0.06, 1.2, P.gun, 0, 0.05, 0.43, { m: 'metal' });
  k.cyl(0.066, 0.04, P.dark, 0, 0.05, 1.04);
  k.rbox(0.19, 0.17, 0.52, 0.06, P.woodL, 0, 0.06, 0.72);
  for (let i = 0; i < 4; i++) k.box(0.2, 0.18, 0.025, P.woodD, 0, 0.06, 0.55 + i * 0.11);
  k.rbox(0.2, 0.3, 0.58, 0.04, P.black, 0, 0.12, -0.28);
  k.box(0.205, 0.08, 0.22, P.dark, 0, 0.17, -0.2);
  k.rbox(0.15, 0.3, 0.26, 0.06, P.wood, 0, -0.06, -0.62, { rx: 0.55 });
  k.rbox(0.16, 0.28, 0.9, 0.07, P.wood, 0, -0.03, -1.04, { rx: -0.1 });
  k.box(0.17, 0.32, 0.07, P.black, 0, -0.08, -1.5, { rx: -0.1 });
  k.box(0.06, 0.035, 0.26, P.black, 0, -0.07, -0.33);
  k.box(0.035, 0.08, 0.035, P.black, 0, -0.03, -0.3);
  k.sph(0.035, P.silver, 0, 0.28, 1.3, { m: 'metal' });
  k.anchor('muzzle', 0, 0.19, 1.36);
}

// ------------------------------------------------------------------ UNCOMMON
function handcannon(k) {
  k.rbox(0.25, 0.3, 1.12, 0.035, P.silver, 0, 0.24, 0.1, { m: 'metal' });
  k.box(0.14, 0.05, 0.9, P.chrome, 0, 0.405, 0.18, { m: 'metal' });
  k.cyl(0.065, 0.03, P.black, 0, 0.26, 0.665);
  k.rbox(0.22, 0.16, 0.92, 0.035, P.steel, 0, 0.03, 0.06, { m: 'metal' });
  k.rbox(0.22, 0.62, 0.33, 0.06, P.black, 0, -0.3, -0.32, { rx: 0.3 });
  for (let i = 0; i < 5; i++) k.box(0.255, 0.2, 0.025, P.gun, 0, 0.24, -0.3 - i * 0.04);
  k.box(0.05, 0.07, 0.07, P.black, 0, 0.45, 0.56);
  k.box(0.14, 0.07, 0.07, P.black, 0, 0.45, -0.38);
  k.box(0.07, 0.04, 0.32, P.steel, 0, -0.1, 0.06, { m: 'metal' });
  k.box(0.07, 0.15, 0.05, P.steel, 0, -0.03, 0.21, { m: 'metal' });
  k.box(0.04, 0.1, 0.04, P.black, 0, -0.03, 0.03);
  k.box(0.08, 0.09, 0.12, P.gun, 0, 0.33, -0.5);
  k.anchor('muzzle', 0, 0.26, 0.7);
}

function tacsmg(k) {
  k.rbox(0.2, 0.27, 1.0, 0.06, P.black, 0, 0.17, -0.02);
  k.cyl(0.07, 0.62, P.dark, 0, 0.3, 0.3);
  k.rbox(0.25, 0.26, 0.46, 0.08, P.dark, 0, 0.12, 0.66);
  k.cyl(0.085, 0.55, P.black, 0, 0.17, 1.15);
  k.cyl(0.07, 0.02, P.gun, 0, 0.17, 1.43);
  curvedMag(k, P.gun, 3, 0, 0.06, 0.26, 0.19, 0.12, 0.18, 0.1, 0.17);
  k.rbox(0.16, 0.4, 0.2, 0.05, P.black, 0, -0.12, -0.28, { rx: 0.32 });
  k.box(0.06, 0.035, 0.26, P.black, 0, -0.02, -0.08);
  k.box(0.035, 0.035, 0.6, P.gun, 0.07, 0.2, -0.8, { m: 'metal' });
  k.box(0.035, 0.035, 0.6, P.gun, -0.07, 0.2, -0.8, { m: 'metal' });
  k.rbox(0.17, 0.32, 0.08, 0.03, P.black, 0, 0.12, -1.1);
  k.cyl(0.07, 0.1, P.dark, 0, 0.36, -0.36, { axis: 'x' });
  k.box(0.12, 0.13, 0.06, P.dark, 0, 0.36, 0.56);
  k.anchor('muzzle', 0, 0.17, 1.45);
}

function doublebarrel(k) {
  k.cyl(0.075, 1.5, P.dark, -0.08, 0.2, 0.55, { m: 'metal' });
  k.cyl(0.075, 1.5, P.dark, 0.08, 0.2, 0.55, { m: 'metal' });
  k.box(0.05, 0.05, 1.5, P.gun, 0, 0.28, 0.55, { m: 'metal' });
  k.rbox(0.25, 0.13, 0.62, 0.05, P.woodL, 0, 0.08, 0.45);
  k.rbox(0.27, 0.27, 0.42, 0.05, P.silver, 0, 0.15, -0.38, { m: 'metal' });
  k.box(0.275, 0.1, 0.16, P.brass, 0, 0.12, -0.4, { m: 'metal' });
  k.box(0.05, 0.1, 0.1, P.dark, -0.07, 0.32, -0.52, { rx: -0.4 });
  k.box(0.05, 0.1, 0.1, P.dark, 0.07, 0.32, -0.52, { rx: -0.4 });
  k.rbox(0.15, 0.3, 0.28, 0.06, P.wood, 0, -0.06, -0.72, { rx: 0.55 });
  k.rbox(0.17, 0.3, 0.9, 0.08, P.wood, 0, -0.04, -1.12, { rx: -0.1 });
  k.box(0.18, 0.33, 0.06, P.woodD, 0, -0.09, -1.58, { rx: -0.1 });
  k.box(0.06, 0.035, 0.24, P.dark, 0, -0.02, -0.42);
  k.box(0.035, 0.08, 0.035, P.dark, 0, 0.02, -0.4);
  k.anchor('muzzle', 0, 0.2, 1.32);
}

function huntingrifle(k) {
  k.rbox(0.18, 0.2, 1.3, 0.06, P.wood, 0, 0.03, 0.45);
  k.cyl(0.05, 2.05, P.dark, 0, 0.15, 0.9, { m: 'metal' });
  k.cyl(0.085, 0.62, P.gun, 0, 0.16, -0.22, { m: 'metal' });
  k.cyl(0.022, 0.2, P.silver, 0.12, 0.16, -0.38, { axis: 'x', m: 'metal' });
  k.sph(0.05, P.silver, 0.23, 0.16, -0.38, { m: 'metal' });
  k.rbox(0.16, 0.3, 0.3, 0.06, P.wood, 0, -0.06, -0.52, { rx: 0.45 });
  k.rbox(0.18, 0.36, 0.78, 0.08, P.wood, 0, -0.06, -1.02, { rx: -0.08 });
  k.box(0.19, 0.38, 0.06, P.black, 0, -0.09, -1.43, { rx: -0.08 });
  k.cyl(0.07, 0.8, P.black, 0, 0.42, -0.1, { m: 'metal' });
  k.cyl(0.07, 0.2, P.black, 0, 0.42, 0.38, { r2: 0.11, m: 'metal' });
  k.cyl(0.09, 0.14, P.black, 0, 0.42, -0.55, { m: 'metal' });
  k.cyl(0.1, 0.01, P.glass, 0, 0.42, 0.485, { m: 'glow' });
  k.box(0.06, 0.13, 0.08, P.black, 0, 0.28, -0.3);
  k.box(0.06, 0.13, 0.08, P.black, 0, 0.28, 0.1);
  k.box(0.06, 0.035, 0.24, P.dark, 0, -0.12, -0.28);
  k.anchor('muzzle', 0, 0.15, 1.93);
}

// ------------------------------------------------------------------ RARE
function ak(k) {
  k.rbox(0.2, 0.28, 1.0, 0.03, P.black, 0, 0.14, -0.1);
  k.rbox(0.18, 0.09, 0.96, 0.04, P.dark, 0, 0.31, -0.12, { m: 'metal' });
  k.rbox(0.22, 0.21, 0.6, 0.06, P.woodL, 0, 0.1, 0.7);
  k.rbox(0.16, 0.12, 0.52, 0.05, P.woodL, 0, 0.29, 0.66);
  k.cyl(0.045, 1.05, P.dark, 0, 0.18, 1.32, { m: 'metal' });
  k.cyl(0.035, 0.6, P.dark, 0, 0.3, 1.2, { m: 'metal' });
  k.box(0.1, 0.2, 0.1, P.dark, 0, 0.25, 1.05);
  k.box(0.06, 0.2, 0.06, P.dark, 0, 0.33, 1.6);
  k.cyl(0.065, 0.16, P.black, 0, 0.18, 1.9, { m: 'metal' });
  k.box(0.1, 0.08, 0.14, P.dark, 0, 0.38, 0.36);
  curvedMag(k, 0xb4501c, 4, 0, 0.02, 0.2, 0.19, 0.14, 0.26, 0.12, 0.17);
  k.rbox(0.16, 0.36, 0.2, 0.05, P.woodD, 0, -0.14, -0.36, { rx: 0.38 });
  k.rbox(0.18, 0.28, 0.92, 0.06, P.woodL, 0, 0.04, -1.02, { rx: -0.12 });
  k.box(0.19, 0.32, 0.05, P.black, 0, -0.02, -1.49, { rx: -0.12 });
  k.box(0.06, 0.035, 0.28, P.dark, 0, -0.02, -0.12);
  k.box(0.035, 0.09, 0.035, P.dark, 0, 0.02, -0.12);
  k.box(0.1, 0.05, 0.05, P.silver, 0.12, 0.24, 0.26, { m: 'metal' });
  k.anchor('muzzle', 0, 0.18, 1.99);
}

function m4(k) {
  k.rbox(0.18, 0.2, 0.92, 0.03, P.black, 0, 0.24, -0.1);
  k.rbox(0.17, 0.2, 0.6, 0.03, P.black, 0, 0.06, -0.15);
  k.rbox(0.24, 0.24, 0.82, 0.05, P.tan, 0, 0.22, 0.76);
  for (let i = 0; i < 7; i++) k.box(0.1, 0.03, 0.06, P.black, 0, 0.355, 0.42 + i * 0.11);
  k.cyl(0.04, 0.6, P.dark, 0, 0.22, 1.45, { m: 'metal' });
  k.cyl(0.06, 0.15, P.black, 0, 0.22, 1.8, { m: 'metal' });
  k.box(0.05, 0.22, 0.05, P.black, 0, 0.42, 1.12);
  k.rbox(0.15, 0.17, 0.26, 0.03, P.black, 0, 0.44, 0.02);
  k.box(0.1, 0.1, 0.02, 0xff3344, 0, 0.45, 0.155, { m: 'glow' });
  curvedMag(k, P.tanD, 2, 0, 0.02, 0.12, 0.26, 0.12, 0.2, 0.05, 0.14);
  k.rbox(0.14, 0.34, 0.18, 0.05, P.black, 0, -0.12, -0.36, { rx: 0.35 });
  k.cyl(0.06, 0.45, P.black, 0, 0.2, -0.78);
  k.rbox(0.16, 0.3, 0.4, 0.05, P.tan, 0, 0.12, -1.0);
  k.rbox(0.1, 0.3, 0.1, 0.04, P.black, 0, 0.0, 0.9);
  k.box(0.06, 0.035, 0.26, P.black, 0, -0.03, -0.12);
  k.box(0.1, 0.05, 0.05, P.dark, 0.12, 0.28, -0.4);
  k.anchor('muzzle', 0, 0.22, 1.88);
}

function battlerifle(k) {
  k.rbox(0.22, 0.26, 1.45, 0.04, P.tan, 0, 0.26, 0.22);
  k.rbox(0.2, 0.2, 0.55, 0.04, P.black, 0, 0.06, -0.22);
  for (let i = 0; i < 9; i++) k.box(0.1, 0.03, 0.07, P.black, 0, 0.405, -0.35 + i * 0.14);
  k.cyl(0.045, 0.5, P.dark, 0, 0.24, 1.15, { m: 'metal' });
  k.cyl(0.07, 0.2, P.black, 0, 0.24, 1.46, { m: 'metal' });
  k.rbox(0.2, 0.22, 0.3, 0.04, P.black, 0, 0.53, 0.0);
  k.box(0.14, 0.13, 0.02, 0x6ff0ff, 0, 0.55, 0.155, { m: 'glow' });
  k.box(0.14, 0.4, 0.22, P.black, 0, -0.2, 0.08, { rx: -0.08 });
  k.rbox(0.15, 0.34, 0.2, 0.05, P.black, 0, -0.12, -0.42, { rx: 0.35 });
  k.rbox(0.18, 0.34, 0.62, 0.05, P.tan, 0, 0.17, -0.98);
  k.rbox(0.14, 0.08, 0.42, 0.03, P.black, 0, 0.38, -0.98);
  k.box(0.06, 0.035, 0.26, P.black, 0, -0.03, -0.18);
  k.box(0.12, 0.05, 0.05, P.black, -0.14, 0.3, 0.4);
  k.anchor('muzzle', 0, 0.24, 1.57);
}

function drumshotgun(k) {
  k.rbox(0.28, 0.4, 1.4, 0.06, P.black, 0, 0.22, -0.05);
  k.box(0.29, 0.06, 0.62, P.orange, 0, 0.3, -0.3);
  k.rbox(0.2, 0.2, 0.52, 0.05, P.dark, 0, 0.28, 0.86);
  for (let i = 0; i < 3; i++) k.box(0.21, 0.06, 0.08, P.black, 0, 0.28, 0.72 + i * 0.14);
  k.cyl(0.075, 0.3, P.black, 0, 0.28, 1.2, { m: 'metal' });
  k.cyl(0.34, 0.26, P.gun, 0, -0.24, 0.3, { axis: 'x', m: 'metal', seg: 20 });
  k.cyl(0.2, 0.28, P.dark, 0, -0.24, 0.3, { axis: 'x', seg: 16 });
  k.box(0.06, 0.2, 0.06, P.black, 0, 0.5, 0.28);
  k.box(0.06, 0.2, 0.06, P.black, 0, 0.5, -0.28);
  k.box(0.06, 0.06, 0.62, P.black, 0, 0.6, 0);
  k.rbox(0.16, 0.34, 0.2, 0.05, P.black, 0, -0.1, -0.48, { rx: 0.3 });
  k.rbox(0.24, 0.46, 0.36, 0.06, P.black, 0, 0.14, -0.92);
  k.anchor('muzzle', 0, 0.28, 1.36);
}

// ------------------------------------------------------------------ EPIC
function sniper(k) {
  k.rbox(0.2, 0.26, 1.3, 0.05, P.olive, 0, 0.12, 0.1);
  k.cyl(0.05, 1.8, P.dark, 0, 0.2, 1.45, { m: 'metal' });
  k.rbox(0.13, 0.13, 0.24, 0.02, P.black, 0, 0.2, 2.44);
  k.cyl(0.085, 1.0, P.black, 0, 0.52, 0.05, { m: 'metal' });
  k.cyl(0.085, 0.26, P.black, 0, 0.52, 0.66, { r2: 0.14, m: 'metal' });
  k.cyl(0.1, 0.16, P.black, 0, 0.52, -0.52, { m: 'metal' });
  k.cyl(0.13, 0.01, P.glass, 0, 0.52, 0.795, { m: 'glow' });
  k.cyl(0.05, 0.12, P.dark, 0, 0.64, 0.05, { axis: 'y' });
  k.cyl(0.05, 0.12, P.dark, 0.1, 0.52, 0.05, { axis: 'x' });
  k.box(0.07, 0.16, 0.09, P.black, 0, 0.34, -0.25);
  k.box(0.07, 0.16, 0.09, P.black, 0, 0.34, 0.3);
  k.cyl(0.022, 0.2, P.silver, 0.12, 0.2, -0.35, { axis: 'x', m: 'metal' });
  k.sph(0.05, P.black, 0.23, 0.2, -0.35);
  k.box(0.14, 0.24, 0.24, P.black, 0, -0.08, 0.1);
  k.rbox(0.15, 0.34, 0.2, 0.05, P.black, 0, -0.1, -0.5, { rx: 0.3 });
  k.rbox(0.18, 0.36, 0.8, 0.06, P.olive, 0, 0.08, -1.05);
  k.rbox(0.14, 0.1, 0.46, 0.03, P.oliveD, 0, 0.3, -0.98);
  k.box(0.19, 0.4, 0.06, P.black, 0, 0.06, -1.47);
  k.box(0.04, 0.6, 0.04, P.gun, 0.1, -0.16, 1.0, { rx: -0.35, rz: 0.25, m: 'metal' });
  k.box(0.04, 0.6, 0.04, P.gun, -0.1, -0.16, 1.0, { rx: -0.35, rz: -0.25, m: 'metal' });
  k.anchor('muzzle', 0, 0.2, 2.57);
}

function lmg(k) {
  k.rbox(0.26, 0.34, 1.1, 0.04, P.black, 0, 0.2, -0.05);
  k.rbox(0.24, 0.1, 0.6, 0.03, P.dark, 0, 0.41, 0.02);
  k.rbox(0.26, 0.2, 0.5, 0.05, P.black, 0, 0.12, 0.72);
  k.cyl(0.055, 1.3, P.dark, 0, 0.2, 1.3, { m: 'metal' });
  k.box(0.12, 0.05, 0.75, P.gun, 0, 0.29, 1.2, { m: 'metal' });
  k.cyl(0.075, 0.14, P.black, 0, 0.2, 1.98, { m: 'metal' });
  k.box(0.05, 0.2, 0.05, P.black, 0, 0.36, 1.75);
  k.box(0.05, 0.16, 0.05, P.black, 0, 0.5, 0.64);
  k.box(0.05, 0.05, 0.34, P.black, 0, 0.6, 0.76);
  k.rbox(0.32, 0.36, 0.42, 0.04, P.olive, -0.02, -0.22, 0.12);
  k.box(0.33, 0.05, 0.43, P.oliveD, -0.02, -0.08, 0.12);
  for (let i = 0; i < 5; i++) k.cyl(0.025, 0.14, P.brass, -0.2, -0.02 + i * 0.06, 0.1, { axis: 'x', m: 'metal' });
  k.rbox(0.16, 0.36, 0.2, 0.05, P.black, 0, -0.12, -0.4, { rx: 0.3 });
  k.rbox(0.2, 0.36, 0.7, 0.06, P.black, 0, 0.14, -0.95);
  k.box(0.035, 0.035, 0.55, P.gun, 0.07, 0.08, 1.4, { m: 'metal' });
  k.box(0.035, 0.035, 0.55, P.gun, -0.07, 0.08, 1.4, { m: 'metal' });
  k.anchor('muzzle', 0, 0.2, 2.05);
}

function grenadelauncher(k) {
  k.cyl(0.3, 0.56, P.olive, 0, 0.06, 0.16, { seg: 12 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + PI / 2;
    k.cyl(0.075, 0.02, P.black, Math.cos(a) * 0.18, 0.06 + Math.sin(a) * 0.18, 0.445);
    const b = a + PI / 6;
    k.box(0.05, 0.05, 0.5, P.oliveD, Math.cos(b) * 0.29, 0.06 + Math.sin(b) * 0.29, 0.16, { rz: b });
  }
  k.cyl(0.11, 0.78, P.dark, 0, 0.24, 0.8, { m: 'metal' });
  k.cyl(0.13, 0.08, P.orange, 0, 0.24, 1.17);
  k.box(0.12, 0.08, 1.35, P.black, 0, 0.42, 0.3);
  k.rbox(0.18, 0.18, 0.2, 0.03, P.black, 0, 0.56, 0.2);
  k.box(0.12, 0.1, 0.02, 0x6ff0ff, 0, 0.57, 0.305, { m: 'glow' });
  k.rbox(0.2, 0.62, 0.1, 0.03, P.black, 0, 0.1, -0.17);
  k.rbox(0.1, 0.36, 0.12, 0.04, P.black, 0, -0.08, 0.78, { rx: 0.1 });
  k.rbox(0.14, 0.36, 0.2, 0.05, P.black, 0, -0.18, -0.38, { rx: 0.3 });
  k.box(0.035, 0.035, 0.5, P.gun, 0.06, 0.12, -0.6, { m: 'metal' });
  k.box(0.035, 0.035, 0.5, P.gun, -0.06, 0.12, -0.6, { m: 'metal' });
  k.rbox(0.16, 0.32, 0.36, 0.05, P.black, 0, 0.08, -0.95);
  k.anchor('muzzle', 0, 0.24, 1.22);
}

function heavysniper(k) {
  k.rbox(0.26, 0.24, 1.6, 0.04, P.dark, 0, 0.3, 0.35);
  k.rbox(0.24, 0.26, 0.9, 0.04, P.gun, 0, 0.06, -0.1);
  k.box(0.265, 0.06, 1.0, P.orange, 0, 0.3, 0.1);
  k.cyl(0.07, 1.45, P.black, 0, 0.3, 1.8, { m: 'metal' });
  k.rbox(0.28, 0.22, 0.34, 0.03, P.dark, 0, 0.3, 2.62);
  k.box(0.29, 0.08, 0.06, P.black, 0, 0.3, 2.55);
  k.box(0.29, 0.08, 0.06, P.black, 0, 0.3, 2.68);
  k.cyl(0.1, 1.1, P.black, 0, 0.64, 0.25, { m: 'metal' });
  k.cyl(0.1, 0.3, P.black, 0, 0.64, 0.94, { r2: 0.16, m: 'metal' });
  k.cyl(0.12, 0.18, P.black, 0, 0.64, -0.38, { m: 'metal' });
  k.cyl(0.15, 0.01, P.glass, 0, 0.64, 1.095, { m: 'glow' });
  k.cyl(0.06, 0.14, P.dark, 0, 0.78, 0.25, { axis: 'y' });
  k.box(0.08, 0.2, 0.1, P.black, 0, 0.47, -0.05);
  k.box(0.08, 0.2, 0.1, P.black, 0, 0.47, 0.55);
  k.box(0.18, 0.32, 0.36, P.black, 0, -0.18, 0.2);
  k.rbox(0.16, 0.36, 0.22, 0.05, P.black, 0, -0.16, -0.4, { rx: 0.3 });
  k.rbox(0.2, 0.42, 0.7, 0.06, P.dark, 0, 0.06, -0.95);
  k.box(0.21, 0.46, 0.07, P.black, 0, 0.04, -1.32);
  k.box(0.05, 0.4, 0.05, P.gun, 0, -0.3, -1.1, { m: 'metal' });
  k.box(0.045, 0.7, 0.045, P.gun, 0.12, -0.1, 1.25, { rx: -0.35, rz: 0.3, m: 'metal' });
  k.box(0.045, 0.7, 0.045, P.gun, -0.12, -0.1, 1.25, { rx: -0.35, rz: -0.3, m: 'metal' });
  k.anchor('muzzle', 0, 0.3, 2.8);
}

// ------------------------------------------------------------------ LEGENDARY
function minigun(k) {
  k.rbox(0.56, 0.56, 0.72, 0.08, P.gun, 0, 0.2, -0.56, { m: 'metal' });
  k.box(0.58, 0.12, 0.3, P.dark, 0, 0.2, -0.56);
  k.cyl(0.31, 0.3, P.black, 0, 0.2, -0.06, { m: 'metal', seg: 16 });
  const s = k.sub('spin', 0, 0.2, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    s.cyl(0.058, 2.0, P.dark, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 1.05, { m: 'metal', seg: 10 });
  }
  s.cyl(0.07, 2.0, P.gun, 0, 0, 1.05, { m: 'metal' });
  s.cyl(0.25, 0.08, P.black, 0, 0, 0.45, { seg: 16 });
  s.cyl(0.25, 0.08, P.black, 0, 0, 1.3, { seg: 16 });
  s.cyl(0.24, 0.06, P.gun, 0, 0, 1.98, { m: 'metal', seg: 16 });
  k.cyl(0.045, 0.4, P.black, 0.2, 0.2, -1.05, { axis: 'y' });
  k.cyl(0.045, 0.4, P.black, -0.2, 0.2, -1.05, { axis: 'y' });
  k.box(0.44, 0.05, 0.05, P.black, 0, 0.4, -1.05);
  k.box(0.05, 0.05, 0.16, P.black, 0.2, 0.4, -0.97);
  k.box(0.05, 0.05, 0.16, P.black, -0.2, 0.4, -0.97);
  k.box(0.06, 0.18, 0.06, P.black, 0, 0.56, -0.7);
  k.box(0.06, 0.18, 0.06, P.black, 0, 0.56, -0.35);
  k.box(0.06, 0.06, 0.41, P.black, 0, 0.66, -0.52);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    k.box(0.12, 0.08, 0.12, P.brass, 0.34 + t * 0.26, 0.12 - t * 0.55, -0.45 + Math.sin(t * PI) * 0.12, { rz: -0.6 * t, m: 'metal' });
  }
  k.rbox(0.44, 0.46, 0.56, 0.05, P.olive, 0.62, -0.62, -0.42);
  k.box(0.45, 0.06, 0.57, P.oliveD, 0.62, -0.44, -0.42);
  k.anchor('muzzle', 0, 0.2, 2.06);
}

function bazooka(k) {
  k.cyl(0.2, 2.8, P.olive, 0, 0.26, 0.2, { seg: 18 });
  k.cyl(0.28, 0.34, P.oliveD, 0, 0.26, -1.34, { r2: 0.2, seg: 18 });
  k.cyl(0.235, 0.14, P.oliveD, 0, 0.26, 1.54, { seg: 18 });
  k.cyl(0.205, 0.12, P.yellow, 0, 0.26, 1.05, { seg: 18 });
  k.cyl(0.21, 0.06, P.oliveD, 0, 0.26, 0.55, { seg: 18 });
  k.cyl(0.21, 0.06, P.oliveD, 0, 0.26, -0.5, { seg: 18 });
  k.cyl(0.15, 0.16, P.gun, 0, 0.26, 1.66, { m: 'metal' });
  k.cone(0.15, 0.28, P.red, 0, 0.26, 1.88);
  k.rbox(0.12, 0.36, 0.16, 0.04, P.woodD, 0, -0.06, 0.28, { rx: 0.2 });
  k.rbox(0.12, 0.36, 0.16, 0.04, P.woodD, 0, -0.06, -0.3, { rx: 0.25 });
  k.rbox(0.14, 0.18, 0.44, 0.04, P.wood, 0, 0.03, -0.78);
  k.box(0.04, 0.22, 0.04, P.black, -0.22, 0.46, 0.85);
  k.box(0.03, 0.14, 0.14, P.black, -0.22, 0.6, 0.85);
  k.box(0.04, 0.16, 0.04, P.black, -0.22, 0.43, -0.2);
  k.anchor('muzzle', 0, 0.26, 1.72);
}

function rpg(k) {
  k.cyl(0.11, 2.3, P.gun, 0, 0.22, -0.05, { m: 'metal', seg: 16 });
  k.cyl(0.16, 0.72, P.wood, 0, 0.22, -0.1, { seg: 16 });
  k.cyl(0.24, 0.42, P.gun, 0, 0.22, -1.38, { r2: 0.11, m: 'metal', seg: 16 });
  k.cyl(0.07, 0.4, P.oliveD, 0, 0.22, 1.28);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    k.box(0.02, 0.14, 0.26, P.oliveD, Math.cos(a) * 0.1, 0.22 + Math.sin(a) * 0.1, 1.3, { rz: a + PI / 2 });
  }
  k.cyl(0.1, 0.3, P.olive, 0, 0.22, 1.63, { r2: 0.26, seg: 16 });
  k.cyl(0.26, 0.22, P.olive, 0, 0.22, 1.89, { seg: 16 });
  k.cone(0.26, 0.5, P.olive, 0, 0.22, 2.25, { seg: 16 });
  k.sph(0.05, P.gun, 0, 0.22, 2.5);
  k.rbox(0.12, 0.34, 0.16, 0.04, P.black, 0, -0.06, 0.4, { rx: 0.15 });
  k.rbox(0.12, 0.34, 0.16, 0.04, P.black, 0, -0.06, -0.62, { rx: 0.25 });
  k.rbox(0.1, 0.16, 0.32, 0.03, P.black, -0.18, 0.34, 0.25);
  k.cyl(0.05, 0.01, P.glass, -0.18, 0.36, 0.415, { m: 'glow' });
  k.anchor('muzzle', 0, 0.22, 1.5);
}

function flamethrower(k) {
  k.rbox(0.26, 0.3, 0.95, 0.05, P.gun, 0, 0.16, -0.05, { m: 'metal' });
  k.cyl(0.13, 0.75, P.black, 0, 0.19, 0.78, { seg: 14 });
  for (let i = 0; i < 5; i++) k.cyl(0.135, 0.03, P.gun, 0, 0.19, 0.48 + i * 0.15, { m: 'metal', seg: 14 });
  k.cyl(0.07, 0.4, P.dark, 0, 0.19, 1.3, { m: 'metal' });
  k.cyl(0.1, 0.16, P.brass, 0, 0.19, 1.56, { r2: 0.065, m: 'metal' });
  k.cyl(0.025, 0.25, P.dark, 0, 0.08, 1.48);
  k.sph(0.055, 0x6fc8ff, 0, 0.08, 1.62, { m: 'glow' });
  k.cyl(0.21, 0.82, P.red, 0, -0.26, -0.2, { seg: 16 });
  k.sph(0.21, P.red, 0, -0.26, 0.21, { sz: 0.5 });
  k.sph(0.21, P.red, 0, -0.26, -0.61, { sz: 0.5 });
  k.cyl(0.215, 0.08, P.yellow, 0, -0.26, -0.35, { seg: 16 });
  k.cyl(0.215, 0.08, P.black, 0, -0.26, -0.25, { seg: 16 });
  k.cyl(0.215, 0.08, P.yellow, 0, -0.26, -0.15, { seg: 16 });
  k.cyl(0.04, 0.14, P.silver, 0, -0.02, -0.4, { axis: 'y', m: 'metal' });
  k.rbox(0.12, 0.34, 0.16, 0.04, P.black, 0, -0.1, 0.62, { rx: 0.1 });
  k.rbox(0.14, 0.36, 0.2, 0.05, P.black, 0, -0.02, -0.74, { rx: 0.3 });
  k.anchor('muzzle', 0, 0.19, 1.66);
}

// ------------------------------------------------------------------ MYTHIC
function tesla(k) {
  k.rbox(0.38, 0.42, 1.0, 0.1, P.dark, 0, 0.2, -0.35, { m: 'metal' });
  k.box(0.39, 0.08, 0.8, P.brass, 0, 0.3, -0.35, { m: 'metal' });
  k.cyl(0.07, 1.35, P.cyan, 0, 0.22, 0.8, { m: 'glow' });
  for (let i = 0; i < 6; i++) k.tor(0.17, 0.045, P.copper, 0, 0.22, 0.25 + i * 0.2, { m: 'metal', seg: 18 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    k.box(0.035, 0.035, 1.2, P.brass, Math.cos(a) * 0.17, 0.22 + Math.sin(a) * 0.17, 0.75, { m: 'metal' });
  }
  k.sph(0.2, P.cyan, 0, 0.22, 1.58, { m: 'glow' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    k.box(0.05, 0.05, 0.42, P.brass, Math.cos(a) * 0.26, 0.22 + Math.sin(a) * 0.26, 1.5, { m: 'metal' });
    k.sph(0.05, P.cyan, Math.cos(a) * 0.26, 0.22 + Math.sin(a) * 0.26, 1.72, { m: 'glow' });
  }
  k.cyl(0.1, 0.5, P.gun, 0.26, 0.2, -0.4, { m: 'metal' });
  k.box(0.02, 0.1, 0.3, P.cyan, 0.36, 0.2, -0.4, { m: 'glow' });
  k.cyl(0.1, 0.5, P.gun, -0.26, 0.2, -0.4, { m: 'metal' });
  k.box(0.02, 0.1, 0.3, P.cyan, -0.36, 0.2, -0.4, { m: 'glow' });
  k.rbox(0.14, 0.36, 0.2, 0.05, P.black, 0, -0.14, -0.55, { rx: 0.3 });
  k.rbox(0.18, 0.36, 0.5, 0.06, P.dark, 0, 0.14, -1.1);
  k.anchor('muzzle', 0, 0.22, 1.6);
}

function plasmagun(k) {
  const body = 0x3b2a5e;
  const bodyL = 0x5d44a0;
  k.rbox(0.6, 0.58, 0.78, 0.12, body, 0, 0.2, -0.6, { m: 'metal' });
  k.box(0.62, 0.1, 0.5, P.violet, 0, 0.2, -0.6, { m: 'glow' });
  k.cyl(0.33, 0.3, bodyL, 0, 0.2, -0.08, { m: 'metal', seg: 16 });
  const s = k.sub('spin', 0, 0.2, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    s.cyl(0.06, 1.9, P.dark, Math.cos(a) * 0.17, Math.sin(a) * 0.17, 1.0, { m: 'metal', seg: 10 });
    s.box(0.035, 0.035, 1.7, 0xe07bff, Math.cos(a) * 0.235, Math.sin(a) * 0.235, 1.0, { m: 'glow', rz: a });
  }
  s.cyl(0.08, 1.9, P.violet, 0, 0, 1.0, { m: 'glow' });
  s.cyl(0.27, 0.1, bodyL, 0, 0, 0.4, { m: 'metal', seg: 16 });
  s.cyl(0.27, 0.1, bodyL, 0, 0, 1.25, { m: 'metal', seg: 16 });
  s.cyl(0.26, 0.08, P.violet, 0, 0, 1.92, { m: 'glow', seg: 16 });
  k.cyl(0.14, 0.5, P.dark, 0, 0.62, -0.6, { m: 'metal' });
  k.box(0.02, 0.12, 0.4, 0xff4df0, 0.145, 0.62, -0.6, { m: 'glow' });
  k.box(0.02, 0.12, 0.4, 0xff4df0, -0.145, 0.62, -0.6, { m: 'glow' });
  k.cyl(0.05, 0.42, P.black, 0.22, 0.2, -1.12, { axis: 'y' });
  k.cyl(0.05, 0.42, P.black, -0.22, 0.2, -1.12, { axis: 'y' });
  k.box(0.49, 0.05, 0.05, P.black, 0, 0.42, -1.12);
  k.anchor('muzzle', 0, 0.2, 1.98);
}

function railgun(k) {
  const white = 0xdfe6ee;
  k.rbox(0.48, 0.46, 1.1, 0.1, white, 0, 0.2, -0.4);
  k.box(0.49, 0.06, 0.9, P.cyan, 0, 0.12, -0.4, { m: 'glow' });
  k.box(0.07, 0.26, 2.4, P.dark, 0.15, 0.26, 0.95, { m: 'metal' });
  k.box(0.07, 0.26, 2.4, P.dark, -0.15, 0.26, 0.95, { m: 'metal' });
  k.box(0.08, 0.1, 2.3, P.cyan, 0, 0.26, 0.98, { m: 'glow' });
  for (let i = 0; i < 4; i++) k.tor(0.27, 0.045, P.gun, 0, 0.26, 0.3 + i * 0.55, { m: 'metal', seg: 20 });
  k.box(0.1, 0.3, 0.1, P.cyan, 0.15, 0.26, 2.17, { m: 'glow' });
  k.box(0.1, 0.3, 0.1, P.cyan, -0.15, 0.26, 2.17, { m: 'glow' });
  k.rbox(0.2, 0.18, 0.4, 0.04, P.dark, 0, 0.53, -0.35);
  k.box(0.16, 0.12, 0.02, P.cyan, 0, 0.54, -0.145, { m: 'glow' });
  k.rbox(0.15, 0.36, 0.2, 0.05, P.dark, 0, -0.14, -0.55, { rx: 0.3 });
  k.rbox(0.22, 0.4, 0.55, 0.08, white, 0, 0.14, -1.2);
  k.box(0.23, 0.05, 0.4, P.cyan, 0, 0.26, -1.2, { m: 'glow' });
  k.anchor('muzzle', 0, 0.26, 2.2);
}

// ------------------------------------------------------------------ SECRET
function nuke(k) {
  const tube = 0x3d4a2f;
  k.cyl(0.34, 2.5, tube, 0, 0.32, 0.0, { seg: 20 });
  k.cyl(0.42, 0.4, P.oliveD, 0, 0.32, -1.4, { r2: 0.34, seg: 20 });
  for (let i = 0; i < 6; i++) k.cyl(0.345, 0.12, i % 2 ? P.black : P.yellow, 0, 0.32, -0.8 + i * 0.12, { seg: 20 });
  k.cyl(0.37, 0.12, P.oliveD, 0, 0.32, 1.2, { seg: 20 });
  k.sph(0.3, 0x9aa3ad, 0, 0.32, 1.52, { sz: 1.35, m: 'metal' });
  k.cyl(0.305, 0.1, P.yellow, 0, 0.32, 1.5, { seg: 20 });
  k.sph(0.08, P.red, 0, 0.32, 1.92);
  k.box(0.14, 0.12, 1.6, P.black, 0, -0.08, 0.0);
  k.rbox(0.14, 0.4, 0.2, 0.05, P.black, 0, -0.3, 0.45, { rx: 0.15 });
  k.rbox(0.14, 0.4, 0.2, 0.05, P.black, 0, -0.3, -0.35, { rx: 0.25 });
  k.rbox(0.24, 0.26, 0.4, 0.05, P.black, -0.36, 0.5, 0.2);
  k.box(0.18, 0.16, 0.02, P.lime, -0.36, 0.52, 0.405, { m: 'glow' });
  k.sph(0.06, P.lime, 0.12, 0.67, -0.3, { m: 'glow' });
  k.sph(0.06, P.red, -0.02, 0.67, -0.3, { m: 'glow' });
  k.cyl(0.14, 0.02, P.yellow, 0.345, 0.32, 0.4, { axis: 'x' });
  k.cyl(0.04, 0.03, P.black, 0.35, 0.32, 0.4, { axis: 'x' });
  k.anchor('muzzle', 0, 0.32, 1.9);
}

function blackhole(k) {
  const body = 0x1c1233;
  const bodyL = 0x35245e;
  k.rbox(0.36, 0.38, 1.2, 0.12, body, 0, 0.2, -0.35, { m: 'metal' });
  k.box(0.37, 0.05, 1.0, P.violet, 0, 0.3, -0.35, { m: 'glow' });
  k.box(0.37, 0.05, 1.0, P.violet, 0, 0.1, -0.35, { m: 'glow' });
  k.cyl(0.2, 0.3, bodyL, 0, 0.22, 0.32, { r2: 0.28, m: 'metal' });
  k.sph(0.3, 0x05010c, 0, 0.22, 0.78, { seg: 18, segH: 12 });
  k.tor(0.44, 0.045, 0xc58bff, 0, 0.22, 0.78, { m: 'glow', rx: 1.1, seg: 28 });
  k.tor(0.38, 0.03, 0xff7bf3, 0, 0.22, 0.78, { m: 'glow', rx: -0.6, ry: 0.5, seg: 28 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 + PI / 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    k.box(0.09, 0.09, 0.7, bodyL, cx * 0.42, 0.22 + cy * 0.42, 0.78, { m: 'metal', rx: cy * 0.25, ry: -cx * 0.25 });
    k.sph(0.06, P.violet, cx * 0.34, 0.22 + cy * 0.34, 1.12, { m: 'glow' });
  }
  k.rbox(0.14, 0.36, 0.2, 0.05, P.black, 0, -0.14, -0.55, { rx: 0.3 });
  k.rbox(0.2, 0.36, 0.5, 0.08, body, 0, 0.14, -1.15, { m: 'metal' });
  k.anchor('muzzle', 0, 0.22, 1.15);
}

function unicorn(k) {
  const rb = [0xff4d4d, 0xff9f1a, 0xffe14d, 0x5ee65e, 0x4db8ff, 0xa66bff];
  k.rbox(0.4, 0.42, 0.95, 0.16, P.white, 0, 0.22, -0.2);
  k.rbox(0.32, 0.3, 0.42, 0.12, P.white, 0, 0.14, 0.42);
  k.sph(0.035, 0xd65c98, 0.08, 0.14, 0.63);
  k.sph(0.035, 0xd65c98, -0.08, 0.14, 0.63);
  k.box(0.02, 0.12, 0.1, P.black, 0.205, 0.3, 0.12);
  k.box(0.02, 0.12, 0.1, P.black, -0.205, 0.3, 0.12);
  k.box(0.024, 0.04, 0.04, P.white, 0.208, 0.33, 0.14);
  k.box(0.024, 0.04, 0.04, P.white, -0.208, 0.33, 0.14);
  k.box(0.02, 0.06, 0.1, 0xff9ccd, 0.205, 0.18, 0.22);
  k.box(0.02, 0.06, 0.1, 0xff9ccd, -0.205, 0.18, 0.22);
  k.cone(0.07, 0.16, P.white, 0.12, 0.5, -0.05, { axis: 'y' });
  k.cone(0.07, 0.16, P.white, -0.12, 0.5, -0.05, { axis: 'y' });
  // horn = the barrel
  const hx = 0;
  const hy = 0.42;
  const hz = 0.36;
  const tilt = 0.35;
  const dy = Math.sin(tilt);
  const dz = Math.cos(tilt);
  k.cone(0.09, 0.8, 0xffe26a, hx, hy + dy * 0.4, hz + dz * 0.4, { rx: -tilt, m: 'metal' });
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const d = 0.8 * t * 0.85;
    k.tor(0.09 * (1 - t) + 0.012, 0.016, P.pink, hx, hy + dy * d, hz + dz * d, { rx: -tilt, seg: 14 });
  }
  for (let i = 0; i < 6; i++) k.rbox(0.14, 0.16, 0.18, 0.05, rb[i], 0, 0.46 - i * 0.015, 0.1 - i * 0.15);
  for (let i = 0; i < 6; i++) k.box(0.16, 0.06, 0.5, rb[i], 0, 0.36 - i * 0.06, -0.92);
  k.rbox(0.15, 0.36, 0.2, 0.06, P.pink, 0, -0.12, -0.35, { rx: 0.3 });
  k.anchor('muzzle', hx, hy + dy * 0.8, hz + dz * 0.8);
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
