/**
 * Island content planning (no meshes): stamps, model placements, NPC spots, interactables,
 * walkables/colliders, pier structures, scatter rules and custom build-time features.
 * All plan-API coordinates are LOCAL to the island centre; stored results are WORLD coords.
 */
import type { Interactable, NpcDef } from '../../core/types';
import { NPC_BY_ID } from '../../data/npcs';
import { LOCATION_BY_ID } from '../../data/world';
import type { IslandTerrain } from './terrain';
import type { Collider, Walkable } from './physics';

export type LodClass = 'landmark' | 'large' | 'medium' | 'small' | 'tiny';
export type ModelKindW = 'building' | 'prop' | 'vegetation';

export interface Placement {
  kind: ModelKindW;
  id: string;
  x: number;
  z: number;
  /** absolute y, or null = ground at (x,z) */
  y: number | null;
  yOff: number;
  rot: number;
  scale: number;
  seed: number;
  lod: LodClass;
  collide: boolean;
  /** tilt (radians) about local X / Z, e.g. wrecks */
  tiltX?: number;
  tiltZ?: number;
  opts?: Record<string, unknown>;
}

export interface NpcSpot {
  npcId: string;
  x: number;
  y: number | null;
  z: number;
  rot: number;
}

export interface InteractSpot {
  id: string;
  kind: Interactable['kind'];
  x: number;
  y: number | null;
  z: number;
  radius: number;
  label: string;
  npcId?: string;
  data?: Record<string, unknown>;
}

export interface PierSpec {
  type: 'pier';
  /** world polyline of the deck centre */
  pts: [number, number][];
  width: number;
  deckY: number;
  /** rope railing on both sides */
  rail: boolean;
  /** lamp posts every N metres (0 = none) */
  lamps: number;
  /** 'pier' (weathered, tall posts) | 'boardwalk' (low, narrow) | 'jetty' (rustic) */
  style: 'pier' | 'boardwalk' | 'jetty' | 'dock';
  /** end platform size (0 = none) */
  endPlatform: number;
  /** skip railing within this distance of the start (m) */
  railStart?: number;
}

export interface BridgeSpec {
  type: 'bridge';
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y0: number;
  y1: number;
  width: number;
  arch: number;
  style: 'wood' | 'rope' | 'stone';
}

export interface StairSpec {
  type: 'stairs';
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y0: number;
  y1: number;
  width: number;
  style: 'wood' | 'stone';
}

export type Structure = PierSpec | BridgeSpec | StairSpec;

export interface ScatterRule {
  kind: ModelKindW;
  /** one model id or several (random choice) */
  ids: string[];
  /** instances per hectare at full probability */
  density: number;
  minH?: number;
  maxH?: number;
  maxSlope?: number;
  minSlope?: number;
  /** clumping: probability *= smoothstep(lo, hi, fbm(x/scale)) */
  clump?: { scale: number; lo: number; hi: number; seed?: number };
  scale?: [number, number];
  /** extra probability test (local coords) */
  test?: (lx: number, lz: number, h: number, slope: number) => number;
  /** keep this far from exclusion circles */
  clearance?: number;
  /** sink into ground (m) */
  sink?: number;
  /** 'tree' | 'bush' | 'rock' | 'small' (distance culling class) */
  cls?: 'tree' | 'bush' | 'rock' | 'small';
  /** tilt randomly up to N radians */
  tilt?: number;
  /** restrict to a region (local circle) */
  region?: { x: number; z: number; r: number };
  seed?: number;
}

/** Build-time hook for custom meshes (arch, cave, statue base, lake ice, lava...). */
export type FeatureFn = (fc: unknown) => void;

const ROLE_LABEL: Record<NpcDef['role'], string> = {
  merchant: 'Merchant',
  shipwright: 'Shipwright',
  appraiser: 'Appraiser',
  angler: 'Angler',
  totem_carver: 'Totem Carver',
  keeper: 'Keeper of the Altar',
  treasure_hunter: 'Treasure Hunter',
  innkeeper: 'Innkeeper',
  bait_vendor: 'Bait Vendor',
  rod_crafter: 'Rod Crafter',
  bestiary_keeper: 'Archivist',
  villager: 'Villager',
};

export class Plan {
  t: IslandTerrain;
  id: string;
  cx: number;
  cz: number;
  placements: Placement[] = [];
  npcs: NpcSpot[] = [];
  interacts: InteractSpot[] = [];
  walkables: Walkable[] = [];
  colliders: Collider[] = [];
  structures: Structure[] = [];
  features: FeatureFn[] = [];
  scatter: ScatterRule[] = [];
  /** exclusion circles for scatter (world coords) */
  exclude: { x: number; z: number; r: number }[] = [];
  spawn: { x: number; y: number | null; z: number } | null = null;
  boatSpawn: { x: number; z: number } | null = null;
  private seedCounter = 1;

