import type { Rarity, RarityDef } from '../core/types';

export const RARITIES: Record<Rarity, RarityDef> = {
  trash: { id: 'trash', name: 'Trash', color: '#8a8f98', order: 0, luckFactor: -0.6, xp: 2, progressMult: 1.15, indicator: '!' },
  common: { id: 'common', name: 'Common', color: '#e8edf2', order: 1, luckFactor: 0, xp: 6, progressMult: 1.0, indicator: '!' },
  uncommon: { id: 'uncommon', name: 'Uncommon', color: '#6ee07a', order: 2, luckFactor: 0.25, xp: 12, progressMult: 0.97, indicator: '!' },
  unusual: { id: 'unusual', name: 'Unusual', color: '#4fd6c6', order: 3, luckFactor: 0.45, xp: 20, progressMult: 0.93, indicator: '!' },
  rare: { id: 'rare', name: 'Rare', color: '#4a9dff', order: 4, luckFactor: 0.75, xp: 38, progressMult: 0.88, indicator: '!!' },
  legendary: { id: 'legendary', name: 'Legendary', color: '#ffb52e', order: 5, luckFactor: 1.2, xp: 90, progressMult: 0.8, indicator: '!!' },
  mythical: { id: 'mythical', name: 'Mythical', color: '#ff4fa3', order: 6, luckFactor: 1.8, xp: 220, progressMult: 0.72, indicator: '!!!' },
  exotic: { id: 'exotic', name: 'Exotic', color: '#b46bff', order: 7, luckFactor: 2.4, xp: 500, progressMult: 0.65, indicator: '!!!' },
  secret: { id: 'secret', name: 'Secret', color: '#1fffd2', order: 8, luckFactor: 3.0, xp: 1200, progressMult: 0.58, indicator: '?' },
  limited: { id: 'limited', name: 'Limited', color: '#ff3b3b', order: 9, luckFactor: 1.5, xp: 400, progressMult: 0.7, indicator: '!!!' },
};

export const RARITY_ORDER: Rarity[] = Object.values(RARITIES)
  .sort((a, b) => a.order - b.order)
  .map((r) => r.id);
