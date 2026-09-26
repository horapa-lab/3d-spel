// All weapons. Stats are for level 1. DPS roughly x3.3 per rarity tier so every
// new rarity feels like a massive jump.
//
// fire types:
//   bullet  - fast homing tracer             pellet - shotgun spread (pellets)
//   rocket  - visible rocket, AoE            grenade - arcing shell, AoE
//   flame   - cone, continuous ticks         tesla  - chain lightning
//   plasma  - glowing bolts, small AoE       rail   - instant piercing beam
//   nuke    - slow missile, gigantic AoE     vortex - black hole that pulls + damages
//   rainbow - rainbow bolts that pierce
//
// target: 'first' = zombie closest to the barricade, 'strong' = highest max HP

export const WEAPONS = [
  // ---------------- COMMON ----------------
  {
    id: 'pistol', name: 'Mini Pistol', rarity: 0, dmg: 2.5, rate: 2, range: 24,
    fire: 'bullet', speed: 70, tracer: 0xffe9a0, width: 0.07, len: 1.1, sound: 'pistol', scale: 1.7,
    desc: 'Tiny, trusty and totally underrated. Every army starts somewhere.',
  },
  {
    id: 'revolver', name: 'Six Shooter', rarity: 0, dmg: 7.5, rate: 0.8, range: 26,
    fire: 'bullet', speed: 75, tracer: 0xfff0b0, width: 0.09, len: 1.4, sound: 'revolver', scale: 1.55,
    desc: 'Yee-haw! Slow to fire but every bullet hurts.',
  },
  {
    id: 'microsmg', name: 'Micro SMG', rarity: 0, dmg: 0.9, rate: 6.5, range: 22,
    fire: 'bullet', speed: 70, tracer: 0xffe38a, width: 0.06, len: 0.9, sound: 'smg', scale: 1.5,
    desc: 'Sprays tiny bullets like a lawn sprinkler.',
  },
  {
    id: 'pump', name: 'Pump Shotgun', rarity: 0, dmg: 1.1, pellets: 6, rate: 0.9, range: 18,
    fire: 'pellet', speed: 65, tracer: 0xffd27a, width: 0.06, len: 0.7, spread: 0.9, sound: 'shotgun', scale: 1.05,
    desc: 'Chk-chk BOOM. Best friends with zombies up close.',
  },

  // ---------------- UNCOMMON ----------------
  {
    id: 'handcannon', name: 'Hand Cannon', rarity: 1, dmg: 19, rate: 0.95, range: 28,
    fire: 'bullet', speed: 80, tracer: 0xffc46b, width: 0.12, len: 1.6, sound: 'revolver', scale: 1.45,
    desc: 'A pistol that thinks it is a cannon.',
  },
  {
    id: 'tacsmg', name: 'Tac SMG', rarity: 1, dmg: 2.2, rate: 8, range: 25,
    fire: 'bullet', speed: 75, tracer: 0xffe38a, width: 0.07, len: 1.0, sound: 'smg', scale: 1.25,
    desc: 'Suppressed, tactical and very, very busy.',
  },
  {
    id: 'doublebarrel', name: 'Double Barrel', rarity: 1, dmg: 2.6, pellets: 10, rate: 0.7, range: 18,
    fire: 'pellet', speed: 65, tracer: 0xffc070, width: 0.07, len: 0.8, spread: 1.2, sound: 'shotgun', scale: 1.05,
    desc: 'Two barrels. Twice the boom. Zero chill.',
  },
  {
    id: 'huntingrifle', name: 'Hunting Rifle', rarity: 1, dmg: 32, rate: 0.55, range: 40, pierce: 1,
    fire: 'bullet', speed: 110, tracer: 0xfff4c8, width: 0.08, len: 2.4, sound: 'sniper', scale: 0.95,
    desc: 'Scoped, patient, and it shoots through a zombie or two.',
  },

  // ---------------- RARE ----------------
  {
    id: 'ak', name: 'AK Rifle', rarity: 2, dmg: 6.8, rate: 8, range: 32,
    fire: 'bullet', speed: 90, tracer: 0xffd06a, width: 0.08, len: 1.5, sound: 'rifle', scale: 0.9,
    desc: 'The classic. Loud, reliable, and never jams.',
  },
  {
    id: 'm4', name: 'M4 Carbine', rarity: 2, dmg: 5.2, rate: 10.5, range: 32,
    fire: 'bullet', speed: 95, tracer: 0xffe38a, width: 0.075, len: 1.5, sound: 'rifle', scale: 0.9,
    desc: 'Tactical rails, red dot and a hunger for zombies.',
  },
  {
    id: 'battlerifle', name: 'Battle Rifle', rarity: 2, dmg: 12, rate: 4.6, range: 34, pierce: 1,
    fire: 'bullet', speed: 100, tracer: 0xffc85a, width: 0.1, len: 1.8, sound: 'rifle', scale: 0.9,
    desc: 'Heavy rounds that punch straight through the front row.',
  },
  {
    id: 'drumshotgun', name: 'Drum Shotgun', rarity: 2, dmg: 3, pellets: 6, rate: 3, range: 20,
    fire: 'pellet', speed: 70, tracer: 0xffb35a, width: 0.07, len: 0.8, spread: 1.1, sound: 'shotgun', scale: 0.95,
    desc: 'A fully automatic shotgun with a drum. Madness.',
  },

  // ---------------- EPIC ----------------
  {
    id: 'sniper', name: 'Longshot Sniper', rarity: 3, dmg: 200, rate: 0.9, range: 60, pierce: 3, target: 'strong',
    fire: 'bullet', speed: 150, tracer: 0xbff4ff, width: 0.12, len: 3.4, sound: 'sniper', scale: 0.9,
    desc: 'Picks off the biggest zombie on the field. Pierces 3.',
  },
  {
    id: 'lmg', name: 'Squad LMG', rarity: 3, dmg: 9.5, rate: 18, range: 34,
    fire: 'bullet', speed: 95, tracer: 0xffcf5a, width: 0.09, len: 1.6, sound: 'lmg', scale: 0.9,
    desc: 'A belt-fed wall of lead. Do not stand in front of it.',
  },
  {
    id: 'grenadelauncher', name: 'Grenade Launcher', rarity: 3, dmg: 80, aoe: 2.6, rate: 2.2, range: 30,
    fire: 'grenade', speed: 26, tracer: 0x9adf5a, sound: 'launcher', scale: 1.0,
    desc: 'Six chambers of bouncing, exploding joy.',
  },
  {
    id: 'heavysniper', name: 'Heavy .50 Sniper', rarity: 3, dmg: 270, rate: 0.7, range: 65, pierce: 5, target: 'strong',
    fire: 'bullet', speed: 160, tracer: 0xffe2a8, width: 0.16, len: 4, sound: 'sniper', scale: 0.85,
    desc: 'Anti-material rifle. Goes through five zombies and a wall.',
  },

  // ---------------- LEGENDARY ----------------
  {
    id: 'minigun', name: 'Minigun', rarity: 4, dmg: 20, rate: 30, range: 34,
    fire: 'bullet', speed: 110, tracer: 0xffd35c, width: 0.1, len: 1.8, sound: 'minigun', scale: 0.95, spin: true,
    desc: 'BRRRRRRRT. Six barrels, zero mercy.',
  },
  {
    id: 'bazooka', name: 'Bazooka', rarity: 4, dmg: 420, aoe: 3.2, rate: 1.4, range: 36,
    fire: 'rocket', speed: 34, tracer: 0xff9a3c, sound: 'rocket', scale: 0.9,
    desc: 'Rocket goes in, zombies go up.',
  },
  {
    id: 'rpg', name: 'RPG Launcher', rarity: 4, dmg: 520, aoe: 3.4, rate: 1.15, range: 38,
    fire: 'rocket', speed: 38, tracer: 0xffb04a, sound: 'rocket', scale: 0.9,
    desc: 'The iconic warhead. Huge boom, huge smile.',
  },
  {
    id: 'flamethrower', name: 'Flamethrower', rarity: 4, dmg: 64, rate: 10, range: 17, cone: 0.42,
    fire: 'flame', tracer: 0xff7a1a, sound: 'flame', scale: 1.0,
    desc: 'Roasts every zombie in a cone. Smells terrible.',
  },

  // ---------------- MYTHIC ----------------
  {
    id: 'tesla', name: 'Tesla Cannon', rarity: 5, dmg: 700, chain: 5, rate: 3, range: 30,
    fire: 'tesla', tracer: 0x6fe8ff, sound: 'tesla', scale: 0.95,
    desc: 'Lightning jumps between zombies. Science!',
  },
  {
    id: 'plasmagun', name: 'Plasma Minigun', rarity: 5, dmg: 55, aoe: 1.1, rate: 40, range: 36,
    fire: 'plasma', speed: 90, tracer: 0xd46bff, width: 0.2, len: 1.4, sound: 'plasma', scale: 0.95, spin: true,
    desc: 'A minigun that fires angry purple stars.',
  },
  {
    id: 'railgun', name: 'Railgun', rarity: 5, dmg: 4600, rate: 0.5, range: 70, pierce: 999, target: 'strong',
    fire: 'rail', tracer: 0x55e6ff, sound: 'rail', scale: 0.9,
    desc: 'Magnetic death beam. Pierces EVERYTHING in a line.',
  },

  // ---------------- SECRET ----------------
  {
    id: 'nuke', name: 'Nuke Launcher', rarity: 6, dmg: 30000, aoe: 9, rate: 0.25, range: 55,
    fire: 'nuke', speed: 22, tracer: 0xb6ff4a, sound: 'nuke', scale: 0.85,
    desc: 'Tactical nuke incoming. Please wear sunglasses.',
  },
  {
    id: 'blackhole', name: 'Black Hole Gun', rarity: 6, dmg: 7000, dur: 3, aoe: 6.5, rate: 0.33, range: 45,
    fire: 'vortex', speed: 20, tracer: 0xb26bff, sound: 'vortex', scale: 0.95,
    desc: 'Opens a tiny black hole that eats zombies alive.',
  },
  {
    id: 'unicorn', name: 'Unicorn Blaster', rarity: 6, dmg: 1300, rate: 6.5, range: 45, pierce: 2,
    fire: 'rainbow', speed: 100, width: 0.22, len: 2, sound: 'rainbow', scale: 1.0,
    desc: 'The rarest, fluffiest, most violent gun in existence.',
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w, i) => [w.id, Object.assign(w, { index: i })]));

export const WEAPONS_BY_RARITY = [];
for (const w of WEAPONS) (WEAPONS_BY_RARITY[w.rarity] ||= []).push(w);

/** Damage per second of the weapon type at level 1, used for comparisons & UI. */
export function baseDps(w) {
  const perShot = w.dmg * (w.pellets || 1);
  let dps = perShot * w.rate;
  // the black hole deals `dmg` per second for `dur` seconds to everything it swallows
  if (w.fire === 'vortex') dps = w.dmg * w.dur * w.rate;
  return dps;
}
