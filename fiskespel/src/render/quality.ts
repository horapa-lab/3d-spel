/**
 * Per-tier render settings shared by the renderer, ocean and sky.
 * OWNER: render. Other systems may read `TIERS[q]` but should prefer `ctx.quality`.
 */
import type { QualityTier } from '../core/types';

export interface TierSettings {
  /** Device pixel ratio cap. */
  pixelRatio: number;
  /** Shadow map size (0 = no shadows). */
  shadowMapSize: number;
  /** Half extent (m) of the camera-following shadow frustum. */
  shadowExtent: number;
  /** MSAA samples on the HDR scene target. */
  msaa: number;
  bloom: boolean;
  fxaa: boolean;
  /** Opaque colour+depth pre-pass scale for refraction / exact shorelines (0 = off). */
  prepass: number;
  /** Ocean polar-grid angular segments (multiple of 8). */
  oceanSegments: number;
  /** Ocean ring aspect (radial step / angular step). */
  oceanRingAspect: number;
  /** Gerstner waves per wave set. */
  waves: number;
  /** Detail normal cascade texture size and wave count. */
  detailSize: number;
  detailWaves: number;
  /** Evaluate the sky analytically in the water reflection (sharp clouds) instead of the cube. */
  analyticReflection: boolean;
  /** Sky cube face size for reflections / PMREM. */
  envSize: number;
  /** Minimum seconds between env map regenerations. */
  envInterval: number;
  /** Sky-view LUT size. */
  skyLut: [number, number];
  rainDrops: number;
  particles: number;
  /** Underwater volumetric light shafts. */
  shafts: boolean;
  /** Terrain depth bake resolution (near window). */
  depthBake: number;
  /** Persistent foam simulation texture size (0 = analytic only). */
  foamSim: number;
}

export const TIERS: Record<QualityTier, TierSettings> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 1024,
    shadowExtent: 28,
    msaa: 0,
    bloom: false,
    fxaa: true,
    prepass: 0,
    oceanSegments: 128,
    oceanRingAspect: 1.6,
    waves: 10,
    detailSize: 128,
    detailWaves: 24,
    analyticReflection: false,
    envSize: 64,
    envInterval: 4,
    skyLut: [128, 64],
    rainDrops: 1800,
    particles: 256,
    shafts: false,
    depthBake: 128,
    foamSim: 0,
  },
  medium: {
    pixelRatio: 1.25,
    shadowMapSize: 2048,
    shadowExtent: 36,
    msaa: 0,
    bloom: false,
    fxaa: true,
    prepass: 0,
    oceanSegments: 192,
    oceanRingAspect: 1.4,
    waves: 14,
    detailSize: 256,
    detailWaves: 40,
    analyticReflection: false,
    envSize: 128,
    envInterval: 2,
    skyLut: [160, 96],
    rainDrops: 4000,
    particles: 512,
    shafts: true,
    depthBake: 192,
    foamSim: 0,
  },
  high: {
    pixelRatio: 1.5,
    shadowMapSize: 2048,
    shadowExtent: 44,
    msaa: 0,
    bloom: true,
    fxaa: true,
    prepass: 0.5,
    oceanSegments: 256,
    oceanRingAspect: 1.25,
    waves: 18,
    detailSize: 256,
    detailWaves: 56,
    analyticReflection: true,
    envSize: 128,
    envInterval: 1,
    skyLut: [192, 108],
    rainDrops: 7000,
    particles: 768,
    shafts: true,
    depthBake: 256,
    foamSim: 0,
  },
  ultra: {
    pixelRatio: 2,
    shadowMapSize: 4096,
    shadowExtent: 56,
    msaa: 4,
    bloom: true,
    fxaa: false,
    prepass: 0.75,
    oceanSegments: 320,
    oceanRingAspect: 1.15,
    waves: 24,
    detailSize: 512,
    detailWaves: 64,
    analyticReflection: true,
    envSize: 256,
    envInterval: 0.5,
    skyLut: [256, 128],
    rainDrops: 10000,
    particles: 1024,
    shafts: true,
    depthBake: 256,
    foamSim: 0,
  },
};

export const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra'];
