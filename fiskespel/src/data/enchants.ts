import type { EnchantDef } from '../core/types';
/**
 * Rod enchants, applied with relics at the Keeper's altar (night only). OWNER: economy.
 *
 *  - `standard` / `exalted` relics roll the MAIN slot (index 0 of save.rodEnchants[rodId]).
 *  - `cosmic` relics roll the SECONDARY slot (index 1).
 *  - `stats` are additive rod stat modifiers (economy.effectiveRodStats()).
 *  - `effect.id` is from PASSIVE_IDS (docs/CONTRACT.md), same semantics as rod passives; the fishing
 *    system implements them (read via economy.rodEnchants() / economy.activeEffects()).
 *  - `weight` is the relative roll weight inside the pool.
 */
export const ENCHANTS: EnchantDef[] = [
  // ── standard ─────────────────────────────────────────────────────────────
  { id: 'brisk', name: 'Brisk', pool: 'standard', weight: 10,
    description: 'Fish bite 25% sooner.', stats: { lureSpeed: 0.25 } },
  { id: 'fortunate', name: 'Fortunate', pool: 'standard', weight: 10,
    description: '+30% luck on every cast.', stats: { luck: 0.3 } },
  { id: 'firm_grip', name: 'Firm Grip', pool: 'standard', weight: 9,
    description: 'A wider reel bar (+0.05 control).', stats: { control: 0.05 } },
  { id: 'tideproof', name: 'Tideproof', pool: 'standard', weight: 9,
    description: 'Hooked fish thrash 20% less.', stats: { resilience: 0.2 } },
  { id: 'feather_cast', name: 'Feather Cast', pool: 'standard', weight: 8,
    description: '+12% lure speed and +0.03 control.', stats: { lureSpeed: 0.12, control: 0.03 } },
  { id: 'nightwatch', name: 'Nightwatch', pool: 'standard', weight: 7,
    description: '+60% luck at night.', effect: { id: 'night_luck', value: 0.6 } },
  { id: 'sunlit', name: 'Sunlit', pool: 'standard', weight: 7,
    description: '+40% luck during the day.', effect: { id: 'day_luck', value: 0.4 } },
  { id: 'rainchaser', name: 'Rainchaser', pool: 'standard', weight: 6,
    description: '+70% luck in rain, storms and fog.', effect: { id: 'weather_luck', value: 0.7 } },
  { id: 'hearty', name: 'Hearty', pool: 'standard', weight: 6,
    description: 'Catches come out heavier (weight roll skewed up).', effect: { id: 'size_up', value: 0.3 } },
  { id: 'magpie', name: 'Magpie', pool: 'standard', weight: 5,
    description: 'Treasure maps turn up 2.5× as often.', effect: { id: 'treasure_sense', value: 1.5 } },
  { id: 'haggler', name: 'Haggler', pool: 'standard', weight: 6,
    description: 'Every catch is worth 12% more.', effect: { id: 'coin_bonus', value: 0.12 } },
  { id: 'studious', name: 'Studious', pool: 'standard', weight: 6,
    description: '+30% XP from catches.', effect: { id: 'xp_bonus', value: 0.3 } },
  { id: 'spoolsurge', name: 'Spoolsurge', pool: 'standard', weight: 6,
    description: 'Reel progress fills 15% faster.', effect: { id: 'reel_power', value: 0.15 } },
  { id: 'nimble_wrist', name: 'Nimble Wrist', pool: 'standard', weight: 6,
    description: 'Each shake shortens the wait 60% more.', effect: { id: 'shake_master', value: 0.6 } },

  // ── exalted ──────────────────────────────────────────────────────────────
  { id: 'twin_hook', name: 'Twin Hook', pool: 'exalted', weight: 6,
    description: '8% chance to land a second fish of the same species.', effect: { id: 'double_catch', chance: 0.08 } },
  { id: 'gilded', name: 'Gilded', pool: 'exalted', weight: 5,
    description: '3% chance to turn an unmutated catch Golden.', effect: { id: 'mutation_touch', chance: 0.03, mutation: 'golden' } },
  { id: 'flawless', name: 'Flawless', pool: 'exalted', weight: 6,
    description: 'Perfect catches are worth 40% more; +0.02 control.', stats: { control: 0.02 },
    effect: { id: 'perfect_bonus', value: 0.4 } },
  { id: 'windfall', name: 'Windfall', pool: 'exalted', weight: 6,
    description: '10% chance per cast of +100% luck for 45 s.', effect: { id: 'luck_burst', chance: 0.1, value: 1.0 } },
  { id: 'second_look', name: 'Second Look', pool: 'exalted', weight: 6,
    description: '25% chance to re-roll a common or trash catch.', effect: { id: 'rarity_up', chance: 0.25 } },
  { id: 'eager_hook', name: 'Eager Hook', pool: 'exalted', weight: 5,
    description: '+10% lure speed; 10% chance a fish bites the moment you land.', stats: { lureSpeed: 0.1 },
    effect: { id: 'quick_bite', chance: 0.1 } },
  { id: 'titan_line', name: 'Titan Line', pool: 'exalted', weight: 5,
    description: 'Doubles max weight, no overweight penalty; +10% resilience.', stats: { resilience: 0.1 },
    effect: { id: 'heavy_lifter', value: 1.0 } },
  { id: 'emberward', name: 'Emberward', pool: 'exalted', weight: 3,
    description: 'Lets the rod fish the Magma Pools.', effect: { id: 'heat_proof' } },
  { id: 'pressure_seal', name: 'Pressure Seal', pool: 'exalted', weight: 3,
    description: 'Lets the rod fish the Abyssal Trench.', effect: { id: 'abyss_proof' } },

  // ── cosmic (secondary slot) ──────────────────────────────────────────────
  { id: 'starlit', name: 'Starlit', pool: 'cosmic', weight: 8,
    description: '+50% luck and +15% lure speed.', stats: { luck: 0.5, lureSpeed: 0.15 } },
  { id: 'stillwater', name: 'Stillwater', pool: 'cosmic', weight: 7,
    description: 'Hooked fish move 30% less; +0.02 control.', stats: { control: 0.02 },
    effect: { id: 'calm_waters', value: 0.3 } },
  { id: 'wayfinder', name: 'Wayfinder', pool: 'cosmic', weight: 6,
    description: '+80% luck anywhere out on the open sea.',
    effect: { id: 'zone_luck', value: 0.8, zones: ['open_ocean', 'deep_ocean', 'abyssal_trench'] } },
  { id: 'tidesage', name: 'Tidesage', pool: 'cosmic', weight: 6,
    description: '+50% XP and +15% luck.', stats: { luck: 0.15 }, effect: { id: 'xp_bonus', value: 0.5 } },
  { id: 'prism_heart', name: 'Prism Heart', pool: 'cosmic', weight: 3,
    description: '1% chance to turn an unmutated catch Prismatic.', effect: { id: 'mutation_touch', chance: 0.01, mutation: 'prismatic' } },
  { id: 'veilweaver', name: 'Veilweaver', pool: 'cosmic', weight: 2,
    description: 'The Keeper’s own weave: 0.6% chance a catch turns Ethereal.', effect: { id: 'mutation_touch', chance: 0.006, mutation: 'ethereal' } },
];

export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

/** Which rod slot a relic pool writes to. */
export const ENCHANT_SLOT: Record<EnchantDef['pool'], 0 | 1> = { standard: 0, exalted: 0, cosmic: 1 };
