/**
 * Rod passives + enchant effects share one vocabulary (PASSIVE_IDS in docs/CONTRACT.md).
 * This module turns a rod + its enchants into a queryable set. Pure — no THREE, no DOM.
 */
import type { EnchantDef, RodDef, TimeOfDay, Weather } from '../../core/types';

export const PASSIVE_IDS = [
  'luck_burst',
  'mutation_touch',
  'double_catch',
  'coin_bonus',
  'xp_bonus',
  'quick_bite',
  'heavy_lifter',
  'calm_waters',
  'heat_proof',
  'abyss_proof',
  'perfect_bonus',
  'treasure_sense',
  'weather_luck',
  'night_luck',
  'day_luck',
  'size_up',
  'zone_luck',
  'rarity_up',
  'reel_power',
  'shake_master',
] as const;
export type PassiveId = (typeof PASSIVE_IDS)[number];

export interface PassiveSpec {
  id: string;
  chance?: number;
  value?: number;
  mutation?: string;
  zones?: string[];
  /** 'rod:<id>' or 'enchant:<id>' — for toasts / debugging. */
  source: string;
  /** Display name of the source (rod passive name or enchant name). */
  name: string;
}

/** Defaults used when a definition leaves out `value` / `chance`. */
export const PASSIVE_DEFAULTS: Record<PassiveId, { chance?: number; value?: number }> = {
  luck_burst: { chance: 0.1, value: 0.5 },
  mutation_touch: { chance: 0.05 },
  double_catch: { chance: 0.05 },
  coin_bonus: { value: 0.1 },
  xp_bonus: { value: 0.1 },
  quick_bite: { chance: 0.1 },
  heavy_lifter: { value: 0.5 },
  calm_waters: { value: 0.2 },
  heat_proof: {},
  abyss_proof: {},
  perfect_bonus: { value: 0.25 },
  treasure_sense: { value: 1 },
  weather_luck: { value: 0.3 },
  night_luck: { value: 0.3 },
  day_luck: { value: 0.3 },
  size_up: { value: 0.3 },
  zone_luck: { value: 0.3 },
  rarity_up: { chance: 0.15 },
  reel_power: { value: 0.15 },
  shake_master: { value: 0.5 },
};

/** Luck-burst duration (seconds). */
export const LUCK_BURST_SECONDS = 45;
/** Weathers that count for `weather_luck`. */
export const WEATHER_LUCK_WEATHERS: Weather[] = ['rain', 'storm', 'fog'];

const def = (id: string) => (PASSIVE_DEFAULTS as Record<string, { chance?: number; value?: number }>)[id] ?? {};

/** Collect the rod passive + every enchant effect into one list. */
export function collectPassives(rod: RodDef | null | undefined, enchants: (EnchantDef | null | undefined)[] = []): PassiveSpec[] {
  const out: PassiveSpec[] = [];
  if (rod?.passive?.id) {
    const p = rod.passive;
    out.push({ id: p.id, chance: p.chance, value: p.value, mutation: p.mutation, zones: p.zones, source: `rod:${rod.id}`, name: p.name || rod.name });
  }
  for (const e of enchants) {
    if (!e?.effect?.id) continue;
    const f = e.effect;
    out.push({ id: f.id, chance: f.chance, value: f.value, mutation: f.mutation, zones: f.zones, source: `enchant:${e.id}`, name: e.name });
  }
  return out;
}

/** Queryable passive set. Values of the same id add up; chances combine as independent rolls. */
export class PassiveSet {
  constructor(readonly list: PassiveSpec[] = []) {}

  static from(rod: RodDef | null | undefined, enchants: (EnchantDef | null | undefined)[] = []): PassiveSet {
    return new PassiveSet(collectPassives(rod, enchants));
  }

  has(id: string): boolean {
    return this.list.some((p) => p.id === id);
  }

  all(id: string): PassiveSpec[] {
    return this.list.filter((p) => p.id === id);
  }

  /** Sum of `value` over all sources of `id` (defaults filled in). 0 when absent. */
  value(id: string): number {
    let v = 0;
    for (const p of this.list) if (p.id === id) v += p.value ?? def(id).value ?? 0;
    return v;
  }

  /** Probability that at least one source of `id` triggers: 1 - Π(1 - chance). 0 when absent. */
  chance(id: string): number {
    let miss = 1;
    let any = false;
    for (const p of this.list) {
      if (p.id !== id) continue;
      any = true;
      const c = Math.min(1, Math.max(0, p.chance ?? def(id).chance ?? 0));
      miss *= 1 - c;
    }
    return any ? 1 - miss : 0;
  }

  /** Roll `id` once; returns the triggering source or null. */
  roll(id: string, rng: () => number = Math.random): PassiveSpec | null {
    for (const p of this.list) {
      if (p.id !== id) continue;
      const c = Math.min(1, Math.max(0, p.chance ?? def(id).chance ?? 0));
      if (rng() < c) return p;
    }
    return null;
  }

  /** Luck bonus from situational passives (weather/night/day/zone + an active luck burst). */
  situationalLuck(s: { zone: string | null; weather: Weather; time: TimeOfDay; burstLuck?: number }): number {
    let luck = s.burstLuck ?? 0;
    for (const p of this.list) {
      switch (p.id) {
        case 'weather_luck':
          if (WEATHER_LUCK_WEATHERS.includes(s.weather)) luck += p.value ?? def(p.id).value ?? 0;
          break;
        case 'night_luck':
          if (s.time === 'night') luck += p.value ?? def(p.id).value ?? 0;
          break;
        case 'day_luck':
          if (s.time === 'day') luck += p.value ?? def(p.id).value ?? 0;
          break;
        case 'zone_luck':
          if (s.zone && (!p.zones || p.zones.length === 0 || p.zones.includes(s.zone))) luck += p.value ?? def(p.id).value ?? 0;
          break;
      }
    }
    return luck;
  }

  /** Zone access rule: returns the missing passive id, or null when fishing is allowed. */
  missingRequirement(zone: string | null): 'heat_proof' | 'abyss_proof' | null {
    return zoneRequirement(zone, this);
  }
}

/** Zones that need a special passive. */
export const ZONE_REQUIREMENTS: Record<string, 'heat_proof' | 'abyss_proof'> = {
  ashen_lava: 'heat_proof',
  abyssal_trench: 'abyss_proof',
};

export function zoneRequirement(zone: string | null, passives: PassiveSet): 'heat_proof' | 'abyss_proof' | null {
  if (!zone) return null;
  const need = ZONE_REQUIREMENTS[zone];
  if (!need) return null;
  return passives.has(need) ? null : need;
}