  constructor(t: IslandTerrain) {
    this.t = t;
    this.id = t.layout.id;
    this.cx = t.layout.x;
    this.cz = t.layout.z;
  }

  /** local height incl. stamps so far (no sea floor) */
  h(lx: number, lz: number): number {
    return this.t.localHeight(lx, lz);
  }

  pad(lx: number, lz: number, r: number, o: { y?: number; fall?: number; dirt?: number; plaza?: number; sx?: number } = {}): number {
    const st = this.t.addPad(lx, lz, r, o);
    return st.y;
  }

  path(pts: [number, number][], o: Parameters<IslandTerrain['addPath']>[1] = {}): void {
    this.t.addPath(pts, o);
  }

  excludeCircle(lx: number, lz: number, r: number): void {
    this.exclude.push({ x: lx + this.cx, z: lz + this.cz, r });
  }

  place(
    kind: ModelKindW,
    id: string,
    lx: number,
    lz: number,
    rot = 0,
    o: { y?: number; yOff?: number; scale?: number; seed?: number; lod?: LodClass; collide?: boolean; opts?: Record<string, unknown>; clear?: number; tiltX?: number; tiltZ?: number } = {},
  ): Placement {
    const p: Placement = {
      kind,
      id,
      x: lx + this.cx,
      z: lz + this.cz,
      y: o.y ?? null,
      yOff: o.yOff ?? 0,
      rot,
      scale: o.scale ?? 1,
      seed: o.seed ?? this.seedCounter++ * 7919 + this.t.layout.seed * 104729,
      lod: o.lod ?? (kind === 'building' ? 'large' : 'medium'),
      collide: o.collide ?? true,
      opts: o.opts,
      tiltX: o.tiltX,
      tiltZ: o.tiltZ,
    };
    this.placements.push(p);
    if (o.clear !== 0) this.excludeCircle(lx, lz, o.clear ?? (kind === 'building' ? 7 : 1.5));
    return p;
  }

  /** Building on a flattened pad. `r` = footprint radius for the pad. */
  building(id: string, lx: number, lz: number, rot: number, r: number, o: { y?: number; dirt?: number; plaza?: number; seed?: number; opts?: Record<string, unknown>; lod?: LodClass; noPad?: boolean; yOff?: number } = {}): Placement {
    let y = o.y;
    if (!o.noPad) y = this.pad(lx, lz, r, { y: o.y, fall: Math.max(5, r * 0.7), dirt: o.dirt ?? 0.55, plaza: o.plaza });
    return this.place('building', id, lx, lz, rot, { y, seed: o.seed, opts: o.opts, lod: o.lod ?? 'large', clear: r + 2, yOff: o.yOff });
  }

  prop(id: string, lx: number, lz: number, rot = 0, o: Parameters<Plan['place']>[5] = {}): Placement {
    return this.place('prop', id, lx, lz, rot, { lod: 'small', ...o });
  }

  veg(id: string, lx: number, lz: number, rot = 0, o: Parameters<Plan['place']>[5] = {}): Placement {
    return this.place('vegetation', id, lx, lz, rot, { lod: 'medium', ...o });
  }

  /** Place an NPC + its interactable. rot = facing (0 = +Z). */
  npc(npcId: string, lx: number, lz: number, rot: number, y?: number): void {
    const def = NPC_BY_ID[npcId];
    if (!def) throw new Error(`unknown npc ${npcId}`);
    const x = lx + this.cx;
    const z = lz + this.cz;
    this.npcs.push({ npcId, x, y: y ?? null, z, rot });
    this.interacts.push({
      id: `npc:${npcId}`,
      kind: 'npc',
      x,
      y: y ?? null,
      z,
      radius: 2.8,
      label: `${def.name} · ${ROLE_LABEL[def.role]}`,
      npcId,
    });
    this.excludeCircle(lx, lz, 2);
  }

  interact(kind: Interactable['kind'], idSuffix: string, lx: number, lz: number, label: string, o: { y?: number; radius?: number; data?: Record<string, unknown> } = {}): void {
    this.interacts.push({
      id: `${kind}:${this.id}:${idSuffix}`,
      kind,
      x: lx + this.cx,
      y: o.y ?? null,
      z: lz + this.cz,
      radius: o.radius ?? 3,
      label,
      data: o.data,
    });
  }

  /** Welcome signpost + sign interactable at an island entrance. */
  sign(lx: number, lz: number, rot: number, text?: string): void {
    const name = text ?? LOCATION_BY_ID[this.id]?.name ?? this.id;
    this.prop('signpost', lx, lz, rot, { opts: { text: name }, lod: 'medium', seed: 1 });
    this.interact('sign', 'welcome', lx, lz, name, { radius: 3, data: { text: name, description: LOCATION_BY_ID[this.id]?.description ?? '' } });
  }

