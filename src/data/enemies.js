// Monster roster. hp / reward / dmg are multipliers on top of the wave scaling.
// rig: humanoid | blob | ghost.  zw = spawn weight per zone (desert, canyon,
// snow, toxic, volcano, moon).  s = model scale.

export const ENEMIES = {
  zombie: {
    name: 'Zombie', rig: 'humanoid', hp: 1, speed: 2.2, reward: 1, dmg: 1, s: 1, minWave: 1,
    zw: [10, 5, 4, 6, 2, 2], goo: 0x8fd45a,
  },
  runner: {
    name: 'Runner', rig: 'humanoid', hp: 0.55, speed: 4.3, reward: 0.9, dmg: 0.8, s: 0.9, minWave: 3,
    zw: [4, 3, 2, 4, 1, 1], goo: 0x9ad65a,
  },
  skeleton: {
    name: 'Skeleton', rig: 'humanoid', hp: 1.3, speed: 3.1, reward: 1.5, dmg: 1, s: 1, minWave: 6,
    zw: [3, 3, 4, 1, 4, 1], goo: 0xf2eee2,
  },
  mummy: {
    name: 'Mummy', rig: 'humanoid', hp: 2.4, speed: 1.8, reward: 2, dmg: 1.4, s: 1.05, minWave: 8,
    zw: [3, 1, 0.5, 3, 1, 0.5], goo: 0xe9dfc2,
  },
  goblin: {
    name: 'Goblin', rig: 'humanoid', hp: 0.8, speed: 3.9, reward: 1.3, dmg: 1, s: 0.85, minWave: 4,
    zw: [2, 8, 3, 1, 3, 1], goo: 0xb5dc4a,
  },
  orc: {
    name: 'Orc Brute', rig: 'humanoid', hp: 8, speed: 1.5, reward: 6, dmg: 4, s: 1.45, minWave: 10,
    zw: [0.7, 4, 1, 1, 3, 1], goo: 0x6f9f40,
  },
  yeti: {
    name: 'Yeti', rig: 'humanoid', hp: 6, speed: 1.9, reward: 5, dmg: 3, s: 1.4, minWave: 12,
    zw: [0, 0, 5, 0, 0, 1], goo: 0xdff0ff,
  },
  slime: {
    name: 'Slime', rig: 'blob', hp: 1.6, speed: 2.4, reward: 1.4, dmg: 1.2, s: 1, minWave: 5,
    zw: [2, 1, 1, 8, 3, 4], goo: 0x6fe06f,
  },
  ghost: {
    name: 'Ghost', rig: 'ghost', hp: 1.1, speed: 3.0, reward: 1.6, dmg: 1, s: 1, minWave: 7,
    zw: [1.5, 1, 3, 4, 1, 4], goo: 0xeaf2ff,
  },
  imp: {
    name: 'Imp', rig: 'humanoid', hp: 2.2, speed: 3.6, reward: 2.5, dmg: 1.5, s: 0.95, minWave: 9,
    zw: [0, 1, 0, 1, 8, 2], goo: 0xff6a4a,
  },
  robot: {
    name: 'Robot', rig: 'humanoid', hp: 3, speed: 2.4, reward: 3, dmg: 2, s: 1.05, minWave: 12,
    zw: [0, 0, 0, 0, 1, 8], goo: 0x9fb4cc,
  },

  // bosses (one per zone, x3 size)
  boss_zombie: { name: 'Zombie King', rig: 'humanoid', base: 'zombie', hp: 70, speed: 1.05, reward: 45, dmg: 22, s: 3.1, boss: true, goo: 0x8fd45a },
  boss_orc: { name: 'Orc Warlord', rig: 'humanoid', base: 'orc', hp: 70, speed: 1.0, reward: 45, dmg: 22, s: 2.3, boss: true, goo: 0x6f9f40 },
  boss_yeti: { name: 'Frost Giant', rig: 'humanoid', base: 'yeti', hp: 70, speed: 1.0, reward: 45, dmg: 22, s: 2.4, boss: true, goo: 0xdff0ff },
  boss_slime: { name: 'Slime King', rig: 'blob', base: 'slime', hp: 70, speed: 1.1, reward: 45, dmg: 22, s: 3.2, boss: true, goo: 0x6fe06f },
  boss_imp: { name: 'Demon Lord', rig: 'humanoid', base: 'imp', hp: 70, speed: 1.05, reward: 45, dmg: 22, s: 3.0, boss: true, goo: 0xff6a4a },
  boss_robot: { name: 'Mega Mech', rig: 'humanoid', base: 'robot', hp: 70, speed: 1.0, reward: 45, dmg: 22, s: 2.9, boss: true, goo: 0x9fb4cc },
};

export const ENEMY_IDS = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss);
export const BOSS_BY_ZONE = ['boss_zombie', 'boss_orc', 'boss_yeti', 'boss_slime', 'boss_imp', 'boss_robot'];
export const ALL_ENEMY_IDS = Object.keys(ENEMIES);

/** Spawn weight of an enemy type at a wave (zone themed rosters). */
export function enemyWeight(id, wave, zoneIndex) {
  const e = ENEMIES[id];
  if (e.boss || wave < e.minWave) return 0;
  const zi = zoneIndex % 6;
  let w = e.zw[zi];
  // after the first lap every monster can show up everywhere
  if (zoneIndex >= 6) w = Math.max(w, 1.2);
  return w;
}
