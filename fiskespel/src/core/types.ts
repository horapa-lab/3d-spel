/**
 * SHARED CONTRACT for Reel Isles.
 *
 * Every system is built by a different author in parallel. This file is the
 * agreement between them. Rules:
 *  - Never rename or remove anything here.
 *  - You MAY add new OPTIONAL members (`foo?: ...`) to an interface you need,
 *    and new types at the bottom of the file under your own section comment.
 *  - Systems may only touch another system's API in `update()` or after the
 *    'game:ready' event — never in their factory function — except for the
 *    "core" members of GameContext (renderer, scene, camera, events, clock,
 *    input, quality, registry).
 *
 * World units are metres. Water surface rest level is y = 0. +Y is up.
 */
import type * as THREE from 'three';
import type { EventBus } from './events';

// ─────────────────────────────────────────────────────────────── ids & enums

export type Rarity =
  | 'trash'
  | 'common'
  | 'uncommon'
  | 'unusual'
  | 'rare'
  | 'legendary'
  | 'mythical'
  | 'exotic'
  | 'secret'
  | 'limited';

export type TimeOfDay = 'day' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'windy' | 'storm' | 'aurora';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
export type Biome =
  | 'temperate'
  | 'tropical'
  | 'desert'
  | 'snow'
  | 'swamp'
  | 'atoll'
  | 'rock'
  | 'pirate'
  | 'jungle'
  | 'volcanic'
  | 'monolith'
  | 'grotto'
  | 'ocean'
  | 'deep'
  | 'abyss';

/** Size label derived from weight percentile inside a species' kg range. */
export type SizeLabel = 'tiny' | 'small' | 'normal' | 'big' | 'giant';

// ─────────────────────────────────────────────────────────────── environment

/** Snapshot of the shared (UTC-driven) world state. Produced by WorldClockAPI. */
export interface EnvState {
  utcMs: number;
  /** 0..1 over one full day+night cycle. 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight. */
  dayProgress: number;
  isNight: boolean;
  /** sin(sun elevation), -1..1. Positive = sun above horizon. */
  sunElevation: number;
  weather: Weather;
  /** Weather we are blending towards (equals `weather` when stable). */
  nextWeather: Weather;
  /** 0..1 blend from `weather` to `nextWeather`. */
  weatherBlend: number;
  season: Season;
  /** Active global world event id (see data/events.ts) or null. */
  event: string | null;
  /** Wind direction in radians (0 = +X) and strength 0..1. */
  windDir: number;
  windStrength: number;
  /** Seconds since page load (monotonic, for animation). */
  time: number;
}

export interface WorldClockAPI {
  /** Current environment (includes local overrides such as totems). */
  get(): EnvState;
  /** Milliseconds until the given event next starts (0 if active now, Infinity if unknown). */
  msUntilEvent(eventId: string): number;
  /** Milliseconds until the next day/night switch. */
  msUntilPhaseChange(): number;
  /** Upcoming weather for the next N half-cycles (for a forecast UI). */
  forecast(count: number): { startsInMs: number; isNight: boolean; weather: Weather; event: string | null }[];
  /** Local override (totems). durationMs from now. Pass null fields to leave untouched. */
  applyOverride(o: { weather?: Weather | null; isNight?: boolean | null; event?: string | null; durationMs: number }): void;
  /** Called once per frame by main.ts. */
  update(dt: number): void;
  /** Optional: main.ts calls this right after creation so the clock can emit env:* events. */
  attach?(events: EventBus<GameEvents>): void;
}

// ─────────────────────────────────────────────────────────────── content defs

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string; // css hex
  order: number; // 0 = trash ... higher = rarer
  /** Luck scaling: chance weight *= max(0, 1 + luck * luckFactor). */
  luckFactor: number;
  /** Default XP for catching a fish of this rarity (fish may override). */
  xp: number;
  /** Reel minigame progress multiplier default (<1 = harder). */
  progressMult: number;
  /** Bite indicator style for UI ("!", "!!", "!!!", "?"). */
  indicator: string;
}

