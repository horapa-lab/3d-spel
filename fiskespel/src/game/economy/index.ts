// OWNER: economy/platform agent. Stub.
import type { EconomyAPI, GameContext, PlayerSave } from '../../core/types';
import { ROD_BY_ID } from '../../data/rods';
import { BACKPACK_START, START_LOCATION, STARTER_BOBBER, STARTER_ROD } from '../../data/constants';

export function newSave(): PlayerSave {
  return {
    version: 1, coins: 0, xp: 0, level: 1, rods: [STARTER_ROD], equippedRod: STARTER_ROD, rodEnchants: {},
    baits: {}, equippedBait: null, items: {}, bobbers: [STARTER_BOBBER], equippedBobber: STARTER_BOBBER,
    boats: [], equippedBoat: null, backpack: [], backpackSize: BACKPACK_START, bestiary: {}, claimedBestiaryZones: [],
    discovered: [START_LOCATION], quests: [], questCooldowns: {}, treasureMaps: [], boosts: [],
    stats: { catches: 0, perfect: 0, coinsEarned: 0, playSeconds: 0, biggestKg: 0, rarest: null },
    settings: { music: 0.6, sfx: 0.8, quality: 'auto', autoReelUnlocked: false, showTutorial: true },
    spawn: { location: START_LOCATION }, lastSeen: Date.now(),
  };
}

export async function createEconomy(_ctx: GameContext): Promise<EconomyAPI> {
  const save = newSave();
  const rod = () => ROD_BY_ID[save.equippedRod] ?? Object.values(ROD_BY_ID)[0];
  const api: EconomyAPI = {
    save,
    coins: () => save.coins, level: () => save.level, xp: () => save.xp, xpToNext: () => 100,
    addCoins(a) { save.coins += a; }, spendCoins(a) { if (save.coins < a) return false; save.coins -= a; return true; },
    addXp(a) { save.xp += a; },
    equippedRod: rod, effectiveRodStats: () => rod().stats, rodEnchants: () => [],
    equippedBait: () => null, consumeBait() {},
    luckMultiplier: () => 1, lureMultiplier: () => 1, xpMultiplier: () => 1, sellMultiplier: () => 1, mutationMultiplier: () => 1,
    addCatch(c) { save.backpack.push(c); return true; }, sell: () => 0, sellAll: () => 0, toggleFavorite() {},
    shopFor: () => [], buy: () => false, equipRod: () => false, equipBait: () => false, equipBobber: () => false, equipBoat: () => false,
    useItem: () => ({ ok: false, message: 'stub' }), appraiseCost: () => 0, appraise: () => null,
    enchant: () => ({ ok: false, message: 'stub' }),
    bestiaryZone: () => [], bestiaryProgress: () => ({ caught: 0, total: 0, claimed: false }), claimBestiary: () => false,
    questFor: () => null, turnInQuest: () => false, addBoost() {}, activeBoosts: () => [],
    discover: () => false, save_() {}, update() {},
  };
  return api;
}
