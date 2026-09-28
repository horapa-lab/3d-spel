/**
 * Content plans for every island: village pads, docks, NPC spots, signs, spawns, boat spawns,
 * and the special sub-zone terrain (Frozen Lake bowl, Magma Pools).
 */
import { dist, s } from './defs/common';
import type { Plan } from './plan';
import { SUB_ZONES } from './layout';
import { FROST_LAKE } from './defs/frostpeak';
import { MAGMA, MAGMA_POOLS, VOLCANO } from './defs/ashen';
import { KEEPER_PLAZA } from './defs/keepers';
import { GROTTO } from './defs/glimmer';
import { ARCH } from './defs/stonearch';
import { COVE, COVE_MOUTH } from './defs/wreckers';
import { ELDER_TEMPLE } from './defs/elder';

/** Outermost shoreline point along a direction (local), marching inward from far out. */
function shore(p: Plan, ang: number, far: number, level = 0.4): [number, number, number] {
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  for (let r = far; r > 0; r -= 2) {
    if (p.h(dx * r, dz * r) > level) return [dx * r, dz * r, r];
  }
  return [0, 0, 0];
}

/** Direction (local angle) from an island centre towards Driftwood Harbor. */
function towardHome(p: Plan): number {
  return Math.atan2(-p.cz, -p.cx);
}

interface Harbor {
  /** shore point */
  sx: number;
  sz: number;
  /** outward unit dir + perpendicular */
  dx: number;
  dz: number;
  px: number;
  pz: number;
  /** helper: local point at `along` (+ = seaward) and `side` offsets from the shore point */
  at(along: number, side: number): [number, number];
  /** facing angle (rot) looking seaward */
  seaRot: number;
}

/**
 * Standard landing: a dock running out from the shore, a flattened landing pad, a welcome sign,
 * spawn on land and a boat spawn in the water beside the dock end.
 */
function landing(p: Plan, ang: number, far: number, o: { dock?: number; deckY?: number; padY?: number; width?: number } = {}): Harbor {
  const [sx, sz] = shore(p, ang, far);
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const px = -dz;
  const pz = dx;
  const at = (along: number, side: number): [number, number] => [sx + dx * along + px * side, sz + dz * along + pz * side];
  const H: Harbor = { sx, sz, dx, dz, px, pz, at, seaRot: Math.atan2(dx, dz) };
  const dock = o.dock ?? 40;
  const deckY = o.deckY ?? 1.7;
  // landing pad on the shore
  const [lx, lz] = at(-16, 0);
  p.pad(lx, lz, 14, { y: o.padY ?? Math.max(1.6, Math.min(3, p.h(lx, lz))), fall: 12, dirt: 0.8 });
  p.pier([at(-4, 0), at(dock, 0)], { width: o.width ?? 3.2, deckY, style: 'dock', endPlatform: 8, lamps: 16, railStart: 6 });
  const [spx, spz] = at(-12, 0);
  p.setSpawn(spx, spz);
  const [sgx, sgz] = at(-9, 4.5);
  p.sign(sgx, sgz, H.seaRot + Math.PI);
  const [bx, bz] = at(dock - 6, 9);
  p.setBoatSpawn(bx, bz);
  return H;
}

const face = (fromX: number, fromZ: number, toX: number, toZ: number) => Math.atan2(toX - fromX, toZ - fromZ);

// ─────────────────────────────────────────────────────────────── Driftwood Harbor

