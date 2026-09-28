import { describe, expect, it } from 'vitest';
import type { BaitDef, FishDef, MutationDef, Rarity } from '../src/core/types';
import { makeRng } from '../src/core/rng';
import { RARITIES } from '../src/data/rarities';
import { MUTATIONS, ATTRIBUTES } from '../src/data/mutations';
import { FISH } from '../src/data/fish';
import { LOCATIONS } from '../src/data/world';
import {
  applyValueBonuses,
  baitMultiplier,
  catchXp,
  displayLengthForKg,
  effectiveLuck,
  fishPool,
  fishValue,
  fishWeight,
  formatOdds,
  mutationChances,
  mutationEligible,
  oddsFor,
  rarityDistribution,
  resolvePoolZone,
  rollAttributes,
  rollCatch,
  rollFish,
  rollMutation,
  rollWeight,
  sizeLabelFor,
  sizePercentile,
  weightedPool,
  type RollEnv,
  type SpeciesContext,
} from '../src/game/fishing/roll';

const fish = (id: string, rarity: Rarity, chance: number, extra: Partial<FishDef> = {}): FishDef => ({
  id,
  name: id,
  zone: 'test_bay',
  rarity,
  chance,
  minKg: 1,
  maxKg: 5,
  pricePerKg: 10,
  resilience: 1,
  xp: 10,
  description: '',
  visual: {},
  ...extra,
});

const POOL: FishDef[] = [
  fish('boot', 'trash', 8, { zone: '*' }),
  fish('perch', 'common', 55),
  fish('bass', 'uncommon', 24),
  fish('pike', 'rare', 9),
  fish('gar', 'legendary', 3),
  fish('ghost', 'mythical', 1),
  fish('owl', 'common', 20, { time: 'night' }),
  fish('rainbow', 'uncommon', 10, { weather: ['rain'] }),
  fish('icefin', 'uncommon', 10, { season: ['winter'] }),
  fish('bloodfin', 'limited', 5, { zone: '*', event: 'crimson_moon' }),
  fish('other_zone', 'common', 50, { zone: 'far_away' }),
];

const DAY: RollEnv = { isNight: false, weather: 'clear', season: 'summer', event: null };
const ctx = (o: Partial<SpeciesContext> = {}): SpeciesContext => ({ zone: 'test_bay', env: DAY, luck: 0, ...o });

function frequencies(c: SpeciesContext, n: number, seed = 7) {
  const rng = makeRng(seed);
  const out: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const r = rollFish(c, POOL, rng)!;
    out[r.def.id] = (out[r.def.id] ?? 0) + 1;
  }
  for (const k of Object.keys(out)) out[k] /= n;
  return out;
}

describe('species pool', () => {
  it('uses zone fish plus global "*" fish, event fish only during their event', () => {
    const ids = fishPool(POOL, 'test_bay', null).map((f) => f.id);
    expect(ids).toContain('boot');
    expect(ids).toContain('perch');
    expect(ids).not.toContain('bloodfin');
    expect(ids).not.toContain('other_zone');
    expect(fishPool(POOL, 'test_bay', 'crimson_moon').map((f) => f.id)).toContain('bloodfin');
    expect(fishPool(POOL, 'far_away', null).map((f) => f.id).sort()).toEqual(['boot', 'other_zone']);
  });

  it('falls back to a parent / open ocean pool when a zone has no own species', () => {
    const ocean = [...POOL, fish('sprat', 'common', 10, { zone: 'open_ocean' })];
    expect(resolvePoolZone(ocean, 'test_bay')).toBe('test_bay');
    expect(resolvePoolZone(ocean, 'nowhere')).toBe('open_ocean');
    const sub = LOCATIONS.find((l) => l.kind === 'sub' && l.parent)!;
    expect(resolvePoolZone([fish('p', 'common', 1, { zone: sub.parent! })], sub.id)).toBe(sub.parent);
  });

  it('frequencies match weights with no luck', () => {
    const f = frequencies(ctx(), 60_000);
    const w = weightedPool(ctx(), POOL);
    const total = w.reduce((s, x) => s + x.weight, 0);
    for (const x of w) expect(f[x.def.id] ?? 0).toBeCloseTo(x.weight / total, 2);
    // the night fish is at 10 % during the day
    expect(w.find((x) => x.def.id === 'owl')!.weight).toBeCloseTo(20 * 0.1);
  });

  it('odds are total / weight and consistent with observed frequencies', () => {
    const odds = oddsFor('gar', ctx(), POOL);
    const f = frequencies(ctx(), 80_000, 99);
    expect(1 / odds).toBeCloseTo(f.gar, 2);
    expect(oddsFor('bloodfin', ctx(), POOL)).toBe(Infinity);
    expect(formatOdds(2400)).toBe('1 in 2,400');
  });
});

