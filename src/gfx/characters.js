// Blocky characters: zombie body part geometries (for instanced rendering) and
// the player's little soldier.

import * as THREE from 'three';
import { Kit } from './kit.js';

// Zombie rig dimensions (walker, scale 1). Pivots:
//   legs: top of the leg (hip)      torso: bottom center (hip)
//   arms: shoulder                  head: bottom center (neck)
export const RIG = {
  hipY: 0.85,
  legX: 0.2,
  torsoH: 0.95,
  shoulderY: 0.85 + 0.88,
  armX: 0.6,
  neckY: 0.85 + 0.95,
};

/**
 * Parts are white-ish so the per-instance color tints them (skin / shirt / pants).
 * Details are darker vertex colors -> they stay dark after tinting.
 */
export function buildZombieGeometries() {
  const head = new Kit();
  head.box(0.72, 0.72, 0.72, 0xffffff, 0, 0.36, 0);
  head.box(0.74, 0.1, 0.12, 0xc8c8c8, 0, 0.53, 0.32); // brow
  head.box(0.17, 0.13, 0.04, 0x141414, -0.16, 0.4, 0.365); // eyes
  head.box(0.17, 0.13, 0.04, 0x141414, 0.16, 0.4, 0.365);
  head.box(0.07, 0.07, 0.045, 0x7a0000, -0.14, 0.4, 0.37); // bloodshot pupils
  head.box(0.07, 0.07, 0.045, 0x7a0000, 0.18, 0.4, 0.37);
  head.box(0.38, 0.11, 0.04, 0x3a0c0c, 0, 0.19, 0.365); // mouth
  head.box(0.07, 0.07, 0.045, 0xd8d8d8, -0.1, 0.225, 0.37); // teeth
  head.box(0.07, 0.07, 0.045, 0xd8d8d8, 0.08, 0.225, 0.37);
  head.box(0.22, 0.12, 0.74, 0xa0a0a0, 0.18, 0.72, 0); // scalp patch (darker skin)

  const torso = new Kit();
  torso.box(0.9, 0.95, 0.5, 0xffffff, 0, 0.475, 0);
  torso.box(0.92, 0.12, 0.52, 0x3a3a3a, 0, 0.06, 0); // belt
  torso.box(0.3, 0.22, 0.04, 0xbdbdbd, -0.2, 0.62, 0.26); // torn patches (darker shirt)
  torso.box(0.18, 0.3, 0.04, 0xbdbdbd, 0.25, 0.3, 0.26);
  torso.box(0.2, 0.16, 0.06, 0xffffff, -0.3, 0.1, 0.24); // ragged hem
  torso.box(0.16, 0.14, 0.06, 0xffffff, 0.3, 0.09, 0.24);

  const arm = new Kit();
  arm.box(0.28, 0.72, 0.28, 0xffffff, 0, -0.36, 0);
  arm.box(0.31, 0.2, 0.31, 0xdedede, 0, -0.78, 0); // hand
  arm.box(0.3, 0.14, 0.3, 0xcfcfcf, 0, -0.08, 0); // shoulder band

  const leg = new Kit();
  leg.box(0.34, 0.72, 0.36, 0xffffff, 0, -0.36, 0);
  leg.box(0.37, 0.15, 0.46, 0x262626, 0, -0.78, 0.05); // shoe
  leg.box(0.35, 0.1, 0.37, 0xd0d0d0, 0, -0.62, 0); // rolled pants

  // accessories (real colors, not tinted)
  const helmet = new Kit();
  helmet.rbox(0.84, 0.3, 0.84, 0.1, 0x55682c, 0, 0.8, 0);
  helmet.box(0.92, 0.06, 0.92, 0x4a5a25, 0, 0.68, 0.02);
  helmet.box(0.2, 0.08, 0.02, 0x2b2b2b, 0, 0.83, 0.43);

  const horns = new Kit();
  horns.cone(0.1, 0.34, 0xfff1c9, -0.24, 0.86, 0.02, { axis: 'y', rz: 0.35 });
  horns.cone(0.1, 0.34, 0xfff1c9, 0.24, 0.86, 0.02, { axis: 'y', rz: -0.35 });

  const crown = new Kit();
  crown.cyl(0.42, 0.22, 0xffc62e, 0, 0.8, 0, { axis: 'y', seg: 8, m: 'metal' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    crown.cone(0.09, 0.22, 0xffc62e, Math.cos(a) * 0.36, 1.02, Math.sin(a) * 0.36, { axis: 'y', m: 'metal' });
  }
  crown.sph(0.07, 0xff2e55, 0, 0.8, 0.42, { m: 'glow' });

  const pads = new Kit();
  for (const sx of [-1, 1]) {
    pads.rbox(0.46, 0.24, 0.62, 0.08, 0x5d4037, sx * 0.58, 0.95, 0);
    pads.cone(0.07, 0.22, 0xe6e6e6, sx * 0.72, 1.14, 0.18, { axis: 'y', rz: -sx * 0.4 });
    pads.cone(0.07, 0.22, 0xe6e6e6, sx * 0.72, 1.14, -0.18, { axis: 'y', rz: -sx * 0.4 });
    pads.cone(0.07, 0.22, 0xe6e6e6, sx * 0.55, 1.16, 0, { axis: 'y', rz: -sx * 0.2 });
  }

  return {
    head: head.allGeometry(),
    torso: torso.allGeometry(),
    arm: arm.allGeometry(),
    leg: leg.allGeometry(),
    helmet: helmet.allGeometry(),
    horns: horns.allGeometry(),
    crown: crown.allGeometry(),
    pads: pads.allGeometry(),
  };
}

// ------------------------------------------------------------------ player
/**
 * Roblox-ish soldier with orange hair (like the reference). Returns the root
 * plus the limbs so the Player class can animate them.
 */
export function buildPlayerModel() {
  const skin = 0xffc896;
  const shirt = 0x23262e;
  const pants = 0x2f4a8a;
  const hair = 0xff6a1a;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torsoK = new Kit();
  torsoK.rbox(0.8, 0.85, 0.46, 0.08, shirt, 0, 0.425, 0);
  torsoK.box(0.3, 0.22, 0.03, 0xffc62e, 0, 0.55, 0.235); // chest logo
  torsoK.box(0.18, 0.1, 0.035, 0xff6a1a, 0, 0.55, 0.24);
  torsoK.box(0.82, 0.1, 0.48, 0x5b4636, 0, 0.06, 0); // belt
  torsoK.box(0.14, 0.1, 0.05, 0xd8ad45, 0, 0.06, 0.24, { m: 'metal' });
  torsoK.rbox(0.56, 0.62, 0.26, 0.08, 0x6b7a3a, 0, 0.45, -0.34); // backpack
  torsoK.box(0.4, 0.14, 0.05, 0x4c5628, 0, 0.3, -0.48);
  const torso = torsoK.build();
  torso.position.y = 0.8;
  body.add(torso);

  const headK = new Kit();
  headK.rbox(0.66, 0.62, 0.62, 0.1, skin, 0, 0.31, 0);
  headK.box(0.1, 0.13, 0.04, 0x1d1d1d, -0.14, 0.34, 0.31); // eyes
  headK.box(0.1, 0.13, 0.04, 0x1d1d1d, 0.14, 0.34, 0.31);
  headK.box(0.04, 0.04, 0.045, 0xffffff, -0.12, 0.37, 0.315);
  headK.box(0.04, 0.04, 0.045, 0xffffff, 0.16, 0.37, 0.315);
  headK.box(0.2, 0.05, 0.04, 0x8a3a2a, 0, 0.17, 0.31); // smile
  headK.box(0.07, 0.05, 0.04, 0x8a3a2a, -0.12, 0.2, 0.31);
  headK.box(0.07, 0.05, 0.04, 0x8a3a2a, 0.12, 0.2, 0.31);
  // big orange hair
  headK.rbox(0.74, 0.3, 0.72, 0.1, hair, 0, 0.66, -0.02);
  headK.rbox(0.76, 0.42, 0.3, 0.1, hair, 0, 0.5, -0.24);
  headK.box(0.2, 0.16, 0.2, hair, -0.22, 0.6, 0.3, { rz: 0.3 });
  headK.box(0.22, 0.18, 0.2, hair, 0.05, 0.62, 0.32, { rz: -0.2 });
  headK.box(0.18, 0.14, 0.2, hair, 0.26, 0.58, 0.28, { rz: -0.4 });
  headK.box(0.14, 0.36, 0.5, hair, -0.36, 0.44, -0.04);
  headK.box(0.14, 0.36, 0.5, hair, 0.36, 0.44, -0.04);
  const head = headK.build();
  head.position.y = 0.8 + 0.85;
  body.add(head);

  const mkArm = (side) => {
    const k = new Kit();
    k.rbox(0.26, 0.42, 0.28, 0.06, shirt, 0, -0.2, 0);
    k.rbox(0.24, 0.36, 0.26, 0.06, skin, 0, -0.56, 0);
    const g = k.build();
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.53, 0.8 + 0.78, 0);
    pivot.add(g);
    body.add(pivot);
    return pivot;
  };
  const mkLeg = (side) => {
    const k = new Kit();
    k.rbox(0.34, 0.66, 0.36, 0.06, pants, 0, -0.33, 0);
    k.rbox(0.36, 0.16, 0.46, 0.05, 0xf2f2f2, 0, -0.72, 0.05); // sneakers
    k.box(0.37, 0.05, 0.47, 0xff6a1a, 0, -0.78, 0.05);
    const g = k.build();
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.8, 0);
    pivot.add(g);
    body.add(pivot);
    return pivot;
  };

  const armL = mkArm(-1);
  const armR = mkArm(1);
  const legL = mkLeg(-1);
  const legR = mkLeg(1);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, body, head, torso, armL, armR, legL, legR };
}