export function planDriftwood(p: Plan): void {
  // village terraces on the bay's north shore
  p.pad(0, 104, 44, { y: 3.4, fall: 26, plaza: 0.9 });
  p.pad(-44, 88, 16, { y: 4.2, fall: 10, dirt: 0.5 });
  p.pad(-6, 64, 14, { y: 6.0, fall: 12, dirt: 0.5 });
  p.pad(40, 92, 14, { y: 3.8, fall: 10, dirt: 0.5 });
  p.pad(-66, 150, 14, { y: 1.9, fall: 10, dirt: 0.6 });
  p.path([[0, 104], [4, 136], [5, 146]], { width: 5, dirt: 1 });
  p.path([[0, 104], [-40, 118], [-66, 148]], { width: 4 });
  p.path([[0, 104], [-6, 64], [-20, 20], [-40, -40]], { width: 3.5 });
  p.path([[0, 104], [60, 110], [120, 140], [175, 180], [205, 200]], { width: 3.2 });
  // main pier into the bay
  p.pier([[5, 140], [5, 296]], { width: 3.6, deckY: 1.9, lamps: 18, endPlatform: 14, style: 'pier', railStart: 8 });
  // shipwright's dock
  p.pier([[-64, 150], [-60, 194]], { width: 3.2, deckY: 1.7, style: 'dock', endPlatform: 0, lamps: 0 });
  p.setSpawn(6, 128);
  p.setBoatSpawn(-49, 196);
  p.sign(15, 126, Math.PI);
  p.npc('marla', -16, 100, 0);
  p.npc('wren', 32, 94, -0.5);
  p.npc('oskar', -62, 160, 0.2, 1.7);
  p.npc('tobias', 5, 302, Math.PI * 0.1, 1.9);
  p.npc('nell', -40, 94, 0.6);
  p.npc('pip', 16, 142, -0.9);
  p.npc('juno', -4, 70, 0.1);
  p.interact('boat_spawn', 'shipwright', -60, 186, 'Launch Boat', { y: 1.7, radius: 3.5 });
  p.interact('bell', 'harbor_bell', 10, 136, 'Harbor Bell', { radius: 2.5 });
}

// ─────────────────────────────────────────────────────────────── Coral Crescent

export function planCoral(p: Plan): void {
  const OPEN = Math.atan2(380, 930);
  const a0 = OPEN + Math.PI;
  const u = (r: number, da = 0): [number, number] => [Math.cos(a0 + da) * r, Math.sin(a0 + da) * r];
  const [vx, vz] = u(158);
  p.pad(vx, vz, 26, { y: 2.2, fall: 16, dirt: 0.6 });
  // jetty into the bay (towards the centre)
  p.pier([u(140), u(86)], { width: 2.8, deckY: 1.6, style: 'jetty', endPlatform: 7, lamps: 0, railStart: 4 });
  const [spx, spz] = u(150);
  p.setSpawn(spx, spz);
  const [bx, bz] = u(92, 0.12);
  p.setBoatSpawn(bx, bz);
  const [sgx, sgz] = u(147, -0.05);
  p.sign(sgx, sgz, face(sgx, sgz, 0, 0));
  const [lx, lz] = u(162, 0.18);
  p.pad(lx, lz, 8, { y: 2.3 });
  p.npc('lani', lx, lz, face(lx, lz, 0, 0));
  const [kx, kz] = u(165, -0.2);
  p.pad(kx, kz, 8, { y: 2.3 });
  p.npc('kai', kx, kz, face(kx, kz, 0, 0));
  const [ex, ez] = u(84);
  p.npc('ula', ex, ez, face(ex, ez, 0, 0), 1.6);
}

// ─────────────────────────────────────────────────────────────── Sunspire Isle

export function planSunspire(p: Plan): void {
  const H = landing(p, towardHome(p), 460, { dock: 38 });
  const [vx, vz] = H.at(-48, 0);
  p.pad(vx, vz, 26, { y: Math.max(3, p.h(vx, vz)), fall: 18, plaza: 0.8 });
  const [zx, zz] = H.at(-58, 14);
  p.npc('zahra', zx, zz, H.seaRot);
  const [hx, hz] = H.at(-40, -12);
  p.npc('hakim', hx, hz, H.seaRot);
  const [dx, dz] = H.at(36, 0);
  p.npc('dune', dx, dz, H.seaRot, 1.7);
}

// ─────────────────────────────────────────────────────────────── Turtleback Atoll

