/**
 * Fish value / weight maths used by economy (quests, appraiser, balance sim). Pure.
 * OWNER: economy.
 *
 * Weight, size label and value come from the fishing system's pure helpers
 * (src/game/fishing/roll.ts) so the appraiser can never disagree with a fresh catch:
 * kg = min + (max − min)·u², value = ceil(ceil(pricePerKg·kg)·mutation·attrs).
 */
import type { CaughtFish, FishDef, SizeLabel } from '../../core/types';
import type { Rng } from '../../core/rng';
import { MUTATIONS } from '../../data/mutations';
import { fishValue, rollWeight, sizeLabelFor } from '../fishing/roll';

export interface FishMath {
  rollWeight(def: FishDef, rng: Rng): number;
  sizeLabel(def: FishDef, kg: number): SizeLabel;
  /** Value without passives / sell multipliers. */
  value(def: FishDef, kg: number, mutation: string | null, attributes: string[]): number;
}

export const defaultFishMath: FishMath = {
  rollWeight: (def, rng) => rollWeight(def, rng, 0),
  sizeLabel: (def, kg) => sizeLabelFor(def, kg),
  value: (def, kg, mutation, attributes) => Math.max(1, fishValue(def, kg, mutation, attributes)),
};

/** Mean kg under the u² weight distribution. */
export function avgKg(def: Pick<FishDef, 'minKg' | 'maxKg'>): number {
  return def.minKg + (def.maxKg - def.minKg) / 3;
}

/** Sale value of an average-weight, un-mutated catch. */
export function avgValue(def: Pick<FishDef, 'minKg' | 'maxKg' | 'pricePerKg'>): number {
  return Math.max(1, Math.ceil(def.pricePerKg * avgKg(def)));
}

// ─────────────────────────────────────────────────────────── appraiser

/** Chance that an appraisal lands a mutation at all (before mutationMultiplier). */
export const APPRAISE_MUTATION_CHANCE = 0.3;
/** Relative weight of the special Keeper-only mutation(s) in appraisal rolls. */
export const APPRAISE_SPECIAL_WEIGHT = 0.0015;
export const APPRAISE_COST_FRACTION = 0.3;

export function appraiseCostFor(fish: Pick<CaughtFish, 'value'>): number {
  return Math.max(1, Math.ceil(fish.value * APPRAISE_COST_FRACTION));
}

/**
 * Mutation pool for appraisal: every natural mutation except event-bound ones, weighted by its
 * base chance; special ones (Keeper magic) at a tiny weight.
 */
export function appraisalMutationPool(): { id: string; weight: number }[] {
  const pool: { id: string; weight: number }[] = [];
  for (const m of MUTATIONS) {
    if (m.conditions?.event) continue;
    const w = m.special ? APPRAISE_SPECIAL_WEIGHT : m.chance;
    if (w > 0) pool.push({ id: m.id, weight: w });
  }
  return pool;
}

export function rollAppraisalMutation(rng: Rng, mutationMultiplier = 1): string | null {
  const p = Math.min(0.9, APPRAISE_MUTATION_CHANCE * Math.max(0, mutationMultiplier));
  if (rng() >= p) return null;
  const pool = appraisalMutationPool();
  const total = pool.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e.id;
  }
  return pool[pool.length - 1]?.id ?? null;
}

/**
 * Re-roll weight + mutation of a caught fish (attributes, species, zone, perfect… untouched).
 * Extra value multipliers the fishing system baked into `value` (coin_bonus, perfect_bonus…) are
 * preserved as a ratio over the recomputed base value.
 */
export function appraiseFish(fish: CaughtFish, def: FishDef, rng: Rng, mutationMultiplier = 1, math: FishMath = defaultFishMath): CaughtFish {
  const oldBase = math.value(def, fish.kg, fish.mutation, fish.attributes);
  // Clamp: guards against a mismatched value formula turning the ratio into an exploit.
  const bonus = oldBase > 0 ? Math.min(4, Math.max(1, fish.value / oldBase)) : 1;
  const kg = math.rollWeight(def, rng);
  const mutation = rollAppraisalMutation(rng, mutationMultiplier);
  const base = math.value(def, kg, mutation, fish.attributes);
  return {
    ...fish,
    kg,
    mutation,
    size: math.sizeLabel(def, kg),
    value: Math.max(1, Math.round(base * bonus)),
  };
}
