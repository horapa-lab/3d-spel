// Chibi "idle mobile game" characters: big heads, big cartoon eyes, soft
// rounded bodies. Enemies are split into parts for instanced animation.
//
// Humanoid part pivots (model space, scale 1):
//   leg   - hip, hangs down        torso - hip (bottom center)
//   arm   - shoulder, hangs down   head  - neck (bottom center)

import * as THREE from 'three';
import { Kit } from './kit.js';

export const HUMANOID = {
  hipY: 0.62,
  legX: 0.21,
  shoulderY: 1.22,
  armX: 0.5,
  neckY: 1.3,
};

const INK = 0x1c1826;
const WHITE = 0xffffff;

// ------------------------------------------------------------------ helpers
/** Big cartoon eyes on a face at depth z (front of the head). */
function eyes(k, { y, z, spread = 0.2, size = 0.14, white = WHITE, pupil = INK, look = 0, uneven = 0, glow = false }) {
  for (const sx of [-1, 1]) {
    const s = size * (sx < 0 ? 1 + uneven : 1 - uneven * 0.5);
    k.sph(s, white, sx * spread, y, z, { sz: 0.5, seg: 14, segH: 10, m: glow ? 'glow' : 'solid' });
    k.sph(s * 0.5, pupil, sx * spread + look * s * 0.35, y - s * 0.08, z + s * 0.3, { sz: 0.5, seg: 12, segH: 8 });
    if (!glow) k.sph(s * 0.17, WHITE, sx * spread + s * 0.2 + look * s * 0.3, y + s * 0.22, z + s * 0.45, { sz: 0.5, seg: 8, segH: 6, m: 'glow' });
  }
}

function brow(k, y, z, color, angle = 0.25, spread = 0.2, w = 0.22) {
  k.rbox(w, 0.07, 0.07, 0.03, color, -spread, y, z, { rz: -angle });
  k.rbox(w, 0.07, 0.07, 0.03, color, spread, y, z, { rz: angle });
}

/** Standard chibi limbs. */
function limbs(arm, leg, { skin, sleeve = null, pants, shoe, armR = 0.13, legR = 0.15, hand = null, bare = false }) {
  // arm: pivot at shoulder, hangs down ~0.62
  if (sleeve !== null) arm.rbox(0.34, 0.26, 0.34, 0.12, sleeve, 0, -0.1, 0);
  arm.cap(armR, 0.3, skin, 0, -0.34, 0);
  arm.sph(hand ? 0.17 : armR * 1.25, hand || skin, 0, -0.6, 0.02);
  // leg: pivot at hip
  leg.cap(legR, 0.26, pants, 0, -0.26, 0);
  if (bare) leg.sph(legR * 1.2, shoe, 0, -0.52, 0.06, { sy: 0.6, sz: 1.3 });
  else leg.rbox(legR * 2.4, 0.16, 0.44, 0.08, shoe, 0, -0.54, 0.06);
}

