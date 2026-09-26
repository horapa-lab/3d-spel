// World props: loot crate (with tiers), upgrade stations, gun mounts, pads,
// sandbags, barriers, portal and zone decorations.

import * as THREE from 'three';
import { Kit } from './kit.js';

// ------------------------------------------------------------------ crate
export const CRATE_TIERS = [
  { name: 'Wooden Crate', wood: 0xb8743a, woodL: 0xd08a45, woodD: 0x7d4a22, metal: 0x6b6f78, glow: null },
  { name: 'Iron Crate', wood: 0x8e5a34, woodL: 0xa66a3d, woodD: 0x5c3820, metal: 0xc3ccd6, glow: null },
  { name: 'Golden Crate', wood: 0x8a2f2f, woodL: 0xa33a3a, woodD: 0x5e1d1d, metal: 0xffc83d, glow: 0xffe27a },
  { name: 'Epic Crate', wood: 0x4b2a7a, woodL: 0x5d3695, woodD: 0x2f1a4f, metal: 0xd9a6ff, glow: 0xc77dff },
  { name: 'Diamond Crate', wood: 0x2b6a9e, woodL: 0x3a82bd, woodD: 0x1b4468, metal: 0xbff3ff, glow: 0x7fe8ff },
  { name: 'Cosmic Crate', wood: 0x1a1433, woodL: 0x261d4a, woodD: 0x0e0a1f, metal: 0xff7bf3, glow: 0xff4df0 },
];
export const crateTierForLevel = (lvl) => Math.min(CRATE_TIERS.length - 1, Math.floor((lvl - 1) / 5));

export const CRATE_W = 3.2;
export const CRATE_H = 1.1;
export const CRATE_D = 1.6;

export function buildCrate(tier) {
  const t = CRATE_TIERS[tier];
  const W = CRATE_W;
  const H = CRATE_H;
  const D = CRATE_D;
  const k = new Kit();
  k.box(W - 0.1, 0.12, D - 0.1, t.woodD, 0, 0.06, 0);
  k.box(W - 0.3, 0.02, D - 0.3, 0x24160c, 0, 0.13, 0); // dark inside floor
  for (let i = 0; i < 3; i++) {
    const y = 0.12 + 0.16 + i * 0.31;
    const col = i % 2 ? t.wood : t.woodL;
    k.box(W - 0.24, 0.29, 0.1, col, 0, y, D / 2 - 0.05);
    k.box(W - 0.24, 0.29, 0.1, col, 0, y, -D / 2 + 0.05);
    k.box(0.1, 0.29, D - 0.24, col, W / 2 - 0.05, y, 0);
    k.box(0.1, 0.29, D - 0.24, col, -W / 2 + 0.05, y, 0);
  }
  // diagonal brace on the front
  k.box(W * 0.62, 0.14, 0.05, t.woodD, 0, H * 0.5, D / 2 + 0.02, { rz: 0.28 });
  // corner posts + metal caps
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      k.box(0.2, H, 0.2, t.woodD, sx * (W / 2 - 0.1), H / 2, sz * (D / 2 - 0.1));
      k.box(0.24, 0.16, 0.24, t.metal, sx * (W / 2 - 0.1), 0.1, sz * (D / 2 - 0.1), { m: 'metal' });
      k.box(0.24, 0.16, 0.24, t.metal, sx * (W / 2 - 0.1), H - 0.08, sz * (D / 2 - 0.1), { m: 'metal' });
    }
    // rope handles on the sides
    k.tor(0.16, 0.04, 0xd9c08a, sx * (W / 2 + 0.02), H * 0.55, 0, { axis: 'x', arc: Math.PI, rz: 0 });
  }
  // latch on the front
  k.box(0.26, 0.26, 0.06, t.metal, 0, H - 0.2, D / 2 + 0.04, { m: 'metal' });
  k.box(0.1, 0.1, 0.07, 0x222222, 0, H - 0.22, D / 2 + 0.06);
  // star emblem on the front
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.12 : 0.28;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.04, bevelEnabled: false });
  k.geo(starGeo, t.glow || 0xffc62e, -W * 0.3, H * 0.47, D / 2 + 0.02, { m: t.glow ? 'glow' : 'solid' });
  k.geo(starGeo.clone(), t.glow || 0xffc62e, W * 0.3, H * 0.47, D / 2 + 0.02, { m: t.glow ? 'glow' : 'solid' });

  // lid, pivot on the back top edge
  const lid = k.sub('lid', 0, H, -D / 2);
  lid.box(W, 0.16, D + 0.04, t.wood, 0, 0.08, D / 2);
  for (let i = 0; i < 4; i++) lid.box(W - 0.02, 0.02, 0.03, t.woodD, 0, 0.165, 0.2 + i * 0.4);
  lid.box(0.14, 0.18, D + 0.08, t.metal, -W * 0.36, 0.08, D / 2, { m: 'metal' });
  lid.box(0.14, 0.18, D + 0.08, t.metal, W * 0.36, 0.08, D / 2, { m: 'metal' });
  lid.box(0.26, 0.2, 0.08, t.metal, 0, 0.02, D + 0.04, { m: 'metal' });
  if (t.glow) lid.box(W * 0.5, 0.02, 0.1, t.glow, 0, 0.17, D / 2, { m: 'glow' });
  // gun silhouette under the lid (seen when it opens, like the reference)
  const sil = 0x111111;
  lid.box(1.7, 0.012, 0.14, sil, 0.1, -0.005, D / 2 + 0.05);
  lid.box(0.7, 0.012, 0.26, sil, -0.75, -0.005, D / 2 - 0.02);
  lid.box(0.16, 0.012, 0.36, sil, -0.35, -0.005, D / 2 - 0.25, { ry: 0.3 });
  lid.box(0.5, 0.012, 0.12, sil, 0.35, -0.005, D / 2 - 0.08);

  const g = k.build();
  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return g;
}

