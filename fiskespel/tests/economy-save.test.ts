import { describe, expect, it } from 'vitest';
import { loadSave, newSave, sanitize, SAVE_VERSION, serializeSave, type SaveCatalog } from '../src/game/economy/save';
import { createEconomy } from '../src/game/economy/index';
import { SAVE_KEY, STARTER_BOBBER, STARTER_ROD, START_LOCATION, BACKPACK_START } from '../src/data/constants';
import { fakeCtx } from './economy-fixtures';

const catalog: SaveCatalog = {
  rods: { [STARTER_ROD]: 1, good_rod: 1 },
  baits: { worm: 1 },
  items: { [STARTER_BOBBER]: { kind: 'bobber' }, old_map: { kind: 'treasure_map' }, relic_a: { kind: 'relic' } },
  boats: { rowboat: 1 },
  fish: { perch: 1, cod: 1 },
  locations: { [START_LOCATION]: 1, coral_crescent: 1 },
  enchants: { brisk: 1, starlit: 1 },
  treasureMapId: 'old_map',
};

/** What the original lead stub wrote (version 1). */
function v1Save() {
  return {
    version: 1, coins: 1234, xp: 40, level: 7, rods: [STARTER_ROD, 'good_rod'], equippedRod: 'good_rod',
    rodEnchants: { good_rod: ['brisk', 'starlit'] }, baits: { worm: 12 }, equippedBait: 'worm', items: { relic_a: 2 },
    bobbers: [STARTER_BOBBER], equippedBobber: STARTER_BOBBER, boats: ['rowboat'], equippedBoat: 'rowboat',
    backpack: [
      { uid: 'a', fishId: 'perch', kg: 1.2, mutation: null, attributes: [], size: 'normal', value: 20, zone: START_LOCATION, caughtAt: 1, perfect: false, odds: 3 },
      { uid: 'b', fishId: 'gone_fish', kg: 3, mutation: null, attributes: [], size: 'big', value: 55, zone: START_LOCATION, caughtAt: 2, perfect: true, odds: 9 },
    ],
    backpackSize: 30,
    bestiary: { perch: { caught: 3, bestKg: 1.2, bestValue: 20, mutations: [], firstCaughtAt: 1 } },
    claimedBestiaryZones: [], discovered: [START_LOCATION, 'coral_crescent'],
    quests: [], questCooldowns: {},
    treasureMaps: [{ id: 'm1', target: null }, { id: 'm2', target: [10, 20] }],
    boosts: [{ id: 'old', label: 'Old', luckMult: 2, expiresAt: 5 }],
    stats: { catches: 9, perfect: 2, coinsEarned: 999, playSeconds: 600, biggestKg: 3, rarest: 'perch' },
    settings: { music: 0.3, sfx: 0.9, quality: 'high', autoReelUnlocked: false, showTutorial: false },
    spawn: { location: 'coral_crescent' }, lastSeen: 100,
  };
}

describe('economy save', () => {
  it('newSave has the contract defaults', () => {
    const s = newSave();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.rods).toEqual([STARTER_ROD]);
    expect(s.equippedRod).toBe(STARTER_ROD);
    expect(s.bobbers).toEqual([STARTER_BOBBER]);
    expect(s.backpackSize).toBe(BACKPACK_START);
    expect(s.discovered).toEqual([START_LOCATION]);
    expect(s.level).toBe(1);
  });

  it('migrates a v1 save: maps → items, unknown fish refunded, expired boosts dropped', () => {
    const r = loadSave(JSON.stringify(v1Save()), catalog, 1000);
    const s = r.save;
    expect(r.fromVersion).toBe(1);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.items.old_map).toBe(1); // undecoded map became an item
    expect(s.treasureMaps).toEqual([{ id: 'm2', target: [10, 20] }]);
    expect(s.backpack.map((f) => f.uid)).toEqual(['a']);
    expect(r.refunded).toBe(55);
    expect(s.coins).toBe(1234 + 55);
    expect(s.boosts).toEqual([]);
    expect(s.equippedRod).toBe('good_rod');
    expect(s.rodEnchants.good_rod).toEqual(['brisk', 'starlit']);
    expect(s.stats.questsCompleted).toBe(0);
    expect(s.settings.quality).toBe('high');
    expect(s.spawn.location).toBe('coral_crescent');
    expect(s.level).toBe(7);
    expect(s.xp).toBe(40);
  });

  it('never throws on garbage and falls back to a fresh save', () => {
    for (const junk of ['', '{', 'null', '[]', '42', '"x"', JSON.stringify({ coins: 'lots', level: -3, rods: 'nope' })]) {
      const r = loadSave(junk, catalog);
      expect(r.save.rods).toContain(STARTER_ROD);
      expect(r.save.level).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(r.save.coins)).toBe(true);
    }
  });

  it('repairs invalid equipment and clamps numbers', () => {
    const raw = {
      ...v1Save(), version: 2, equippedRod: 'missing_rod', rods: ['missing_rod'], equippedBait: 'worm', baits: { worm: 0 },
      equippedBobber: 'nope', level: 9999, coins: -50, backpackSize: 5,
      rodEnchants: { good_rod: ['unknown_ench', 'starlit'], ghost_rod: ['brisk'] },
    };
    const { save } = sanitize(raw, catalog);
    expect(save.rods).toEqual([STARTER_ROD]);
    expect(save.equippedRod).toBe(STARTER_ROD);
    expect(save.equippedBait).toBeNull();
    expect(save.equippedBobber).toBe(STARTER_BOBBER);
    expect(save.level).toBe(150);
    expect(save.coins).toBeGreaterThanOrEqual(0);
    expect(save.backpackSize).toBe(BACKPACK_START);
    expect(save.rodEnchants).toEqual({ good_rod: ['', 'starlit'] });
  });

  it('round-trips losslessly and keeps unknown top-level keys', () => {
    const s = newSave(1);
    s.coins = 77;
    (s as unknown as Record<string, unknown>).futureField = { a: 1 };
    const r = loadSave(serializeSave(s), null, 1);
    expect(r.save.coins).toBe(77);
    expect((r.save as unknown as Record<string, unknown>).futureField).toEqual({ a: 1 });
    expect(r.notes).not.toContain('invalid save');
  });

  it('createEconomy loads from the platform, debounces saves and restores the backup on corruption', async () => {
    const good = newSave();
    good.coins = 4321;
    const f = fakeCtx({ stored: { [SAVE_KEY]: JSON.stringify(good) } });
    const eco = await createEconomy(f.ctx);
    expect(eco.coins()).toBe(4321);
    expect(f.store.get(SAVE_KEY + '.bak')).toBeDefined();
    const writesBefore = f.counters.writes;
    eco.addCoins(10, 'test');
    eco.update(0.016); // debounced: not yet written
    expect(f.counters.writes).toBe(writesBefore);
    eco.save_();
    expect(JSON.parse(f.store.get(SAVE_KEY)!).coins).toBe(4331);

    // Corrupt main save → backup copy is used.
    const f2 = fakeCtx({ stored: { [SAVE_KEY]: '{broken', [SAVE_KEY + '.bak']: JSON.stringify(good) } });
    const eco2 = await createEconomy(f2.ctx);
    expect(eco2.coins()).toBe(4321);
  });
});