describe('luck', () => {
  it('uses max(0, 1 + L × luckFactor) with L = (1 + luck) × multiplier − 1', () => {
    expect(effectiveLuck(0, 1)).toBe(0);
    expect(effectiveLuck(0.5, 2)).toBeCloseTo(2);
    expect(effectiveLuck(0, 2)).toBeCloseTo(1);
    const def = POOL.find((f) => f.id === 'gar')!;
    expect(fishWeight(def, ctx({ luck: 1 }))).toBeCloseTo(3 * (1 + RARITIES.legendary.luckFactor));
    // trash can be luck'd away but never negative
    const boot = POOL.find((f) => f.id === 'boot')!;
    expect(fishWeight(boot, ctx({ luck: 5 }))).toBe(0);
  });

  it('more luck shifts the rarity distribution up monotonically', () => {
    const order = (d: Partial<Record<Rarity, number>>) =>
      (Object.keys(d) as Rarity[]).reduce((s, r) => s + (d[r] ?? 0) * RARITIES[r].order, 0);
    let prevRare = 0;
    let prevOrder = 0;
    for (const luck of [0, 0.25, 0.5, 1, 2, 4]) {
      const d = rarityDistribution(ctx({ luck }), POOL);
      const rareUp = (d.rare ?? 0) + (d.legendary ?? 0) + (d.mythical ?? 0);
      expect(rareUp).toBeGreaterThan(prevRare);
      expect(order(d)).toBeGreaterThan(prevOrder);
      prevRare = rareUp;
      prevOrder = order(d);
    }
  });

  it('economy luck multiplier boosts rare catches even with zero rod luck', () => {
    const a = rarityDistribution(ctx({ luck: 0, luckMultiplier: 1 }), POOL);
    const b = rarityDistribution(ctx({ luck: 0, luckMultiplier: 2 }), POOL);
    expect(b.legendary!).toBeGreaterThan(a.legendary! * 1.8);
    expect(b.trash!).toBeLessThan(a.trash!);
  });

  it('observed luck effect in actual rolls', () => {
    const base = frequencies(ctx(), 40_000, 3);
    const lucky = frequencies(ctx({ luck: 1.5 }), 40_000, 3);
    expect(lucky.ghost).toBeGreaterThan(base.ghost * 2.5);
    expect(lucky.gar).toBeGreaterThan(base.gar * 1.8);
    expect(lucky.boot ?? 0).toBeLessThan(base.boot * 0.3);
  });
});

