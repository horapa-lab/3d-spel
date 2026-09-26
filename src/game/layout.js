// World layout constants shared by all systems.
// Zombies walk from the portal (negative Z) toward the barricade (positive Z).
// The player can walk the whole base: the plaza behind the barricade and the
// two wooden gun decks along the road (between the inner and outer gun rows).

export const ROAD_HALF = 5;
export const BARRICADE_Z = 3;
export const SPAWN_Z = -46;
export const LANE_HALF = 4.2;

// walkable areas
export const PLAZA = { minX: -12.4, maxX: 12.4, minZ: 4.4, maxZ: 17.5 };
export const DECK = { minX: 6.3, maxX: 12.4, minZ: -30.5, maxZ: 4.4 }; // per side, |x|
export const WALK_RECTS = [
  { minX: PLAZA.minX, maxX: PLAZA.maxX, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ },
  { minX: -DECK.maxX, maxX: -DECK.minX, minZ: DECK.minZ, maxZ: DECK.maxZ + 0.5 },
  { minX: DECK.minX, maxX: DECK.maxX, minZ: DECK.minZ, maxZ: DECK.maxZ + 0.5 },
];

export const CRATE_POS = { x: 0, z: 9.6 };
export const CRATE_PAD = { x: 0, z: 12.6, r: 1.3 };
export const LUCK_POS = { x: -7.2, z: 9.4 };
export const LUCK_PAD = { x: -7.2, z: 12.3, r: 1.1 };
export const VAULT_POS = { x: 7.2, z: 9.4 };
export const VAULT_PAD = { x: 7.2, z: 12.3, r: 1.1 };
export const PLAYER_START = { x: 0, z: 15.2 };

export const INNER_X = 7.3;
export const OUTER_X = 11.4;
export const INNER_MOUNT = 1.0; // gun pivot height above the deck
export const OUTER_MOUNT = 2.1; // outer row stands on a pedestal, shoots over the inner row
export const SLOT_STEP = 3.8;
export const ROWS_PER_SIDE = 8;
export const DECK_Z0 = 4.4;
export const DECK_Z1 = -30.5;

/** Slot unlock order: inner rows first, alternating left/right, near to far. */
export const SLOTS = (() => {
  const out = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < ROWS_PER_SIDE; i++) {
      for (const side of [-1, 1]) {
        const x = side * (row === 0 ? INNER_X : OUTER_X);
        const z = row === 0 ? 1.6 - i * SLOT_STEP : -0.3 - i * SLOT_STEP;
        out.push({
          side,
          row,
          x,
          y: 0,
          z,
          mountH: row === 0 ? INNER_MOUNT : OUTER_MOUNT,
          // where the player stands to upgrade this gun (on the walkway)
          padX: side * (row === 0 ? 8.75 : 9.95),
          padZ: z,
        });
      }
    }
  }
  return out;
})();

/** Clamp a point to the walkable area (union of rectangles). */
export function clampWalkable(x, z) {
  let bx = x;
  let bz = z;
  let bd = Infinity;
  for (const r of WALK_RECTS) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x));
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) {
      bd = d;
      bx = cx;
      bz = cz;
      if (d === 0) break;
    }
  }
  return [bx, bz];
}
