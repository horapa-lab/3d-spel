/**
 * Enchanting maths. Pure. OWNER: economy.
 */
import type { ActiveEffect, EnchantDef, RodDef, RodStats } from '../../core/types';
import type { Rng } from '../../core/rng';
import { ENCHANTS, ENCHANT_BY_ID, ENCHANT_SLOT } from '../../data/enchants';

export type RelicPool = EnchantDef['pool'];

/** Weighted roll inside a pool. `exclude` (the enchant already in that slot) is never rolled again. */
export function rollEnchant(pool: RelicPool, rng: Rng, exclude?: string | null, list: readonly EnchantDef[] = ENCHANTS): EnchantDef | null {
  const cands = list.filter((e) => e.pool === pool && e.id !== exclude && e.weight > 0);
  const total = cands.reduce((a, e) => a + e.weight, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of cands) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return cands[cands.length - 1] ?? null;
}

/** Probability of each enchant id when rolling `pool` (optionally excluding one). */
export function enchantOdds(pool: RelicPool, exclude?: string | null, list: readonly EnchantDef[] = ENCHANTS): Record<string, number> {
  const cands = list.filter((e) => e.pool === pool && e.id !== exclude && e.weight > 0);
  const total = cands.reduce((a, e) => a + e.weight, 0);
  return Object.fromEntries(cands.map((e) => [e.id, total > 0 ? e.weight / total : 0]));
}

/** Put an enchant into its slot, returning the new slot array (index 0 main, 1 secondary). */
export function applyEnchantToSlots(slots: readonly string[] | undefined, ench: EnchantDef): string[] {
  const out = [...(slots ?? [])];
  const slot = ENCHANT_SLOT[ench.pool];
  while (out.length < slot) out.push('');
  out[slot] = ench.id;
  return out;
}

export function enchantDefs(slots: readonly string[] | undefined): EnchantDef[] {
  const out: EnchantDef[] = [];
  for (const id of slots ?? []) {
    const e = id ? ENCHANT_BY_ID[id] : undefined;
    if (e) out.push(e);
  }
  return out;
}

/** Rod stats + additive enchant stat modifiers (effects are NOT folded in — fishing reads them). */
export function effectiveStats(rod: Pick<RodDef, 'stats'>, enchants: readonly EnchantDef[]): RodStats {
  const s: RodStats = { ...rod.stats };
  for (const e of enchants) {
    if (!e.stats) continue;
    s.lureSpeed += e.stats.lureSpeed ?? 0;
    s.luck += e.stats.luck ?? 0;
    s.control += e.stats.control ?? 0;
    s.resilience += e.stats.resilience ?? 0;
    if (e.stats.maxKg) s.maxKg += e.stats.maxKg;
  }
  return s;
}

/** Rod passive + enchant effects as one list. */
export function collectEffects(rod: Pick<RodDef, 'passive'>, enchants: readonly EnchantDef[]): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  if (rod.passive) {
    const p = rod.passive;
    out.push({
      id: p.id,
      source: 'rod',
      ...(p.value !== undefined ? { value: p.value } : {}),
      ...(p.chance !== undefined ? { chance: p.chance } : {}),
      ...(p.mutation ? { mutation: p.mutation } : {}),
      ...(p.zones ? { zones: p.zones } : {}),
    });
  }
  for (const e of enchants) {
    if (!e.effect) continue;
    out.push({ ...e.effect, source: `enchant:${e.id}` });
  }
  return out;
}
