/**
 * Treasure maps → a dig spot on land or shallow water near a discovered island. Pure. OWNER: economy.
 */
import type { ItemDef, Rarity } from '../../core/types';
import type { Rng } from '../../core/rng';
import { RARITIES } from '../../data/rarities';

export const TREASURE_DECODE_COST = 250;
/** Acceptable ground height for a chest: dry land or shallow water, not a mountain top. */
export const TREASURE_MIN_H = -1.2;
export const TREASURE_MAX_H = 9;

export interface IslandLike {
  id: string;
  center: { x: number; z: number };
  radius: number;
}

/**
 * Sample points in a ring around the island until one has a sensible ground height and is not
 * pushed by colliders (buildings/props). Returns null if nothing fits.
 */
export function findTreasureSpot(
  island: IslandLike,
  terrainHeight: (x: number, z: number) => number,
  rng: Rng,
  blocked?: (x: number, z: number) => boolean,
  tries = 80,
): { x: number; z: number; y: number } | null {
  const R = Math.max(10, island.radius);
  let best: { x: number; z: number; y: number; score: number } | null = null;
  for (let i = 0; i < tries; i++) {
    const a = rng() * Math.PI * 2;
    // Mostly inland / along the beach; later tries widen the ring.
    const spread = 0.25 + 1.05 * Math.sqrt(rng()) * (0.7 + (0.3 * i) / tries);
    const x = island.center.x + Math.cos(a) * R * spread;
    const z = island.center.z + Math.sin(a) * R * spread;
    const h = terrainHeight(x, z);
    if (!Number.isFinite(h) || h < TREASURE_MIN_H || h > TREASURE_MAX_H) continue;
    // Reject steep ground (chest would float / sink).
    const d = 1.2;
    const slope = Math.max(
      Math.abs(terrainHeight(x + d, z) - h),
      Math.abs(terrainHeight(x - d, z) - h),
      Math.abs(terrainHeight(x, z + d) - h),
      Math.abs(terrainHeight(x, z - d) - h),
    );
    if (slope > 0.9) continue;
    if (blocked?.(x, z)) continue;
    // Prefer beaches / low ground: most "treasure-like" and easy to reach by boat or swimming.
    const score = Math.abs(h - 1) + slope * 2;
    if (!best || score < best.score) best = { x, z, y: Math.max(h, TREASURE_MIN_H), score };
    if (score < 1.2 && i > 8) break;
  }
  return best ? { x: best.x, z: best.z, y: best.y } : null;
}

/** Pick a treasure chest item for an island of `tier` (rarer chests on later islands). */
export function pickChest(items: readonly ItemDef[], tier: number, rng: Rng): string | null {
  const chests = items.filter((i) => i.kind === 'treasure_chest');
  if (!chests.length) return null;
  const maxOrder = 2 + Math.floor(tier / 15); // uncommon early … legendary+ at tier 45+
  const w = (i: ItemDef) => {
    const o = RARITIES[i.rarity as Rarity]?.order ?? 2;
    if (o > maxOrder + 1) return 0;
    return o > maxOrder ? 0.15 : 1 / (1 + Math.abs(maxOrder - o) * 0.6);
  };
  const total = chests.reduce((a, c) => a + w(c), 0);
  if (total <= 0) return chests[0].id;
  let r = rng() * total;
  for (const c of chests) {
    r -= w(c);
    if (r < 0) return c.id;
  }
  return chests[chests.length - 1].id;
}