describe('time / weather / season / bait modifiers', () => {
  it('wrong time of day ×0.1, preferred weather ×1.35, season ×1.25 / ×0.85', () => {
    const owl = POOL.find((f) => f.id === 'owl')!;
    expect(fishWeight(owl, ctx({ env: { ...DAY, isNight: true } }))).toBeCloseTo(20);
    expect(fishWeight(owl, ctx())).toBeCloseTo(2);
    const rainbow = POOL.find((f) => f.id === 'rainbow')!;
    expect(fishWeight(rainbow, ctx({ env: { ...DAY, weather: 'rain' } }))).toBeCloseTo(13.5);
    expect(fishWeight(rainbow, ctx())).toBeCloseTo(10);
    const icefin = POOL.find((f) => f.id === 'icefin')!;
    expect(fishWeight(icefin, ctx({ env: { ...DAY, season: 'winter' } }))).toBeCloseTo(12.5);
    expect(fishWeight(icefin, ctx())).toBeCloseTo(8.5);
    // a fish without seasons is unaffected
    expect(fishWeight(POOL[1], ctx({ env: { ...DAY, season: 'winter' } }))).toBeCloseTo(55);
  });

  it('bait preferred luck applies to matching targets only', () => {
    const glow: BaitDef = {
      id: 'glow_worm', name: 'Glow Worm', description: '', rarity: 'uncommon', price: 10, soldAt: null,
      stats: { lureSpeed: 0, luck: 0, resilience: 0, preferredLuck: 2 }, preferred: { time: 'night' }, visual: {},
    };
    const owl = POOL.find((f) => f.id === 'owl')!;
    expect(baitMultiplier(glow, owl)).toBe(3);
    expect(baitMultiplier(glow, POOL[1])).toBe(1);
    const rare: BaitDef = { ...glow, id: 'squid_strip', preferred: { rarities: ['rare', 'legendary'] } };
    expect(baitMultiplier(rare, POOL.find((f) => f.id === 'pike')!)).toBe(3);
    expect(baitMultiplier(rare, POOL.find((f) => f.id === 'bass')!)).toBe(1);
    // fish that list the bait in preferredBait get at least ×1.5
    const plain: BaitDef = { ...glow, id: 'worm', stats: { ...glow.stats, preferredLuck: 0 }, preferred: undefined };
    expect(baitMultiplier(plain, fish('x', 'common', 1, { preferredBait: ['worm'] }))).toBe(1.5);
    const f = rarityDistribution(ctx({ bait: rare }), POOL);
    const g = rarityDistribution(ctx(), POOL);
    expect(f.rare!).toBeGreaterThan(g.rare! * 2);
  });

  it('event fish only bite during their event', () => {
    const ev = frequencies(ctx({ env: { ...DAY, event: 'crimson_moon' } }), 20_000, 5);
    expect(ev.bloodfin).toBeGreaterThan(0.01);
    expect(frequencies(ctx(), 20_000, 5).bloodfin).toBeUndefined();
  });
});

describe('weight & size', () => {
  const def = { minKg: 2, maxKg: 12 };
  it('is skewed light (u²): mean ≈ min + range/3, always within bounds', () => {
    const rng = makeRng(11);
    let sum = 0;
    const N = 50_000;
    for (let i = 0; i < N; i++) {
      const kg = rollWeight(def, rng);
      expect(kg).toBeGreaterThanOrEqual(2);
      expect(kg).toBeLessThanOrEqual(12);
      sum += kg;
    }
    expect(sum / N).toBeCloseTo(2 + 10 / 3, 1);
  });

  it('size_up skews heavier', () => {
    const a = makeRng(5);
    const b = makeRng(5);
    let s0 = 0;
    let s1 = 0;
    for (let i = 0; i < 20_000; i++) {
      s0 += rollWeight(def, a, 0);
      s1 += rollWeight(def, b, 0.6);
    }
    expect(s1).toBeGreaterThan(s0 * 1.2);
  });

  it('labels follow percentiles: tiny 10 %, small 25 %, normal 40 %, big 22 %, giant 3 %', () => {
    const rng = makeRng(21);
    const n: Record<string, number> = {};
    const N = 60_000;
    for (let i = 0; i < N; i++) {
      const s = sizeLabelFor({ minKg: 0.5, maxKg: 40 }, rollWeight({ minKg: 0.5, maxKg: 40 }, rng));
      n[s] = (n[s] ?? 0) + 1;
    }
    expect(n.tiny / N).toBeCloseTo(0.1, 1);
    expect(n.small / N).toBeCloseTo(0.25, 1);
    expect(n.normal / N).toBeCloseTo(0.4, 1);
    expect(n.big / N).toBeCloseTo(0.22, 1);
    expect(n.giant / N).toBeCloseTo(0.03, 1);
    expect(sizeLabelFor(def, 12)).toBe('giant');
    expect(sizeLabelFor(def, 2)).toBe('tiny');
    expect(sizePercentile({ minKg: 3, maxKg: 3 }, 3)).toBe(0.5);
  });

  it('display length is plausible and bounded', () => {
    expect(displayLengthForKg(1)).toBeGreaterThan(0.35);
    expect(displayLengthForKg(1)).toBeLessThan(0.6);
    expect(displayLengthForKg(0.05)).toBeGreaterThanOrEqual(0.16);
    expect(displayLengthForKg(50_000)).toBeLessThanOrEqual(3.2);
    expect(displayLengthForKg(100)).toBeGreaterThan(displayLengthForKg(10));
  });
});