export function planTurtleback(p: Plan): void {
  // hamlet on the north-west rim, next to the boat channel
  const a = -Math.PI / 2 - 0.42;
  const u = (r: number, da = 0): [number, number] => [Math.cos(a + da) * r, Math.sin(a + da) * r];
  const [vx, vz] = u(200);
  p.pad(vx, vz, 24, { y: 1.9, fall: 12, dirt: 0.6 });
  // dock into the lagoon (inward)
  p.pier([u(180), u(140)], { width: 3.2, deckY: 1.6, style: 'dock', endPlatform: 9, lamps: 14, railStart: 4 });
  // outer landing jetty (sea side)
  p.pier([u(224), u(262)], { width: 3.0, deckY: 1.7, style: 'jetty', endPlatform: 6, lamps: 0, railStart: 4 });
  const [spx, spz] = u(206);
  p.setSpawn(spx, spz);
  const [bx, bz] = u(150, 0.07);
  p.setBoatSpawn(bx, bz);
  const [sgx, sgz] = u(216, 0.04);
  p.sign(sgx, sgz, face(sgx, sgz, 0, 0) + Math.PI);
  const [b1x, b1z] = u(176, -0.02);
  p.npc('barnaby', b1x, b1z, face(b1x, b1z, 0, 0), 1.6);
  const [mx, mz] = u(198, 0.09);
  p.npc('mags', mx, mz, face(mx, mz, 0, 0));
  const [qx, qz] = u(198, -0.09);
  p.npc('coral_quinn', qx, qz, face(qx, qz, 0, 0));
  const [ix, iz] = u(146, 0.02);
  p.interact('boat_spawn', 'shipyard', ix, iz, 'Launch Boat', { y: 1.6, radius: 3.5 });
}

// ─────────────────────────────────────────────────────────────── Stone Arch

export function planStoneArch(p: Plan): void {
  // hermit's ledge on the east tower's southern foot
  const E = ARCH.east;
  const lx = E.x + 12;
  const lz = E.z + 58;
  p.pad(lx, lz, 12, { y: 2.2, fall: 8, dirt: 0.6 });
  p.pier([[lx + 2, lz + 8], [lx + 4, lz + 40]], { width: 2.8, deckY: 1.6, style: 'jetty', endPlatform: 6, lamps: 0, railStart: 3 });
  p.setSpawn(lx, lz + 2);
  p.setBoatSpawn(lx + 13, lz + 36);
  p.sign(lx - 5, lz + 6, 0);
  p.npc('ansel', lx + 5, lz - 3, 0.3);
}

// ─────────────────────────────────────────────────────────────── Mirewood Bayou

export function planMirewood(p: Plan): void {
  const H = landing(p, towardHome(p), 560, { dock: 34, deckY: 1.4 });
  const [vx, vz] = H.at(-36, 0);
  p.pad(vx, vz, 20, { y: 1.3, fall: 12, dirt: 0.8 });
  const [mx, mz] = H.at(-40, 10);
  p.npc('mossmother', mx, mz, H.seaRot);
  const [jx, jz] = H.at(30, 0);
  p.npc('jeb', jx, jz, H.seaRot, 1.4);
}

// ─────────────────────────────────────────────────────────────── Frostpeak

export function planFrostpeak(p: Plan): void {
  const L = FROST_LAKE;
  // cirque bowl: flat ice-covered lake, a rim, steep headwall behind
  p.t.addCustom([L.x - 140, L.z - 140, L.x + 140, L.z + 140], (lx, lz, h) => {
    const d = dist(lx, lz, L.x, L.z);
    if (d > L.r + 75) return h;
    const bed = L.y - 0.6 - 3.2 * s(L.r * 0.95, L.r * 0.3, d);
    const target = d < L.r ? bed : L.y + 1.4;
    const w = 1 - s(L.r + 12, L.r + 75, d);
    return h + (target - h) * w;
  });
  const H = landing(p, Math.PI / 2 + 0.05, 640, { dock: 40 });
  const [vx, vz] = H.at(-44, 0);
  p.pad(vx, vz, 26, { y: Math.max(3, p.h(vx, vz)), fall: 16, dirt: 0.6 });
  const [ix, iz] = H.at(-44, -12);
  p.npc('ingrid', ix, iz, H.seaRot);
  const [sx, sz] = H.at(-50, 14);
  p.npc('sigrun', sx, sz, H.seaRot);
  // switchback trail from the village to the lake rim
  const [tx, tz] = H.at(-60, 0);
  const rimZ = L.z + L.r + 10;
  p.path(
    [
      [tx, tz],
      [L.x + 70, rimZ + 150],
      [L.x - 40, rimZ + 110],
      [L.x + 55, rimZ + 70],
      [L.x - 20, rimZ + 32],
      [L.x, rimZ - 4],
    ],
    { width: 3.4, fall: 5, smooth: 6 },
  );
  // Bjorn on the ice by the fishing holes
  p.npc('bjorn', L.x + 8, L.z + 22, Math.PI, L.y + 0.1);
  p.walk(L.x, L.z, L.r, L.r, 0, L.y + 0.1, L.y + 0.1, { circle: true, holes: frostHoles() });
}