export interface MutationVisual {
  tint: string;
  tintStrength: number; // 0..1
  emissive?: string;
  emissiveStrength?: number;
  metalness?: number;
  roughness?: number;
  opacity?: number; // <1 = translucent
  iridescence?: number; // 0..1
  pattern?: 'none' | 'spots' | 'cracks' | 'crystals' | 'moss' | 'stars' | 'veins' | 'bands' | 'barnacles' | 'coral';
  patternColor?: string;
  particles?: 'none' | 'sparkle' | 'embers' | 'bubbles' | 'snow' | 'electric' | 'smoke' | 'petals' | 'stardust';
}

export interface MutationDef {
  id: string;
  name: string;
  multiplier: number;
  /** Base chance (0..1) per catch when conditions hold. */
  chance: number;
  conditions?: {
    zones?: string[];
    weather?: Weather[];
    time?: TimeOfDay;
    event?: string;
    season?: Season[];
  };
  /** Only obtainable via enchants / appraisal (never rolled naturally when true). */
  special?: boolean;
  description: string;
  visual: MutationVisual;
}

/** Stackable attributes (independent of mutation), e.g. gleaming/glittering. */
export interface AttributeDef {
  id: string;
  name: string;
  multiplier: number;
  chance: number;
  description: string;
  visual: { particles: MutationVisual['particles']; sheen: number };
}

export interface WeatherDef {
  id: Weather;
  name: string;
  /** Relative probability when rolling a half-cycle's weather. */
  weight: number;
  nightOnly?: boolean;
  description: string;
}

export interface WorldEventDef {
  id: string;
  name: string;
  description: string;
  time: TimeOfDay | 'any';
  /** Probability that a given half-cycle (matching `time`) hosts this event. */
  probability: number;
  effects: {
    luckMult?: number;
    xpMult?: number;
    mutationBoost?: { id: string; chanceMult: number }[];
  };
  color: string;
}

export interface LocationDef {
  id: string;
  name: string;
  biome: Biome;
  /** Recommended player level (soft gate; drives shop tiers and fish rarity mix). */
  tier: number;
  /** 'island' has land; 'water' is an ocean zone; 'sub' is a special pond/lake/pool inside an island. */
  kind: 'island' | 'water' | 'sub';
  parent?: string;
  description: string;
}

export interface NpcDef {
  id: string;
  name: string;
  role:
    | 'merchant'
    | 'shipwright'
    | 'appraiser'
    | 'angler'
    | 'totem_carver'
    | 'keeper'
    | 'treasure_hunter'
    | 'innkeeper'
    | 'bait_vendor'
    | 'rod_crafter'
    | 'bestiary_keeper'
    | 'villager';
  location: string;
  lines: string[];
  /** Appearance hints for the character model builder. */
  look: {
    body: 'slim' | 'average' | 'stocky';
    skin: string;
    hair: string;
    outfit: string;
    accent: string;
    hat?: 'none' | 'cap' | 'beanie' | 'straw' | 'captain' | 'tricorn' | 'hood' | 'fur' | 'bandana' | 'wizard';
    beard?: boolean;
    apron?: boolean;
    glasses?: boolean;
    age?: 'young' | 'adult' | 'old';
  };
}

export interface FishDef {
  id: string;
  name: string;
  /** Fishing zone id (location id). */
  zone: string;
  rarity: Rarity;
  /** Base weight inside its zone's pool (relative). */
  chance: number;
  time?: TimeOfDay; // undefined = any time
  weather?: Weather[]; // preferred weather (+35%); undefined = no preference
  season?: Season[]; // preferred seasons
  event?: string; // only catchable during this world event
  minKg: number;
  maxKg: number;
  pricePerKg: number;
  /** Reel minigame: fish calmness (seconds factor). ~1.5 calm .. 0.25 frantic. */
  resilience: number;
  progressMult?: number;
  xp: number;
  description: string;
  /** Optional bait ids this fish prefers (bait preferredLuck applies). */
  preferredBait?: string[];
  /** Model builder params. Opaque to everything except models/fish. */
  visual: unknown;
}

export interface RodStats {
  /** Fraction: +0.25 = 25% faster bites; negative = slower. */
  lureSpeed: number;
  /** Fraction: +0.5 = +50% luck. */
  luck: number;
  /** Added to reel bar width (bar width = 0.20 + control, clamp 0.08..0.6). */
  control: number;
  /** Fraction: +0.3 = fish moves 30% less / slower. */
  resilience: number;
  /** Max fish weight in kg (Infinity allowed). */
  maxKg: number;
}

