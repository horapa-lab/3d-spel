import type { BoatDef } from '../core/types';
// OWNER: characters/boats agent. Stub.
export const BOATS: BoatDef[] = [
  { id: 'rowboat', name: 'Rowboat', description: 'Slow but trusty.', price: 0, unlockLevel: 1, soldAt: 'driftwood_harbor', speed: 12, turnRate: 1.4, visual: {} },
];
export const BOAT_BY_ID: Record<string, BoatDef> = Object.fromEntries(BOATS.map((b) => [b.id, b]));