describe('mutations & attributes', () => {
  const env: RollEnv = { isNight: true, weather: 'storm', season: 'winter', event: 'crimson_moon' };

  it('eligibility follows conditions and never rolls special mutations', () => {
    for (const m of MUTATIONS) {
      if (m.special) expect(mutationEligible(m, 'frostpeak', env)).toBe(false);
    }
    const byId = (id: string) => MUTATIONS.find((m) => m.id === id)!;
    expect(mutationEligible(byId('electric'), 'x', env)).toBe(true);
    expect(mutationEligible(byId('electric'), 'x', { ...env, weather: 'clear' })).toBe(false);
    expect(mutationEligible(byId('frosted'), 'frostpeak', env)).toBe(true);
    expect(mutationEligible(byId('frosted'), 'coral_crescent', env)).toBe(false);
    expect(mutationEligible(byId('dusky'), 'x', { ...env, isNight: false })).toBe(false);
    expect(mutationEligible(byId('crimson'), 'x', env)).toBe(true);
    expect(mutationEligible(byId('crimson'), 'x', { ...env, event: null })).toBe(false);
    const seasonal: MutationDef = { ...byId('albino'), id: 's', conditions: { season: ['summer'] } };
    expect(mutationEligible(seasonal, 'x', env)).toBe(false);
  });

  it('rolls at most one, each at its chance × multipliers', () => {
    const c = { zone: 'coral_crescent', env: { isNight: false, weather: 'clear' as const, season: 'summer' as const, event: null } };
    const chances = mutationChances(c);
    const rng = makeRng(123);
    const N = 200_000;
    const got: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const m = rollMutation(c, rng);
      if (m) got[m] = (got[m] ?? 0) + 1;
    }
    for (const x of chances) expect((got[x.def.id] ?? 0) / N).toBeCloseTo(x.chance, 2);
    // boosts scale
    const boosted = mutationChances({ ...c, mutationMultiplier: 2 });
    expect(boosted[0].chance).toBeCloseTo(chances[0].chance * 2);
  });

  it('event mutation boosts apply (golden tide ×6)', () => {
    const base = mutationChances({ zone: 'x', env: { isNight: false, weather: 'cloudy', season: 'summer', event: null } });
    const tide = mutationChances({ zone: 'x', env: { isNight: false, weather: 'cloudy', season: 'summer', event: 'golden_tide' } });
    const g0 = base.find((m) => m.def.id === 'golden')!.chance;
    const g1 = tide.find((m) => m.def.id === 'golden')!.chance;
    expect(g1).toBeCloseTo(g0 * 6);
  });

  it('attributes roll independently at their chance', () => {
    const rng = makeRng(8);
    const N = 100_000;
    const got: Record<string, number> = {};
    let both = 0;
    for (let i = 0; i < N; i++) {
      const a = rollAttributes(rng);
      for (const id of a) got[id] = (got[id] ?? 0) + 1;
      if (a.length === 2) both++;
    }
    for (const a of ATTRIBUTES) expect(got[a.id] / N).toBeCloseTo(a.chance, 2);
    expect(both / N).toBeCloseTo(ATTRIBUTES[0].chance * ATTRIBUTES[1].chance, 3);
  });
});

