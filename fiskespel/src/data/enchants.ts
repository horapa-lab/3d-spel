import type { EnchantDef } from '../core/types';
// OWNER: economy agent. Stub.
export const ENCHANTS: EnchantDef[] = [
  { id: 'swift', name: 'Swift', pool: 'standard', weight: 10, description: '+30% lure speed.', stats: { lureSpeed: 0.3 } },
];
export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));
