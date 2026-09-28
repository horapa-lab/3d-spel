/**
 * RodVisual — the `visual` payload of RodDef (data/rods.ts). Opaque to everything except
 * models/rods. Kept as plain JSON-ish data so the catalogue stays small.
 *
 * Conventions: butt at origin, rod along +Y, reel hangs on the rod's underside (+Z local side);
 * casting/conventional reels sit on top (−Z). Tilt a rod forward by rotating it around +X.
 */
import type { MatSpec } from './kit/mat';

/** Material: preset name from kit/mat `P` (e.g. 'gold', 'chrome') or a full spec. */
export type MatRef = string | MatSpec;

export type ReelType = 'spinning' | 'baitcast' | 'fly' | 'spool' | 'conventional';
export type ReelTheme = 'none' | 'shell' | 'skull' | 'gear' | 'crystal' | 'star' | 'sun' | 'leaf' | 'eye' | 'moon' | 'snow' | 'bone';

export interface ReelSpec {
  type: ReelType;
  body: MatRef;
  accent?: MatRef;
  spool?: MatRef;
  knob?: MatRef;
  /** Line colour on the spool. */
  line?: string;
  size?: number;
  theme?: ReelTheme;
}

export type GripKind = 'cork' | 'eva' | 'wood' | 'cord' | 'leather' | 'bamboo' | 'stone' | 'bone' | 'custom';

export interface GripSpec {
  kind: GripKind;
  /** Tint (eva/cord/leather) or wood style (wood). */
  color?: string;
  mat?: MatRef;
  shape?: 'straight' | 'cigar' | 'wells' | 'split' | 'fighting';
  rear?: number;
  fore?: number;
  /** Trim rings at the grip ends. */
  trim?: MatRef;
  radius?: number;
}

export interface BlankSpec {
  mat: MatRef;
  /** Vertex-colour gradient butt→tip (multiplies the material colour; material needs vc). */
  grad?: string[];
  /** Bamboo node rings. */
  nodes?: boolean;
  /** Two-piece ferrule joint at mid length. */
  ferrule?: boolean;
  /** Segmented look: rings every n metres (bone / stone vertebrae). */
  segments?: number;
  segMat?: MatRef;
}

export interface GuideSpec {
  count?: number;
  frame?: MatRef;
  ring?: MatRef;
  style?: 'modern' | 'wire' | 'ornate' | 'snake';
  size?: number;
}

export interface WrapSpec {
  color: string;
  trim?: string;
  metallic?: boolean;
  /** Decorative butt wrap above the fore grip. */
  deco?: 'bands' | 'diamond' | 'none';
  decoLen?: number;
}

export interface ButtSpec {
  kind: 'rubber' | 'cap' | 'gem' | 'knob' | 'fight' | 'crystal' | 'skull' | 'orb' | 'claw' | 'shell' | 'sun' | 'lantern';
  mat?: MatRef;
  gem?: string;
}

export interface SeatSpec {
  mat: MatRef;
  hood?: MatRef;
  insert?: MatRef;
}

/** Themed decorations. `at` = 0..1 along the blank (0 = fore grip end, 1 = tip). */
export type Deco =
  | { kind: 'coral'; at: number; color?: string; color2?: string; count?: number }
  | { kind: 'shells'; at: number; color?: string }
  | { kind: 'frost'; from: number; to: number; count?: number; color?: string }
  | { kind: 'mushrooms'; from: number; to: number; cap?: string; spot?: string; count?: number }
  | { kind: 'moss'; from: number; to: number; color?: string }
  | { kind: 'vertebrae'; from: number; to: number; count?: number }
  | { kind: 'ribs'; at: number }
  | { kind: 'filigree'; from: number; to: number; mat?: MatRef }
  | { kind: 'gems'; at: number[]; color: string; size?: number }
  | { kind: 'runeRings'; at: number[]; color: string; spin?: boolean }
  | { kind: 'tentacle'; from: number; to: number; color?: string; turns?: number; count?: number }
  | { kind: 'orbit'; at: number; color: string; count?: number; radius?: number; shape?: 'star' | 'orb' | 'shard' }
  | { kind: 'ribbon'; from: number; to: number; colors: string[]; turns?: number }
  | { kind: 'feather'; color?: string; color2?: string }
  | { kind: 'charm'; shape: 'anchor' | 'coin' | 'tooth' | 'skull' | 'moon' | 'star' | 'shell' | 'bell'; mat?: MatRef }
  | { kind: 'sunDisc'; at: number; mat?: MatRef }
  | { kind: 'vine'; from: number; to: number; color?: string; leaf?: string; turns?: number }
  | { kind: 'crystals'; at: number; color: string; count?: number; size?: number }
  | { kind: 'lure'; color: string }
  | { kind: 'flames'; at: number; color?: string }
  | { kind: 'chain'; from: number; to: number; mat?: MatRef }
  | { kind: 'rope'; from: number; to: number; color?: string }
  | { kind: 'barnacles'; from: number; to: number }
  | { kind: 'scarab'; at: number; color?: string }
  | { kind: 'plates'; from: number; to: number; mat?: MatRef }
  | { kind: 'cracks'; from: number; to: number }
  | { kind: 'bolts'; from: number; to: number; color?: string }
  | { kind: 'halo'; at: number; color: string; radius?: number }
  | { kind: 'wings'; at: number; color?: string }
  | { kind: 'tassel'; color: string };

export interface RodVisual {
  /** One-sentence description for reviewers. */
  look: string;
  /** Overall length in metres (1.8..3.4). */
  len: number;
  /** Radius multiplier for the blank (heavy rods > 1). */
  thick?: number;
  blank: BlankSpec;
  grip: GripSpec;
  seat?: SeatSpec;
  reel: ReelSpec;
  guides?: GuideSpec;
  wraps: WrapSpec;
  butt?: ButtSpec;
  deco?: Deco[];
  /** Colour of the line threaded through the guides. */
  line?: string;
}
