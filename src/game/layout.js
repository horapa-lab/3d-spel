// World layout constants shared by all systems.
// Zombies walk from the portal (negative Z) toward the barricade (positive Z).

export const ROAD_HALF = 5;
export const BARRICADE_Z = 3;
export const SPAWN_Z = -54;
export const LANE_HALF = 4.2;

export const PLAZA = { minX: -9.2, maxX: 9.2, minZ: 5.4, maxZ: 16.2 };

export const CRATE_POS = { x: 0, z: 9.0 };
export const CRATE_PAD = { x: 0, z: 11.9, r: 1.25 };
export const LUCK_POS = { x: -6.0, z: 9.0 };
export const LUCK_PAD = { x: -6.0, z: 11.8, r: 1.1 };
export const VAULT_POS = { x: 6.0, z: 9.0 };
export const VAULT_PAD = { x: 6.0, z: 11.8, r: 1.1 };
export const PLAYER_START = { x: 0, z: 14.4 };

export const INNER_X = 7.3;
export const OUTER_X = 10.3;
export const INNER_Y = 0.8;
export const OUTER_Y = 1.6;
export const SLOT_STEP = 3.7;
export const ROWS_PER_SIDE = 8;
export const DECK_Z0 = 3.8;
export const DECK_Z1 = -27.8;

/** Slot unlock order: inner rows first, alternating left/right, near to far. */
export const SLOTS = (() => {
  const out = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < ROWS_PER_SIDE; i++) {
      for (const side of [-1, 1]) {
        out.push({
          side,
          row,
          x: side * (row === 0 ? INNER_X : OUTER_X),
          y: row === 0 ? INNER_Y : OUTER_Y,
          z: row === 0 ? 2.0 - i * SLOT_STEP : 0.15 - i * SLOT_STEP,
        });
      }
    }
  }
  return out;
})();
