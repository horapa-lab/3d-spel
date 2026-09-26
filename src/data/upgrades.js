// Coin upgrades. cost(level) = base * growth^level (level = current level).

export const UPGRADES = [
  {
    id: 'firepower', name: 'Firepower', icon: 'fire', color: '#FF6B3D',
    desc: 'All guns deal more damage', base: 18, growth: 1.32, max: 400,
  },
  {
    id: 'firerate', name: 'Fire Rate', icon: 'bolt', color: '#FFC928',
    desc: 'All guns shoot faster', base: 40, growth: 1.42, max: 40,
  },
  {
    id: 'coins', name: 'Coin Bonus', icon: 'coin', color: '#FFD23F',
    desc: 'Zombies drop more coins', base: 45, growth: 1.5, max: 400,
  },
  {
    id: 'slots', name: 'Gun Slots', icon: 'slot', color: '#4CD964',
    desc: 'Room for one more gun on the wall', base: 25, growth: 2.25, max: 28,
  },
  {
    id: 'barricade', name: 'Barricade', icon: 'shield', color: '#38A6FF',
    desc: 'Tougher barricade, faster repairs', base: 30, growth: 1.34, max: 400,
  },
  {
    id: 'crate', name: 'Crate Luck', icon: 'clover', color: '#52E052',
    desc: 'Better odds for rare guns', base: 80, growth: 2.3, max: 29,
  },
  {
    id: 'vault', name: 'Idle Vault', icon: 'vault', color: '#B45CFF',
    desc: 'Earn coins while you are away', base: 80, growth: 1.7, max: 22,
  },
];

export const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
