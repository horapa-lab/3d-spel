import { describe, expect, it } from 'vitest';
import type { EnchantDef, RodDef } from '../src/core/types';
import { makeRng } from '../src/core/rng';
import { collectPassives, PASSIVE_DEFAULTS, PASSIVE_IDS, PassiveSet, zoneRequirement } from '../src/game/fishing/passives';

const rod = (passive?: RodDef['passive']): RodDef => ({
  id: 'r', name: 'Rod', description: '', tier: 1, price: 0, unlockLevel: 1, soldAt: null, obtain: 'shop', obtainHint: '',
  stats: { lureSpeed: 0, luck: 0, control: 0, resilience: 0, maxKg: 10 }, passive, visual: {},
});
const ench = (id: string, effect: EnchantDef['effect']): EnchantDef => ({ id, name: id, pool: 'standard', weight: 1, description: '', effect });

describe('passives', () => {
  it('every contract PASSIVE_ID has a default entry', () => {
    expect(PASSIVE_IDS.length).toBe(20);
    for (const id of PASSIVE_IDS) expect(PASSIVE_DEFAULTS[id]).toBeDefined();
  });

  it('collects rod passive + enchant effects; values add up, chances combine', () => {
    const set = PassiveSet.from(rod({ id: 'coin_bonus', name: 'Midas', description: '', value: 0.2 }), [
      ench('a', { id: 'coin_bonus', value: 0.1 }),
      ench('b', { id: 'double_catch', chance: 0.5 }),
      ench('c', { id: 'double_catch', chance: 0.5 }),
    ]);
    expect(set.list.length).toBe(4);
    expect(set.value('coin_bonus')).toBeCloseTo(0.3);
    expect(set.chance('double_catch')).toBeCloseTo(0.75);
    expect(set.value('xp_bonus')).toBe(0);
    expect(set.chance('quick_bite')).toBe(0);
    expect(collectPassives(null, [null, undefined]).length).toBe(0);
  });

  it('fills in defaults when value / chance are missing', () => {
    const set = PassiveSet.from(rod({ id: 'reel_power', name: 'x', description: '' }), [ench('q', { id: 'quick_bite' })]);
    expect(set.value('reel_power')).toBe(PASSIVE_DEFAULTS.reel_power.value);
    expect(set.chance('quick_bite')).toBeCloseTo(PASSIVE_DEFAULTS.quick_bite.chance!);
  });

  it('roll() triggers at the configured chance', () => {
    const set = PassiveSet.from(rod({ id: 'luck_burst', name: 'x', description: '', chance: 0.3, value: 0.5 }));
    const rng = makeRng(3);
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (set.roll('luck_burst', rng)) hits++;
    expect(hits / 20000).toBeCloseTo(0.3, 1);
  });

  it('situational luck: weather / night / day / zone / burst', () => {
    const set = PassiveSet.from(rod({ id: 'night_luck', name: 'x', description: '', value: 0.4 }), [
      ench('w', { id: 'weather_luck', value: 0.25 }),
      ench('d', { id: 'day_luck', value: 0.1 }),
      ench('z', { id: 'zone_luck', value: 0.5, zones: ['coral_crescent'] }),
    ]);
    expect(set.situationalLuck({ zone: 'x', weather: 'clear', time: 'night' })).toBeCloseTo(0.4);
    expect(set.situationalLuck({ zone: 'x', weather: 'rain', time: 'night' })).toBeCloseTo(0.65);
    expect(set.situationalLuck({ zone: 'x', weather: 'fog', time: 'day' })).toBeCloseTo(0.35);
    expect(set.situationalLuck({ zone: 'coral_crescent', weather: 'clear', time: 'day' })).toBeCloseTo(0.6);
    expect(set.situationalLuck({ zone: 'x', weather: 'clear', time: 'day', burstLuck: 0.5 })).toBeCloseTo(0.6);
  });

  it('zone requirements: heat_proof for lava, abyss_proof for the trench', () => {
    const none = new PassiveSet([]);
    expect(zoneRequirement('ashen_lava', none)).toBe('heat_proof');
    expect(zoneRequirement('abyssal_trench', none)).toBe('abyss_proof');
    expect(zoneRequirement('driftwood_harbor', none)).toBeNull();
    const hp = PassiveSet.from(rod(), [ench('h', { id: 'heat_proof' })]);
    expect(hp.missingRequirement('ashen_lava')).toBeNull();
    expect(hp.missingRequirement('abyssal_trench')).toBe('abyss_proof');
  });
});
