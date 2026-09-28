import type { BaitDef } from '../core/types';
// OWNER: rods/items agent. Stub.
export const BAITS: BaitDef[] = [
  { id: 'worm', name: 'Worm', description: 'Classic. Slightly faster bites.', rarity: 'common', price: 6, soldAt: 'driftwood_harbor', stats: { lureSpeed: 0.1, luck: 0, resilience: 0, preferredLuck: 0 }, visual: {} },
];
export const BAIT_BY_ID: Record<string, BaitDef> = Object.fromEntries(BAITS.map((b) => [b.id, b]));