export interface RodDef {
  id: string;
  name: string;
  description: string;
  tier: number; // progression order 1..N
  price: number; // coins; 0 = not purchasable (obtain elsewhere)
  unlockLevel: number;
  /** Location whose merchant/rod crafter sells it, or null. */
  soldAt: string | null;
  obtain: 'starter' | 'shop' | 'quest' | 'bestiary' | 'event' | 'treasure' | 'level';
  obtainHint: string;
  stats: RodStats;
  /** Passive ability — `id` from PASSIVE_IDS (docs/CONTRACT.md), implemented by the fishing system. */
  passive?: { id: string; name: string; description: string; chance?: number; value?: number; mutation?: string; zones?: string[] };
  /** Model builder params. Opaque to everything except models/rods. */
  visual: unknown;
}

export interface BaitDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  /** Coins per unit when sold in shops, or null if only from crates/quests. */
  price: number | null;
  soldAt: string | null;
  stats: { lureSpeed: number; luck: number; resilience: number; preferredLuck: number };
  /** What the bait's preferredLuck applies to. */
  preferred?: { rarities?: Rarity[]; zones?: string[]; time?: TimeOfDay; fishIds?: string[] };
  visual: unknown;
}

export type ItemKind =
  | 'bait_crate'
  | 'treasure_chest'
  | 'relic'
  | 'totem'
  | 'treasure_map'
  | 'bobber'
  | 'lantern'
  | 'potion'
  | 'misc';

export interface LootEntry {
  kind: 'coins' | 'bait' | 'item' | 'rod' | 'xp';
  id?: string;
  min: number;
  max: number;
  weight: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  description: string;
  price: number | null;
  soldAt: string | null;
  /** For crates/chests: rolls `rolls` times from loot. */
  loot?: { rolls: number; table: LootEntry[] };
  /** For totems: environment override. */
  totem?: { weather?: Weather; isNight?: boolean; event?: string; durationMin: number };
  /** For relics: which enchant pool it rolls from. */
  relic?: { pool: 'standard' | 'exalted' | 'cosmic' };
  /** For potions: temporary boost. (sellMult / mutationMult optional, added by economy.) */
  potion?: { luckMult?: number; lureMult?: number; xpMult?: number; sellMult?: number; mutationMult?: number; durationMin: number };
  /** Backpack upgrade (kind 'misc'): using it adds `slots` to the backpack capacity (economy). */
  backpack?: { slots: number };
  /** Minimum player level to buy it in a shop (economy; default 1). */
  unlockLevel?: number;
  visual: unknown;
}

export interface BoatDef {
  id: string;
  name: string;
  description: string;
  price: number;
  unlockLevel: number;
  soldAt: string | null;
  speed: number; // m/s top speed
  turnRate: number; // rad/s
  visual: unknown;
}

export interface EnchantDef {
  id: string;
  name: string;
  pool: 'standard' | 'exalted' | 'cosmic';
  weight: number;
  description: string;
  /** Additive stat modifiers applied to the enchanted rod. */
  stats?: Partial<RodStats>;
  /** Special behaviour — `id` from PASSIVE_IDS (same semantics as rod passives), implemented by fishing/economy. */
  effect?: { id: string; value?: number; chance?: number; mutation?: string; zones?: string[] };
}

// ─────────────────────────────────────────────────────────────── runtime data

export interface CaughtFish {
  uid: string;
  fishId: string;
  kg: number;
  mutation: string | null;
  attributes: string[];
  size: SizeLabel;
  value: number;
  zone: string;
  caughtAt: number; // utc ms
  perfect: boolean;
  /** "1 in X" odds at the moment it was rolled. */
  odds: number;
  favorite?: boolean;
}

export interface Boost {
  id: string; // e.g. 'ad_luck', 'potion_luck'
  label: string;
  luckMult?: number;
  lureMult?: number;
  xpMult?: number;
  sellMult?: number;
  mutationMult?: number;
  expiresAt: number; // utc ms
}

export interface BestiaryEntry {
  caught: number;
  bestKg: number;
  bestValue: number;
  mutations: string[];
  firstCaughtAt: number;
}

export interface QuestState {
  id: string;
  npcId: string;
  fishId: string;
  /** Any fish of fishId satisfies; hand in from backpack. */
  rewardCoins: number;
  rewardXp: number;
  bonusItem?: string | null;
  expiresAt?: number;
}