  /** Walkable rectangle (local centre). ang: rotation about Y. */
  walk(lx: number, lz: number, hw: number, hl: number, ang: number, y0: number, y1 = y0, extra: Partial<Walkable> = {}): Walkable {
    const w: Walkable = { cx: lx + this.cx, cz: lz + this.cz, hw, hl, ang, y0, y1, ...extra };
    this.walkables.push(w);
    return w;
  }

  colliderCircle(lx: number, lz: number, r: number, y0 = -50, y1 = 500): void {
    this.colliders.push({ kind: 'circle', x: lx + this.cx, z: lz + this.cz, r, y0, y1 });
  }

  colliderBox(lx: number, lz: number, hw: number, hd: number, ang: number, y0 = -50, y1 = 500): void {
    this.colliders.push({ kind: 'box', cx: lx + this.cx, cz: lz + this.cz, hw, hd, ang, y0, y1 });
  }

  /**
   * Pier / boardwalk along local points. Registers walkables for each segment (+ end platform).
   * Returns the local end point.
   */
  pier(
    pts: [number, number][],
    o: { width?: number; deckY?: number; rail?: boolean; lamps?: number; style?: PierSpec['style']; endPlatform?: number; railStart?: number } = {},
  ): [number, number] {
    const width = o.width ?? 3.2;
    const deckY = o.deckY ?? 1.7;
    const spec: PierSpec = {
      type: 'pier',
      pts: pts.map(([x, z]) => [x + this.cx, z + this.cz]),
      width,
      deckY,
      rail: o.rail ?? true,
      lamps: o.lamps ?? 0,
      style: o.style ?? 'pier',
      endPlatform: o.endPlatform ?? 0,
      railStart: o.railStart,
    };
    this.structures.push(spec);
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k];
      const [bx, bz] = pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      this.walk((ax + bx) / 2, (az + bz) / 2, width / 2 + 0.05, len / 2 + width * 0.3, ang, deckY);
      this.excludeCircle((ax + bx) / 2, (az + bz) / 2, len / 2 + 2);
    }
    const end = pts[pts.length - 1];
    if (spec.endPlatform > 0) {
      const [px, pz] = pts[pts.length - 2];
      const ang = Math.atan2(end[0] - px, end[1] - pz);
      const E = spec.endPlatform;
      const ex = end[0] + Math.sin(ang) * (E / 2 - width * 0.3);
      const ez = end[1] + Math.cos(ang) * (E / 2 - width * 0.3);
      this.walk(ex, ez, E / 2, E / 2, ang, deckY);
      this.excludeCircle(ex, ez, E * 0.7 + 2);
    }
    return end;
  }

  bridge(ax: number, az: number, bx: number, bz: number, o: { y0?: number; y1?: number; width?: number; arch?: number; style?: BridgeSpec['style'] } = {}): void {
    const y0 = o.y0 ?? Math.max(0.8, this.h(ax, az));
    const y1 = o.y1 ?? Math.max(0.8, this.h(bx, bz));
    const width = o.width ?? 2.6;
    const arch = o.arch ?? 1.2;
    this.structures.push({ type: 'bridge', ax: ax + this.cx, az: az + this.cz, bx: bx + this.cx, bz: bz + this.cz, y0, y1, width, arch, style: o.style ?? 'wood' });
    // two ramps + middle (approximate arch)
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const dx = (bx - ax) / 3;
    const dz = (bz - az) / 3;
    const ym = (y0 + y1) / 2 + arch;
    this.walk(ax + dx * 0.5, az + dz * 0.5, width / 2, len / 6 + 0.3, ang, y0, (y0 * 1 + ym * 2) / 3 + arch * 0.1);
    this.walk(ax + dx * 1.5, az + dz * 1.5, width / 2, len / 6 + 0.3, ang, (y0 + ym * 2) / 3 + arch * 0.1, (y1 + ym * 2) / 3 + arch * 0.1);
    this.walk(ax + dx * 2.5, az + dz * 2.5, width / 2, len / 6 + 0.3, ang, (y1 + ym * 2) / 3 + arch * 0.1, y1);
    this.excludeCircle((ax + bx) / 2, (az + bz) / 2, len / 2 + 2);
  }

  stairs(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, width = 3, style: StairSpec['style'] = 'stone'): void {
    this.structures.push({ type: 'stairs', ax: ax + this.cx, az: az + this.cz, bx: bx + this.cx, bz: bz + this.cz, y0, y1, width, style });
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    this.walk((ax + bx) / 2, (az + bz) / 2, width / 2, len / 2, ang, y0, y1);
  }

  feature(fn: (fc: never) => void): void {
    this.features.push(fn as FeatureFn);
  }

  addScatter(r: ScatterRule): void {
    this.scatter.push(r);
  }

  setSpawn(lx: number, lz: number, y?: number): void {
    this.spawn = { x: lx + this.cx, y: y ?? null, z: lz + this.cz };
  }

  setBoatSpawn(lx: number, lz: number): void {
    this.boatSpawn = { x: lx + this.cx, z: lz + this.cz };
  }
}
