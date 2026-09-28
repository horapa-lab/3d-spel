/**
 * Temporary boosts (potions, rewarded ads) + world-event multipliers. Pure. OWNER: economy.
 */
import type { Boost, WorldEventDef } from '../../core/types';

export type BoostField = 'luckMult' | 'lureMult' | 'xpMult' | 'sellMult' | 'mutationMult';

export function pruneBoosts(boosts: readonly Boost[], now: number): Boost[] {
  return boosts.filter((b) => b.expiresAt > now);
}

/** Product of one multiplier over all active boosts (missing = 1). */
export function boostProduct(boosts: readonly Boost[], field: BoostField, now: number): number {
  let m = 1;
  for (const b of boosts) {
    if (b.expiresAt <= now) continue;
    const v = b[field];
    if (typeof v === 'number' && v > 0) m *= v;
  }
  return m;
}

/**
 * Add a boost. The same id never stacks multiplicatively: it keeps the stronger multipliers and
 * extends the duration (remaining time + new duration, capped at `maxStackMs`).
 */
export function mergeBoost(boosts: readonly Boost[], b: Boost, now: number, maxStackMs = 60 * 60 * 1000): Boost[] {
  const live = pruneBoosts(boosts, now);
  const i = live.findIndex((x) => x.id === b.id);
  if (i < 0) return [...live, { ...b }];
  const old = live[i];
  const added = Math.max(0, b.expiresAt - now);
  const merged: Boost = { ...old, ...b, expiresAt: Math.min(now + maxStackMs, Math.max(old.expiresAt, now) + added) };
  for (const k of ['luckMult', 'lureMult', 'xpMult', 'sellMult', 'mutationMult'] as const) {
    const a = old[k];
    const c = b[k];
    if (a !== undefined || c !== undefined) merged[k] = Math.max(a ?? 1, c ?? 1);
  }
  const out = [...live];
  out[i] = merged;
  return out;
}

export function eventDef(events: readonly WorldEventDef[], id: string | null | undefined): WorldEventDef | null {
  return (id && events.find((e) => e.id === id)) || null;
}
