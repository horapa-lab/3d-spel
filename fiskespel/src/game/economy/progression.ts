/**
 * Level curve + XP helpers. Pure. OWNER: economy.
 *
 * Target (docs/CONTRACT.md): level 10 ≈ 1 h, 30 ≈ 6 h, 60 ≈ 25 h, 100 ≈ 80 h of play, cap 150.
 * Tuned with tests/economy-sim.test.ts (catch XP grows as players reach rarer zones, so the
 * per-level requirement grows faster than linearly).
 */
import { MAX_LEVEL } from './save';

export { MAX_LEVEL };

/** Curve constants (see economy-sim for how they were chosen). */
export const XP_CURVE = { base: 240, linear: 40, coef: 0.5, power: 2.1 };

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const raw = XP_CURVE.base + XP_CURVE.linear * L + XP_CURVE.coef * Math.pow(L, XP_CURVE.power);
  // Round to a friendly number.
  const step = raw < 1000 ? 5 : raw < 10000 ? 25 : 100;
  return Math.round(raw / step) * step;
}

/** Total XP from level 1 (0 xp) to reaching `level`. */
export function totalXpToReach(level: number): number {
  let t = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL + 1); l++) t += xpForLevel(l);
  return t;
}

/**
 * Apply `amount` XP to a (level, xp) pair. Returns the new pair and the levels gained (in order).
 * At MAX_LEVEL xp stays clamped at the last requirement (bar shows full).
 */
export function applyXp(level: number, xp: number, amount: number): { level: number; xp: number; gained: number[] } {
  const gained: number[] = [];
  let L = level;
  let X = xp + Math.max(0, amount);
  while (L < MAX_LEVEL && X >= xpForLevel(L)) {
    X -= xpForLevel(L);
    L++;
    gained.push(L);
  }
  if (L >= MAX_LEVEL) X = Math.min(X, xpForLevel(MAX_LEVEL));
  return { level: L, xp: Math.floor(X), gained };
}

/** XP for discovering a location of the given tier. */
export function discoveryXp(tier: number): number {
  return Math.round((150 + 25 * Math.max(1, tier)) / 5) * 5;
}

/** Level at which auto-reel unlocks (settings.autoReelUnlocked). */
export const AUTO_REEL_LEVEL = 10;