export function frostHoles(): { x: number; z: number; r: number }[] {
  const Z = SUB_ZONES[0];
  const out: { x: number; z: number; r: number }[] = [];
  const spots: [number, number][] = [
    [6, 16],
    [14, 12],
    [-4, 8],
    [20, 24],
    [-14, 20],
    [2, 28],
    [-22, -6],
  ];
  for (const [x, z] of spots) out.push({ x: Z.x + x, z: Z.z + z, r: 1.3 });
  // open water lead near the north shore
  out.push({ x: Z.x - 10, z: Z.z - 34, r: 12 });
  return out;
}

// ─────────────────────────────────────────────────────────────── Wreckers' Cove

export function planWreckers(p: Plan): void {
  // village on the cove's inner beach, opposite the mouth
  const back = COVE_MOUTH + Math.PI;
  const bx = COVE.x + Math.cos(back) * (COVE.r + 16);
  const bz = COVE.z + Math.sin(back) * (COVE.r + 16);
  p.pad(bx, bz, 26, { y: 2.2, fall: 14, plaza: 0.5, dirt: 0.5 });
  const inx = Math.cos(COVE_MOUTH);
  const inz = Math.sin(COVE_MOUTH);
  const dockA: [number, number] = [bx + inx * 12, bz + inz * 12];
  const dockB: [number, number] = [bx + inx * 50, bz + inz * 50];
  p.pier([dockA, dockB], { width: 3.2, deckY: 1.7, style: 'dock', endPlatform: 9, lamps: 14, railStart: 4 });
  p.setSpawn(bx + inx * 4, bz + inz * 4);
  p.setBoatSpawn(dockB[0] - inz * 9, dockB[1] + inx * 9);
  p.sign(bx + inx * 8 - inz * 5, bz + inz * 8 + inx * 5, COVE_MOUTH + Math.PI / 2);
  const rot = Math.atan2(inx, inz);
  p.npc('rosa', bx - inz * 12, bz + inx * 12, rot);
  p.npc('pete', bx + inz * 12, bz - inx * 12, rot);
  p.npc('gully', dockB[0], dockB[1], rot, 1.7);
}

// ─────────────────────────────────────────────────────────────── Elder Isle

export function planElder(p: Plan): void {
  const H = landing(p, towardHome(p) + 0.15, 700, { dock: 40 });
  const [cx, cz] = H.at(-40, 0);
  p.pad(cx, cz, 24, { y: Math.max(2.5, Math.min(5, p.h(cx, cz))), fall: 16, dirt: 0.8 });
  const [ox, oz] = H.at(-38, 10);
  p.npc('ottoline', ox, oz, H.seaRot);
  const [tx, tz] = H.at(-46, -12);
  p.npc('thornwick', tx, tz, H.seaRot);
  const T = ELDER_TEMPLE;
  p.pad(T.x, T.z, T.r, { y: T.y, fall: 30, plaza: 0.9 });
  p.path([[cx, cz], [(cx + T.x) / 2, (cz + T.z) / 2 + 30], [T.x - T.r, T.z]], { width: 3.2, fall: 4, smooth: 6 });
}

// ─────────────────────────────────────────────────────────────── Glimmer Grotto

