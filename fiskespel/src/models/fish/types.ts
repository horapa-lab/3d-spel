/**
 * Visual parameter types for the procedural fish generator.
 *
 * `FishDef.visual` (src/data/fish.ts) holds a compact `FishVisual`: an archetype id plus
 * overrides. `resolveSpec()` (archetypes.ts) expands it into a full `FishSpec`.
 */

export type CaudalType =
  | 'forked'
  | 'lunate'
  | 'rounded'
  | 'truncate'
  | 'emarginate'
  | 'heterocercal'
  | 'pointed'
  | 'diphycercal'
  | 'none';

export type ScaleType = 'cycloid' | 'large' | 'fine' | 'ctenoid' | 'smooth' | 'denticle' | 'plate' | 'rough' | 'crystal';

export type PatternType =
  | 'bars' // vertical bands
  | 'stripes' // horizontal lines along body
  | 'lines' // many thin horizontal lines
  | 'spots' // random spots
  | 'rosettes' // spots with ring halo
  | 'patches' // koi-like blotches
  | 'reticulate' // chain / net lines
  | 'marble' // warped marbling
  | 'mottle' // camouflage mottling
  | 'speckle' // tiny dots
  | 'waves' // wavy dorsal lines (mackerel)
  | 'ocellus' // single eye-spot
  | 'saddles' // dorsal saddle blotches
  | 'mosaic' // per-scale random colour
  | 'photophores' // rows of glowing dots
  | 'cracks' // voronoi cracks
  | 'zebra' // many wavy bars
  | 'head' // head region colour
  | 'tail' // tail region colour
  | 'band' // one broad region band between s0..s1
  | 'belly' // belly glow / colour stripe
  | 'grid' // dots + lines grid (whale-shark like)
  | 'diagonal' // slanted bars
  | 'mask' // eye mask stripe through the eye
  | 'dorsal'; // colour along dorsal ridge

export interface PatternLayer {
  t: PatternType;
  /** colour (hex) */
  c: string;
  /** secondary colour (edges, halos, ring) */
  c2?: string;
  /** count / density */
  n?: number;
  /** size / width */
  w?: number;
  /** body range along length 0 (snout) .. 1 (tail base) */
  s0?: number;
  s1?: number;
  /** vertical range in v' (0 dorsal .. 1 ventral) */
  v0?: number;
  v1?: number;
  /** strength / opacity 0..1 */
  k?: number;
  /** irregularity 0..1 */
  j?: number;
  /** emissive glow of this layer (0 = none) */
  glow?: number;
  seed?: number;
  /** angle for diagonal (deg) */
  ang?: number;
}

export type FinPattern = 'none' | 'spots' | 'bands' | 'edge' | 'tips' | 'barred' | 'stripes' | 'ocellus' | 'rays' | 'dark';

export interface FinLook {
  base: string;
  edge: string;
  /** membrane opacity 0..1 */
  op: number;
  pat?: FinPattern;
  pc?: string;
  /** fleshy / opaque (shark fins, adipose) */
  opaque?: boolean;
  /** emissive glow of fin colours */
  glow?: number;
}

export interface MedianFin {
  s0: number;
  s1: number;
  /** height relative to max body depth */
  h: number;
  /** height profile at 5 points along the base (front→back), 0..1 */
  prof?: number[];
  /** backward lean of rays (deg) */
  sweep?: number;
  rays?: number;
  /** spiny notched membrane 0..1 */
  notch?: number;
  /** membrane edge wave */
  round?: number;
  look?: Partial<FinLook>;
  /** thickness for fleshy fins (fraction of length) */
  thick?: number;
  /** lateral offset (for paired median-like fins) */
  side?: number;
}

