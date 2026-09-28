/**
 * Shops, quests, bestiary rewards, enchant rolls, loot tables, economy flows. OWNER: economy.
 */
import { describe, expect, it } from 'vitest';
import type { BaitDef, FishDef, ItemDef, LocationDef, NpcDef, RodDef } from '../src/core/types';
import { buildShop, allShopEntries, type ShopData } from '../src/game/economy/shops';
import { generateQuest, questPool, QUEST_COOLDOWN_MS } from '../src/game/economy/quests';
import { avgValue } from '../src/game/economy/fishmath';
import { pageReward, rewardCoins, rewardXp, pageProgress } from '../src/game/economy/bestiary';
import { rollEnchant, enchantOdds, effectiveStats, applyEnchantToSlots } from '../src/game/economy/enchanting';
import { rollLoot, lootExpectation } from '../src/game/economy/loot';
import { mergeBoost, boostProduct } from '../src/game/economy/boosts';
import { xpForLevel, applyXp, totalXpToReach } from '../src/game/economy/progression';
import { ENCHANTS, ENCHANT_BY_ID } from '../src/data/enchants';
import { NPCS } from '../src/data/npcs';
import { RODS } from '../src/data/rods';
import { BAITS } from '../src/data/baits';
import { ITEMS } from '../src/data/items';
import { BOATS } from '../src/data/boats';
import { FISH } from '../src/data/fish';
import { LOCATIONS, WORLD_EVENTS } from '../src/data/world';
import { createEconomy } from '../src/game/economy/index';
import { fakeCtx, seqRng } from './economy-fixtures';

const PASSIVE_IDS = ['luck_burst', 'mutation_touch', 'double_catch', 'coin_bonus', 'xp_bonus', 'quick_bite', 'heavy_lifter', 'calm_waters', 'heat_proof', 'abyss_proof', 'perfect_bonus', 'treasure_sense', 'weather_luck', 'night_luck', 'day_luck', 'size_up', 'zone_luck', 'rarity_up', 'reel_power', 'shake_master'];

const npc = (id: string, role: NpcDef['role'], location: string): NpcDef => ({ id, name: id, role, location, lines: [], look: { body: 'average', skin: '', hair: '', outfit: '', accent: '' } });
const rod = (id: string, over: Partial<RodDef> = {}): RodDef => ({ id, name: id, description: '', tier: 2, price: 500, unlockLevel: 1, soldAt: 'isle', obtain: 'shop', obtainHint: '', stats: { lureSpeed: 0, luck: 0, control: 0, resilience: 0, maxKg: 50 }, visual: {}, ...over });
const bait = (id: string, price: number | null, soldAt: string | null): BaitDef => ({ id, name: id, description: '', rarity: 'common', price, soldAt, stats: { lureSpeed: 0, luck: 0, resilience: 0, preferredLuck: 0 }, visual: {} });
const item = (id: string, kind: ItemDef['kind'], price: number | null, soldAt: string | null, over: Partial<ItemDef> = {}): ItemDef => ({ id, name: id, kind, rarity: 'common', description: '', price, soldAt, visual: {}, ...over });
const fish = (id: string, zone: string, rarity: FishDef['rarity'], over: Partial<FishDef> = {}): FishDef => ({ id, name: id, zone, rarity, chance: 10, minKg: 1, maxKg: 4, pricePerKg: 10, resilience: 1, xp: 6, description: '', visual: {}, ...over });