export interface PlayerSave {
  version: number;
  coins: number;
  xp: number; // xp inside current level
  level: number;
  rods: string[];
  equippedRod: string;
  /** rodId -> enchant ids (index 0 = main, 1 = cosmic secondary). */
  rodEnchants: Record<string, string[]>;
  baits: Record<string, number>;
  equippedBait: string | null;
  items: Record<string, number>;
  bobbers: string[];
  equippedBobber: string;
  boats: string[];
  equippedBoat: string | null;
  backpack: CaughtFish[];
  backpackSize: number;
  bestiary: Record<string, BestiaryEntry>;
  claimedBestiaryZones: string[];
  discovered: string[];
  quests: QuestState[];
  questCooldowns: Record<string, number>;
  /** Completed angler quests per NPC id (economy; quest-reward rods). */
  questCounts?: Record<string, number>;
  /** Decoded treasure maps (economy). `chest` = treasure_chest item id, `location` = island near the X. */
  treasureMaps: { id: string; target: [number, number] | null; chest?: string; location?: string }[];
  boosts: Boost[];
  stats: {
    catches: number;
    perfect: number;
    coinsEarned: number;
    playSeconds: number;
    biggestKg: number;
    rarest: string | null;
    /** Optional counters (economy). */
    fishSold?: number;
    questsCompleted?: number;
    treasuresFound?: number;
    cratesOpened?: number;
    appraisals?: number;
    enchants?: number;
    bestiaryClaims?: number;
  };
  settings: {
    music: number;
    sfx: number;
    quality: QualityTier | 'auto';
    autoReelUnlocked: boolean;
    showTutorial: boolean;
  };
  spawn: { location: string };
  lastSeen: number;
}

// ─────────────────────────────────────────────────────────────── world

export interface IslandInfo {
  id: string; // location id
  name: string;
  biome: Biome;
  center: { x: number; z: number };
  /** Rough radius of land (for map + culling). */
  radius: number;
  /** Player spawn / respawn point on this island (on land, near dock). */
  spawn: THREE.Vector3;
  /** Where boats can be spawned / boarded near this island (in water). */
  boatSpawn: THREE.Vector3;
}

export interface Interactable {
  id: string;
  kind: 'npc' | 'altar' | 'sign' | 'chest' | 'boat_spawn' | 'bestiary' | 'bell';
  position: THREE.Vector3;
  radius: number;
  label: string;
  npcId?: string;
  locationId: string;
  /** For chests: treasure id. */
  data?: Record<string, unknown>;
}

export interface NpcPlacement {
  npcId: string;
  position: THREE.Vector3;
  rotationY: number;
}

export interface WorldAPI {
  group: THREE.Object3D;
  /** Half extent of the playable world square (metres). World spans [-halfSize, halfSize] on X and Z. */
  halfSize: number;
  islands: IslandInfo[];
  npcs: NpcPlacement[];
  interactables: Interactable[];
  /** Ground / seabed height at x,z. Water surface is y = 0, so < 0 means underwater. */
  terrainHeight(x: number, z: number): number;
  /** Fishing zone id for a bobber at x,z (location id, sub-zone id, or 'open_ocean' / 'deep_ocean' / 'abyssal_trench'). */
  zoneAt(x: number, z: number): string;
  /** Location (island or ocean area) the player is in, for discovery + HUD. */
  locationAt(x: number, z: number): string;
  /** Extra water surfaces that are not the sea (lakes/lava) — height of that surface or null. */
  localWaterAt?(x: number, z: number): { y: number; kind: 'water' | 'lava' | 'ice' } | null;
  /** Push a sphere (feet position, radius) out of solid props/buildings. Mutates pos. */
  collide(pos: THREE.Vector3, radius: number): void;
  update(dt: number, camera: THREE.Camera, env: EnvState): void;
}

// ─────────────────────────────────────────────────────────────── render / ocean / sky

export interface RenderAPI {
  renderer: THREE.WebGLRenderer;
  quality: QualityTier;
  setQuality(q: QualityTier): void;
  resize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, env: EnvState): void;
  /** Rolling average FPS for auto-quality. */
  fps(): number;
}

