/** Treasure map → decode → chest → loot, crates/potions/totems/backpack with mocked items. OWNER: economy. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/data/items', () => {
  const ITEMS = [
    { id: 'classic_bobber', name: 'Classic Bobber', kind: 'bobber', rarity: 'common', description: '', price: null, soldAt: null, visual: {} },
    { id: 'sea_map', name: 'Sea Map', kind: 'treasure_map', rarity: 'rare', description: '', price: null, soldAt: null, visual: {} },
    { id: 'old_chest', name: 'Old Chest', kind: 'treasure_chest', rarity: 'rare', description: '', price: null, soldAt: null, visual: {},
      loot: { rolls: 2, table: [{ kind: 'coins', min: 100, max: 100, weight: 1 }] } },
    { id: 'crate', name: 'Crate', kind: 'bait_crate', rarity: 'common', description: '', price: 120, soldAt: 'driftwood_harbor', visual: {},
      loot: { rolls: 3, table: [{ kind: 'bait', id: 'worm', min: 1, max: 2, weight: 1 }] } },
    { id: 'luck_tonic', name: 'Luck Tonic', kind: 'potion', rarity: 'uncommon', description: '', price: 300, soldAt: null, visual: {}, potion: { luckMult: 1.5, durationMin: 10 } },
    { id: 'rain_totem', name: 'Rain Totem', kind: 'totem', rarity: 'rare', description: '', price: 900, soldAt: 'sunspire_isle', visual: {}, totem: { weather: 'rain', durationMin: 8 } },
    { id: 'big_bag', name: 'Big Bag', kind: 'misc', rarity: 'uncommon', description: '', price: 1000, soldAt: null, visual: {}, backpack: { slots: 10 } },
  ];
  return { ITEMS, ITEM_BY_ID: Object.fromEntries(ITEMS.map((i) => [i.id, i])) };
});

import { createEconomy } from '../src/game/economy/index';
import { fakeCtx } from './economy-fixtures';

describe('treasure + consumables (mocked items)', () => {
  it('decode costs 250, spawns a chest interactable on land, opening pays loot + XP and removes it', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    eco.grantItem('sea_map', 1);
    expect(eco.mapCount!()).toBe(1);
    expect(eco.decodeMap!().ok).toBe(false); // no coins
    eco.addCoins(300, 'test');
    const d = eco.decodeMap!();
    expect(d.ok).toBe(true);
    expect(eco.coins()).toBe(50);
    expect(eco.mapCount!()).toBe(0);
    const chest = f.world.interactables.find((i) => i.kind === 'chest')!;
    expect(chest.data?.treasureId).toBe('old_chest');
    expect(f.world.terrainHeight(chest.position.x, chest.position.z)).toBeGreaterThanOrEqual(-1.2);
    expect(f.built).toContain('item:old_chest');
    expect(eco.save.treasureMaps.length).toBe(1);

    // Persisted chests respawn in a new session.
    eco.save_();
    const f2 = fakeCtx({ stored: Object.fromEntries(f.store) });
    await createEconomy(f2.ctx);
    expect(f2.world.interactables.filter((i) => i.kind === 'chest').length).toBe(1);

    const xpBefore = eco.save.xp + eco.save.level * 1e6;
    f.ctx.events.emit('interact', { target: chest });
    expect(eco.coins()).toBe(250);
    expect(eco.save.xp + eco.save.level * 1e6).toBeGreaterThan(xpBefore);
    expect(f.world.interactables.includes(chest)).toBe(false);
    expect(eco.save.treasureMaps).toEqual([]);
    expect(eco.save.stats.treasuresFound).toBe(1);
  });

  it('crates, potions, totems and backpack upgrades', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    eco.addCoins(120, 'test');
    const shop = eco.shopFor('pip');
    const crate = shop.find((e) => e.id === 'crate')!;
    expect(eco.buy(crate)).toBe(true);
    const r = eco.useItem('crate');
    expect(r.ok).toBe(true);
    expect(eco.save.baits.worm).toBeGreaterThanOrEqual(3);

    eco.grantItem('luck_tonic', 1);
    expect(eco.useItem('luck_tonic').ok).toBe(true);
    expect(eco.luckMultiplier()).toBeCloseTo(1.5);
    expect(eco.activeBoosts().length).toBe(1);

    eco.grantItem('rain_totem', 1);
    expect(eco.useItem('rain_totem').ok).toBe(true);
    expect(f.overrides[0]).toMatchObject({ weather: 'rain', durationMs: 8 * 60000 });

    const size = eco.save.backpackSize;
    eco.addCoins(1000, 'test');
    const bag = eco.shopFor('marla').find((e) => e.id === 'big_bag')!;
    expect(eco.buy(bag)).toBe(true);
    expect(eco.save.backpackSize).toBe(size + 10);
    expect(eco.save.items.big_bag).toBeUndefined();
  });
});
