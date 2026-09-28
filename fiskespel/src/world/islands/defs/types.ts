import type { ShapeDef } from '../terrain';
import type { TerrainPalette } from '../terrain-material';
import type { Plan } from '../plan';

/** One island design: terrain shape + palette + content plan. */
export interface IslandDef extends ShapeDef {
  id: string;
  palette: TerrainPalette;
  /** Stamps, placements, NPCs, interactables, features. Runs once at startup (no meshes). */
  plan?(p: Plan): void;
}
