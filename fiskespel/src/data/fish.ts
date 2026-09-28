import type { FishDef } from '../core/types';
// OWNER: fish agent. Stub — replaced with the full catalog.
export const FISH: FishDef[] = [
  { id: 'harbor_perch', name: 'Harbor Perch', zone: 'driftwood_harbor', rarity: 'common', chance: 50, minKg: 0.2, maxKg: 1.6, pricePerKg: 14, resilience: 1.2, xp: 6, description: 'A striped perch that loves the pier pilings.', visual: {} },
];
export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));
