/**
 * Angler quests. Pure. OWNER: economy.
 *
 * Each angler NPC asks for one species from their own location (or its sub-zones), rewards
 * ≈ 6–8 × the species' average sale value in coins and 6–8 × its XP, with a small chance of a
 * bonus relic / bait crate / totem. After a turn-in the angler rests for QUEST_COOLDOWN_MS.
 */
import type { FishDef, ItemDef, LocationDef, NpcDef, QuestState, Rarity } from '../../core/types';
import type { Rng } from '../../core/rng';
import { RARITIES } from '../../data/rarities';
import { avgValue } from './fishmath';

export const QUEST_COOLDOWN_MS = 2 * 60 * 1000;
export const QUEST_BONUS_CHANCE = 0.14;
export const QUEST_MULT_MIN = 6;
export const QUEST_MULT_MAX = 8;

/** Total pick weight of each rarity bucket (split evenly between species of that rarity). */
export const QUEST_RARITY_WEIGHT: Partial<Record<Rarity, number>> = {
  common: 1.0,
  uncommon: 0.85,
  unusual: 0.6,
  rare: 0.35,
  legendary: 0.08,
};

function questPoolAt(zones: Set<string>, fish: readonly FishDef[]): FishDef[] {
  return fish.filter((f) => zones.has(f.zone) && !f.event && QUEST_RARITY_WEIGHT[f.rarity] !== undefined);
}

/** Fish an angler at `location` may ask for. Falls back to the nearest-tier zone with fish. */
export function questPool(location: string, fish: readonly FishDef[], locations: readonly LocationDef[]): FishDef[] {
  const zones = new Set([location, ...locations.filter((l) => l.parent === location).map((l) => l.id)]);
  let pool = questPoolAt(zones, fish);
  if (pool.length) return pool;
  const here = locations.find((l) => l.id === location);
  const tier = here?.tier ?? 1;
  const others = [...locations].sort((a, b) => Math.abs(a.tier - tier) - Math.abs(b.tier - tier));
  for (const l of others) {
    pool = questPoolAt(new Set([l.id]), fish);
    if (pool.length) return pool;
  }
  return [];
}

export function pickQuestFish(pool: readonly FishDef[], rng: Rng, avoid?: string | null): FishDef | null {
  const list = pool.length > 1 && avoid ? pool.filter((f) => f.id !== avoid) : [...pool];
  if (!list.length) return null;
  const perRarity = new Map<Rarity, number>();
  for (const f of list) perRarity.set(f.rarity, (perRarity.get(f.rarity) ?? 0) + 1);
  const w = (f: FishDef) => (QUEST_RARITY_WEIGHT[f.rarity] ?? 0) / (perRarity.get(f.rarity) ?? 1);
  const total = list.reduce((a, f) => a + w(f), 0);
  let r = rng() * total;
  for (const f of list) {
    r -= w(f);
    if (r < 0) return f;
  }
  return list[list.length - 1];
}

/** Candidate bonus items: relics, bait crates and totems that have a model/def. Cheaper = likelier. */
export function questBonusPool(items: readonly ItemDef[], tier: number): { id: string; weight: number }[] {
  const out: { id: string; weight: number }[] = [];
  for (const it of items) {
    if (it.kind !== 'relic' && it.kind !== 'bait_crate' && it.kind !== 'totem') continue;
    const order = RARITIES[it.rarity]?.order ?? 1;
    // Keep bonus items roughly in line with the zone: rarer items only from later anglers.
    if (order > 2 + Math.floor(tier / 15)) continue;
    const price = it.price ?? 2000 * (order + 1);
    out.push({ id: it.id, weight: 1 / Math.sqrt(Math.max(50, price)) });
  }
  return out;
}

export function generateQuest(
  npc: NpcDef,
  fish: readonly FishDef[],
  locations: readonly LocationDef[],
  items: readonly ItemDef[],
  rng: Rng,
  now: number,
  lastFishId?: string | null,
): QuestState | null {
  const pool = questPool(npc.location, fish, locations);
  const f = pickQuestFish(pool, rng, lastFishId);
  if (!f) return null;
  const mult = QUEST_MULT_MIN + (QUEST_MULT_MAX - QUEST_MULT_MIN) * rng();
  const xpMult = QUEST_MULT_MIN + (QUEST_MULT_MAX - QUEST_MULT_MIN) * rng();
  const coins = Math.max(20, Math.round((avgValue(f) * mult) / 5) * 5);
  const baseXp = f.xp || RARITIES[f.rarity].xp;
  const xp = Math.max(10, Math.round(baseXp * xpMult));
  let bonusItem: string | null = null;
  if (rng() < QUEST_BONUS_CHANCE) {
    const tier = locations.find((l) => l.id === npc.location)?.tier ?? 1;
    const bp = questBonusPool(items, tier);
    const total = bp.reduce((a, b) => a + b.weight, 0);
    let r = rng() * total;
    for (const b of bp) {
      r -= b.weight;
      if (r < 0) {
        bonusItem = b.id;
        break;
      }
    }
  }
  return {
    id: `q_${npc.id}_${now.toString(36)}`,
    npcId: npc.id,
    fishId: f.id,
    rewardCoins: coins,
    rewardXp: xp,
    bonusItem,
  };
}