export function planGlimmer(p: Plan): void {
  const G = GROTTO;
  // landing beach at the cave mouth (east)
  const mx = G.mouthX + 8;
  p.pier([[mx - 6, G.z + 12], [mx + 30, G.z + 16]], { width: 2.8, deckY: 1.5, style: 'jetty', endPlatform: 6, lamps: 0, railStart: 3 });
  p.setSpawn(G.x + 62, G.z + 2);
  p.setBoatSpawn(mx + 30, G.z + 26);
  p.sign(mx - 10, G.z + 20, Math.PI / 2);
  p.npc('luma', G.x + 40, G.z - 16, -Math.PI / 2 - 0.5);
  p.npc('echo', G.pool.x + G.pool.r + 3, G.pool.z, -Math.PI / 2);
}

// ─────────────────────────────────────────────────────────────── Keeper's Monolith

export function planKeepers(p: Plan): void {
  const P = KEEPER_PLAZA;
  p.pad(P.x, P.z, P.r, { y: P.y, fall: 24, plaza: 1 });
  const H = landing(p, towardHome(p), 420, { dock: 36 });
  const [ax, az] = H.at(-40, 0);
  p.path([[ax, az], [(ax + P.x) / 2, (az + P.z) / 2], [P.x, P.z]], { width: 3.6, fall: 4, smooth: 5 });
  // altar in front of the statue, facing the approach
  const ang = Math.atan2(H.dz, H.dx);
  const alx = P.x + Math.cos(ang) * 14;
  const alz = P.z + Math.sin(ang) * 14;
  p.interact('altar', 'altar', alx, alz, 'Moonlit Altar · Enchant Rod', { y: P.y + 0.9, radius: 3.5 });
  p.npc('keeper', alx + Math.cos(ang) * 3 - Math.sin(ang) * 3, alz + Math.sin(ang) * 3 + Math.cos(ang) * 3, face(0, 0, Math.cos(ang), Math.sin(ang)), P.y);
  const [sx, sz] = H.at(-30, 10);
  p.npc('sable', sx, sz, H.seaRot);
}

// ─────────────────────────────────────────────────────────────── Ashen Reach

export function planAshen(p: Plan): void {
  const M = MAGMA;
  p.pad(M.x, M.z, M.r, { y: M.y + 1.8, fall: 30, dirt: 0.3 });
  p.t.addCustom([M.x - 80, M.z - 80, M.x + 80, M.z + 80], (lx, lz, h) => {
    for (const [x, z, r] of MAGMA_POOLS) {
      const d = dist(lx, lz, x, z);
      if (d < r + 4) h = Math.min(h, M.y - 1.6 + 3.4 * s(r - 3, r + 3.5, d));
    }
    return h;
  });
  const H = landing(p, -Math.PI / 2 + 0.25, 640, { dock: 38 });
  const [fx, fz] = H.at(-40, 0);
  p.pad(fx, fz, 20, { y: Math.max(2.4, Math.min(5, p.h(fx, fz))), fall: 14, dirt: 0.8 });
  const [vx, vz] = H.at(-42, 10);
  p.npc('vulk', vx, vz, H.seaRot);
  p.path([[fx, fz], [(fx + M.x) / 2 + 20, (fz + M.z) / 2], [M.x - 10, M.z - M.r * 0.8]], { width: 3.2, smooth: 6 });
  const [px, pz] = MAGMA_POOLS[0];
  p.npc('cinder', px + 4, pz - 22, 0, undefined);
  void VOLCANO;
}

export const PLANS: Record<string, (p: Plan) => void> = {
  driftwood_harbor: planDriftwood,
  coral_crescent: planCoral,
  sunspire_isle: planSunspire,
  turtleback_atoll: planTurtleback,
  stone_arch: planStoneArch,
  mirewood_bayou: planMirewood,
  frostpeak: planFrostpeak,
  wreckers_cove: planWreckers,
  elder_isle: planElder,
  glimmer_grotto: planGlimmer,
  keepers_monolith: planKeepers,
  ashen_reach: planAshen,
};