export interface CaudalFin {
  type: CaudalType;
  /** length relative to body length */
  len: number;
  /** vertical half-angle of the fan (deg) */
  spread: number;
  /** fork depth 0..1 (1 = no fork) */
  fork?: number;
  rays?: number;
  /** relative length of upper / lower lobes */
  up?: number;
  down?: number;
  look?: Partial<FinLook>;
  thick?: number;
  /** vertical tilt of the whole tail (deg, + = up) */
  tilt?: number;
}

export type PairedShape = 'round' | 'point' | 'wing' | 'fan' | 'filament' | 'paddle';

export interface PairedFin {
  /** position along body 0..1 */
  s: number;
  /** vertical position of fin base (-1 belly .. +1 back, relative to half depth) */
  y: number;
  /** length relative to body length */
  len: number;
  /** base length relative to fin length */
  base?: number;
  /** outward angle from body (deg) */
  ang?: number;
  /** downward angle (deg) */
  droop?: number;
  /** base line tilt (deg) */
  tilt?: number;
  shape?: PairedShape;
  rays?: number;
  /** fan spread (deg) */
  spread?: number;
  look?: Partial<FinLook>;
  thick?: number;
  /** fleshy lobe length (coelacanth) */
  lobe?: number;
}

export interface FinSet {
  dorsal?: MedianFin[];
  anal?: MedianFin[];
  caudal?: CaudalFin;
  pectoral?: PairedFin | null;
  pelvic?: PairedFin | null;
  adipose?: { s: number; h: number; len: number } | null;
  finlets?: { n: number; s0: number; s1: number; size: number; bottom?: boolean } | null;
}

export interface BodySpec {
  /** max depth relative to body length (snout → caudal base) */
  depth: number;
  /** full width / full depth */
  wr: number;
  maxAt: number;
  maxAtB?: number;
  /** front envelope exponents: <0.6 blunt, 1 ogive, >1 pointed */
  noseT: number;
  noseB: number;
  noseW?: number;
  /** rear taper exponent */
  tailP: number;
  /** peduncle depth relative to max depth */
  ped: number;
  pedW?: number;
  /** share of depth above axis */
  back: number;
  /** snout tip vertical offset (-1..1) */
  mouthY: number;
  /** tail axis vertical offset (-1..1 of half depth) */
  tailY?: number;
  /** cross-section superellipse exponents (2 = ellipse) */
  nT: number;
  nB: number;
  /** head width bulge */
  headW?: number;
  /** hump behind head */
  hump?: number;
  /** belly sag */
  sag?: number;
  /** rostrum/snout length (fraction) and depth (relative to max depth) */
  snout?: number;
  snoutD?: number;
  snoutW?: number;
  /** caudal base flare */
  flare?: number;
  /** vertical position of widest point 0..1 from belly */
  widest?: number;
  /** tail keels (scombrids / sharks) */
  keel?: number;
  /** s of gill cover edge */
  gill: number;
  gillType?: 'operculum' | 'slits' | 'none';
  /** mouth */
  mouth: MouthSpec;
  /** spine curve (pose): lateral S-curve amplitude, vertical arch */
  curveX?: number;
  curveY?: number;
  curveK?: number;
  /** extra body segmentation rings (seahorse/armour) */
  rings?: number;
}

export interface MouthSpec {
  /** gape length (fraction of body length) */
  len: number;
  /** vertical position at snout (-1..1) */
  y?: number;
  /** slope of the gape line going back (+ = downwards) */
  slope?: number;
  /** lip thickness (fraction) */
  lip?: number;
  lipC?: string;
  /** open mouth with cavity 0..1 */
  open?: number;
  /** under-slung position (sharks, sturgeons) */
  under?: boolean;
  /** jaw width multiplier for open mouths */
  wide?: number;
}