// ------------------------------------------------------------------ stations
/** Lucky slot machine next to the crate (Crate Luck upgrade). */
export function buildLuckStation() {
  const k = new Kit();
  k.rbox(1.5, 0.3, 1.1, 0.08, 0x3b3f4a, 0, 0.15, 0);
  k.rbox(1.3, 1.6, 0.9, 0.12, 0xe8394a, 0, 1.1, 0);
  k.rbox(1.36, 0.3, 0.96, 0.1, 0xffc62e, 0, 2.0, 0, { m: 'metal' });
  k.box(0.9, 0.5, 0.06, 0x2a1e3a, 0, 1.35, 0.44);
  for (let i = 0; i < 3; i++) k.box(0.24, 0.38, 0.03, 0xfff6d8, -0.3 + i * 0.3, 1.35, 0.47, { m: 'glow' });
  for (let i = 0; i < 3; i++) k.box(0.1, 0.1, 0.03, 0x2fbf4a, -0.3 + i * 0.3, 1.35, 0.49, { m: 'glow' });
  k.box(1.0, 0.12, 0.2, 0xffc62e, 0, 0.8, 0.46, { m: 'metal' });
  k.cyl(0.05, 0.6, 0xc0c6cf, 0.75, 1.45, 0, { axis: 'y', m: 'metal' });
  k.sph(0.13, 0xe8394a, 0.75, 1.8, 0);
  for (let i = 0; i < 7; i++) k.sph(0.06, i % 2 ? 0xffe27a : 0xfff6d8, -0.6 + i * 0.2, 2.18, 0.4, { m: 'glow' });
  const g = k.build();
  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return g;
}

/** Floating four-leaf clover hologram over the luck machine. */
export function buildClover() {
  const k = new Kit();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    k.sph(0.22, 0x52e052, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0, { sz: 0.35, m: 'glow' });
  }
  k.box(0.06, 0.35, 0.05, 0x2fa83a, 0.05, -0.32, 0, { rz: 0.3, m: 'glow' });
  return k.build({ shadows: false });
}