describe('value & xp', () => {
  it('value = ceil(ceil(pricePerKg × kg) × mutation × attributes)', () => {
    const def = { pricePerKg: 14 };
    expect(fishValue(def, 0.5, null, [])).toBe(7);
    expect(fishValue(def, 0.51, null, [])).toBe(8); // 7.14 → 8
    const golden = MUTATIONS.find((m) => m.id === 'golden')!.multiplier;
    const gleam = ATTRIBUTES.find((a) => a.id === 'gleaming')!.multiplier;
    const glit = ATTRIBUTES.find((a) => a.id === 'glittering')!.multiplier;
    expect(fishValue(def, 1.37, 'golden', [])).toBe(Math.ceil(Math.ceil(14 * 1.37) * golden));
    expect(fishValue(def, 1.37, 'golden', ['gleaming', 'glittering'])).toBe(Math.ceil(20 * golden * gleam * glit));
    expect(fishValue({ pricePerKg: 0.1 }, 3, null, [])).toBe(1); // float-safe: 0.30000000000000004 → 1
    expect(fishValue({ pricePerKg: 0.1 }, 30, null, [])).toBe(3);
  });

  it('coin / perfect bonuses', () => {
    expect(applyValueBonuses(100, { coinBonus: 0.25 })).toBe(125);
    expect(applyValueBonuses(100, { coinBonus: 0.25, perfectBonus: 0.2, perfect: true })).toBe(150);
    expect(applyValueBonuses(100, { perfectBonus: 0.2, perfect: false })).toBe(100);
  });

  it('xp = fish.xp × perfect × multiplier × (1 + xp_bonus)', () => {
    expect(catchXp({ xp: 10, rarity: 'common' }, {})).toBe(10);
    expect(catchXp({ xp: 10, rarity: 'common' }, { perfect: true })).toBe(15);
    expect(catchXp({ xp: 10, rarity: 'common' }, { perfect: true, xpMultiplier: 2, xpBonus: 0.5 })).toBe(45);
    expect(catchXp({ xp: 0, rarity: 'rare' }, {})).toBe(RARITIES.rare.xp);
  });
});

describe('full catch roll', () => {
  it('produces consistent catches (value matches formula, size matches kg)', () => {
    const rng = makeRng(2024);
    for (let i = 0; i < 2000; i++) {
      const c = rollCatch({ ...ctx({ luck: 0.3 }), sizeUp: 0.2 }, POOL, rng)!;
      expect(c).not.toBeNull();
      expect(c.kg).toBeGreaterThanOrEqual(c.def.minKg);
      expect(c.kg).toBeLessThanOrEqual(c.def.maxKg);
      expect(c.size).toBe(sizeLabelFor(c.def, c.kg));
      expect(c.value).toBe(fishValue(c.def, c.kg, c.mutation, c.attributes));
      expect(c.odds).toBeGreaterThanOrEqual(1);
    }
  });

  it('rarity_up re-rolls trash/common catches', () => {
    const count = (chance: number) => {
      const rng = makeRng(77);
      let common = 0;
      for (let i = 0; i < 20_000; i++) {
        const r = rollCatch({ ...ctx(), rarityUpChance: chance }, POOL, rng)!;
        if (r.def.rarity === 'common' || r.def.rarity === 'trash') common++;
      }
      return common / 20_000;
    };
    expect(count(1)).toBeLessThan(count(0) * 0.8);
  });

  it('mutation_touch forces its mutation when none rolled', () => {
    const rng = makeRng(4);
    let touched = 0;
    for (let i = 0; i < 5000; i++) {
      const r = rollCatch({ ...ctx(), mutationTouch: [{ chance: 1, mutation: 'ethereal' }] }, POOL, rng)!;
      expect(r.mutation).not.toBeNull();
      if (r.touched) {
        touched++;
        expect(r.mutation).toBe('ethereal');
      }
    }
    expect(touched).toBeGreaterThan(4000);
  });

  it('works against the live catalog: every fish zone has a non-empty pool', () => {
    const zones = new Set(FISH.map((f) => f.zone).filter((z) => z !== '*'));
    for (const z of zones) {
      const r = rollFish(ctx({ zone: z }), FISH, makeRng(1));
      expect(r, `zone ${z}`).not.toBeNull();
      expect(r!.odds).toBeGreaterThanOrEqual(1);
    }
  });
});
