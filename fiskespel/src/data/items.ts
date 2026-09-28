import type { ItemDef } from '../core/types';
// OWNER: rods/items agent. Stub.
export const ITEMS: ItemDef[] = [
  { id: 'classic_bobber', name: 'Classic Bobber', kind: 'bobber', rarity: 'common', description: 'Red and white. Timeless.', price: null, soldAt: null, visual: {} },
];
export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