export interface OceanAPI {
  object: THREE.Object3D;
  /** Displaced sea surface height at world x,z (includes waves). */
  heightAt(x: number, z: number): number;
  /** Surface normal at x,z (for boats/bobbers). */
  normalAt(x: number, z: number, target: THREE.Vector3): THREE.Vector3;
  /** Spawn a splash ring / droplets at a position (bobber landing, fish jump). */
  splash(pos: THREE.Vector3, strength: number): void;
  /** True when the camera is below the sea surface. */
  isUnderwater(camera: THREE.Camera): boolean;
  update(dt: number, camera: THREE.Camera, env: EnvState): void;
}

export interface SkyAPI {
  sunDirection: THREE.Vector3;
  /** Main directional light (casts shadows). */
  sun: THREE.DirectionalLight;
  /** Environment map for PBR reflections (updated when time/weather changes). */
  envMap: THREE.Texture | null;
  /** Fog currently applied to the scene. */
  fog: THREE.Fog | THREE.FogExp2 | null;
  update(dt: number, camera: THREE.Camera, env: EnvState): void;
}

// ─────────────────────────────────────────────────────────────── models

export type ModelKind =
  | 'fish'
  | 'rod'
  | 'bait'
  | 'item'
  | 'bobber'
  | 'character'
  | 'npc'
  | 'boat'
  | 'building'
  | 'prop'
  | 'vegetation';

export interface ModelBuildOptions {
  /** Mutation id (fish only). */
  mutation?: string | null;
  /** Attribute ids (fish only). */
  attributes?: string[];
  /** 0 = full detail, 1 = medium, 2 = far. */
  lod?: 0 | 1 | 2;
  quality?: QualityTier;
  seed?: number;
  /** Optional pose for models that support it, e.g. 'open' for chests/crates (lab: ?pose=open). */
  pose?: string;
}

/**
 * Model conventions:
 *  fish:      centred at origin, head toward +Z, total length 1.0 (scaled by gameplay).
 *  rod:       handle butt at origin, rod along +Y, has a child named ROD_TIP_NAME at the tip,
 *             and a child named ROD_GRIP_NAME where the hand holds it. Length 1.8..3.4 m.
 *  bobber:    ~0.12 m, waterline at y = 0, line attachment child named BOBBER_LINE_NAME.
 *  character/npc: feet at y = 0, faces +Z, ~1.75 m tall. Right hand socket child named HAND_R_NAME.
 *  boat:      faces +Z, waterline y = 0, child named BOAT_SEAT_NAME (player stands/sits here).
 *  item/bait: resting on y = 0, fits roughly in a 0.6 m cube (chests up to 1.2 m).
 *  building/prop/vegetation: base at y = 0, real-world size.
 */
export const ROD_TIP_NAME = 'rodTip';
export const ROD_GRIP_NAME = 'rodGrip';
export const BOBBER_LINE_NAME = 'lineAttach';
export const HAND_R_NAME = 'handR';
export const BOAT_SEAT_NAME = 'seat';

export interface ModelFamily {
  /** All ids this family can build (used by the lab + gauntlet). */
  list(): string[];
  build(id: string, opts?: ModelBuildOptions): THREE.Object3D;
  /** Short human description of what the model should look like (for reviewers). */
  describe?(id: string): string;
}

export interface ModelRegistry {
  register(kind: ModelKind, family: ModelFamily): void;
  has(kind: ModelKind): boolean;
  list(kind: ModelKind): string[];
  build(kind: ModelKind, id: string, opts?: ModelBuildOptions): THREE.Object3D;
  describe(kind: ModelKind, id: string): string;
}

// ─────────────────────────────────────────────────────────────── input

export interface InputAPI {
  /** Movement intent, -1..1. x = strafe right, y = forward. */
  move: { x: number; y: number };
  /** Camera look delta accumulated this frame (pixels, already scaled). */
  look: { x: number; y: number };
  /** Zoom delta this frame (+ = zoom out). */
  zoom: number;
  /**
   * Primary action: LMB on the canvas, or the touch action button. Cast & reel.
   * While the fishing phase is 'reeling', Space also counts as primary (input.ts handles this
   * when `reelingMode` is true).
   */
  primaryDown: boolean;
  primaryPressed: boolean;
  primaryReleased: boolean;
  /** Set by fishing: when true Space maps to primary instead of jump. */
  reelingMode: boolean;
  interactPressed: boolean; // E / touch interact
  jumpPressed: boolean; // Space (when not reelingMode) / touch jump
  sprint: boolean; // Shift / touch sprint
  isTouch: boolean;
  /** True for one frame when a key (KeyboardEvent.code) went down. */
  keyPressed(code: string): boolean;
  keyDown(code: string): boolean;
  /** Mobile UI feeds these. */
  setVirtualMove(x: number, y: number): void;
  setVirtualButton(name: 'primary' | 'interact' | 'jump' | 'sprint', down: boolean): void;
  addLook(dx: number, dy: number): void;
  /** Temporarily ignore gameplay input (menus open). */
  setBlocked(blocked: boolean): void;
  blocked: boolean;
  /** Called by main.ts at the END of every frame to clear per-frame flags. */
  endFrame(): void;
}

