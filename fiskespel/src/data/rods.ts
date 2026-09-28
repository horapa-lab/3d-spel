import type { RodDef } from '../core/types';
// OWNER: rods/items agent. Stub — replaced with the full catalog.
export const RODS: RodDef[] = [
  { id: 'starter_rod', name: 'Driftwood Rod', description: 'A simple rod carved from driftwood.', tier: 1, price: 0, unlockLevel: 1, soldAt: null, obtain: 'starter', obtainHint: 'You start with it.', stats: { lureSpeed: 0, luck: 0, control: 0, resilience: 0, maxKg: 25 }, visual: {} },
];
export const ROD_BY_ID: Record<string, RodDef> = Object.fromEntries(RODS.map((r) => [r.id, r]));