export interface Extras {
  barbels?: { n: number; len: number; thick?: number; c?: string; chin?: number };
  lure?: { len: number; bulb: number; c: string; glow?: number; stalkC?: string };
  teeth?: { n: number; size: number; c?: string; fang?: number };
  bill?: { len: number; w: number; type?: 'sword' | 'spear' | 'saw' | 'needle' | 'paddle'; c?: string };
  spines?: { n: number; len: number; c?: string };
  scutes?: { rows: number; n: number; size: number; c?: string };
  photophores?: { rows: number; n: number; size: number; c: string };
  horns?: { n: number; len: number; c?: string; curl?: number };
  whiskers?: { n: number; len: number; c?: string };
  crest?: { h: number; c?: string; s0?: number; s1?: number };
  hammer?: { w: number };
  eyeTentacles?: { len: number; c?: string };
  filaments?: { n: number; len: number; c?: string };
  kype?: number;
  plates?: { c?: string };
  sucker?: boolean;
  stinger?: { len: number };
  cephalic?: { len: number };
  gillFrills?: { c: string };
  glowOrbs?: { n: number; c: string; size: number };
  crystals?: { n: number; c: string; size: number };
  lateralLine?: { c: string; glow?: number };
}

export type AnimMode = 'swim' | 'eel' | 'flap' | 'pulse' | 'hover' | 'tentacle' | 'crawl' | 'none';

export interface EyeSpec {
  size: number; // radius relative to max body depth
  s: number; // position along body
  y: number; // vertical frac (-1..1)
  iris: string;
  pupil?: string;
  glow?: number;
  /** eyes on top of head (flatfish/rays) */
  top?: boolean;
  /** protrusion 0..1 */
  bulge?: number;
  ring?: string;
}

export interface LookSpec {
  top: string;
  mid: string;
  belly: string;
  /** v' of top→mid transition */
  split?: number;
  /** v' of mid→belly transition */
  split2?: number;
  pat: PatternLayer[];
  /** flank metalness 0..1 */
  silver: number;
  rough: number;
  irid: number;
  clearcoat: number;
  scale: ScaleType;
  /** scales along body length */
  scaleN: number;
  /** strength of scale outlines in colour texture */
  scaleVis: number;
  normal: number;
  lateral: number;
  lateralC?: string;
  fin: FinLook;
  finDorsal?: Partial<FinLook>;
  finCaudal?: Partial<FinLook>;
  finAnal?: Partial<FinLook>;
  finPectoral?: Partial<FinLook>;
  finPelvic?: Partial<FinLook>;
  /** emissive colour for glow layers */
  glowC?: string;
  /** subtle whole-body emissive (0..1) */
  bodyGlow?: number;
  /** translucent body (jelly / glass fish) */
  opacity?: number;
  cheek?: string;
}

export interface FishSpec {
  kind: 'fish' | 'special';
  special?: string;
  body: BodySpec;
  fins: FinSet;
  eye: EyeSpec;
  look: LookSpec;
  ex: Extras;
  anim: AnimMode;
  /** flatfish: lying on side */
  flat?: boolean;
  /** depressed body (rays): width dominant */
  ray?: boolean;
  seed: number;
  /** generic colour params for special builders */
  params?: Record<string, unknown>;
}

/** Deep partial helper */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** Compact per-species visual stored in FishDef.visual. */
export interface FishVisual {
  /** archetype id (see archetypes.ts) */
  a: string;
  /** one-sentence look description for reviewers */
  look?: string;
  seed?: number;
  /** body depth multiplier */
  d?: number;
  /** width multiplier */
  w?: number;
  /** colours: [back, flank, belly] */
  c?: [string, string, string];
  pat?: PatternLayer[];
  /** fin base / edge colour + opacity */
  fin?: Partial<FinLook>;
  eye?: string;
  eyeSize?: number;
  body?: Partial<BodySpec>;
  fins?: Partial<FinSet>;
  lk?: Partial<Omit<LookSpec, 'pat' | 'fin'>>;
  ex?: Extras;
  /** replace archetype extras instead of merging */
  exReplace?: boolean;
  anim?: AnimMode;
  params?: Record<string, unknown>;
  /** caudal fin override shortcut */
  tail?: Partial<CaudalFin>;
}
