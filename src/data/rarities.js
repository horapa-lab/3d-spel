// Rarity tiers. `base` is the crate weight at crate level 1 and `grow` is how much
// that weight is multiplied per crate level (high tiers grow faster -> better odds).

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#C9D4DF', dark: '#6B7785', hex: 0xc9d4df, base: 720, grow: 0.86, scrap: 0.35 },
  { id: 'uncommon', name: 'Uncommon', color: '#52E052', dark: '#1E8A2A', hex: 0x52e052, base: 210, grow: 0.97, scrap: 0.6 },
  { id: 'rare', name: 'Rare', color: '#38A6FF', dark: '#1459B8', hex: 0x38a6ff, base: 55, grow: 1.1, scrap: 1.2 },
  { id: 'epic', name: 'Epic', color: '#B45CFF', dark: '#6420B0', hex: 0xb45cff, base: 12, grow: 1.17, scrap: 2.5 },
  { id: 'legendary', name: 'Legendary', color: '#FFB81C', dark: '#B86A00', hex: 0xffb81c, base: 2.5, grow: 1.22, scrap: 5 },
  { id: 'mythic', name: 'Mythic', color: '#FF3358', dark: '#A8102E', hex: 0xff3358, base: 0.4, grow: 1.26, scrap: 10 },
  { id: 'secret', name: 'SECRET', color: '#FFFFFF', dark: '#5A1E9C', hex: 0xffffff, base: 0.06, grow: 1.28, scrap: 20, rainbow: true },
];

export const RARITY_COUNT = RARITIES.length;
export const EPIC = 3;

/** CSS color for a rarity (secret gets an animated rainbow class in the UI instead). */
export function rarityColor(r) {
  return RARITIES[r].color;
}
