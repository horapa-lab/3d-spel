// Every 10 waves the battlefield changes look. Palettes are applied to the
// existing world meshes, decorations are regenerated per zone.

export const ZONES = [
  {
    name: 'Desert Outpost', deco: 'desert',
    skyTop: 0x3f9cff, skyBottom: 0xcfe9ff, fog: 0xf3d7a6, fogNear: 70, fogFar: 150,
    ground: 0xf0ae57, groundDark: 0xd98f3c, rock: 0xd9773f, rockDark: 0xb85a2c, road: 0x6c7079,
    accent: 0x7dff5a, sun: 0xfff1d6, hemiSky: 0xcfe8ff, hemiGround: 0xe0a060,
  },
  {
    name: 'Dusty Canyon', deco: 'canyon',
    skyTop: 0xff9a55, skyBottom: 0xffe0b0, fog: 0xf2c29a, fogNear: 60, fogFar: 140,
    ground: 0xd9905a, groundDark: 0xb86e3e, rock: 0xa84a2a, rockDark: 0x7e321b, road: 0x6f6660,
    accent: 0xffd23f, sun: 0xffe0b8, hemiSky: 0xffd2a8, hemiGround: 0xb86e3e,
  },
  {
    name: 'Frozen Pass', deco: 'snow',
    skyTop: 0x6fb6ff, skyBottom: 0xeaf6ff, fog: 0xe6f2ff, fogNear: 55, fogFar: 135,
    ground: 0xeef6ff, groundDark: 0xc8dcf0, rock: 0x9fb6cc, rockDark: 0x7890a8, road: 0x5d6a78,
    accent: 0x6fe3ff, sun: 0xffffff, hemiSky: 0xe0f0ff, hemiGround: 0xb8d0e8,
  },
  {
    name: 'Toxic Swamp', deco: 'toxic',
    skyTop: 0x5a3f8f, skyBottom: 0xb7e39a, fog: 0x9fcf86, fogNear: 45, fogFar: 125,
    ground: 0x7fae4a, groundDark: 0x5f8a34, rock: 0x6a5a8a, rockDark: 0x4a3d66, road: 0x55585f,
    accent: 0xb6ff3a, sun: 0xf2ffd8, hemiSky: 0xd6f5c0, hemiGround: 0x6a8a3a,
  },
  {
    name: 'Volcano Base', deco: 'volcano',
    skyTop: 0x6b1d1d, skyBottom: 0xff9b54, fog: 0xc8674a, fogNear: 45, fogFar: 125,
    ground: 0x5a4a48, groundDark: 0x3d3130, rock: 0x3a2e2e, rockDark: 0x241c1c, road: 0x4a4a50,
    accent: 0xff5a1f, sun: 0xffc8a0, hemiSky: 0xffb48a, hemiGround: 0x5a3030,
  },
  {
    name: 'Moon Base', deco: 'moon',
    skyTop: 0x05060f, skyBottom: 0x2a2f55, fog: 0x2a2f55, fogNear: 60, fogFar: 150,
    ground: 0xb9bcc8, groundDark: 0x8e92a2, rock: 0x7d8190, rockDark: 0x5c606e, road: 0x4c5060,
    accent: 0x5ae0ff, sun: 0xf0f4ff, hemiSky: 0xb8c4ff, hemiGround: 0x6a6e80,
  },
];

export const WAVES_PER_ZONE = 10;

export function zoneIndexForWave(wave) {
  return Math.floor((wave - 1) / WAVES_PER_ZONE);
}

export function zoneForWave(wave) {
  const i = zoneIndexForWave(wave);
  return ZONES[i % ZONES.length];
}

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
export function zoneName(wave) {
  const i = zoneIndexForWave(wave);
  const lap = Math.floor(i / ZONES.length);
  return ZONES[i % ZONES.length].name + (ROMAN[lap] ?? ` ${lap + 1}`);
}
