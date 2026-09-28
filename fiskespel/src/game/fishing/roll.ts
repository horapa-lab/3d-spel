/**
 * The three random layers of a catch — species × weight × mutation/attributes — as pure,
 * exported functions (no THREE, no DOM). The appraiser (economy) re-uses the weight /
 * mutation / value helpers.
 *
 *   species weight = chance × max(0, 1 + L × RARITIES[r].luckFactor)
 *                    × 0.1 at the wrong time of day
 *                    × 1.35 in a preferred weather
 *                    × 1.25 / 0.85 in a preferred / other season (fish with seasons only)
 *                    × (1 + bait.preferredLuck) when the bait prefers the fish
 *   L (effective luck) = (1 + luck) × luckMultiplier − 1
 *        luck = rod luck + bait luck + passive bonuses (fractions), luckMultiplier = economy boosts/events
 *   odds "1 in X" = Σ weights / weight
 *   kg = min + (max − min) × u^(2 − 1.4·sizeUp)          (skewed light; size_up skews heavy)
 *   size label = percentile of kg in the species' natural (u²) distribution
 *   value = ceil( ceil(pricePerKg × kg) × mutation × attributes ), then coin/perfect bonuses
 */
import type { AttributeDef, BaitDef, FishDef, MutationDef, Rarity, Season, SizeLabel, Weather, WorldEventDef } from '../../core/types';
import { RARITIES } from '../../data/rarities';
import { ATTRIBUTES, MUTATIONS } from '../../data/mutations';
import { LOCATION_BY_ID, WORLD_EVENTS } from '../../data/world';
import { REEL } from '../../data/constants';

export type Rng = () => number;

export const WRONG_TIME_MULT = 0.1;
export const WEATHER_MULT = 1.35;
export const SEASON_MULT = 1.25;
export const OFF_SEASON_MULT = 0.85;
/** Minimum preferredLuck used when a fish explicitly lists the equipped bait in `preferredBait`. */
export const PREFERRED_BAIT_MIN = 0.5;
/** Cap on the summed mutation chance of one catch (keeps "no mutation" possible). */
export const MAX_MUTATION_TOTAL = 0.9;
/** Base treasure-map chance per catch. */
export const TREASURE_MAP_CHANCE = 1 / 200;

export interface RollEnv {
  isNight: boolean;
  weather: Weather;
  season: Season;
  event: string | null;
}