describe('shops', () => {
  const data: ShopData = {
    npcs: [npc('m', 'merchant', 'isle'), npc('rc', 'rod_crafter', 'isle'), npc('bv', 'bait_vendor', 'isle'), npc('tc', 'totem_carver', 'desert'), npc('k', 'keeper', 'mono'), npc('s', 'merchant', 'mono'), npc('sw', 'shipwright', 'isle'), npc('inn', 'innkeeper', 'atoll')],
    rods: [rod('r1'), rod('r2', { price: 0 }), rod('r3', { soldAt: 'atoll' }), rod('ev', { obtain: 'event', obtainHint: 'Sold during the Crimson Moon', soldAt: 'isle' })],
    baits: [bait('worm', 5, 'isle'), bait('rare', null, null)],
    items: [item('crate', 'bait_crate', 120, 'isle'), item('totem', 'totem', 900, 'desert'), item('relic', 'relic', 5000, 'mono'), item('pot', 'potion', 300, null), item('bag', 'misc', 1000, null, { backpack: { slots: 10 } }), item('bob', 'bobber', null, null)],
    boats: [{ id: 'row', name: 'row', description: '', price: 0, unlockLevel: 1, soldAt: 'isle', speed: 1, turnRate: 1, visual: {} }, { id: 'sloop', name: 'sloop', description: '', price: 5000, unlockLevel: 5, soldAt: 'isle', speed: 1, turnRate: 1, visual: {} }],
    events: WORLD_EVENTS,
  };
  const st = { level: 1, rods: ['r1'], boats: ['row'], bobbers: [] as string[], baits: { worm: 3 }, items: {}, event: null as string | null };
  const ids = (npcId: string, s = st) => buildShop(data.npcs.find((n) => n.id === npcId)!, data, s).map((e) => `${e.kind}:${e.id}`);

  it('routes stock by role + location', () => {
    expect(ids('m')).toEqual(expect.arrayContaining(['rod:r1', 'bait:worm', 'item:crate', 'item:pot', 'item:bag']));
    expect(ids('m')).not.toContain('rod:r2'); // price 0 → not sold
    expect(ids('rc')).toEqual(['rod:r1']);
    expect(ids('bv')).toEqual(['bait:worm', 'item:crate']);
    expect(ids('tc')).toEqual(['item:totem']);
    expect(ids('k')).toEqual(['item:relic']);
    expect(ids('s')).toEqual(expect.arrayContaining(['item:relic', 'item:pot', 'item:bag']));
    expect(ids('sw')).toEqual(['boat:row', 'boat:sloop']);
    // Location without a rod seller: the innkeeper falls back to selling it.
    expect(ids('inn')).toContain('rod:r3');
  });

  it('event rods are only for sale during their event, owned flags + counts are set', () => {
    expect(ids('m')).not.toContain('rod:ev');
    expect(ids('m', { ...st, event: 'crimson_moon' })).toContain('rod:ev');
    const e = buildShop(data.npcs[0], data, st);
    expect(e.find((x) => x.id === 'r1')!.owned).toBe(true);
    expect(e.find((x) => x.id === 'worm')!.count).toBe(3);
  });

  it('real data: every priced shop rod / bait / item / boat is sold somewhere', () => {
    const real: ShopData = { npcs: NPCS, rods: RODS, baits: BAITS, items: ITEMS, boats: BOATS, events: WORLD_EVENTS };
    const all = allShopEntries(real, { level: 1, rods: [], boats: [], bobbers: [], baits: {}, items: {}, event: null });
    const orphans: string[] = [];
    for (const r of RODS) if (r.obtain === 'shop' && r.price > 0 && !all.has(`rod:${r.id}`)) orphans.push(r.id);
    for (const b of BAITS) if (b.price && b.soldAt && !all.has(`bait:${b.id}`)) orphans.push(b.id);
    for (const i of ITEMS) if (i.price && !all.has(`${i.kind === 'bobber' ? 'bobber' : 'item'}:${i.id}`)) orphans.push(i.id);
    for (const b of BOATS) if (b.price > 0 && !all.has(`boat:${b.id}`)) orphans.push(b.id);
    expect(orphans).toEqual([]);
  });

  it('buy flow: level gate, coins, auto-equip, shop:buy', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    const merchant = NPCS.find((n) => n.role === 'merchant' && n.location === 'driftwood_harbor')!;
    const shop = eco.shopFor(merchant.id);
    const baitEntry = shop.find((e) => e.kind === 'bait');
    if (baitEntry) {
      expect(eco.buy(baitEntry, 5)).toBe(false); // no coins
      eco.addCoins(baitEntry.price * 5, 'test');
      expect(eco.buyCheck!(baitEntry, 5).ok).toBe(true);
      expect(eco.buy(baitEntry, 5)).toBe(true);
      expect(eco.save.baits[baitEntry.id]).toBe(5);
      expect(eco.equippedBait()?.id).toBe(baitEntry.id);
      expect(f.emitted.some((e) => e.type === 'shop:buy')).toBe(true);
      eco.consumeBait();
      expect(eco.save.baits[baitEntry.id]).toBe(4);
    }
    const rodEntry = RODS.filter((r) => r.obtain === 'shop' && r.price > 0).sort((a, b) => a.price - b.price)[0];
    if (rodEntry) {
      const entry = { kind: 'rod' as const, id: rodEntry.id, price: rodEntry.price, unlockLevel: rodEntry.unlockLevel };
      eco.addCoins(rodEntry.price, 'test');
      if (rodEntry.unlockLevel > 1) expect(eco.buyCheck!(entry).reason).toMatch(/level/);
      eco.addXp(totalXpToReach(rodEntry.unlockLevel), 'test');
      expect(eco.buy(entry)).toBe(true);
      expect(eco.equippedRod().id).toBe(rodEntry.id);
      expect(f.emitted.some((e) => e.type === 'equip:rod')).toBe(true);
      expect(eco.buy(entry)).toBe(false); // already owned
    }
  });
});

