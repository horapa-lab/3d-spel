// All the numbers of the game in one place: wave scaling, prices, odds, DPS,
// offline earnings and the automatic "where does my new gun go" logic.
// Pure functions only (no three.js) so tools/sim.mjs can run them in node.

import { RARITIES, EPIC } from '../data/rarities.js';
import { WEAPONS_BY_RARITY, WEAPON_BY_ID, baseDps } from '../data/weapons.js';
import { UPGRADES_BY_ID } from '../data/upgrades.js';
import { ENEMIES, ENEMY_IDS } from '../data/enemies.js';
import { weightedIndex } from '../util/math.js';

export const BASE_SLOTS = 4;
export const MAX_SLOTS = 32;
export const MAX_GUN_LEVEL = 10;
export const PITY_EVERY = 30;
export const GOLD_CHANCE = 0.02;
export const GOLD_MULT = 2;
export const CRIT_CHANCE = 0.08;
export const CRIT_MULT = 2.5;
export const BOSS_EVERY = 5;

export const ZOMBIE_BASE_HP = 9;
export const ZOMBIE_BASE_REWARD = 2;
export const ZOMBIE_BASE_DMG = 4;

// ------------------------------------------------------------------ waves
export const isBossWave = (w) => w % BOSS_EVERY === 0;
export const hpMult = (w) => Math.pow(1.19, w - 1);
export const rewardMult = (w) => Math.pow(1.11, w - 1);
export const dmgMult = (w) => Math.pow(1.07, w - 1);
export const spawnPerSec = (w) => Math.min(3.4, 0.5 + 0.075 * (w - 1));
export const killsNeeded = (w) => Math.min(60, 10 + Math.floor(w * 1.6));
export const waveClearBonus = (w) => Math.ceil(ZOMBIE_BASE_REWARD * rewardMult(w) * 3);

export function zombieStats(type, wave) {
  const e = ENEMIES[type];
  return {
    hp: ZOMBIE_BASE_HP * e.hp * hpMult(wave),
    reward: ZOMBIE_BASE_REWARD * e.reward * rewardMult(wave),
    dmg: ZOMBIE_BASE_DMG * e.dmg * dmgMult(wave),
  };
}

export function pickEnemyType(wave, rng = Math.random) {
  const ids = [];
  const weights = [];
  for (const id of ENEMY_IDS) {
    const e = ENEMIES[id];
    if (e.minWave <= wave) {
      ids.push(id);
      weights.push(e.weight(wave));
    }
  }
  return ids[weightedIndex(weights, rng)];
}

// ------------------------------------------------------------------ upgrades
export const upgradeLevel = (s, id) => s.up[id] || 0;

export function upgradeCost(id, level) {
  const u = UPGRADES_BY_ID[id];
  return Math.ceil(u.base * Math.pow(u.growth, level));
}

/** Total price of buying `n` levels starting at `level`. */
export function upgradeCostN(id, level, n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += upgradeCost(id, level + i);
  return total;
}

/** How many levels (max `cap`) can be bought with `coins`. */
export function affordableLevels(id, level, coins, cap = 1000) {
  const u = UPGRADES_BY_ID[id];
  let n = 0;
  let spent = 0;
  while (n < cap && level + n < u.max) {
    const c = upgradeCost(id, level + n);
    if (spent + c > coins) break;
    spent += c;
    n++;
  }
  return { n, cost: spent };
}

export const isMaxed = (s, id) => upgradeLevel(s, id) >= UPGRADES_BY_ID[id].max;

export const firepowerMult = (L) => Math.pow(1.1, L);
export const fireRateMult = (L) => 1 + 0.05 * L;
export const coinBonusMult = (L) => Math.pow(1.08, L);
export const barricadeHpFor = (L) => 120 * Math.pow(1.2, L);
export const crateLevelFor = (L) => 1 + L;
export const vaultRateFor = (L) => Math.min(1, 0.2 + 0.04 * L);
export const vaultHoursFor = (L) => Math.min(24, 2 + L);

export const dmgMultOf = (s) => firepowerMult(upgradeLevel(s, 'firepower'));
export const rateMultOf = (s) => fireRateMult(upgradeLevel(s, 'firerate'));
export const coinMultOf = (s) => coinBonusMult(upgradeLevel(s, 'coins'));
export const slotCount = (s) => BASE_SLOTS + upgradeLevel(s, 'slots');
export const barricadeMaxHp = (s) => barricadeHpFor(upgradeLevel(s, 'barricade'));
export const barricadeRegen = (s) => 0.05 + 0.003 * Math.min(30, upgradeLevel(s, 'barricade'));
export const crateLevel = (s) => crateLevelFor(upgradeLevel(s, 'crate'));
export const vaultRate = (s) => vaultRateFor(upgradeLevel(s, 'vault'));
export const vaultHours = (s) => vaultHoursFor(upgradeLevel(s, 'vault'));

