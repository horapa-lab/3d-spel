/**
 * Bestiary pages (one per fishing zone) + completion rewards. Pure. OWNER: economy.
 *
 * A page lists every FishDef whose `zone` is that id ('*' = global/event page).
 * Completion (claimable reward) requires every fish on the page EXCEPT event-only fish,
 * `limited` and `secret` rarities (those still show and count for 100 % collectors, but never gate
 * the reward: they can be impossible to find for weeks).
 */
import type { BestiaryEntry, FishDef, ItemDef, LocationDef, RodDef } from '../../core/types';
import { RARITIES } from '../../data/rarities';
import { xpForLevel } from './progression';

export const GLOBAL_PAGE = '*';

export function pageFish(zoneId: string, fish: readonly FishDef[]): FishDef[] {
  return fish
    .filter((f) => f.zone === zoneId)
    .sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order || b.chance - a.chance || a.name.localeCompare(b.name));
}

export function isRequired(f: FishDef): boolean {
  return !f.event && f.rarity !== 'limited' && f.rarity !== 'secret';
}

export function pageProgress(
  zoneId: string,
  fish: readonly FishDef[],
  bestiary: Record<string, BestiaryEntry>,
): { caught: number; total: number; caughtAll: number; totalAll: number } {
  const list = pageFish(zoneId, fish);
  const req = list.filter(isRequired);
  return {
    caught: req.filter((f) => (bestiary[f.id]?.caught ?? 0) > 0).length,
    total: req.length,
    caughtAll: list.filter((f) => (bestiary[f.id]?.caught ?? 0) > 0).length,
    totalAll: list.length,
  };
}

/** Every page id that has at least one fish (locations first, in LOCATIONS order, then '*'). */
export function pageIds(fish: readonly FishDef[], locations: readonly LocationDef[]): string[] {
  const zones = new Set(fish.map((f) => f.zone));
  const out = locations.map((l) => l.id).filter((id) => zones.has(id));
  for (const z of zones) if (!out.includes(z) && z !== GLOBAL_PAGE) out.push(z);
  if (zones.has(GLOBAL_PAGE)) out.push(GLOBAL_PAGE);
  return out;
}

/** Pages that can be claimed (real locations with ≥ 1 required fish). */
export function claimablePages(fish: readonly FishDef[], locations: readonly LocationDef[]): string[] {
  return pageIds(fish, locations).filter((z) => z !== GLOBAL_PAGE && pageFish(z, fish).some(isRequired));
}

export function rewardCoins(tier: number): number {
  const raw = 500 * Math.pow(1 + Math.max(1, tier), 1.4);
  const step = raw < 10000 ? 50 : raw < 100000 ? 500 : 1000;
  return Math.round(raw / step) * step;
}

export function rewardXp(tier: number): number {
  return Math.round((2 * xpForLevel(Math.max(1, tier))) / 5) * 5;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function mentions(text: string, loc: LocationDef): boolean {
  const t = ` ${norm(text)} `;
  return t.includes(` ${norm(loc.name)} `) || t.includes(` ${norm(loc.id)} `) || norm(text).includes(loc.id.replace(/_/g, ' '));
}

/**
 * Explicit zone → bobber reward. Ids that do not exist in items.ts are ignored and the resolver
 * falls back to a bobber (price null) whose id/name/description mentions the zone.
 */
export const BESTIARY_BOBBERS: Record<string, string[]> = {
  driftwood_harbor: ['harbor_bobber', 'driftwood_bobber', 'anchor_bobber'],
  coral_crescent: ['coral_bobber', 'reef_bobber', 'shell_bobber'],
  sunspire_isle: ['sunspire_bobber', 'sun_bobber', 'scarab_bobber'],
  turtleback_atoll: ['turtle_bobber', 'atoll_bobber'],
  mirewood_bayou: ['mushroom_bobber', 'bayou_bobber', 'toadstool_bobber'],
  stone_arch: ['arch_bobber', 'stone_bobber'],
  frostpeak: ['frost_bobber', 'snowflake_bobber', 'ice_bobber'],
  frostpeak_lake: ['ice_bobber', 'frozen_bobber'],
  wreckers_cove: ['skull_bobber', 'pirate_bobber', 'wreck_bobber'],
  deep_ocean: ['deep_bobber', 'lantern_bobber'],
  elder_isle: ['amber_bobber', 'fossil_bobber', 'elder_bobber'],
  glimmer_grotto: ['crystal_bobber', 'glow_bobber', 'grotto_bobber'],
  keepers_monolith: ['rune_bobber', 'monolith_bobber'],
  ashen_reach: ['ember_bobber', 'obsidian_bobber', 'ash_bobber'],
  ashen_lava: ['magma_bobber', 'lava_bobber'],
  abyssal_trench: ['abyss_bobber', 'void_bobber', 'trench_bobber'],
  open_ocean: ['buoy_bobber', 'ocean_bobber', 'wave_bobber'],
};

export function bobberFor(zoneId: string, loc: LocationDef | undefined, items: readonly ItemDef[]): string | null {
  const bobbers = items.filter((i) => i.kind === 'bobber');
  const byId = new Set(bobbers.map((b) => b.id));
  for (const id of BESTIARY_BOBBERS[zoneId] ?? []) if (byId.has(id)) return id;
  if (!loc) return null;
  const free = bobbers.filter((b) => b.price === null || b.price === 0);
  const hit = free.find((b) => b.id.includes(zoneId) || mentions(`${b.id} ${b.name} ${b.description}`, loc));
  return hit?.id ?? null;
}

/** Rods with obtain 'bestiary' whose hint names this zone. */
export function rodFor(zoneId: string, loc: LocationDef | undefined, rods: readonly RodDef[]): string | null {
  if (!loc) return null;
  const hit = rods.find((r) => r.obtain === 'bestiary' && mentions(`${r.obtainHint} ${r.description}`, loc));
  return hit?.id ?? null;
}

/** Bestiary rods not tied to a single zone: granted when every claimable page is claimed. */
export function completionRods(rods: readonly RodDef[], locations: readonly LocationDef[]): string[] {
  return rods
    .filter((r) => r.obtain === 'bestiary')
    .filter((r) => !locations.some((l) => mentions(`${r.obtainHint} ${r.description}`, l)))
    .map((r) => r.id);
}

export function pageReward(
  zoneId: string,
  loc: LocationDef | undefined,
  items: readonly ItemDef[],
  rods: readonly RodDef[],
): { coins: number; xp: number; bobber: string | null; rod: string | null } {
  const tier = loc?.tier ?? 1;
  return { coins: rewardCoins(tier), xp: rewardXp(tier), bobber: bobberFor(zoneId, loc, items), rod: rodFor(zoneId, loc, rods) };
}