describe('quests', () => {
  const locs: LocationDef[] = [
    { id: 'isle', name: 'Isle', biome: 'temperate', tier: 1, kind: 'island', description: '' },
    { id: 'lake', name: 'Lake', biome: 'snow', tier: 3, kind: 'sub', parent: 'isle', description: '' },
    { id: 'far', name: 'Far', biome: 'rock', tier: 20, kind: 'island', description: '' },
  ];
  const pool = [fish('a', 'isle', 'common'), fish('b', 'isle', 'rare', { pricePerKg: 50 }), fish('c', 'lake', 'uncommon'), fish('m', 'isle', 'mythical'), fish('e', 'isle', 'common', { event: 'x' }), fish('z', 'far', 'common')];

  it('asks for species from the angler’s location + sub-zones only (no mythical/event)', () => {
    expect(questPool('isle', pool, locs).map((f) => f.id).sort()).toEqual(['a', 'b', 'c']);
    expect(questPool('nowhere', pool, locs).length).toBeGreaterThan(0); // nearest-tier fallback
  });

  it('rewards 6–8× average value and 6–8× XP', () => {
    const rng = seqRng(3);
    for (let i = 0; i < 200; i++) {
      const q = generateQuest(npc('t', 'angler', 'isle'), pool, locs, [item('crate', 'bait_crate', 100, 'isle')], rng, 1000 + i)!;
      const f = pool.find((x) => x.id === q.fishId)!;
      const avg = avgValue(f);
      expect(q.rewardCoins).toBeGreaterThanOrEqual(Math.max(20, avg * 6 - 5));
      expect(q.rewardCoins).toBeLessThanOrEqual(Math.max(20, avg * 8 + 5));
      expect(q.rewardXp).toBeGreaterThanOrEqual(Math.max(10, Math.round(f.xp * 6)));
      expect(q.rewardXp).toBeLessThanOrEqual(Math.max(10, Math.round(f.xp * 8)));
    }
  });

  it('turn-in consumes one matching fish, pays, and starts the 2 min cooldown', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    const angler = NPCS.find((n) => n.role === 'angler')!;
    const q = eco.questFor(angler.id);
    if (!q) return; // no fish data for that location yet
    expect(eco.questFor(angler.id)).toBe(q); // stable
    expect(eco.turnInQuest(angler.id)).toBe(false);
    const mk = (uid: string, value: number, favorite = false) => ({ uid, fishId: q.fishId, kg: 1, mutation: null, attributes: [], size: 'normal' as const, value, zone: 'x', caughtAt: 1, perfect: false, odds: 2, ...(favorite ? { favorite } : {}) });
    eco.addCatch(mk('fav', 1, true));
    expect(eco.turnInQuest(angler.id)).toBe(false); // favourites are protected
    eco.addCatch(mk('big', 500));
    eco.addCatch(mk('small', 5));
    const coins = eco.coins();
    expect(eco.turnInQuest(angler.id)).toBe(true);
    expect(eco.save.backpack.map((x) => x.uid).sort()).toEqual(['big', 'fav']);
    expect(eco.coins()).toBe(coins + q.rewardCoins);
    expect(eco.questFor(angler.id)).toBeNull();
    expect(eco.questCooldownMs!(angler.id)).toBeGreaterThan(QUEST_COOLDOWN_MS - 1000);
    expect(f.emitted.filter((e) => e.type === 'quest:complete').length).toBe(1);
  });
});