// ─────────────────────────────────────────────────────────────── player

export type PlayerAnim =
  | 'idle'
  | 'walk'
  | 'run'
  | 'swim'
  | 'jump'
  | 'cast_charge'
  | 'cast_release'
  | 'fishing_idle'
  | 'reel'
  | 'hold_fish'
  | 'celebrate'
  | 'drive';

export interface PlayerAPI {
  object: THREE.Object3D;
  position: THREE.Vector3; // feet
  /** Facing yaw in radians (0 = +Z). */
  heading: number;
  mode: 'walk' | 'swim' | 'boat';
  /** Set by fishing while charging/casting/reeling: blocks movement. */
  locked: boolean;
  /** World position of the equipped rod tip. */
  rodTip(target: THREE.Vector3): THREE.Vector3;
  /** Horizontal unit vector the player/camera faces (cast direction). */
  castDirection(target: THREE.Vector3): THREE.Vector3;
  setAnim(anim: PlayerAnim): void;
  /** Show a caught fish model held up in the hands (null = hide). */
  showCatch(fish: THREE.Object3D | null): void;
  equipRod(rodId: string): void;
  /** Nearest interactable within reach (updated each frame). */
  nearestInteractable: Interactable | null;
  spawnBoat(): boolean;
  boardBoat(): boolean;
  leaveBoat(): void;
  teleport(pos: THREE.Vector3): void;
  camera: THREE.PerspectiveCamera;
  update(dt: number): void;
}

// ─────────────────────────────────────────────────────────────── fishing

export type FishingPhase = 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'caught' | 'escaped';

export interface ShakeButton {
  id: number;
  /** Normalised screen position 0..1 (from top-left). */
  x: number;
  y: number;
  /** Seconds remaining before it moves. */
  ttl: number;
}

export interface ReelState {
  /** Left edge of the player bar, 0..1-barWidth. */
  barPos: number;
  barWidth: number;
  /** Fish indicator centre 0..1. */
  fishPos: number;
  /** 0..1, catch at 1, escape at 0. */
  progress: number;
  inside: boolean;
  locked: boolean;
  perfect: boolean;
  rarity: Rarity;
  fishName: string | null; // revealed name? null until caught (UI shows "???")
  overweight: boolean;
  /** 0..1 how hard (for UI shake/colour). */
  difficulty: number;
}

export interface FishingAPI {
  phase: FishingPhase;
  /** 0..1 while charging. */
  castPower: number;
  shakeButtons: ShakeButton[];
  clickShake(id: number): void;
  reel: ReelState | null;
  /** Rarity of hooked fish once it bites (for "!" indicator). */
  hookedRarity: Rarity | null;
  lastCatch: CaughtFish | null;
  bobberPosition: THREE.Vector3 | null;
  currentZone: string | null;
  autoReel: boolean;
  setAutoReel(on: boolean): void;
  /** Rewarded-ad hook: after an escape, retry the same fish once. */
  canRetryEscaped(): boolean;
  retryEscaped(): void;
  cancel(): void;
  update(dt: number): void;
}

// ─────────────────────────────────────────────────────────────── economy / progression

export interface ShopEntry {
  kind: 'rod' | 'bait' | 'item' | 'boat' | 'bobber';
  id: string;
  price: number;
  unlockLevel: number;
  owned?: boolean;
  /** How many the player already holds (consumables: bait units / items). */
  count?: number;
  /** Units per purchase shown in the shop (e.g. bait sold in packs). price is per unit. */
  pack?: number;
}

