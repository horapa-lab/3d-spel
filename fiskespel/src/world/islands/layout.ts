/**
 * ARCHIPELAGO LAYOUT — the single source of truth for where every location sits.
 * World units are metres, sea level y = 0. World spans ±WORLD_HALF_SIZE on X and Z.
 * Convention used by the island designs: -Z = "north", +X = "east".
 *
 *            N (-Z)
 *   Trench ·         Frostpeak
 *        Glimmer   Coral        Wreckers
 *                    Driftwood  Sunspire    Elder
 *        Stone Arch  Turtleback   Mirewood
 *     Keeper's            Ashen Reach
 *            S (+Z)
 */

export const WORLD_HALF_SIZE = 3000;

export interface IslandLayout {
  id: string;
  x: number;
  z: number;
  /** Rough land radius (m). */
  radius: number;
  /** Radius (m) of this island's fishing zone / HUD location around its centre. */
  zoneRadius: number;
  seed: number;
}

const isl = (id: string, x: number, z: number, radius: number, seed: number, zonePad = 190): IslandLayout => ({
  id,
  x,
  z,
  radius,
  zoneRadius: radius + zonePad,
  seed,
});

export const ISLAND_LAYOUT: IslandLayout[] = [
  isl('driftwood_harbor', 0, 0, 280, 11, 230),
  isl('coral_crescent', -930, -380, 300, 23),
  isl('sunspire_isle', 880, -560, 320, 37),
  isl('turtleback_atoll', 120, 1020, 250, 41),
  isl('stone_arch', -1150, 820, 200, 53),
  isl('mirewood_bayou', 1480, 720, 380, 67),
  isl('frostpeak', -260, -1680, 420, 71),
  isl('wreckers_cove', 1640, -1380, 290, 83),
  isl('elder_isle', 2380, -180, 450, 97),
  isl('glimmer_grotto', -2250, -620, 210, 101),
  isl('keepers_monolith', -1980, 1850, 230, 113),
  isl('ashen_reach', 1080, 2350, 400, 127),
];

export const LAYOUT_BY_ID: Record<string, IslandLayout> = Object.fromEntries(ISLAND_LAYOUT.map((l) => [l.id, l]));

/** Abyssal Trench — a ~250 m circle of bottomless water, ringed by warning buoys. */
export const TRENCH = { x: -2350, z: -2250, radius: 250 };

/** Water further than this from the origin (and outside every island zone) is Deep Ocean. */
export const DEEP_OCEAN_RADIUS = 1800;

/**
 * Sub-zones (world coordinates). Filled in by the island designs (they know their terrain),
 * but declared here so zone lookups have one home.
 */
export interface SubZone {
  id: string;
  parent: string;
  x: number;
  z: number;
  radius: number;
  /** Surface height of the local water (ice / lava). */
  y: number;
}

export const SUB_ZONES: SubZone[] = [
  // Frozen Lake — a cirque basin on Frostpeak's southern flank (see defs/frostpeak.ts)
  { id: 'frostpeak_lake', parent: 'frostpeak', x: -260 + 20, z: -1680 + 40, radius: 62, y: 96 },
  // Magma Pools — a terrace on Ashen Reach's eastern flank (see defs/ashen.ts)
  { id: 'ashen_lava', parent: 'ashen_reach', x: 1080 + 150, z: 2350 - 20, radius: 48, y: 34 },
];