describe('bestiary', () => {
  it('rewards scale with zone tier', () => {
    const tiers = [1, 5, 10, 20, 30, 45, 60, 90];
    for (let i = 1; i < tiers.length; i++) {
      expect(rewardCoins(tiers[i])).toBeGreaterThan(rewardCoins(tiers[i - 1]));
      expect(rewardXp(tiers[i])).toBeGreaterThan(rewardXp(tiers[i - 1]));
    }
    const loc: LocationDef = { id: 'coral_crescent', name: 'Coral Crescent', biome: 'tropical', tier: 5, kind: 'island', description: '' };
    const r = pageReward('coral_crescent', loc, [item('coral_bobber', 'bobber', null, null)], [rod('reef', { obtain: 'bestiary', obtainHint: 'Complete the Coral Crescent bestiary', price: 0 })]);
    expect(r.bobber).toBe('coral_bobber');
    expect(r.rod).toBe('reef');
  });

  it('secret / limited / event fish never gate completion', () => {
    const list = [fish('a', 'z', 'common'), fish('s', 'z', 'secret'), fish('l', 'z', 'limited'), fish('e', 'z', 'rare', { event: 'x' })];
    const p = pageProgress('z', list, { a: { caught: 1, bestKg: 1, bestValue: 1, mutations: [], firstCaughtAt: 1 } });
    expect(p).toMatchObject({ caught: 1, total: 1, totalAll: 4 });
  });

  it('claim flow on real data (completes a page by catching its fish)', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    const zone = 'driftwood_harbor';
    const page = eco.bestiaryZone(zone);
    if (!page.length) return;
    expect(eco.claimBestiary(zone)).toBe(false);
    for (const { fishId } of page) eco.addCatch({ uid: fishId, fishId, kg: 1, mutation: null, attributes: [], size: 'normal', value: 1, zone, caughtAt: 1, perfect: false, odds: 1 });
    const prog = eco.bestiaryProgress(zone);
    expect(prog.caught).toBe(prog.total);
    const coins = eco.coins();
    expect(eco.claimBestiary(zone)).toBe(true);
    expect(eco.coins()).toBe(coins + eco.bestiaryReward!(zone).coins);
    expect(eco.claimBestiary(zone)).toBe(false);
    expect(eco.bestiaryProgress(zone).claimed).toBe(true);
  });
});