/** Human readable "current -> next" effect for the upgrade UI. */
export function upgradeEffect(id, L) {
  switch (id) {
    case 'firepower': return { now: `x${short(firepowerMult(L))}`, next: `x${short(firepowerMult(L + 1))}` };
    case 'firerate': return { now: `+${Math.round((fireRateMult(L) - 1) * 100)}%`, next: `+${Math.round((fireRateMult(L + 1) - 1) * 100)}%` };
    case 'coins': return { now: `x${short(coinBonusMult(L))}`, next: `x${short(coinBonusMult(L + 1))}` };
    case 'slots': return { now: `${BASE_SLOTS + L}`, next: `${BASE_SLOTS + L + 1}` };
    case 'barricade': return { now: `${shortInt(barricadeHpFor(L))} HP`, next: `${shortInt(barricadeHpFor(L + 1))} HP` };
    case 'crate': return { now: `Lv ${crateLevelFor(L)}`, next: `Lv ${crateLevelFor(L + 1)}` };
    case 'vault': return { now: `${Math.round(vaultRateFor(L) * 100)}% · ${vaultHoursFor(L)}h`, next: `${Math.round(vaultRateFor(L + 1) * 100)}% · ${vaultHoursFor(L + 1)}h` };
    default: return { now: '', next: '' };
  }
}

function short(v) {
  if (v < 10) return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (v < 1000) return v.toFixed(0);
  const e = Math.floor(Math.log10(v));
  return (v / Math.pow(10, e)).toFixed(1) + 'e' + e;
}
function shortInt(v) {
  if (v < 1e4) return Math.round(v).toString();
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + units[i];
}

// ------------------------------------------------------------------ crate
/** Price in "walker kills" grows with every crate you open, coins scale with the wave. */
export const crateKills = (opens) => 6 + 0.3 * opens + 0.0015 * opens * opens;
export function crateCost(s) {
  return Math.ceil(ZOMBIE_BASE_REWARD * rewardMult(s.wave) * crateKills(s.opens));
}

export function rarityWeights(level, luck = 1) {
  return RARITIES.map((r, i) => r.base * Math.pow(r.grow, level - 1) * Math.pow(luck, i / 3));
}

export function rarityOdds(level, luck = 1) {
  const w = rarityWeights(level, luck);
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / t);
}

/** Roll a crate. Mutates nothing - caller applies pity/opens. */
export function rollCrate(s, { luck = 1, minRarity = 0, rng = Math.random } = {}) {
  let rarity;
  if (s.opens === 0) rarity = 1; // first crate always feels good
  else if (s.opens === 2) rarity = 2; // and the third one even better
  else {
    const w = rarityWeights(crateLevel(s), luck);
    const floor = Math.max(minRarity, s.pity >= PITY_EVERY - 1 ? EPIC : 0);
    for (let i = 0; i < floor; i++) w[i] = 0;
    rarity = weightedIndex(w, rng);
  }
  const pool = WEAPONS_BY_RARITY[rarity];
  const weapon = pool[Math.floor(rng() * pool.length)];
  const gold = s.opens > 2 && rng() < GOLD_CHANCE;
  return { t: weapon.id, l: 1, g: gold ? 1 : 0, rarity };
}

export function scrapValue(s, rarity) {
  return Math.ceil(crateCost(s) * RARITIES[rarity].scrap);
}

// ------------------------------------------------------------------ guns
export const gunLevelMult = (l) => 1 + 0.5 * (l - 1);

/** DPS of one gun without global upgrades. */
export function gunPower(gun) {
  if (!gun) return 0;
  const w = WEAPON_BY_ID[gun.t];
  return baseDps(w) * gunLevelMult(gun.l) * (gun.g ? GOLD_MULT : 1);
}

export function gunDps(gun, s) {
  return gunPower(gun) * dmgMultOf(s) * rateMultOf(s);
}

export function totalDps(s) {
  let d = 0;
  const n = slotCount(s);
  for (let i = 0; i < n; i++) d += gunPower(s.guns[i]);
  return d * dmgMultOf(s) * rateMultOf(s);
}

/**
 * Decide what happens with a freshly unboxed gun:
 *  place   - goes to a free slot
 *  levelup - merges into a gun of the same type (+1 level, gold spreads)
 *  replace - kicks out the weakest gun
 *  scrap   - not useful, turned into coins
 * Picks whatever raises total DPS the most.
 */
export function decidePlacement(s, gun) {
  const n = slotCount(s);
  for (let i = 0; i < n; i++) if (!s.guns[i]) return { kind: 'place', slot: i };

  const newPow = gunPower(gun);
  let weakest = -1;
  let weakPow = Infinity;
  for (let i = 0; i < n; i++) {
    const p = gunPower(s.guns[i]);
    if (p < weakPow) {
      weakPow = p;
      weakest = i;
    }
  }
  const gainReplace = newPow - weakPow;

  let lvlSlot = -1;
  let gainLevel = 0;
  for (let i = 0; i < n; i++) {
    const g = s.guns[i];
    if (g.t !== gun.t || g.l >= MAX_GUN_LEVEL) continue;
    const up = { t: g.t, l: g.l + 1, g: g.g || gun.g };
    const gain = gunPower(up) - gunPower(g);
    if (gain > gainLevel) {
      gainLevel = gain;
      lvlSlot = i;
    }
  }

  if (lvlSlot >= 0 && gainLevel >= gainReplace) return { kind: 'levelup', slot: lvlSlot };
  if (gainReplace > 0) return { kind: 'replace', slot: weakest };
  return { kind: 'scrap' };
}

// ------------------------------------------------------------------ offline
export function offlineEarnings(s, seconds) {
  const cap = vaultHours(s) * 3600;
  const t = Math.min(seconds, cap);
  return {
    amount: Math.floor(Math.max(0, s.income) * vaultRate(s) * t),
    seconds: t,
    capped: seconds > cap,
  };
}
