/**
 * Loot tables for bait crates / treasure chests. Pure. OWNER: economy.
 */
import type { LootEntry } from '../../core/types';
import type { Rng } from '../../core/rng';

export interface LootDrop {
  kind: LootEntry['kind'];
  id?: string;
  amount: number;
}

export function randInt(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Roll one entry, weight-proportional. */
export function rollEntry(table: readonly LootEntry[], rng: Rng): LootEntry | null {
  let total = 0;
  for (const e of table) total += Math.max(0, e.weight);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const e of table) {
    r -= Math.max(0, e.weight);
    if (r < 0) return e;
  }
  return table[table.length - 1] ?? null;
}

/**
 * Roll `rolls` entries and merge identical (kind, id) drops.
 * `luck` (0 = none) tilts the weights towards low-weight (rarer) entries: w' = w^(1/(1+luck·0.5)).
 */
export function rollLoot(table: readonly LootEntry[], rolls: number, rng: Rng, luck = 0): LootDrop[] {
  const t = luck > 0 ? table.map((e) => ({ ...e, weight: Math.pow(Math.max(0, e.weight), 1 / (1 + luck * 0.5)) })) : table;
  const out: LootDrop[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(rolls)); i++) {
    const e = rollEntry(t, rng);
    if (!e) continue;
    const amount = randInt(rng, e.min, e.max);
    if (amount <= 0) continue;
    const same = out.find((d) => d.kind === e.kind && d.id === e.id);
    if (same) same.amount += amount;
    else out.push({ kind: e.kind, ...(e.id ? { id: e.id } : {}), amount });
  }
  return out;
}

/** Expected value summary of a table (for tests / tooling). */
export function lootExpectation(table: readonly LootEntry[], rolls: number): Map<string, number> {
  const total = table.reduce((a, e) => a + Math.max(0, e.weight), 0);
  const m = new Map<string, number>();
  if (total <= 0) return m;
  for (const e of table) {
    const key = e.id ? `${e.kind}:${e.id}` : e.kind;
    m.set(key, (m.get(key) ?? 0) + rolls * (Math.max(0, e.weight) / total) * ((e.min + e.max) / 2));
  }
  return m;
}