describe('enchants', () => {
  it('data: ids unique, effects use PASSIVE_IDS, every pool populated', () => {
    expect(new Set(ENCHANTS.map((e) => e.id)).size).toBe(ENCHANTS.length);
    for (const e of ENCHANTS) if (e.effect) expect(PASSIVE_IDS).toContain(e.effect.id);
    for (const p of ['standard', 'exalted', 'cosmic'] as const) expect(ENCHANTS.filter((e) => e.pool === p).length).toBeGreaterThanOrEqual(4);
  });

  it('rolls match weights and never repeat the current slot enchant', () => {
    const rng = seqRng(7);
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const e = rollEnchant('standard', rng, 'brisk')!;
      expect(e.pool).toBe('standard');
      counts[e.id] = (counts[e.id] ?? 0) + 1;
    }
    expect(counts.brisk).toBeUndefined();
    const odds = enchantOdds('standard', 'brisk');
    for (const [id, p] of Object.entries(odds)) expect(Math.abs((counts[id] ?? 0) / N - p)).toBeLessThan(0.015);
  });

  it('slots + stats: cosmic goes to slot 1, stats add up', () => {
    let slots = applyEnchantToSlots([], ENCHANT_BY_ID.starlit);
    expect(slots).toEqual(['', 'starlit']);
    slots = applyEnchantToSlots(slots, ENCHANT_BY_ID.brisk);
    expect(slots).toEqual(['brisk', 'starlit']);
    const s = effectiveStats(rod('x'), [ENCHANT_BY_ID.brisk, ENCHANT_BY_ID.starlit]);
    expect(s.lureSpeed).toBeCloseTo(0.4);
    expect(s.luck).toBeCloseTo(0.5);
  });

  it('altar works only at night and consumes the relic', async () => {
    const relic = ITEMS.find((i) => i.kind === 'relic' && i.relic);
    if (!relic) return;
    const day = await createEconomy(fakeCtx().ctx);
    day.grantItem(relic.id, 1);
    expect(day.enchant(relic.id).ok).toBe(false);
    expect(day.save.items[relic.id]).toBe(1);
    const f = fakeCtx({ night: true });
    const eco = await createEconomy(f.ctx);
    eco.grantItem(relic.id, 1);
    const r = eco.enchant(relic.id);
    expect(r.ok).toBe(true);
    expect(eco.rodEnchants(eco.equippedRod().id).map((e) => e.id)).toContain(r.enchantId);
    expect(eco.save.items[relic.id]).toBeUndefined();
  });
});