/** A special effect active on the equipped rod (rod passive or enchant effect). Economy → fishing. */
export interface ActiveEffect {
  id: string;
  value?: number;
  chance?: number;
  mutation?: string;
  zones?: string[];
  /** 'rod' (rod passive) or 'enchant:<id>'. */
  source: string;
}

export interface EnchantResult {
  ok: boolean;
  enchantId?: string;
  message: string;
}

export interface EconomyAPI {
  readonly save: PlayerSave;
  coins(): number;
  level(): number;
  xp(): number;
  xpToNext(): number;
  addCoins(amount: number, reason: string): void;
  spendCoins(amount: number): boolean;
  addXp(amount: number, reason: string): void;
  /** Give items/bait/rods/bobbers (treasure maps from fishing, quest rewards, loot). kind inferred from id. */
  grantItem(id: string, qty: number): void;

  equippedRod(): RodDef;
  /** Rod stats including enchants and active boosts. */
  effectiveRodStats(): RodStats;
  rodEnchants(rodId: string): EnchantDef[];
  equippedBait(): BaitDef | null;
  /** Called by fishing when a cast lands in water with bait equipped. */
  consumeBait(): void;

  /** Global multipliers from boosts/events/passives (fishing reads these). */
  luckMultiplier(): number;
  lureMultiplier(): number;
  xpMultiplier(): number;
  sellMultiplier(): number;
  mutationMultiplier(): number;

  /** Record a catch: bestiary, stats, backpack. Returns false if backpack was full (fish is lost but still counted). */
  addCatch(c: CaughtFish): boolean;
  sell(uids: string[]): number;
  sellAll(): number;
  toggleFavorite(uid: string): void;

  shopFor(npcId: string): ShopEntry[];
  buy(entry: ShopEntry, qty?: number): boolean;
  equipRod(id: string): boolean;
  equipBait(id: string | null): boolean;
  equipBobber(id: string): boolean;
  equipBoat(id: string): boolean;
  useItem(itemId: string): { ok: boolean; message: string; loot?: { kind: string; id?: string; amount: number }[] };

  appraiseCost(uid: string): number;
  appraise(uid: string): CaughtFish | null;
  enchant(relicItemId: string): EnchantResult;

  /** Bestiary helpers. */
  bestiaryZone(zoneId: string): { fishId: string; entry: BestiaryEntry | null }[];
  bestiaryProgress(zoneId: string): { caught: number; total: number; claimed: boolean };
  claimBestiary(zoneId: string): boolean;

  /** Angler quests. */
  questFor(npcId: string): QuestState | null;
  turnInQuest(npcId: string): boolean;

  addBoost(b: Boost): void;
  activeBoosts(): Boost[];

  discover(locationId: string): boolean;
  save_(): void; // persist now
  update(dt: number): void;

  // ── optional extras (economy) ──────────────────────────────────────────
  /** Rod passive + enchant effects of the equipped rod, in one list (fishing may use instead of reading both). */
  activeEffects?(): ActiveEffect[];
  /** Why a shop entry can / cannot be bought right now (for disabled buttons). */
  buyCheck?(entry: ShopEntry, qty?: number): { ok: boolean; reason?: string };
  /** Coins that selling these fish (default: sellAll set) would give right now, incl. sellMultiplier. */
  sellPreview?(uids?: string[]): number;
  /** Whether the enchant altar works now (night) and a readable reason if not. */
  canEnchant?(): { ok: boolean; reason?: string };
  /** Reward that claiming this zone's bestiary page gives. */
  bestiaryReward?(zoneId: string): { coins: number; xp: number; bobber: string | null; rod: string | null };
  /** Ms until this angler offers a new quest (0 = ready). */
  questCooldownMs?(npcId: string): number;
  /** One-Eyed Rosa: decode one treasure map for TREASURE_DECODE_COST coins. */
  decodeMap?(): { ok: boolean; message: string; target?: [number, number]; locationId?: string };
  /** Undecoded treasure maps held. */
  mapCount?(): number;
  /** Innkeeper: respawn here. */
  setSpawn?(locationId: string): void;
  /** Rewarded ads: run the ad via the platform and grant the reward. */
  adReward?(kind: 'luck' | 'sell' | 'bait' | 'xp'): Promise<boolean>;
  /** Ms until that ad reward is offered again (0 = available). */
  adRewardCooldownMs?(kind: 'luck' | 'sell' | 'bait' | 'xp'): number;
}