/** Big steel safe for the Idle Vault; coin stacks grow with the level. */
export function buildVault() {
  const k = new Kit();
  k.rbox(1.5, 0.25, 1.3, 0.06, 0x3b3f4a, 0, 0.125, 0);
  k.rbox(1.4, 1.7, 1.2, 0.14, 0x8b95a3, 0, 1.1, 0, { m: 'metal' });
  k.rbox(1.46, 0.14, 1.26, 0.06, 0x5d6572, 0, 1.94, 0, { m: 'metal' });
  k.cyl(0.52, 0.12, 0x6b7482, 0, 1.1, 0.62, { seg: 24, m: 'metal' });
  k.cyl(0.44, 0.06, 0x535b67, 0, 1.1, 0.7, { seg: 24, m: 'metal' });
  k.tor(0.22, 0.035, 0xd8ad45, 0, 1.1, 0.75, { m: 'metal' });
  for (let i = 0; i < 4; i++) {
    k.box(0.04, 0.5, 0.04, 0xd8ad45, 0, 1.1, 0.75, { rz: (i * Math.PI) / 4, m: 'metal' });
  }
  k.sph(0.07, 0xd8ad45, 0, 1.1, 0.78, { m: 'metal' });
  k.box(0.08, 0.3, 0.1, 0x3b3f4a, 0.62, 1.4, 0.6);
  k.box(0.08, 0.3, 0.1, 0x3b3f4a, 0.62, 0.8, 0.6);
  // dollar sign plate
  k.box(0.46, 0.26, 0.04, 0xffc62e, 0, 1.78, 0.61, { m: 'metal' });
  k.box(0.06, 0.2, 0.05, 0x2a7a2a, 0, 1.78, 0.63);
  k.box(0.18, 0.04, 0.05, 0x2a7a2a, 0, 1.84, 0.63);
  k.box(0.18, 0.04, 0.05, 0x2a7a2a, 0, 1.72, 0.63);
  const g = k.build();
  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return g;
}

export function buildCoinStack(n) {
  const k = new Kit();
  for (let i = 0; i < n; i++) {
    k.cyl(0.22, 0.07, i % 2 ? 0xffd23f : 0xf5b921, (Math.random() - 0.5) * 0.03, 0.04 + i * 0.075, 0, { axis: 'y', seg: 16, m: 'metal' });
  }
  return k.build();
}

// ------------------------------------------------------------------ gun mount
/** A turret stand with a yaw pivot where the gun sits. */
export function buildMount() {
  const k = new Kit();
  k.rbox(1.1, 0.16, 1.1, 0.05, 0x3a3f48, 0, 0.08, 0, { m: 'metal' });
  k.cyl(0.14, 0.62, 0x565e6a, 0, 0.47, 0, { axis: 'y', m: 'metal' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.box(0.08, 0.5, 0.08, 0x2c3139, Math.cos(a) * 0.28, 0.32, Math.sin(a) * 0.28, { rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5 });
  }
  k.cyl(0.3, 0.1, 0x2c3139, 0, 0.8, 0, { axis: 'y', m: 'metal', seg: 16 });
  const g = k.build();
  g.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return g;
}

// ------------------------------------------------------------------ pads
const padTexCache = {};
function ringTexture(color) {
  if (padTexCache[color]) return padTexCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = color;
  g.lineWidth = 16;
  g.setLineDash([26, 14]);
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 0.22;
  g.fillStyle = color;
  g.beginPath();
  g.arc(128, 128, 100, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  padTexCache[color] = tex;
  return tex;
}

/** Hypercasual "stand here" circle with a fill that grows while you stand on it. */
export function buildPad(radius, color = '#ffffff') {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.2, radius * 2.2),
    new THREE.MeshBasicMaterial({ map: ringTexture(color), transparent: true, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  group.add(ring);
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.05;
  fill.scale.setScalar(0.001);
  fill.renderOrder = 3;
  group.add(fill);
  group.userData.ring = ring;
  group.userData.fill = fill;
  return group;
}

// ------------------------------------------------------------------ environment pieces
export function sandbagGeometry() {
  const k = new Kit();
  k.rbox(1.0, 0.36, 0.52, 0.16, 0xffffff, 0, 0.18, 0, { seg: 2 });
  k.box(0.08, 0.3, 0.54, 0xcfcfcf, 0.42, 0.17, 0);
  return k.allGeometry();
}

export function barrierGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.42, 0);
  s.lineTo(0.42, 0);
  s.lineTo(0.42, 0.14);
  s.lineTo(0.18, 0.32);
  s.lineTo(0.13, 0.85);
  s.lineTo(-0.13, 0.85);
  s.lineTo(-0.18, 0.32);
  s.lineTo(-0.42, 0.14);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 2.0, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -1.0);
  g.rotateY(Math.PI / 2); // length along X
  const k = new Kit();
  k.geo(g, 0xffffff, 0, 0, 0);
  k.box(2.0, 0.12, 0.3, 0xe53935, 0, 0.62, 0, {});
  return k.allGeometry();
}

