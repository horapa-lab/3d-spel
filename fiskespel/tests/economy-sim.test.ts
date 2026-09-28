/**
 * Balance simulation (expected-value model, 60 s steps). OWNER: economy.
 *
 * Uses real FISH / RODS when the data files are filled in (≥ 40 fish, ≥ 8 shop rods); otherwise a
 * synthetic catalog following the CONTRACT.md economy guide (value bands per rarity, rod ladder).
 * Model: the player fishes the highest-tier zone ≤ level they can handle, buys the best affordable
 * shop rod, does an angler quest every ~10 min, discovers zones as they unlock.
 * Prints hours to level 10/30/60/100 and when each rod tier is bought.
 * Targets: L10 ≈ 1 h, L30 ≈ 6 h, L60 ≈ 25 h, L100 ≈ 80 h.
 */
import { describe, expect, it } from 'vitest';
import type { FishDef, Rarity, RodDef } from '../src/core/types';
import { FISH } from '../src/data/fish';
import { RODS } from '../src/data/rods';
import { LOCATIONS } from '../src/data/world';
import { RARITIES } from '../src/data/rarities';
import { avgValue } from '../src/game/economy/fishmath';
import { applyXp, discoveryXp } from '../src/game/economy/progression';

const BANDS: Record<Rarity, [number, number]> = {
  trash: [1, 10], common: [8, 60], uncommon: [25, 140], unusual: [60, 300], rare: [150, 900],
  legendary: [700, 4500], mythical: [3000, 20000], exotic: [12000, 90000], secret: [60000, 400000], limited: [4000, 40000],
};
const POOL_CHANCE: Partial<Record<Rarity, number>> = { trash: 8, common: 55, uncommon: 24, unusual: 12, rare: 6, legendary: 1.2, mythical: 0.15, exotic: 0.02, secret: 0.003 };

function syntheticFish(): FishDef[] {
  const out: FishDef[] = [];
  for (const l of LOCATIONS) {
    const t = Math.min(1, l.tier / 90);
    for (const [r, ch] of Object.entries(POOL_CHANCE) as [Rarity, number][]) {
      const [lo, hi] = BANDS[r];
      const value = lo * Math.pow(hi / lo, t);
      for (let i = 0; i < 2; i++) {
        out.push({ id: `${l.id}_${r}_${i}`, name: '', zone: l.id, rarity: r, chance: ch / 2, minKg: 1, maxKg: 4, pricePerKg: value / 2, resilience: 1, xp: RARITIES[r].xp, description: '', visual: {} });
      }
    }
  }
  return out;
}

function syntheticRods(): RodDef[] {
  // (price, level, luck, lure, maxKg) ladder per CONTRACT.md
  const L: [number, number, number, number][] = [
    [0, 1, 0, 0], [250, 2, 0.1, 0.1], [1500, 5, 0.25, 0.12], [4000, 8, 0.35, 0.15], [8000, 10, 0.45, 0.18],
    [15000, 14, 0.6, 0.2], [40000, 20, 0.8, 0.22], [90000, 28, 1.0, 0.25], [180000, 38, 1.25, 0.28],
    [300000, 45, 1.5, 0.3], [700000, 60, 1.9, 0.33], [1400000, 75, 2.3, 0.36], [2500000, 88, 2.8, 0.4],
  ];
  return L.map(([price, lvl, luck, lure], i) => ({
    id: `rod${i}`, name: `Rod ${i}`, description: '', tier: i + 1, price, unlockLevel: lvl, soldAt: 'x', obtain: i ? 'shop' : 'starter', obtainHint: '',
    stats: { lureSpeed: lure, luck, control: 0.02 * i, resilience: 0.03 * i, maxKg: 20 * Math.pow(3, i) }, visual: {},
  }));
}

interface ZoneModel {
  id: string;
  tier: number;
  fish: FishDef[];
}

function zoneStats(z: ZoneModel, luck: number, maxKg: number) {
  let total = 0;
  let value = 0;
  let xp = 0;
  let hardness = 0;
  for (const f of z.fish) {
    if (f.event) continue;
    let w = f.chance * Math.max(0, 1 + luck * RARITIES[f.rarity].luckFactor);
    if (f.time) w *= 0.55; // half the day at 0.1
    total += w;
    const heavy = f.minKg + (f.maxKg - f.minKg) / 3 > maxKg ? 0.6 : 1; // overweight: slower, more escapes
    value += w * avgValue(f) * 1.12 * heavy; // ~ +12 % from mutations/attributes
    xp += w * (f.xp || RARITIES[f.rarity].xp) * 1.15 * heavy; // perfect catches ~30 % × 1.5
    hardness += w * (1 - RARITIES[f.rarity].progressMult);
  }
  if (total <= 0) return { value: 0, xp: 0, success: 0 };
  return { value: value / total, xp: xp / total, success: Math.max(0.55, 0.9 - (hardness / total) * 0.8) };
}