// ─────────────────────────────────────────────────────────────── ui / audio / platform

export type PanelId =
  | 'shop'
  | 'backpack'
  | 'bestiary'
  | 'rods'
  | 'appraiser'
  | 'quest'
  | 'enchant'
  | 'map'
  | 'settings'
  | 'dialog'
  | 'boats'
  | 'items'
  | 'catch';

export interface UIAPI {
  open(panel: PanelId, data?: Record<string, unknown>): void;
  close(): void;
  isOpen(): boolean;
  toast(text: string, kind?: 'info' | 'good' | 'bad' | 'rare'): void;
  update(dt: number): void;
}

export interface AudioAPI {
  play(id: string, opts?: { volume?: number; pitch?: number; position?: THREE.Vector3 }): void;
  setVolumes(music: number, sfx: number): void;
  /** Must be called from a user gesture before audio plays. */
  unlock(): void;
  update(dt: number, env: EnvState): void;
}

export interface PlatformAPI {
  /** 'crazygames' when running inside CrazyGames, else 'local'. */
  env: 'crazygames' | 'local';
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  /** Resolves true if the reward should be granted. */
  rewarded(placement: string): Promise<boolean>;
  midgame(): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  username(): Promise<string | null>;
  /**
   * Optional hook, set by main.ts after the event bus exists: the platform calls it when an ad
   * starts / ends (rewarded or midgame, SDK or local fake) so the game can pause/mute.
   */
  onAd?: (state: 'start' | 'end') => void;
  /** True while an ad is showing. */
  adPlaying?(): boolean;
  /** Synchronous best-effort write used on pagehide (localStorage / SDK data are sync underneath). */
  setItemSync?(key: string, value: string): void;
}

// ─────────────────────────────────────────────────────────────── events

export interface GameEvents {
  'game:ready': Record<string, never>;
  'fishing:phase': { phase: FishingPhase };
  'cast:start': { power: number };
  'cast:land': { position: THREE.Vector3; zone: string | null; inWater: boolean };
  'fish:bite': { rarity: Rarity };
  'fish:shake': Record<string, never>;
  'fish:hooked': { fishId: string; rarity: Rarity };
  'fish:caught': { fish: CaughtFish; def: FishDef; firstTime: boolean };
  'fish:escaped': { fishId: string };
  'fish:perfect': Record<string, never>;
  'economy:coins': { delta: number; total: number; reason: string };
  'economy:xp': { delta: number; level: number; xp: number };
  'level:up': { level: number };
  'bestiary:new': { fishId: string; zone: string };
  'bestiary:complete': { zone: string };
  'quest:new': { quest: QuestState };
  'quest:complete': { quest: QuestState };
  'location:enter': { locationId: string };
  'location:discovered': { locationId: string };
  interact: { target: Interactable };
  'ui:open': { panel: PanelId; data?: Record<string, unknown> };
  'ui:close': Record<string, never>;
  'ui:toast': { text: string; kind?: 'info' | 'good' | 'bad' | 'rare' };
  'env:weather': { weather: Weather };
  'env:event': { event: string | null };
  'env:phase': { isNight: boolean };
  'boat:board': { boatId: string };
  'boat:leave': Record<string, never>;
  'item:used': { itemId: string };
  'enchant:applied': { rodId: string; enchantId: string };
  'appraise:done': { fish: CaughtFish };
  'shop:buy': { kind: ShopEntry['kind']; id: string };
  'equip:rod': { rodId: string };
  'ad:start': Record<string, never>;
  'ad:end': Record<string, never>;
  'save:done': Record<string, never>;
  'player:splash': { position: THREE.Vector3 };
}

// ─────────────────────────────────────────────────────────────── context

export interface GameContext {
  // core (safe to use in factories)
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  events: EventBus<GameEvents>;
  clock: WorldClockAPI;
  input: InputAPI;
  quality: QualityTier;
  registry: ModelRegistry;
  platform: PlatformAPI;
  // systems (assigned in order by main.ts; use only in update() or after 'game:ready')
  render: RenderAPI;
  sky: SkyAPI;
  ocean: OceanAPI;
  world: WorldAPI;
  economy: EconomyAPI;
  player: PlayerAPI;
  fishing: FishingAPI;
  audio: AudioAPI;
  ui: UIAPI;
}
