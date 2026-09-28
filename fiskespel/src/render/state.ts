/**
 * Shared runtime state between the renderer, the sky and the ocean (all OWNER: render).
 * Lives in a module so systems created in any order can reach each other without
 * touching GameContext members they may not use in their factories.
 */
import * as THREE from 'three';
import type { QualityTier } from '../core/types';
import { TIERS, type TierSettings } from './quality';
import type { Look } from './look';
import { defaultLook } from './look';

type QualityListener = (q: QualityTier, s: TierSettings) => void;

export interface GradeParams {
  exposure: number;
  saturation: number;
  contrast: number;
  /** Multiplicative colour balance (linear). */
  tint: THREE.Color;
  /** Added lift in shadows (linear). */
  lift: THREE.Color;
  vignette: number;
  bloomStrength: number;
  bloomThreshold: number;
  /** 0..1 lightning flash. */
  flash: number;
  /** 0..1 camera below the water surface. */
  underwater: number;
  underwaterColor: THREE.Color;
  /** Camera depth below surface (m) for the underwater look. */
  underwaterDepth: number;
  /** Rain drops on the lens / wet look 0..1. */
  wet: number;
}

export interface PrepassInfo {
  enabled: boolean;
  color: THREE.Texture | null;
  depth: THREE.DepthTexture | null;
  near: number;
  far: number;
  /** Pixel size of the pre-pass targets. */
  size: THREE.Vector2;
}

export const renderState = {
  quality: 'medium' as QualityTier,
  tier: TIERS.medium as TierSettings,
  listeners: [] as QualityListener[],
  /** Objects hidden while the refraction pre-pass renders (water, sky, fx). */
  prepassHidden: new Set<THREE.Object3D>(),
  prepass: { enabled: false, color: null, depth: null, near: 0.1, far: 800, size: new THREE.Vector2(1, 1) } as PrepassInfo,
  /** Scene HDR depth of the final pass (for post effects). */
  sceneDepth: null as THREE.DepthTexture | null,
  /** Drawing buffer size in pixels. */
  viewport: new THREE.Vector2(1, 1),
  grade: {
    exposure: 1,
    saturation: 1,
    contrast: 1,
    tint: new THREE.Color(1, 1, 1),
    lift: new THREE.Color(0, 0, 0),
    vignette: 0.25,
    bloomStrength: 0.12,
    bloomThreshold: 1.2,
    flash: 0,
    underwater: 0,
    underwaterColor: new THREE.Color(0.02, 0.12, 0.16),
    underwaterDepth: 0,
    wet: 0,
  } as GradeParams,
  /** Current blended environment look (written by the sky every frame, read by the ocean). */
  look: defaultLook(),
  /** Frame counter. */
  frame: 0,
  /** Called by the render system right before the main scene render (after the pre-pass). */
  beforeMain: [] as ((renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) => void)[],
};

export function onQualityChange(fn: QualityListener): void {
  renderState.listeners.push(fn);
}

export function setSharedQuality(q: QualityTier): void {
  renderState.quality = q;
  renderState.tier = TIERS[q];
  for (const l of renderState.listeners) l(q, TIERS[q]);
}

export function currentLook(): Look {
  return renderState.look;
}