function simulate(fish: FishDef[], rods: RodDef[], hours = 160) {
  const zones: ZoneModel[] = LOCATIONS.map((l) => ({ id: l.id, tier: l.tier, fish: fish.filter((f) => f.zone === l.id) })).filter((z) => z.fish.length);
  const shop = rods.filter((r) => r.obtain === 'shop' && r.price > 0).sort((a, b) => a.price - b.price);
  let rod = rods.find((r) => r.obtain === 'starter') ?? rods[0];
  let level = 1;
  let xp = 0;
  let coins = 0;
  const found = new Set<string>();
  const levelAt: Record<number, number> = {};
  const rodAt: { rod: string; price: number; lvl: number; h: number }[] = [];
  let questTimer = 0;
  for (let s = 0; s < hours * 60; s++) {
    const h = s / 60;
    // Zone: best tier ≤ level (with value/min as tiebreak).
    const avail = zones.filter((z) => z.tier <= Math.max(1, level));
    let best = avail[0];
    let bestScore = -1;
    for (const z of avail) {
      const st = zoneStats(z, rod.stats.luck, rod.stats.maxKg);
      const score = st.value * st.success + st.xp * 2;
      if (score > bestScore) {
        bestScore = score;
        best = z;
      }
    }
    if (!best) break;
    let gainXp = 0;
    if (!found.has(best.id)) {
      found.add(best.id);
      gainXp += discoveryXp(best.tier);
    }
    const st = zoneStats(best, rod.stats.luck, rod.stats.maxKg);
    const bite = Math.max(0.8, 7.5 * (1 - rod.stats.lureSpeed) - 1.2);
    const cycle = 1 + bite + 6 + 2.5; // cast + bite + reel + reveal/selling overhead
    const catches = (60 / cycle) * st.success;
    coins += catches * st.value;
    gainXp += catches * st.xp;
    questTimer += 1;
    if (questTimer >= 10) {
      questTimer = 0;
      gainXp += 7 * st.xp * 0.8;
      coins += 7 * st.value * 0.6;
    }
    const r = applyXp(level, xp, gainXp);
    for (const L of r.gained) levelAt[L] = h;
    level = r.level;
    xp = r.xp;
    // Buy the best affordable rod.
    const cand = shop.filter((x) => x.unlockLevel <= level && x.price <= coins && x.tier > rod.tier);
    if (cand.length) {
      const pick = cand[cand.length - 1];
      coins -= pick.price;
      rod = pick;
      rodAt.push({ rod: pick.name, price: pick.price, lvl: pick.unlockLevel, h: Math.round(h * 100) / 100 });
    }
  }
  return { levelAt, rodAt, finalLevel: level };
}

describe('economy balance sim', () => {
  it('hours to level 10/30/60/100 are near the CONTRACT targets', () => {
    const real = FISH.length >= 40 && RODS.filter((r) => r.obtain === 'shop').length >= 8;
    const fish = real ? FISH : syntheticFish();
    const rods = real ? RODS : syntheticRods();
    const { levelAt, rodAt, finalLevel } = simulate(fish, rods);
    const row = (L: number, target: number) => `  L${String(L).padEnd(4)} ${(levelAt[L] ?? NaN).toFixed(1).padStart(6)} h   (target ${target} h)`;
    console.log(`\n[economy-sim] data: ${real ? 'REAL data files' : 'SYNTHETIC catalog (data files still stubs)'}; final level @160 h: ${finalLevel}`);
    console.log([row(10, 1), row(30, 6), row(60, 25), row(100, 80)].join('\n'));
    console.log('  rods bought:\n' + rodAt.map((r) => `    ${r.rod.padEnd(22)} ${String(r.price).padStart(8)} c  lvl ${String(r.lvl).padStart(3)}  @ ${r.h} h`).join('\n'));
    expect(levelAt[10]).toBeGreaterThan(0.4);
    expect(levelAt[10]).toBeLessThan(2.5);
    expect(levelAt[30]).toBeGreaterThan(3);
    expect(levelAt[30]).toBeLessThan(12);
  });
});