export function buildPortal(accent) {
  const g = new THREE.Group();
  const k = new Kit();
  const stone = 0x6b5a4e;
  const stoneD = 0x4f4239;
  // pillars made of stacked uneven blocks
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const w = 2.2 + Math.sin(i * 3.1 + sx) * 0.3;
      k.rbox(w, 1.5, 2.4, 0.2, i % 2 ? stone : stoneD, sx * (7.2 + Math.sin(i * 1.7) * 0.2), 0.75 + i * 1.45, 0, { ry: Math.sin(i * 2.3) * 0.1 });
    }
  }
  // arch top
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2;
    k.rbox(2.3, 1.6, 2.6, 0.2, i % 2 ? stone : stoneD, x, 9.3 + Math.sin(i * 1.3) * 0.25, 0, { rz: Math.sin(i) * 0.08 });
  }
  // skull on top
  k.rbox(1.6, 1.4, 1.2, 0.3, 0xf2eee2, 0, 10.9, 0.5);
  k.box(0.4, 0.4, 0.1, 0x1a1a1a, -0.35, 11.0, 1.1);
  k.box(0.4, 0.4, 0.1, 0x1a1a1a, 0.35, 11.0, 1.1);
  k.box(0.7, 0.2, 0.1, 0x1a1a1a, 0, 10.45, 1.1);
  k.box(1.0, 0.3, 0.9, 0xe0dccf, 0, 10.2, 0.6);
  // torches
  for (const sx of [-1, 1]) {
    k.cyl(0.12, 1.4, 0x5b3a22, sx * 5.4, 1.0, 1.5, { axis: 'y' });
    k.sph(0.3, accent, sx * 5.4, 1.9, 1.5, { m: 'glow' });
  }
  const arch = k.build();
  arch.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  g.add(arch);

  // swirling vortex
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(accent) } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 + r * 12.0 - uTime * 3.0) * 0.5 + 0.5;
        float core = smoothstep(1.0, 0.0, r);
        vec3 col = mix(vec3(0.02, 0.0, 0.05), uColor, swirl * 0.7 * (1.0 - core * 0.3));
        col += uColor * pow(core, 3.0) * 0.8;
        float edge = smoothstep(1.0, 0.85, r);
        gl_FragColor = vec4(col, edge * 0.95);
      }`,
  });
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(6.2, 48), mat);
  vortex.position.set(0, 4.6, -0.2);
  vortex.scale.y = 1.35;
  g.add(vortex);
  g.userData.vortex = vortex;
  return g;
}

// ------------------------------------------------------------------ decorations
export function decoCactus(k, x, z, s = 1) {
  const c = 0x4caf50;
  const cd = 0x388e3c;
  k.rbox(0.5 * s, 2.4 * s, 0.5 * s, 0.2 * s, c, x, 1.2 * s, z);
  k.rbox(0.36 * s, 0.9 * s, 0.36 * s, 0.15 * s, cd, x + 0.45 * s, 1.4 * s, z);
  k.rbox(0.36 * s, 0.4 * s, 0.36 * s, 0.15 * s, cd, x + 0.3 * s, 1.0 * s, z);
  k.rbox(0.36 * s, 0.8 * s, 0.36 * s, 0.15 * s, c, x - 0.45 * s, 1.7 * s, z);
  k.rbox(0.36 * s, 0.36 * s, 0.36 * s, 0.15 * s, c, x - 0.3 * s, 1.4 * s, z);
  k.sph(0.12 * s, 0xff5fa8, x, 2.45 * s, z);
}

export function decoRock(k, x, z, s, color, rot = 0) {
  const g = new THREE.DodecahedronGeometry(s, 0);
  k.geo(g, color, x, s * 0.45, z, { ry: rot, rx: rot * 0.7, sy: 0.7 });
}

export function decoBarrel(k, x, z, color, fallen = false) {
  if (fallen) {
    k.cyl(0.42, 1.2, color, x, 0.42, z, { axis: 'x', seg: 14, ry: x });
    k.cyl(0.44, 0.08, 0x333333, x - 0.3, 0.42, z, { axis: 'x', seg: 14 });
  } else {
    k.cyl(0.42, 1.2, color, x, 0.6, z, { axis: 'y', seg: 14 });
    k.cyl(0.44, 0.08, 0x333333, x, 0.3, z, { axis: 'y', seg: 14 });
    k.cyl(0.44, 0.08, 0x333333, x, 0.9, z, { axis: 'y', seg: 14 });
  }
}

export function decoCrate(k, x, z, s = 1, rot = 0) {
  k.box(1.1 * s, 1.1 * s, 1.1 * s, 0xb8743a, x, 0.55 * s, z, { ry: rot });
  k.box(1.14 * s, 0.14 * s, 1.14 * s, 0x7d4a22, x, 0.55 * s, z, { ry: rot });
  k.box(1.14 * s, 1.14 * s, 0.14 * s, 0x7d4a22, x, 0.55 * s, z, { ry: rot });
}

export function decoTire(k, x, z) {
  k.tor(0.45, 0.2, 0x222222, x, 0.2, z, { axis: 'y', seg: 16 });
}

export function decoPine(k, x, z, s = 1, snow = true) {
  k.cyl(0.18 * s, 1.0 * s, 0x6d4c41, x, 0.5 * s, z, { axis: 'y' });
  for (let i = 0; i < 3; i++) {
    const r = (1.3 - i * 0.32) * s;
    k.cone(r, 1.3 * s, 0x2e7d4f, x, (1.3 + i * 0.8) * s, z, { axis: 'y', seg: 8 });
    if (snow) k.cone(r * 0.55, 0.5 * s, 0xffffff, x, (1.75 + i * 0.8) * s, z, { axis: 'y', seg: 8 });
  }
}

export function decoMushroom(k, x, z, s = 1, cap = 0xb04dff) {
  k.cyl(0.18 * s, 1.0 * s, 0xeee6d0, x, 0.5 * s, z, { axis: 'y' });
  k.sph(0.7 * s, cap, x, 1.05 * s, z, { sy: 0.55 });
  k.sph(0.12 * s, 0xffffff, x + 0.3 * s, 1.3 * s, z + 0.2 * s, { m: 'glow' });
  k.sph(0.1 * s, 0xffffff, x - 0.25 * s, 1.35 * s, z - 0.1 * s, { m: 'glow' });
}

export function decoCrystal(k, x, z, s = 1, color = 0x7fe8ff) {
  k.cone(0.35 * s, 1.8 * s, color, x, 0.9 * s, z, { axis: 'y', seg: 5, m: 'glow' });
  k.cone(0.25 * s, 1.1 * s, color, x + 0.35 * s, 0.5 * s, z + 0.1 * s, { axis: 'y', seg: 5, rz: -0.4, m: 'glow' });
}

export function decoDeadTree(k, x, z, s = 1) {
  const c = 0x5d4037;
  k.cyl(0.16 * s, 2.4 * s, c, x, 1.2 * s, z, { axis: 'y', r2: 0.1 * s });
  k.cyl(0.08 * s, 1.0 * s, c, x + 0.35 * s, 1.9 * s, z, { axis: 'y', rz: -0.8 });
  k.cyl(0.07 * s, 0.9 * s, c, x - 0.3 * s, 2.1 * s, z, { axis: 'y', rz: 0.7 });
}

export function decoLamp(k, x, z, accent) {
  k.cyl(0.08, 3.2, 0x3a3f48, x, 1.6, z, { axis: 'y', m: 'metal' });
  k.box(0.7, 0.1, 0.1, 0x3a3f48, x + (x < 0 ? 0.3 : -0.3), 3.15, z);
  k.box(0.34, 0.12, 0.3, accent, x + (x < 0 ? 0.6 : -0.6), 3.08, z, { m: 'glow' });
}