function crown(k, y, color = 0xffc62e, gem = 0xff2e55, r = 0.44) {
  k.cyl(r, 0.22, color, 0, y, 0, { axis: 'y', seg: 10, m: 'metal' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.cone(0.1, 0.26, color, Math.cos(a) * r * 0.86, y + 0.23, Math.sin(a) * r * 0.86, { axis: 'y', m: 'metal' });
    k.sph(0.05, i % 2 ? 0x4de8ff : gem, Math.cos(a) * r, y, Math.sin(a) * r, { m: 'glow' });
  }
}

function spikedPads(k, y, color = 0x5a4632, spike = 0xe6e6e6, x = 0.5, size = 1) {
  for (const sx of [-1, 1]) {
    k.rbox(0.42 * size, 0.24 * size, 0.56 * size, 0.1 * size, color, sx * x, y, 0);
    for (const dz of [-0.14, 0.14]) k.cone(0.07 * size, 0.24 * size, spike, sx * (x + 0.08), y + 0.2 * size, dz * size, { axis: 'y', rz: -sx * 0.35 });
  }
}

// ------------------------------------------------------------------ enemies
function zombieParts(boss = false, runner = false) {
  const skin = runner ? 0xa6dc5e : 0x8fd45a;
  const skinD = runner ? 0x7fb843 : 0x6fb33f;
  const shirt = runner ? 0xff9b3d : 0xf2668b;
  const pants = runner ? 0x5a4a3a : 0x3f5690;
  const head = new Kit();
  head.rbox(0.94, 0.86, 0.86, 0.3, skin, 0, 0.44, 0, { seg: 3 });
  head.rbox(0.36, 0.14, 0.5, 0.07, skinD, 0.16, 0.86, -0.05); // scalp patch
  if (runner) {
    head.rbox(0.9, 0.2, 0.7, 0.1, 0x4a3426, 0, 0.84, -0.08); // messy hair
    head.rbox(0.3, 0.16, 0.2, 0.07, 0x4a3426, -0.25, 0.9, 0.2, { rz: 0.4 });
  }
  eyes(head, { y: 0.52, z: 0.4, spread: 0.21, size: 0.16, uneven: 0.18, look: 0.4 });
  head.rbox(0.42, 0.14, 0.08, 0.06, 0x5a1020, 0, 0.2, 0.42); // mouth
  head.rbox(0.08, 0.08, 0.06, 0.02, WHITE, -0.1, 0.25, 0.46);
  head.rbox(0.08, 0.08, 0.06, 0.02, WHITE, 0.08, 0.24, 0.46);
  head.box(0.03, 0.2, 0.03, INK, -0.3, 0.68, 0.43, { rz: 0.4 }); // stitches
  head.box(0.12, 0.03, 0.03, INK, -0.3, 0.68, 0.44);
  head.sph(0.1, skin, -0.49, 0.45, 0, { sx: 0.5 }); // ears
  head.sph(0.1, skin, 0.49, 0.45, 0, { sx: 0.5 });
  if (boss) crown(head, 0.98);

  const torso = new Kit();
  torso.rbox(0.8, 0.7, 0.52, 0.2, shirt, 0, 0.42, 0, { seg: 3 });
  torso.rbox(0.3, 0.26, 0.06, 0.08, skin, 0.14, 0.34, 0.25); // belly through the rip
  torso.rbox(0.2, 0.16, 0.06, 0.05, shirt, -0.28, 0.08, 0.24, { rz: 0.3 }); // ragged hem
  torso.rbox(0.18, 0.14, 0.06, 0.05, shirt, 0.3, 0.1, 0.24, { rz: -0.4 });
  torso.rbox(0.82, 0.18, 0.54, 0.08, pants, 0, 0.06, 0);
  if (boss) spikedPads(torso, 0.72, 0x5a4632, 0xe6e6e6, 0.48);

  const arm = new Kit();
  const leg = new Kit();
  limbs(arm, leg, { skin, sleeve: shirt, pants, shoe: 0x2e2a36 });
  return { rig: 'humanoid', head, torso, arm, leg };
}

function skeletonParts() {
  const bone = 0xf3efe2;
  const boneD = 0xd9d2bd;
  const head = new Kit();
  head.rbox(0.86, 0.78, 0.82, 0.32, bone, 0, 0.5, 0, { seg: 3 });
  head.rbox(0.6, 0.2, 0.56, 0.08, bone, 0, 0.12, 0.08); // jaw
  for (const sx of [-1, 1]) {
    head.sph(0.17, 0x241a2e, sx * 0.2, 0.52, 0.36, { sz: 0.5 });
    head.sph(0.06, 0xff3b4d, sx * 0.2, 0.52, 0.42, { m: 'glow' });
  }
  head.cone(0.07, 0.12, 0x241a2e, 0, 0.34, 0.41, { axis: 'y', rx: Math.PI });
  for (let i = -2; i <= 2; i++) head.box(0.07, 0.09, 0.04, WHITE, i * 0.09, 0.24, 0.41);
  head.box(0.44, 0.02, 0.03, 0x241a2e, 0, 0.2, 0.42);
  const torso = new Kit();
  torso.cyl(0.07, 0.72, boneD, 0, 0.38, -0.08, { axis: 'y' });
  for (let i = 0; i < 3; i++) torso.rbox(0.66 - i * 0.08, 0.1, 0.46, 0.05, bone, 0, 0.36 + i * 0.16, 0);
  torso.rbox(0.52, 0.18, 0.4, 0.08, bone, 0, 0.06, 0); // pelvis
  torso.rbox(0.5, 0.22, 0.44, 0.08, 0x6a3fa0, 0, 0.12, 0.02); // purple rag
  const arm = new Kit();
  arm.sph(0.1, bone, 0, -0.04, 0);
  arm.cyl(0.065, 0.5, bone, 0, -0.3, 0, { axis: 'y' });
  arm.sph(0.12, bone, 0, -0.6, 0.02, { sy: 0.8 });
  const leg = new Kit();
  leg.cyl(0.075, 0.44, bone, 0, -0.24, 0, { axis: 'y' });
  leg.rbox(0.22, 0.12, 0.34, 0.05, bone, 0, -0.52, 0.06);
  return { rig: 'humanoid', head, torso, arm, leg };
}

function mummyParts() {
  const wrap = 0xeae0c4;
  const wrapD = 0xcdbf98;
  const head = new Kit();
  head.rbox(0.88, 0.86, 0.84, 0.3, wrap, 0, 0.44, 0, { seg: 3 });
  for (let i = 0; i < 5; i++) head.rbox(0.9, 0.07, 0.86, 0.03, wrapD, 0, 0.14 + i * 0.16, 0, { rz: (i % 2 ? 0.12 : -0.1) });
  head.sph(0.12, 0x7dff5a, 0.18, 0.5, 0.4, { sz: 0.5, m: 'glow' }); // one glowing eye
  head.rbox(0.28, 0.07, 0.05, 0.02, 0x3a2e24, -0.18, 0.5, 0.42); // closed eye slit
  head.rbox(0.3, 0.1, 0.05, 0.04, 0x3a2e24, 0, 0.24, 0.42);
  const torso = new Kit();
  torso.rbox(0.8, 0.72, 0.52, 0.2, wrap, 0, 0.42, 0, { seg: 3 });
  for (let i = 0; i < 4; i++) torso.rbox(0.82, 0.06, 0.54, 0.03, wrapD, 0, 0.14 + i * 0.18, 0, { rz: i % 2 ? 0.2 : -0.18 });
  torso.rbox(0.1, 0.4, 0.04, 0.03, wrap, 0.3, 0.02, 0.26, { rz: 0.3 }); // dangling bandage
  const arm = new Kit();
  arm.cap(0.14, 0.34, wrap, 0, -0.32, 0);
  for (let i = 0; i < 3; i++) arm.tor(0.145, 0.025, wrapD, 0, -0.18 - i * 0.16, 0, { axis: 'y', rx: 0.3 });
  arm.sph(0.16, wrap, 0, -0.6, 0.02);
  const leg = new Kit();
  leg.cap(0.16, 0.26, wrap, 0, -0.26, 0);
  leg.tor(0.16, 0.03, wrapD, 0, -0.2, 0, { axis: 'y', rx: -0.3 });
  leg.rbox(0.36, 0.14, 0.42, 0.07, wrapD, 0, -0.54, 0.05);
  return { rig: 'humanoid', head, torso, arm, leg };
}

function goblinParts() {
  const skin = 0xb5dc4a;
  const head = new Kit();
  head.rbox(0.9, 0.76, 0.8, 0.3, skin, 0, 0.4, 0, { seg: 3 });
  for (const sx of [-1, 1]) head.cone(0.14, 0.5, skin, sx * 0.62, 0.52, -0.02, { axis: 'x', rz: sx > 0 ? -0.35 : Math.PI + 0.35 });
  eyes(head, { y: 0.5, z: 0.36, spread: 0.2, size: 0.15, white: 0xfff27a, pupil: INK });
  head.cone(0.1, 0.3, 0x9cc43a, 0, 0.36, 0.5, { rx: 0.25 }); // long nose
  head.rbox(0.5, 0.1, 0.06, 0.04, 0x4a1a1a, 0, 0.16, 0.39); // grin
  for (const dx of [-0.14, 0.14]) head.cone(0.04, 0.09, WHITE, dx, 0.2, 0.42, { axis: 'y' });
  head.cone(0.3, 0.4, 0x7a4a2a, 0, 0.9, -0.05, { axis: 'y', seg: 8 }); // leather hood tip
  const torso = new Kit();
  torso.rbox(0.74, 0.66, 0.5, 0.2, 0x8a5a32, 0, 0.4, 0, { seg: 3 });
  torso.rbox(0.76, 0.12, 0.52, 0.05, 0x4a3020, 0, 0.14, 0);
  torso.rbox(0.18, 0.18, 0.12, 0.05, 0xd8ad45, 0.22, 0.14, 0.27, { m: 'metal' });
  const arm = new Kit();
  const leg = new Kit();
  limbs(arm, leg, { skin, sleeve: null, pants: 0x6a4a2a, shoe: skin, armR: 0.11, legR: 0.13, bare: true });
  return { rig: 'humanoid', head, torso, arm, leg };
}

function orcParts(boss = false) {
  const skin = 0x5f9a3c;
  const skinD = 0x4a7a2c;
  const metal = 0x8a94a3;
  const head = new Kit();
  head.rbox(0.9, 0.72, 0.8, 0.28, skin, 0, 0.42, 0, { seg: 3 });
  head.rbox(0.98, 0.34, 0.84, 0.14, skinD, 0, 0.18, 0.04); // big jaw
  brow(head, 0.62, 0.38, 0x2e4a1c, 0.3, 0.2, 0.28);
  eyes(head, { y: 0.52, z: 0.37, spread: 0.2, size: 0.1, white: 0xffe36b, pupil: 0x8a1010 });
  for (const sx of [-1, 1]) head.cone(0.06, 0.2, 0xfff6dc, sx * 0.24, 0.42, 0.44, { axis: 'y' }); // tusks
  if (boss) {
    head.rbox(1.0, 0.36, 0.9, 0.12, metal, 0, 0.84, -0.02, { m: 'metal' }); // war helmet
    for (const sx of [-1, 1]) head.cone(0.1, 0.5, 0xfff6dc, sx * 0.5, 1.02, 0, { axis: 'y', rz: -sx * 0.6 });
  } else head.cone(0.14, 0.34, 0x1c1c1c, 0, 0.9, -0.2, { axis: 'y', rx: -0.4 }); // top knot
  const torso = new Kit();
  torso.rbox(1.0, 0.78, 0.62, 0.22, skin, 0, 0.44, 0, { seg: 3 });
  torso.rbox(0.8, 0.5, 0.1, 0.1, metal, 0, 0.5, 0.3, { m: 'metal' });
  torso.rbox(0.18, 0.18, 0.06, 0.05, 0xe53935, 0, 0.52, 0.36);
  torso.rbox(1.02, 0.16, 0.64, 0.06, 0x5a3a22, 0, 0.1, 0);
  spikedPads(torso, 0.8, metal, 0xfff6dc, 0.56, 1.1);
  const arm = new Kit();
  arm.cap(0.19, 0.28, skin, 0, -0.32, 0);
  arm.rbox(0.44, 0.18, 0.44, 0.08, 0x5a3a22, 0, -0.44, 0);
  arm.sph(0.23, skin, 0, -0.66, 0.02);
  const leg = new Kit();
  leg.cap(0.19, 0.22, 0x5a3a22, 0, -0.24, 0);
  leg.rbox(0.46, 0.18, 0.5, 0.08, 0x3a2a1c, 0, -0.54, 0.05);
  return { rig: 'humanoid', head, torso, arm, leg };
}

function yetiParts(boss = false) {
  const fur = 0xf4f8ff;
  const face = 0x7fb2e6;
  const head = new Kit();
  head.rbox(1.0, 0.9, 0.9, 0.4, fur, 0, 0.46, 0, { seg: 3 });
  head.rbox(0.62, 0.5, 0.2, 0.18, face, 0, 0.4, 0.38);
  eyes(head, { y: 0.52, z: 0.48, spread: 0.15, size: 0.1 });
  head.rbox(0.34, 0.12, 0.06, 0.05, 0x243a5a, 0, 0.26, 0.49);
  for (const sx of [-1, 1]) head.cone(0.04, 0.1, WHITE, sx * 0.1, 0.24, 0.51, { axis: 'y', rx: Math.PI });
  for (const sx of [-1, 1]) head.cone(0.08, 0.3, 0xdde8f5, sx * 0.4, 0.94, 0, { axis: 'y', rz: -sx * 0.5 });
  if (boss) crown(head, 1.0, 0x9fe8ff, 0x4de8ff, 0.46);
  const torso = new Kit();
  torso.rbox(0.98, 0.8, 0.64, 0.3, fur, 0, 0.44, 0, { seg: 3 });
  for (let i = 0; i < 5; i++) torso.sph(0.16, 0xe6eef8, -0.36 + i * 0.18, 0.1, 0.28);
  torso.rbox(0.5, 0.4, 0.1, 0.15, face, 0, 0.46, 0.3);
  const arm = new Kit();
  arm.cap(0.2, 0.28, fur, 0, -0.32, 0);
  arm.sph(0.2, face, 0, -0.66, 0.02);
  const leg = new Kit();
  leg.cap(0.2, 0.2, fur, 0, -0.24, 0);
  leg.sph(0.22, face, 0, -0.52, 0.06, { sy: 0.6, sz: 1.3 });
  return { rig: 'humanoid', head, torso, arm, leg };
}

function impParts(boss = false) {
  const skin = 0xf0503e;
  const skinD = 0xc23a2c;
  const head = new Kit();
  head.rbox(0.86, 0.8, 0.8, 0.3, skin, 0, 0.42, 0, { seg: 3 });
  for (const sx of [-1, 1]) {
    head.cone(0.1, boss ? 0.6 : 0.36, 0xfff1c9, sx * 0.28, 0.92, 0, { axis: 'y', rz: -sx * 0.45 });
    head.cone(0.1, 0.3, skin, sx * 0.52, 0.52, -0.04, { axis: 'x', rz: sx > 0 ? -0.3 : Math.PI + 0.3 });
  }
  eyes(head, { y: 0.52, z: 0.36, spread: 0.19, size: 0.14, white: 0xffe14d, pupil: INK });
  brow(head, 0.68, 0.38, skinD, -0.35, 0.19, 0.22);
  head.rbox(0.46, 0.1, 0.06, 0.04, 0x3a0a0a, 0, 0.2, 0.39);
  if (boss) crown(head, 1.02, 0xff9a1a, 0xffe14d, 0.42);
  const torso = new Kit();
  torso.rbox(0.74, 0.68, 0.5, 0.22, skin, 0, 0.42, 0, { seg: 3 });
  torso.rbox(0.76, 0.16, 0.52, 0.06, 0x2a1a1a, 0, 0.08, 0);
  for (const sx of [-1, 1]) {
    // bat wings
    torso.rbox(0.62, 0.42, 0.05, 0.1, 0x7a1a24, sx * 0.48, 0.7, -0.32, { rz: -sx * 0.5, ry: sx * 0.4 });
    torso.cone(0.06, 0.26, 0x2a1a1a, sx * 0.72, 0.98, -0.36, { axis: 'y', rz: -sx * 0.6 });
  }
  torso.cone(0.08, 0.5, skinD, 0, 0.2, -0.46, { rx: -2.2 }); // tail
  const arm = new Kit();
  const leg = new Kit();
  limbs(arm, leg, { skin, pants: 0x2a1a1a, shoe: 0x1a1216, armR: 0.12, legR: 0.14, bare: true });
  return { rig: 'humanoid', head, torso, arm, leg };
}

function robotParts(boss = false) {
  const silver = 0xc8d2de;
  const blue = boss ? 0xd8453a : 0x4f86d9;
  const dark = 0x2a3440;
  const head = new Kit();
  head.rbox(0.9, 0.74, 0.8, 0.16, silver, 0, 0.4, 0, { m: 'metal', seg: 3 });
  head.rbox(0.74, 0.3, 0.1, 0.1, dark, 0, 0.46, 0.38);
  for (const sx of [-1, 1]) head.rbox(0.18, 0.1, 0.05, 0.04, boss ? 0xff3344 : 0x4de8ff, sx * 0.17, 0.47, 0.44, { m: 'glow' });
  for (const sx of [-1, 1]) head.cyl(0.1, 0.12, blue, sx * 0.47, 0.42, 0, { axis: 'x' });
  head.cyl(0.03, 0.3, silver, 0, 0.9, 0, { axis: 'y', m: 'metal' });
  head.sph(0.08, 0xff3344, 0, 1.06, 0, { m: 'glow' });
  if (boss) crown(head, 0.9, 0xffc62e, 0xff3344, 0.42);
  const torso = new Kit();
  torso.rbox(0.86, 0.74, 0.56, 0.12, blue, 0, 0.44, 0, { seg: 3 });
  torso.rbox(0.5, 0.3, 0.06, 0.06, dark, 0, 0.5, 0.29);
  for (let i = 0; i < 3; i++) torso.sph(0.045, [0xff3344, 0xffe14d, 0x52e052][i], -0.14 + i * 0.14, 0.52, 0.33, { m: 'glow' });
  torso.rbox(0.7, 0.16, 0.5, 0.06, silver, 0, 0.1, 0, { m: 'metal' });
  if (boss) spikedPads(torso, 0.8, silver, 0xffc62e, 0.5);
  const arm = new Kit();
  arm.sph(0.14, silver, 0, -0.04, 0, { m: 'metal' });
  arm.cyl(0.1, 0.44, silver, 0, -0.3, 0, { axis: 'y', m: 'metal' });
  arm.rbox(0.26, 0.2, 0.22, 0.06, dark, 0, -0.6, 0.02);
  const leg = new Kit();
  leg.cyl(0.12, 0.4, silver, 0, -0.22, 0, { axis: 'y', m: 'metal' });
  leg.rbox(0.34, 0.16, 0.44, 0.06, dark, 0, -0.52, 0.06);
  return { rig: 'humanoid', head, torso, arm, leg };
}

function slimeParts(boss = false) {
  const body = new Kit();
  const col = 0x6fe06f;
  body.sph(0.72, col, 0, 0.62, 0, { sy: 0.86, seg: 22, segH: 16 });
  body.sph(0.62, 0x9cf59c, 0, 0.66, 0.04, { sy: 0.8, seg: 18, segH: 12 }); // inner glow layer peeks through the top
  body.sph(0.16, WHITE, -0.3, 1.02, 0.28, { sy: 0.6, m: 'glow' }); // shine
  eyes(body, { y: 0.78, z: 0.6, spread: 0.24, size: 0.17, look: 0 });
  body.rbox(0.3, 0.12, 0.08, 0.05, 0x1f6a2a, 0, 0.5, 0.66);
  if (boss) crown(body, 1.24, 0xffc62e, 0xff2e55, 0.4);
  return { rig: 'blob', body };
}

function ghostParts() {
  const body = new Kit();
  const col = 0xf2f6ff;
  body.sph(0.6, col, 0, 1.1, 0, { seg: 20, segH: 14 });
  body.cyl(0.6, 0.7, col, 0, 0.72, 0, { axis: 'y', r2: 0.6, seg: 20, open: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.cone(0.17, 0.3, col, Math.cos(a) * 0.46, 0.28, Math.sin(a) * 0.46, { axis: 'y', rx: Math.PI });
  }
  body.sph(0.12, INK, -0.2, 1.14, 0.52, { sy: 1.4, sz: 0.5 });
  body.sph(0.12, INK, 0.2, 1.14, 0.52, { sy: 1.4, sz: 0.5 });
  body.sph(0.04, WHITE, -0.16, 1.22, 0.58, { m: 'glow' });
  body.sph(0.04, WHITE, 0.24, 1.22, 0.58, { m: 'glow' });
  body.sph(0.1, 0x3a2a4a, 0, 0.86, 0.56, { sy: 1.3, sz: 0.5 });
  body.sph(0.08, 0xffa3c4, -0.36, 0.98, 0.46, { sz: 0.4 });
  body.sph(0.08, 0xffa3c4, 0.36, 0.98, 0.46, { sz: 0.4 });
  const arm = new Kit();
  arm.cap(0.11, 0.3, col, 0, -0.26, 0);
  return { rig: 'ghost', body, arm };
}

const BUILDERS = {
  zombie: () => zombieParts(false, false),
  runner: () => zombieParts(false, true),
  skeleton: skeletonParts,
  mummy: mummyParts,
  goblin: goblinParts,
  orc: () => orcParts(false),
  yeti: () => yetiParts(false),
  slime: () => slimeParts(false),
  ghost: ghostParts,
  imp: () => impParts(false),
  robot: () => robotParts(false),
  boss_zombie: () => zombieParts(true, false),
  boss_orc: () => orcParts(true),
  boss_yeti: () => yetiParts(true),
  boss_slime: () => slimeParts(true),
  boss_imp: () => impParts(true),
  boss_robot: () => robotParts(true),
};

/** type -> { rig, parts: { head, torso, arm, leg } | { body, arm? } } (merged geometries) */
export function buildEnemyGeometries() {
  const out = {};
  for (const [type, fn] of Object.entries(BUILDERS)) {
    const p = fn();
    const parts = {};
    for (const k of ['head', 'torso', 'arm', 'leg', 'body']) if (p[k]) parts[k] = p[k].allGeometry();
    out[type] = { rig: p.rig, parts };
  }
  return out;
}

// ------------------------------------------------------------------ player
/**
 * The commander: chibi soldier with orange hair (like the reference), helmet
 * goggles, tactical vest. Returns root + limbs for animation.
 */
export function buildPlayerModel() {
  const skin = 0xffcf9e;
  const vest = 0x3f5a2a;
  const shirt = 0x2b2e38;
  const pants = 0x3b4a6b;
  const hair = 0xff7a1f;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torsoK = new Kit();
  torsoK.rbox(0.8, 0.72, 0.52, 0.22, shirt, 0, 0.38, 0, { seg: 3 });
  torsoK.rbox(0.84, 0.56, 0.56, 0.2, vest, 0, 0.44, 0, { seg: 3 });
  torsoK.rbox(0.2, 0.18, 0.08, 0.05, 0x5a7a3a, -0.2, 0.36, 0.28); // pouches
  torsoK.rbox(0.2, 0.18, 0.08, 0.05, 0x5a7a3a, 0.2, 0.36, 0.28);
  torsoK.rbox(0.26, 0.14, 0.06, 0.05, 0xffc62e, 0, 0.6, 0.29); // badge
  torsoK.rbox(0.86, 0.12, 0.58, 0.05, 0x5b4636, 0, 0.08, 0);
  torsoK.rbox(0.14, 0.1, 0.06, 0.03, 0xe0b24a, 0, 0.08, 0.3, { m: 'metal' });
  torsoK.rbox(0.56, 0.6, 0.28, 0.14, 0x6b7a3a, 0, 0.42, -0.38); // backpack
  torsoK.rbox(0.44, 0.16, 0.08, 0.05, 0x4c5628, 0, 0.26, -0.52);
  const torso = torsoK.build();
  torso.position.y = HUMANOID.hipY;
  body.add(torso);

  const headK = new Kit();
  headK.rbox(0.92, 0.84, 0.84, 0.34, skin, 0, 0.44, 0, { seg: 3 });
  eyes(headK, { y: 0.44, z: 0.39, spread: 0.19, size: 0.13, pupil: 0x2a1d14 });
  headK.rbox(0.16, 0.06, 0.05, 0.03, 0xb4553a, 0, 0.2, 0.42); // smile
  headK.sph(0.07, 0xff9a8a, -0.3, 0.3, 0.38, { sz: 0.4 });
  headK.sph(0.07, 0xff9a8a, 0.3, 0.3, 0.38, { sz: 0.4 });
  // hair: chunky orange tufts
  headK.rbox(0.98, 0.34, 0.9, 0.16, hair, 0, 0.8, -0.03, { seg: 3 });
  headK.rbox(0.96, 0.46, 0.34, 0.16, hair, 0, 0.6, -0.3);
  for (const [x, rz] of [[-0.3, 0.35], [0, 0], [0.3, -0.35]]) headK.rbox(0.3, 0.2, 0.3, 0.1, hair, x, 0.78, 0.36, { rz, rx: -0.4 });
  headK.rbox(0.14, 0.34, 0.5, 0.07, hair, -0.47, 0.56, -0.05);
  headK.rbox(0.14, 0.34, 0.5, 0.07, hair, 0.47, 0.56, -0.05);
  // headband with goggles
  headK.rbox(0.98, 0.1, 0.9, 0.05, 0x2b2e38, 0, 0.66, 0);
  for (const sx of [-1, 1]) headK.cyl(0.09, 0.08, 0x9fe4ff, sx * 0.17, 0.72, 0.43, { m: 'glow' });
  const head = headK.build();
  head.position.y = HUMANOID.neckY;
  body.add(head);

  const mkArm = (side) => {
    const k = new Kit();
    k.rbox(0.3, 0.3, 0.3, 0.12, shirt, 0, -0.12, 0);
    k.cap(0.12, 0.26, skin, 0, -0.36, 0);
    k.sph(0.15, 0x3b3b44, 0, -0.6, 0.02); // gloves
    const pivot = new THREE.Group();
    pivot.position.set(side * HUMANOID.armX, HUMANOID.shoulderY, 0);
    pivot.add(k.build());
    body.add(pivot);
    return pivot;
  };
  const mkLeg = (side) => {
    const k = new Kit();
    k.cap(0.15, 0.24, pants, 0, -0.24, 0);
    k.rbox(0.36, 0.2, 0.46, 0.09, 0x4a3a2a, 0, -0.52, 0.05); // boots
    k.rbox(0.37, 0.05, 0.47, 0.02, 0x2a211a, 0, -0.61, 0.05);
    const pivot = new THREE.Group();
    pivot.position.set(side * HUMANOID.legX, HUMANOID.hipY, 0);
    pivot.add(k.build());
    body.add(pivot);
    return pivot;
  };

  const armL = mkArm(-1);
  const armR = mkArm(1);
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  root.scale.setScalar(1.15);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, body, head, torso, armL, armR, legL, legR };
}
