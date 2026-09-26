// Monster types. hp / reward / dmg are multipliers on top of the wave scaling.
// `shape` tweaks the blocky rig: s = overall scale, w = torso/arm width factor.

export const ENEMIES = {
  walker: {
    name: 'Walker', hp: 1, speed: 2.2, reward: 1, dmg: 1, minWave: 1,
    s: 1, w: 1, skin: 0x8fcb4a, shirt: 0xe8688a, pants: 0x3c4a66, acc: null,
    weight: () => 10,
  },
  runner: {
    name: 'Runner', hp: 0.55, speed: 4.3, reward: 0.9, dmg: 0.8, minWave: 3,
    s: 0.9, w: 0.82, skin: 0xa8d85c, shirt: 0xff9f43, pants: 0x6d4c41, acc: null,
    weight: (w) => 3 + w * 0.08,
  },
  soldier: {
    name: 'Soldier', hp: 2.6, speed: 2.0, reward: 2, dmg: 1.5, minWave: 6,
    s: 1.05, w: 1.05, skin: 0x7bb342, shirt: 0x6e7f3a, pants: 0x4a5530, acc: 'helmet',
    weight: (w) => 2 + w * 0.08,
  },
  skeleton: {
    name: 'Skeleton', hp: 1.3, speed: 3.2, reward: 1.5, dmg: 1, minWave: 9,
    s: 1, w: 0.85, skin: 0xf2eee2, shirt: 0xd9d2bf, pants: 0xbdb5a0, acc: null, bony: true,
    weight: () => 2.5,
  },
  brute: {
    name: 'Brute', hp: 9, speed: 1.5, reward: 6, dmg: 4, minWave: 12,
    s: 1.55, w: 1.3, skin: 0x6fa33a, shirt: 0x6fa33a, pants: 0x5b3a29, acc: 'pads',
    weight: (w) => 0.8 + w * 0.03,
  },
  imp: {
    name: 'Imp', hp: 2.2, speed: 3.7, reward: 2.5, dmg: 1.5, minWave: 16,
    s: 0.95, w: 0.9, skin: 0xe0473c, shirt: 0x3a1e1e, pants: 0x2a1a1a, acc: 'horns',
    weight: () => 2.5,
  },
  boss: {
    name: 'Zombie King', hp: 70, speed: 1.05, reward: 45, dmg: 22, minWave: 999,
    s: 3.1, w: 1.35, skin: 0x7cb342, shirt: 0x7cb342, pants: 0x4e342e, acc: 'boss', boss: true,
    weight: () => 0,
  },
};

export const ENEMY_IDS = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss);

/** Boss look + name changes with the zone for a bit of variety. */
export const BOSS_VARIANTS = [
  { name: 'Zombie King', skin: 0x7cb342, pants: 0x4e342e },
  { name: 'Canyon Crusher', skin: 0xb5733f, pants: 0x3b2618 },
  { name: 'Frost Giant', skin: 0x9fd8ff, pants: 0x34495e },
  { name: 'Toxic Titan', skin: 0x9bff3a, pants: 0x4a148c },
  { name: 'Magma Lord', skin: 0xff6a2b, pants: 0x2b1a14 },
  { name: 'Moon Mutant', skin: 0xc7b8ff, pants: 0x263238 },
];