export interface SpeciesContext {
  /** Fishing zone of the bobber. */
  zone: string;
  env: RollEnv;
  /** Additive luck fraction: rod luck + bait luck + passive bonuses (0.5 = +50 %). */
  luck: number;
  /** economy.luckMultiplier() — multiplies the total luck stat (1 + luck). Default 1. */
  luckMultiplier?: number;
  bait?: BaitDef | null;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ─────────────────────────────────────────────────────────────── species

/** Total luck stat (1 + luck) scaled by the global multiplier, returned as a fraction again. */
export function effectiveLuck(luck: number, luckMultiplier = 1): number {
  return (1 + luck) * Math.max(0, luckMultiplier) - 1;
}

/** Rarity luck scaling: max(0, 1 + L × luckFactor). */
export function luckScale(rarity: Rarity, effLuck: number): number {
  return Math.max(0, 1 + effLuck * (RARITIES[rarity]?.luckFactor ?? 0));
}

/** Fish catchable in `zone` right now: zone fish + global '*' fish; event fish only during their event. */
export function fishPool(fish: readonly FishDef[], zone: string, event: string | null): FishDef[] {
  return fish.filter((f) => (f.zone === zone || f.zone === '*') && (!f.event || f.event === event));
}

/**
 * Zone whose pool should be used for a bobber in `zone`. Falls back to the parent location
 * (sub-zones) and then the open ocean when a zone has no own species yet.
 */
export function resolvePoolZone(fish: readonly FishDef[], zone: string): string {
  const has = (z: string) => fish.some((f) => f.zone === z && !f.event);
  if (has(zone)) return zone;
  const parent = LOCATION_BY_ID[zone]?.parent;
  if (parent && has(parent)) return parent;
  if (has('open_ocean')) return 'open_ocean';
  return zone;
}

/** Does the bait's preference apply to this fish? */
export function baitPrefers(bait: BaitDef, fish: FishDef): boolean {
  if (fish.preferredBait?.includes(bait.id)) return true;
  const p = bait.preferred;
  if (!p) return false;
  if (p.fishIds?.includes(fish.id)) return true;
  const hasCriteria = !!(p.rarities?.length || p.zones?.length || p.time);
  if (!hasCriteria) return false;
  if (p.rarities?.length && !p.rarities.includes(fish.rarity)) return false;
  if (p.zones?.length && !p.zones.includes(fish.zone)) return false;
  if (p.time && fish.time !== p.time) return false;
  return true;
}

/** Species-weight multiplier from the equipped bait (1 when it does not apply). */
export function baitMultiplier(bait: BaitDef | null | undefined, fish: FishDef): number {
  if (!bait || !baitPrefers(bait, fish)) return 1;
  let pl = bait.stats?.preferredLuck ?? 0;
  if (fish.preferredBait?.includes(bait.id)) pl = Math.max(pl, PREFERRED_BAIT_MIN);
  return 1 + Math.max(0, pl);
}

/** Final (unnormalised) weight of one species in the current situation. */
export function fishWeight(def: FishDef, ctx: SpeciesContext): number {
  const L = effectiveLuck(ctx.luck, ctx.luckMultiplier ?? 1);
  let w = Math.max(0, def.chance) * luckScale(def.rarity, L);
  if (w <= 0) return 0;
  const time = ctx.env.isNight ? 'night' : 'day';
  if (def.time && def.time !== time) w *= WRONG_TIME_MULT;
  if (def.weather?.length && def.weather.includes(ctx.env.weather)) w *= WEATHER_MULT;
  if (def.season?.length) w *= def.season.includes(ctx.env.season) ? SEASON_MULT : OFF_SEASON_MULT;
  w *= baitMultiplier(ctx.bait, def);
  return w;
}

export interface WeightedFish {
  def: FishDef;
  weight: number;
}

/** Every catchable species with its weight (zone pool resolved, zero weights dropped). */
export function weightedPool(ctx: SpeciesContext, fish: readonly FishDef[]): WeightedFish[] {
  const zone = resolvePoolZone(fish, ctx.zone);
  const pool = fishPool(fish, zone, ctx.env.event);
  const out: WeightedFish[] = [];
  for (const def of pool) {
    const weight = fishWeight(def, ctx);
    if (weight > 0) out.push({ def, weight });
  }
  return out;
}

export interface SpeciesRoll {
  def: FishDef;
  weight: number;
  total: number;
  /** "1 in X". */
  odds: number;
}

/** Pick one species. Returns null when nothing can bite here. */
export function rollFish(ctx: SpeciesContext, fish: readonly FishDef[], rng: Rng = Math.random): SpeciesRoll | null {
  const pool = weightedPool(ctx, fish);
  let total = 0;
  for (const p of pool) total += p.weight;
  if (total <= 0 || pool.length === 0) return null;
  let r = rng() * total;
  let pick = pool[pool.length - 1];
  for (const p of pool) {
    r -= p.weight;
    if (r < 0) {
      pick = p;
      break;
    }
  }
  return { def: pick.def, weight: pick.weight, total, odds: oddsValue(total, pick.weight) };
}

function oddsValue(total: number, weight: number): number {
  if (weight <= 0) return Infinity;
  return Math.max(1, Math.round(total / weight));
}

/** "1 in X" odds for a species in the given situation (Infinity when not catchable). */
export function oddsFor(fishId: string, ctx: SpeciesContext, fish: readonly FishDef[]): number {
  const pool = weightedPool(ctx, fish);
  let total = 0;
  let w = 0;
  for (const p of pool) {
    total += p.weight;
    if (p.def.id === fishId) w = p.weight;
  }
  return oddsValue(total, w);
}

/** Probability per rarity in the given situation (sums to 1). */
export function rarityDistribution(ctx: SpeciesContext, fish: readonly FishDef[]): Partial<Record<Rarity, number>> {
  const pool = weightedPool(ctx, fish);
  let total = 0;
  const out: Partial<Record<Rarity, number>> = {};
  for (const p of pool) {
    total += p.weight;
    out[p.def.rarity] = (out[p.def.rarity] ?? 0) + p.weight;
  }
  if (total > 0) for (const k of Object.keys(out) as Rarity[]) out[k] = out[k]! / total;
  return out;
}

/** "1 in 2,400" */
export function formatOdds(odds: number): string {
  if (!Number.isFinite(odds)) return '—';
  return `1 in ${Math.max(1, Math.round(odds)).toLocaleString('en-US')}`;
}

// ─────────────────────────────────────────────────────────────── weight & size

export function weightExponent(sizeUp = 0): number {
  return 2 - 1.4 * clamp01(sizeUp);
}

export function roundKg(kg: number): number {
  if (kg < 100) return Math.round(kg * 100) / 100;
  if (kg < 10000) return Math.round(kg * 10) / 10;
  return Math.round(kg);
}

/** kg = min + (max − min) × u^p, skewed light (p = 2); `sizeUp` 0..1 skews it heavy. */
export function rollWeight(def: Pick<FishDef, 'minKg' | 'maxKg'>, rng: Rng = Math.random, sizeUp = 0): number {
  const lo = Math.min(def.minKg, def.maxKg);
  const hi = Math.max(def.minKg, def.maxKg);
  const kg = lo + (hi - lo) * Math.pow(rng(), weightExponent(sizeUp));
  return Math.min(hi, Math.max(lo, roundKg(kg)));
}

/** Percentile (0..1) of `kg` in the species' natural weight distribution. */
export function sizePercentile(def: Pick<FishDef, 'minKg' | 'maxKg'>, kg: number): number {
  const range = def.maxKg - def.minKg;
  if (!(range > 0)) return 0.5;
  return Math.sqrt(clamp01((kg - def.minKg) / range));
}

/** tiny < 10 %, small < 35 %, big ≥ 75 %, giant ≥ 97 %, else normal. */
export function sizeLabelFor(def: Pick<FishDef, 'minKg' | 'maxKg'>, kg: number): SizeLabel {
  const p = sizePercentile(def, kg);
  if (p >= 0.97) return 'giant';
  if (p >= 0.75) return 'big';
  if (p < 0.1) return 'tiny';
  if (p < 0.35) return 'small';
  return 'normal';
}

/** Plausible body length (m) for a fish of `kg` (W ≈ 0.01 g · L_cm³). */
export function fishLengthForKg(kg: number): number {
  return 0.464 * Math.cbrt(Math.max(0.001, kg));
}

/** Length used when showing a caught fish in the player's hands (compresses monsters). */
export function displayLengthForKg(kg: number): number {
  const L = fishLengthForKg(kg);
  const shown = L <= 1.1 ? L : 1.1 + (L - 1.1) * 0.35;
  return Math.min(3.2, Math.max(0.16, shown));
}

// ─────────────────────────────────────────────────────────────── mutations & attributes

export interface MutationContext {
  zone: string;
  env: RollEnv;
  /** economy.mutationMultiplier() (boosts). Default 1. */
  mutationMultiplier?: number;
  /** Extra multiplier from passives / anything else. Default 1. */
  passiveMult?: number;
}

/** Whether a mutation can roll naturally in this situation (never `special` ones). */
export function mutationEligible(m: MutationDef, zone: string, env: RollEnv): boolean {
  if (m.special || !(m.chance > 0)) return false;
  const c = m.conditions;
  if (!c) return true;
  if (c.zones?.length && !c.zones.includes(zone)) return false;
  if (c.weather?.length && !c.weather.includes(env.weather)) return false;
  if (c.time && (c.time === 'night') !== env.isNight) return false;
  if (c.event && c.event !== env.event) return false;
  if (c.season?.length && !c.season.includes(env.season)) return false;
  return true;
}

/** Event `mutationBoost` multiplier for a mutation (1 when none). */
export function eventMutationBoost(eventId: string | null, mutationId: string, events: readonly WorldEventDef[] = WORLD_EVENTS): number {
  if (!eventId) return 1;
  const ev = events.find((e) => e.id === eventId);
  const b = ev?.effects.mutationBoost?.find((x) => x.id === mutationId);
  return b ? Math.max(0, b.chanceMult) : 1;
}

export function mutationChances(ctx: MutationContext, mutations: readonly MutationDef[] = MUTATIONS): { def: MutationDef; chance: number }[] {
  const mult = Math.max(0, ctx.mutationMultiplier ?? 1) * Math.max(0, ctx.passiveMult ?? 1);
  const out: { def: MutationDef; chance: number }[] = [];
  for (const m of mutations) {
    if (!mutationEligible(m, ctx.zone, ctx.env)) continue;
    const chance = m.chance * mult * eventMutationBoost(ctx.env.event, m.id);
    if (chance > 0) out.push({ def: m, chance });
  }
  return out;
}

/** At most one mutation id (or null). Each eligible mutation gets its own chance. */
export function rollMutation(ctx: MutationContext, rng: Rng = Math.random, mutations: readonly MutationDef[] = MUTATIONS): string | null {
  const list = mutationChances(ctx, mutations);
  let total = 0;
  for (const m of list) total += m.chance;
  if (total <= 0) return null;
  const scale = total > MAX_MUTATION_TOTAL ? MAX_MUTATION_TOTAL / total : 1;
  let r = rng();
  for (const m of list) {
    r -= m.chance * scale;
    if (r < 0) return m.def.id;
  }
  return null;
}

/** Attributes roll independently and stack. */
export function rollAttributes(rng: Rng = Math.random, mult = 1, attributes: readonly AttributeDef[] = ATTRIBUTES): string[] {
  const out: string[] = [];
  for (const a of attributes) if (rng() < a.chance * Math.max(0, mult)) out.push(a.id);
  return out;
}

// ─────────────────────────────────────────────────────────────── value & xp

export function mutationValueMult(id: string | null | undefined, mutations: readonly MutationDef[] = MUTATIONS): number {
  if (!id) return 1;
  return mutations.find((m) => m.id === id)?.multiplier ?? 1;
}

export function attributesValueMult(ids: readonly string[] | null | undefined, attributes: readonly AttributeDef[] = ATTRIBUTES): number {
  let m = 1;
  for (const id of ids ?? []) m *= attributes.find((a) => a.id === id)?.multiplier ?? 1;
  return m;
}

const ceilSafe = (x: number) => Math.ceil(x - 1e-9);

/** value = ceil( ceil(pricePerKg × kg) × mutation × attributes ) */
export function fishValue(def: Pick<FishDef, 'pricePerKg'>, kg: number, mutation: string | null | undefined, attributes: readonly string[] | null | undefined): number {
  const base = ceilSafe(Math.max(0, def.pricePerKg) * Math.max(0, kg));
  return ceilSafe(base * mutationValueMult(mutation) * attributesValueMult(attributes));
}

/** Passive value bonuses: × (1 + coin_bonus), and × (1 + perfect_bonus) on a perfect catch. */
export function applyValueBonuses(value: number, o: { coinBonus?: number; perfectBonus?: number; perfect?: boolean }): number {
  let v = value * (1 + Math.max(0, o.coinBonus ?? 0));
  if (o.perfect) v *= 1 + Math.max(0, o.perfectBonus ?? 0);
  return ceilSafe(v);
}

/** XP = fish.xp × (perfect ? 1.5 : 1) × xpMultiplier × (1 + xp_bonus). */
export function catchXp(def: Pick<FishDef, 'xp' | 'rarity'>, o: { perfect?: boolean; xpMultiplier?: number; xpBonus?: number }): number {
  const base = def.xp > 0 ? def.xp : RARITIES[def.rarity]?.xp ?? 1;
  const xp = base * (o.perfect ? REEL.perfectXpMult : 1) * Math.max(0, o.xpMultiplier ?? 1) * (1 + Math.max(0, o.xpBonus ?? 0));
  return Math.max(1, Math.round(xp));
}

// ─────────────────────────────────────────────────────────────── one full catch

export interface CatchRollOptions extends SpeciesContext {
  mutationMultiplier?: number;
  /** size_up passive value (0..1). */
  sizeUp?: number;
  /** rarity_up chance (re-roll a trash/common species once). */
  rarityUpChance?: number;
  /** mutation_touch sources: forced mutation when none rolled. */
  mutationTouch?: { chance: number; mutation: string }[];
  coinBonus?: number;
}

export interface CatchRoll {
  def: FishDef;
  odds: number;
  kg: number;
  size: SizeLabel;
  mutation: string | null;
  attributes: string[];
  /** Value before perfect bonus (coin bonus included). */
  value: number;
  rerolled: boolean;
  touched: boolean;
}

/** Species (with rarity_up), then the weight/mutation/attribute layers for it. */
export function rollSpecies(o: CatchRollOptions, fish: readonly FishDef[], rng: Rng = Math.random): (SpeciesRoll & { rerolled: boolean }) | null {
  let s = rollFish(o, fish, rng);
  if (!s) return null;
  let rerolled = false;
  if ((s.def.rarity === 'trash' || s.def.rarity === 'common') && (o.rarityUpChance ?? 0) > 0 && rng() < (o.rarityUpChance ?? 0)) {
    const again = rollFish(o, fish, rng);
    if (again) {
      s = again;
      rerolled = true;
    }
  }
  return { ...s, rerolled };
}

/** Weight + mutation + attributes + value for an already chosen species. */
export function rollCatchLayers(def: FishDef, o: CatchRollOptions, rng: Rng = Math.random): Omit<CatchRoll, 'def' | 'odds' | 'rerolled'> {
  const kg = rollWeight(def, rng, o.sizeUp ?? 0);
  let mutation = rollMutation({ zone: o.zone, env: o.env, mutationMultiplier: o.mutationMultiplier }, rng);
  let touched = false;
  if (!mutation) {
    for (const t of o.mutationTouch ?? []) {
      if (t.mutation && rng() < t.chance) {
        mutation = t.mutation;
        touched = true;
        break;
      }
    }
  }
  const attributes = rollAttributes(rng);
  const value = applyValueBonuses(fishValue(def, kg, mutation, attributes), { coinBonus: o.coinBonus });
  return { kg, size: sizeLabelFor(def, kg), mutation, attributes, value, touched };
}

export function rollCatch(o: CatchRollOptions, fish: readonly FishDef[], rng: Rng = Math.random): CatchRoll | null {
  const s = rollSpecies(o, fish, rng);
  if (!s) return null;
  return { def: s.def, odds: s.odds, rerolled: s.rerolled, ...rollCatchLayers(s.def, o, rng) };
}