describe('loot, boosts, xp', () => {
  it('rollLoot follows weights and merges duplicates', () => {
    const table = [{ kind: 'coins' as const, min: 10, max: 10, weight: 3 }, { kind: 'bait' as const, id: 'worm', min: 1, max: 3, weight: 1 }];
    const rng = seqRng(11);
    let coins = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const d = rollLoot(table, 2, rng);
      expect(d.filter((x) => x.kind === 'coins').length).toBeLessThanOrEqual(1);
      coins += d.find((x) => x.kind === 'coins')?.amount ?? 0;
    }
    const exp = lootExpectation(table, 2).get('coins')!;
    expect(Math.abs(coins / N - exp) / exp).toBeLessThan(0.05);
  });

  it('crates from data give loot; treasure map → decode → chest → loot', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    const crate = ITEMS.find((i) => i.kind === 'bait_crate');
    if (crate) {
      eco.grantItem(crate.id, 1);
      const r = eco.useItem(crate.id);
      expect(r.ok).toBe(true);
      expect(r.loot!.length).toBeGreaterThan(0);
    }
    const map = ITEMS.find((i) => i.kind === 'treasure_map');
    if (!map) return;
    eco.grantItem(map.id, 1);
    expect(eco.mapCount!()).toBe(1);
    eco.addCoins(250, 'test');
    const d = eco.decodeMap!();
    expect(d.ok).toBe(true);
    const chest = f.world.interactables.find((i) => i.kind === 'chest')!;
    expect(chest).toBeDefined();
    expect(f.world.terrainHeight(chest.position.x, chest.position.z)).toBeGreaterThanOrEqual(-1.2);
    const xp = eco.xp() + eco.level() * 1e6;
    f.ctx.events.emit('interact', { target: chest });
    expect(f.world.interactables.includes(chest)).toBe(false);
    expect(eco.save.treasureMaps.length).toBe(0);
    expect(eco.xp() + eco.level() * 1e6).toBeGreaterThan(xp);
    expect(f.emitted.some((e) => e.type === 'ui:open' && (e.payload as { panel: string }).panel === 'items')).toBe(true);
  });

  it('boosts merge (extend, no multiplicative stacking) and event luck applies', async () => {
    const now = 1000;
    let b = mergeBoost([], { id: 'p', label: 'p', luckMult: 2, expiresAt: now + 100 }, now);
    b = mergeBoost(b, { id: 'p', label: 'p', luckMult: 2, expiresAt: now + 100 }, now);
    expect(b.length).toBe(1);
    expect(b[0].expiresAt).toBe(now + 200);
    expect(boostProduct(b, 'luckMult', now)).toBe(2);
    const eco = await createEconomy(fakeCtx({ event: 'crimson_moon' }).ctx);
    expect(eco.luckMultiplier()).toBeCloseTo(1.2);
    eco.addBoost({ id: 'x', label: 'x', luckMult: 2, sellMult: 2, expiresAt: Date.now() + 60000 });
    expect(eco.luckMultiplier()).toBeCloseTo(2.4);
    expect(eco.sellMultiplier()).toBe(2);
  });

  it('selling applies sellMultiplier and protects favourites; backpack capacity enforced', async () => {
    const eco = await createEconomy(fakeCtx().ctx);
    const id = FISH[0].id;
    const mk = (uid: string, value: number) => ({ uid, fishId: id, kg: 1, mutation: null, attributes: [], size: 'normal' as const, value, zone: 'x', caughtAt: 1, perfect: false, odds: 2 });
    for (let i = 0; i < eco.save.backpackSize; i++) expect(eco.addCatch(mk(`f${i}`, 10))).toBe(true);
    expect(eco.addCatch(mk('overflow', 10))).toBe(false);
    expect(eco.save.stats.catches).toBe(eco.save.backpackSize + 1);
    eco.toggleFavorite('f0');
    eco.addBoost({ id: 's', label: 's', sellMult: 1.5, expiresAt: Date.now() + 60000 });
    expect(eco.sellPreview!()).toBe(Math.round((eco.save.backpackSize - 1) * 10 * 1.5));
    const got = eco.sellAll();
    expect(got).toBe(Math.round((eco.save.backpackSize - 1) * 10 * 1.5));
    expect(eco.save.backpack.map((f) => f.uid)).toEqual(['f0']);
  });

  it('xp curve: monotonic, levels up with events, discovery grants XP once', async () => {
    for (let l = 2; l <= 150; l++) expect(xpForLevel(l)).toBeGreaterThanOrEqual(xpForLevel(l - 1));
    const r = applyXp(1, 0, totalXpToReach(5) + 3);
    expect(r).toMatchObject({ level: 5, xp: 3, gained: [2, 3, 4, 5] });
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    eco.addXp(totalXpToReach(3), 'test');
    expect(eco.level()).toBe(3);
    expect(f.emitted.filter((e) => e.type === 'level:up').length).toBe(2);
    expect(eco.discover('coral_crescent')).toBe(true);
    expect(eco.discover('coral_crescent')).toBe(false);
    f.ctx.events.emit('location:enter', { locationId: LOCATIONS[2].id });
    expect(eco.save.discovered).toContain(LOCATIONS[2].id);
  });

  it('interact routing: npc → dialog, midgame only after 3 min at a natural break', async () => {
    const f = fakeCtx();
    const eco = await createEconomy(f.ctx);
    const pos = f.world.islands[0].spawn;
    f.ctx.events.emit('interact', { target: { id: 'n', kind: 'npc', npcId: NPCS[0].id, position: pos, radius: 2, label: '', locationId: NPCS[0].location } });
    const open = f.emitted.find((e) => e.type === 'ui:open');
    expect(open?.payload).toMatchObject({ panel: 'dialog', data: { npcId: NPCS[0].id } });
    f.ctx.events.emit('ui:close', {});
    expect(f.counters.midgame).toBe(0); // < 3 min since session start
    void eco;
  });
});
