/**
 * Archetype presets (body plans) + resolution of a compact FishVisual into a full FishSpec.
 */
import type { BodySpec, FinSet, FishSpec, FishVisual, LookSpec, MedianFin } from './types';
import { hashStr, lin, linToHex, mixRGB } from './util';

type Mod = (s: FishSpec) => void;

function base(): FishSpec {
  return {
    kind: 'fish',
    seed: 1,
    anim: 'swim',
    body: {
      depth: 0.3,
      wr: 0.44,
      maxAt: 0.36,
      noseT: 1.25,
      noseB: 1.55,
      tailP: 1.3,
      ped: 0.32,
      back: 0.55,
      mouthY: 0,
      nT: 2.2,
      nB: 2.3,
      gill: 0.27,
      gillType: 'operculum',
      mouth: { len: 0.1, slope: 0.25 },
    },
    fins: {
      dorsal: [
        { s0: 0.3, s1: 0.56, h: 0.5, prof: [0.55, 1, 0.9, 0.75, 0.55], rays: 11, notch: 0.45, sweep: 28 },
        { s0: 0.57, s1: 0.8, h: 0.4, prof: [0.9, 1, 0.85, 0.65, 0.45], rays: 13, sweep: 35 },
      ],
      anal: [{ s0: 0.62, s1: 0.8, h: 0.34, prof: [0.8, 1, 0.85, 0.6, 0.4], rays: 10, sweep: 38 }],
      caudal: { type: 'emarginate', len: 0.27, spread: 32, rays: 18 },
      pectoral: { s: 0.3, y: -0.12, len: 0.19, ang: 32, droop: 18, tilt: 25, shape: 'round', rays: 13, spread: 55, base: 0.3 },
      pelvic: { s: 0.34, y: -0.88, len: 0.15, ang: 22, droop: 48, tilt: 10, shape: 'point', rays: 6, spread: 40, base: 0.25 },
      adipose: null,
      finlets: null,
    },
    eye: { size: 0.13, s: 0.1, y: 0.35, iris: '#c9a13b' },
    look: {
      top: '#3b4a2e',
      mid: '#9aa367',
      belly: '#efe9d2',
      pat: [],
      silver: 0.2,
      rough: 0.42,
      irid: 0.3,
      clearcoat: 0.8,
      scale: 'ctenoid',
      scaleN: 46,
      scaleVis: 0.35,
      normal: 0.6,
      lateral: 0.5,
      fin: { base: '#8a8456', edge: '#c9b27c', op: 0.8 },
    },
    ex: {},
  };
}

const B = (s: FishSpec, b: Partial<BodySpec>) => Object.assign(s.body, b);
const F = (s: FishSpec, f: Partial<FinSet>) => Object.assign(s.fins, f);
const L = (s: FishSpec, l: Partial<LookSpec>) => Object.assign(s.look, l);
const md = (s0: number, s1: number, h: number, prof: number[], rays: number, extra: Partial<MedianFin> = {}): MedianFin => ({ s0, s1, h, prof, rays, ...extra });

const ARCH: Record<string, Mod> = {
  percoid: () => {},
  bass: (s) => {
    B(s, { depth: 0.3, maxAt: 0.38, hump: 0.08, mouthY: 0.25, mouth: { len: 0.16, slope: 0.3, y: 0.3 }, noseT: 1.1, noseB: 1.9 });
    s.eye.size = 0.12;
  },
  grouper: (s) => {
    B(s, { depth: 0.32, wr: 0.55, maxAt: 0.4, noseT: 1.05, noseB: 1.6, ped: 0.36, mouthY: 0.15, mouth: { len: 0.17, slope: 0.28, y: 0.2, lip: 0.012 }, hump: 0.05 });
    F(s, {
      dorsal: [md(0.26, 0.55, 0.34, [0.6, 1, 0.9, 0.85, 0.8], 11, { notch: 0.4 }), md(0.55, 0.82, 0.38, [0.9, 1, 1, 0.8, 0.5], 14)],
      caudal: { type: 'rounded', len: 0.25, spread: 32, rays: 16 },
      pectoral: { s: 0.3, y: -0.15, len: 0.2, ang: 35, droop: 15, tilt: 20, shape: 'fan', rays: 16, spread: 60 },
    });
    L(s, { scale: 'ctenoid', scaleN: 60 });
    s.eye.size = 0.1;
  },
  cyprinid: (s) => {
    B(s, { depth: 0.33, wr: 0.48, maxAt: 0.4, noseT: 1.2, noseB: 1.3, ped: 0.38, back: 0.52, mouthY: -0.1, sag: 0.04, mouth: { len: 0.05, slope: 0.1, lip: 0.012 } });
    F(s, {
      dorsal: [md(0.36, 0.66, 0.42, [0.7, 1, 0.75, 0.55, 0.45], 16, { sweep: 32 })],
      anal: [md(0.7, 0.8, 0.36, [0.8, 1, 0.7, 0.5, 0.35], 7)],
      caudal: { type: 'forked', len: 0.28, spread: 34, fork: 0.5, rays: 19 },
      pectoral: { s: 0.29, y: -0.55, len: 0.18, ang: 35, droop: 30, tilt: 30, shape: 'round', rays: 15, spread: 50 },
      pelvic: { s: 0.48, y: -0.9, len: 0.15, ang: 25, droop: 45, tilt: 10, shape: 'round', rays: 8, spread: 40 },
    });
    L(s, { scale: 'large', scaleN: 30, scaleVis: 0.75, normal: 0.9 });
    s.ex.barbels = { n: 2, len: 0.06, thick: 0.006 };
    s.eye = { size: 0.1, s: 0.1, y: 0.25, iris: '#d4a53a' };
  },
  koi: (s) => {
    ARCH.cyprinid(s);
    B(s, { depth: 0.28, wr: 0.55, maxAt: 0.35, noseT: 1.4, noseB: 1.2 });
    L(s, { top: '#f2efe8', mid: '#f7f3ec', belly: '#fbf8f2', scaleVis: 0.5, silver: 0.05, irid: 0.5 });
  },
  salmonid: (s) => {
    B(s, { depth: 0.23, wr: 0.5, maxAt: 0.4, noseT: 1.35, noseB: 1.5, ped: 0.35, back: 0.53, mouth: { len: 0.13, slope: 0.18 } });
    F(s, {
      dorsal: [md(0.38, 0.54, 0.62, [1, 0.95, 0.75, 0.5, 0.3], 12, { sweep: 28 })],
      anal: [md(0.68, 0.8, 0.45, [1, 0.9, 0.65, 0.45, 0.3], 10, { sweep: 32 })],
      caudal: { type: 'emarginate', len: 0.26, spread: 30, rays: 19 },
      pectoral: { s: 0.27, y: -0.6, len: 0.16, ang: 35, droop: 30, tilt: 30, shape: 'round', rays: 13, spread: 45 },
      pelvic: { s: 0.52, y: -0.9, len: 0.13, ang: 25, droop: 45, tilt: 10, shape: 'round', rays: 9, spread: 40 },
      adipose: { s: 0.8, h: 0.18, len: 0.06 },
    });
    L(s, { scale: 'fine', scaleN: 110, scaleVis: 0.1, silver: 0.45, irid: 0.5, normal: 0.35 });
    s.eye = { size: 0.12, s: 0.09, y: 0.3, iris: '#c0c8c0' };
  },
  herring: (s) => {
    ARCH.salmonid(s);
    B(s, { depth: 0.22, wr: 0.42, maxAt: 0.4, mouthY: 0.15, mouth: { len: 0.07, slope: -0.1 } });
    F(s, { adipose: null, dorsal: [md(0.4, 0.55, 0.45, [1, 0.9, 0.6, 0.4, 0.25], 14)], caudal: { type: 'forked', len: 0.3, spread: 34, fork: 0.25, rays: 19 } });
    L(s, { silver: 0.85, scale: 'cycloid', scaleN: 50, scaleVis: 0.25, irid: 0.8, top: '#2d4f6b', mid: '#b9c8cf', belly: '#eef3f4' });
    s.eye.size = 0.16;
  },
  scombrid: (s) => {
    B(s, { depth: 0.26, wr: 0.62, maxAt: 0.4, noseT: 1.2, noseB: 1.35, tailP: 1.9, ped: 0.08, pedW: 0.2, back: 0.52, keel: 0.35, mouth: { len: 0.08, slope: 0.1 }, flare: 1.2 });
    F(s, {
      dorsal: [md(0.3, 0.46, 0.4, [1, 0.7, 0.4, 0.25, 0.15], 13, { notch: 0.2, sweep: 40 }), md(0.5, 0.6, 0.38, [1, 0.8, 0.5, 0.3, 0.2], 12, { sweep: 50 })],
      anal: [md(0.54, 0.63, 0.34, [1, 0.8, 0.5, 0.3, 0.2], 12, { sweep: 50 })],
      caudal: { type: 'lunate', len: 0.36, spread: 58, fork: 0.12, rays: 20 },
      pectoral: { s: 0.28, y: 0.05, len: 0.2, ang: 22, droop: 8, tilt: 35, shape: 'wing', rays: 14, spread: 30 },
      pelvic: { s: 0.3, y: -0.88, len: 0.1, ang: 20, droop: 40, shape: 'point', rays: 6 },
      finlets: { n: 7, s0: 0.64, s1: 0.94, size: 0.07 },
    });
    L(s, { scale: 'fine', scaleN: 140, scaleVis: 0.05, silver: 0.7, irid: 0.6, normal: 0.25, top: '#16305a', mid: '#8fa3b5', belly: '#eef2f4' });
    s.eye = { size: 0.1, s: 0.09, y: 0.3, iris: '#b8b8a0' };
  },
  mahi: (s) => {
    ARCH.scombrid(s);
    B(s, { depth: 0.3, wr: 0.36, maxAt: 0.3, noseT: 0.55, noseB: 1.4, tailP: 1.4, ped: 0.12, keel: 0, mouthY: -0.3 });
    F(s, {
      dorsal: [md(0.06, 0.9, 0.36, [1, 0.85, 0.75, 0.6, 0.45], 40, { sweep: 25 })],
      anal: [md(0.5, 0.9, 0.3, [1, 0.8, 0.7, 0.6, 0.4], 22)],
      finlets: null,
      caudal: { type: 'forked', len: 0.34, spread: 45, fork: 0.1, rays: 20 },
    });
  },
  gadoid: (s) => {
    B(s, { depth: 0.24, wr: 0.55, maxAt: 0.32, noseT: 1.3, noseB: 1.4, tailP: 1.2, ped: 0.22, back: 0.5, mouthY: -0.05, mouth: { len: 0.1, slope: 0.15 } });
    F(s, {
      dorsal: [md(0.28, 0.42, 0.42, [0.7, 1, 0.75, 0.5, 0.3], 12), md(0.45, 0.64, 0.35, [0.7, 1, 0.85, 0.6, 0.35], 18), md(0.67, 0.84, 0.3, [0.7, 1, 0.8, 0.5, 0.3], 16)],
      anal: [md(0.45, 0.64, 0.3, [0.6, 1, 0.9, 0.6, 0.3], 18), md(0.67, 0.84, 0.27, [0.7, 1, 0.8, 0.5, 0.3], 16)],
      caudal: { type: 'truncate', len: 0.2, spread: 30, rays: 20 },
      pectoral: { s: 0.28, y: -0.1, len: 0.16, shape: 'round', rays: 14 },
      pelvic: { s: 0.24, y: -0.9, len: 0.13, droop: 55, shape: 'filament', rays: 6 },
    });
    s.ex.barbels = { n: 0, len: 0.05, chin: 0.06 };
    L(s, { scale: 'fine', scaleN: 90, scaleVis: 0.1, silver: 0.1 });
    s.eye.size = 0.13;
  },
  flatfish: (s) => {
    s.flat = true;
    B(s, { depth: 0.55, wr: 0.16, maxAt: 0.42, noseT: 0.9, noseB: 1.2, ped: 0.12, back: 0.5, tailP: 1.1, nT: 2, nB: 2, mouth: { len: 0.07, slope: 0.1 } });
    F(s, {
      dorsal: [md(0.06, 0.9, 0.16, [0.4, 0.9, 1, 0.8, 0.5], 60, { sweep: 20 })],
      anal: [md(0.28, 0.9, 0.16, [0.5, 0.9, 1, 0.8, 0.5], 46, { sweep: 20 })],
      caudal: { type: 'rounded', len: 0.2, spread: 30, rays: 18 },
      pectoral: { s: 0.28, y: 0.0, len: 0.12, ang: 20, droop: 0, shape: 'round', rays: 10 },
      pelvic: null,
    });
    L(s, { scale: 'cycloid', scaleN: 70, scaleVis: 0.15, top: '#6b5a42', mid: '#7b6a4e', belly: '#f1ede3', split: 0.5, split2: 0.55, silver: 0 });
    s.eye = { size: 0.1, s: 0.12, y: 0.45, iris: '#c8b070', top: true, bulge: 0.8 };
  },
  puffer: (s) => {
    B(s, { depth: 0.55, wr: 0.95, maxAt: 0.42, noseT: 0.6, noseB: 0.7, tailP: 1.4, ped: 0.22, back: 0.5, nT: 2, nB: 2.2, mouth: { len: 0.03, slope: 0, lip: 0.02 }, flare: 0.8 });
    F(s, {
      dorsal: [md(0.72, 0.84, 0.28, [0.6, 1, 0.9, 0.6, 0.3], 10)],
      anal: [md(0.72, 0.84, 0.25, [0.6, 1, 0.9, 0.6, 0.3], 9)],
      caudal: { type: 'rounded', len: 0.22, spread: 30, rays: 12 },
      pectoral: { s: 0.34, y: 0.05, len: 0.11, shape: 'fan', rays: 14, ang: 40 },
      pelvic: null,
    });
    L(s, { scale: 'smooth', scaleVis: 0, normal: 0.5, silver: 0, lateral: 0 });
    s.ex.spines = { n: 90, len: 0.05 };
    s.eye = { size: 0.13, s: 0.2, y: 0.4, iris: '#3fb58e', bulge: 0.6 };
  },
  boxfish: (s) => {
    ARCH.puffer(s);
    B(s, { depth: 0.4, wr: 0.85, nT: 4, nB: 4, noseT: 0.7, maxAt: 0.45, ped: 0.2 });
    s.ex.spines = undefined;
    L(s, { scale: 'plate', scaleN: 12, normal: 1 });
  },
  discoid: (s) => {
    B(s, { depth: 0.85, wr: 0.2, maxAt: 0.42, noseT: 0.95, noseB: 0.95, tailP: 1.1, ped: 0.18, back: 0.52, mouthY: 0.05, mouth: { len: 0.04, slope: 0.05, lip: 0.01 } });
    F(s, {
      dorsal: [md(0.2, 0.86, 0.3, [0.4, 0.8, 1, 0.9, 0.5], 28, { sweep: 50, notch: 0.1 })],
      anal: [md(0.42, 0.86, 0.26, [0.5, 0.9, 1, 0.9, 0.5], 22, { sweep: 50 })],
      caudal: { type: 'truncate', len: 0.2, spread: 30, rays: 16 },
      pectoral: { s: 0.35, y: -0.05, len: 0.14, shape: 'round', rays: 14 },
      pelvic: { s: 0.36, y: -0.75, len: 0.13, shape: 'point', rays: 6, droop: 55 },
    });
    L(s, { scale: 'ctenoid', scaleN: 50, scaleVis: 0.2, silver: 0.05 });
    s.eye = { size: 0.08, s: 0.18, y: 0.3, iris: '#c8a040' };
  },
  angelfish: (s) => {
    ARCH.discoid(s);
    B(s, { depth: 0.75 });
    F(s, {
      dorsal: [md(0.25, 0.8, 0.95, [0.3, 1, 0.8, 0.6, 0.35], 16, { sweep: 55 })],
      anal: [md(0.36, 0.8, 0.95, [0.3, 1, 0.8, 0.6, 0.35], 16, { sweep: 55 })],
      pelvic: { s: 0.36, y: -0.75, len: 0.35, shape: 'filament', rays: 4, droop: 60 },
      caudal: { type: 'lunate', len: 0.34, spread: 45, fork: 0.7, rays: 16 },
    });
  },
  tang: (s) => {
    ARCH.discoid(s);
    B(s, { depth: 0.62, maxAt: 0.45, noseT: 0.85, ped: 0.2, mouthY: -0.05 });
    F(s, { caudal: { type: 'lunate', len: 0.26, spread: 40, fork: 0.7, rays: 16 } });
    s.eye.size = 0.09;
  },
  reef: (s) => {
    B(s, { depth: 0.4, wr: 0.4, maxAt: 0.4, noseT: 1.1, noseB: 1.2, ped: 0.35, mouth: { len: 0.05, slope: 0.1, lip: 0.01 } });
    F(s, {
      dorsal: [md(0.28, 0.82, 0.32, [0.6, 0.9, 1, 0.9, 0.6], 24, { notch: 0.2 })],
      anal: [md(0.58, 0.82, 0.3, [0.7, 1, 0.9, 0.7, 0.5], 12)],
      caudal: { type: 'truncate', len: 0.24, spread: 32, rays: 16 },
      pectoral: { s: 0.32, y: -0.1, len: 0.18, shape: 'round', rays: 14 },
    });
    L(s, { scaleN: 36, scaleVis: 0.3 });
    s.eye = { size: 0.14, s: 0.12, y: 0.3, iris: '#e0a030' };
  },
  wrasse: (s) => {
    ARCH.reef(s);
    B(s, { depth: 0.28, wr: 0.38, noseT: 1.4, maxAt: 0.35, mouth: { len: 0.05, slope: 0.1, lip: 0.014 } });
    L(s, { scale: 'cycloid', scaleN: 34, scaleVis: 0.4 });
  },
  parrot: (s) => {
    ARCH.reef(s);
    B(s, { depth: 0.34, wr: 0.46, noseT: 0.8, noseB: 1.3, maxAt: 0.4, mouth: { len: 0.04, slope: 0.1, lip: 0.022, lipC: '#e8e0c8' } });
    L(s, { scale: 'large', scaleN: 26, scaleVis: 0.7 });
    F(s, { caudal: { type: 'lunate', len: 0.28, spread: 44, fork: 0.65, rays: 16 } });
  },
  catfish: (s) => {
    B(s, { depth: 0.2, wr: 0.95, maxAt: 0.26, noseT: 1.0, noseB: 2.2, tailP: 1.0, ped: 0.4, back: 0.55, nT: 2.1, nB: 3.2, headW: 0.35, mouthY: -0.1, mouth: { len: 0.07, slope: -0.05, lip: 0.02, wide: 1.4 } });
    F(s, {
      dorsal: [md(0.3, 0.4, 0.55, [1, 0.8, 0.6, 0.4, 0.25], 7, { notch: 0.1 })],
      anal: [md(0.58, 0.95, 0.3, [0.6, 0.8, 0.8, 0.7, 0.6], 24)],
      caudal: { type: 'forked', len: 0.22, spread: 30, fork: 0.6, rays: 17 },
      pectoral: { s: 0.22, y: -0.6, len: 0.15, shape: 'point', rays: 9, ang: 40, droop: 10 },
      pelvic: { s: 0.5, y: -0.95, len: 0.11, shape: 'round', rays: 7 },
      adipose: { s: 0.76, h: 0.16, len: 0.08 },
    });
    L(s, { scale: 'smooth', scaleVis: 0, normal: 0.6, silver: 0.05, irid: 0.15, lateral: 0.3, top: '#3b3a30', mid: '#6d6a55', belly: '#d9d2bd' });
    s.ex.barbels = { n: 4, len: 0.3, thick: 0.009, chin: 0.1 };
    s.eye = { size: 0.08, s: 0.1, y: 0.45, iris: '#a09060' };
  },
  pike: (s) => {
    B(s, { depth: 0.16, wr: 0.7, maxAt: 0.55, noseT: 1.1, noseB: 1.2, tailP: 1.2, ped: 0.5, back: 0.5, snout: 0.12, snoutD: 0.35, snoutW: 0.55, mouth: { len: 0.17, slope: 0.08, y: 0.1 }, gill: 0.26, nB: 2.6 });
    F(s, {
      dorsal: [md(0.7, 0.84, 0.75, [0.8, 1, 0.8, 0.6, 0.45], 15, { sweep: 35 })],
      anal: [md(0.72, 0.85, 0.65, [0.8, 1, 0.8, 0.6, 0.45], 13, { sweep: 35 })],
      caudal: { type: 'forked', len: 0.2, spread: 34, fork: 0.55, rays: 18 },
      pectoral: { s: 0.28, y: -0.7, len: 0.1, rays: 13 },
      pelvic: { s: 0.52, y: -0.9, len: 0.1, rays: 9, shape: 'round' },
    });
    L(s, { scale: 'fine', scaleN: 100, scaleVis: 0.15 });
    s.eye = { size: 0.16, s: 0.17, y: 0.55, iris: '#d8c060' };
  },
  gar: (s) => {
    ARCH.pike(s);
    B(s, { depth: 0.13, snout: 0.22, snoutD: 0.22, snoutW: 0.35, mouth: { len: 0.24, slope: 0.02 }, gill: 0.32 });
    F(s, { caudal: { type: 'rounded', len: 0.18, spread: 28, rays: 14 } });
    L(s, { scale: 'plate', scaleN: 50, scaleVis: 0.6, normal: 1 });
    s.ex.teeth = { n: 16, size: 0.012 };
  },
  barracuda: (s) => {
    ARCH.pike(s);
    B(s, { depth: 0.15, snout: 0.08, snoutD: 0.45, mouth: { len: 0.16, slope: 0.04, y: -0.1 } });
    F(s, {
      dorsal: [md(0.36, 0.44, 0.5, [1, 0.8, 0.5, 0.3, 0.2], 5, { notch: 0.3 }), md(0.66, 0.74, 0.5, [1, 0.8, 0.5, 0.3, 0.2], 9)],
      anal: [md(0.68, 0.76, 0.45, [1, 0.8, 0.5, 0.3, 0.2], 9)],
      caudal: { type: 'forked', len: 0.24, spread: 40, fork: 0.3, rays: 18 },
    });
    L(s, { silver: 0.75, irid: 0.5 });
    s.ex.teeth = { n: 10, size: 0.014, fang: 1.5 };
  },
  eel: (s) => {
    s.anim = 'eel';
    B(s, { depth: 0.075, wr: 0.85, maxAt: 0.3, noseT: 1.3, noseB: 1.4, tailP: 0.8, ped: 0.2, back: 0.5, mouth: { len: 0.04, slope: 0.1 }, gill: 0.12, gillType: 'none', curveX: 0.06, curveK: 2.2 });
    F(s, {
      dorsal: [md(0.35, 1.0, 0.8, [0.3, 0.8, 1, 1, 1], 60, { sweep: 45 })],
      anal: [md(0.5, 1.0, 0.8, [0.3, 0.8, 1, 1, 1], 50, { sweep: 45 })],
      caudal: { type: 'pointed', len: 0.05, spread: 30, rays: 10 },
      pectoral: { s: 0.13, y: 0, len: 0.04, rays: 10, shape: 'round' },
      pelvic: null,
    });
    L(s, { scale: 'smooth', scaleVis: 0, normal: 0.5, lateral: 0.2, silver: 0.1 });
    s.eye = { size: 0.2, s: 0.035, y: 0.4, iris: '#b89040' };
  },
  moray: (s) => {
    ARCH.eel(s);
    B(s, { depth: 0.1, wr: 0.6, maxAt: 0.35, noseT: 1.1, mouth: { len: 0.07, slope: 0.1, open: 0.5 } });
    F(s, { pectoral: null, dorsal: [md(0.08, 1.0, 0.45, [0.3, 0.9, 1, 1, 1], 40, { sweep: 45, thick: 0.1 })] });
    L(s, { scale: 'rough', normal: 0.5 });
    s.ex.teeth = { n: 12, size: 0.01, fang: 1.8 };
    s.eye.size = 0.14;
  },
  shark: (s) => {
    B(s, { depth: 0.2, wr: 0.78, maxAt: 0.34, noseT: 1.0, noseB: 1.3, tailP: 1.6, ped: 0.18, pedW: 0.3, back: 0.56, mouthY: 0.1, tailY: 0.35, keel: 0.2, nT: 2.0, nB: 2.4, gill: 0.26, gillType: 'slits', mouth: { len: 0.1, slope: 0.12, under: true, y: -0.7 } });
    const opq = { opaque: true };
    F(s, {
      dorsal: [md(0.36, 0.5, 0.8, [1, 0.9, 0.6, 0.3, 0.05], 2, { sweep: 38, thick: 0.035, look: opq }), md(0.76, 0.82, 0.28, [1, 0.7, 0.4, 0.2, 0.05], 2, { sweep: 45, thick: 0.02, look: opq })],
      anal: [md(0.77, 0.83, 0.22, [1, 0.7, 0.4, 0.2, 0.05], 2, { sweep: 45, thick: 0.02, look: opq })],
      caudal: { type: 'heterocercal', len: 0.34, spread: 38, up: 1, down: 0.55, rays: 2, thick: 0.03, tilt: 8, look: opq },
      pectoral: { s: 0.28, y: -0.55, len: 0.26, ang: 30, droop: 25, tilt: 40, shape: 'wing', rays: 2, spread: 35, base: 0.4, thick: 0.03, look: opq },
      pelvic: { s: 0.62, y: -0.85, len: 0.1, ang: 25, droop: 35, shape: 'point', rays: 2, thick: 0.02, look: opq },
    });
    L(s, { scale: 'denticle', scaleN: 80, scaleVis: 0, normal: 0.6, silver: 0, irid: 0.05, lateral: 0, clearcoat: 0.5, top: '#56626d', mid: '#8a96a0', belly: '#eef0ee', split: 0.42, split2: 0.55, fin: { base: '#56626d', edge: '#3d4750', op: 1, opaque: true } });
    s.eye = { size: 0.07, s: 0.1, y: 0.3, iris: '#2a2a2a', pupil: '#050505' };
  },
  hammerhead: (s) => {
    ARCH.shark(s);
    s.ex.hammer = { w: 0.28 };
    s.eye.size = 0.05;
  },
  ray: (s) => {
    s.ray = true;
    s.anim = 'flap';
    B(s, { depth: 0.12, wr: 7.5, maxAt: 0.42, noseT: 1.3, noseB: 1.3, noseW: 1.05, tailP: 1.2, ped: 0.08, pedW: 0.02, back: 0.6, nT: 1.25, nB: 1.4, gill: 0.3, gillType: 'none', mouth: { len: 0.02, slope: 0, under: true, y: -0.9 } });
    F(s, { dorsal: [], anal: [], caudal: { type: 'none', len: 0, spread: 0 }, pectoral: null, pelvic: null });
    L(s, { scale: 'skin' as never, scaleVis: 0, normal: 0.4, silver: 0, lateral: 0, split: 0.47, split2: 0.53, top: '#6b5d4a', mid: '#8a7a64', belly: '#f0ebe0' });
    s.look.scale = 'smooth';
    s.ex.stinger = { len: 0.9 };
    s.eye = { size: 0.3, s: 0.17, y: 0.9, iris: '#3a3020', top: true, bulge: 0.7 };
  },
  manta: (s) => {
    ARCH.ray(s);
    B(s, { wr: 12, depth: 0.14, maxAt: 0.45, noseT: 1.0, noseW: 0.8 });
    s.ex.stinger = { len: 0.4 };
    s.ex.cephalic = { len: 0.14 };
    L(s, { top: '#1d242c', mid: '#2c343c', belly: '#f2f4f2' });
  },
  billfish: (s) => {
    ARCH.scombrid(s);
    B(s, { depth: 0.2, maxAt: 0.33, noseT: 1.3, snout: 0.0, keel: 0.4, mouth: { len: 0.1, slope: 0.1 } });
    s.ex.bill = { len: 0.32, w: 0.025, type: 'spear' };
    F(s, {
      dorsal: [md(0.18, 0.72, 0.9, [1, 0.45, 0.25, 0.15, 0.1], 40, { sweep: 35 }), md(0.84, 0.88, 0.2, [1, 0.6, 0.3, 0.2, 0.1], 6)],
      anal: [md(0.62, 0.72, 0.5, [1, 0.6, 0.3, 0.2, 0.1], 12, { sweep: 45 })],
      finlets: null,
      caudal: { type: 'lunate', len: 0.38, spread: 55, fork: 0.1, rays: 20 },
      pectoral: { s: 0.25, y: -0.4, len: 0.28, ang: 20, droop: 20, shape: 'wing', rays: 14 },
      pelvic: { s: 0.28, y: -0.9, len: 0.2, droop: 50, shape: 'filament', rays: 3 },
    });
  },
  sailfish: (s) => {
    ARCH.billfish(s);
    F(s, { dorsal: [md(0.14, 0.7, 1.7, [0.8, 1, 1, 0.9, 0.4], 44, { sweep: 25 }), md(0.84, 0.88, 0.2, [1, 0.6, 0.3, 0.2, 0.1], 6)] });
  },
  swordfish: (s) => {
    ARCH.billfish(s);
    s.ex.bill = { len: 0.4, w: 0.05, type: 'sword' };
    F(s, { dorsal: [md(0.22, 0.34, 0.9, [1, 0.6, 0.3, 0.15, 0.1], 12, { sweep: 35 }), md(0.84, 0.88, 0.2, [1, 0.6, 0.3, 0.2, 0.1], 6)], pelvic: null });
  },
  angler: (s) => {
    B(s, { depth: 0.5, wr: 0.9, maxAt: 0.33, noseT: 0.8, noseB: 0.9, tailP: 1.1, ped: 0.28, back: 0.45, mouthY: 0.3, nT: 2.1, nB: 2.4, gill: 0.4, gillType: 'none', mouth: { len: 0.2, slope: -0.15, open: 1, y: 0.1, wide: 1.2 } });
    F(s, {
      dorsal: [md(0.72, 0.84, 0.3, [0.7, 1, 0.8, 0.6, 0.4], 7)],
      anal: [md(0.74, 0.86, 0.25, [0.7, 1, 0.8, 0.6, 0.4], 6)],
      caudal: { type: 'rounded', len: 0.22, spread: 30, rays: 9 },
      pectoral: { s: 0.5, y: -0.2, len: 0.12, shape: 'round', rays: 10 },
      pelvic: null,
    });
    L(s, { scale: 'rough', scaleVis: 0, normal: 0.9, silver: 0, lateral: 0, irid: 0.1, top: '#241e22', mid: '#3a3136', belly: '#4a4044', rough: 0.6 });
    s.ex.lure = { len: 0.45, bulb: 0.035, c: '#aaffee', glow: 3 };
    s.ex.teeth = { n: 22, size: 0.035, fang: 1.4, c: '#e8e4d0' };
    s.eye = { size: 0.06, s: 0.18, y: 0.55, iris: '#303030', pupil: '#101010' };
  },
  deepsea: (s) => {
    B(s, { depth: 0.2, wr: 0.45, maxAt: 0.25, noseT: 0.9, noseB: 1.1, tailP: 0.9, ped: 0.25, back: 0.5, gill: 0.2, gillType: 'none', mouth: { len: 0.18, slope: 0.05, open: 0.8, wide: 1.0 } });
    F(s, {
      dorsal: [md(0.6, 0.72, 0.4, [1, 0.8, 0.6, 0.4, 0.3], 10)],
      anal: [md(0.64, 0.76, 0.35, [1, 0.8, 0.6, 0.4, 0.3], 10)],
      caudal: { type: 'forked', len: 0.16, spread: 30, fork: 0.5, rays: 14 },
      pectoral: { s: 0.22, y: -0.6, len: 0.12, rays: 8, shape: 'filament' },
      pelvic: { s: 0.45, y: -0.9, len: 0.1, rays: 6 },
    });
    L(s, { scale: 'smooth', scaleVis: 0, normal: 0.4, silver: 0.4, irid: 0.6, lateral: 0, top: '#0d0f16', mid: '#1b1e2b', belly: '#262a3a' });
    s.ex.teeth = { n: 12, size: 0.04, fang: 2.2, c: '#dfe8ee' };
    s.ex.photophores = { rows: 2, n: 16, size: 0.012, c: '#5ce8ff' };
    s.eye = { size: 0.18, s: 0.08, y: 0.4, iris: '#20303a', glow: 0.3 };
  },
  lionfish: (s) => {
    ARCH.percoid(s);
    B(s, { depth: 0.32, maxAt: 0.35, mouthY: 0.1, mouth: { len: 0.08, slope: 0.2 } });
    F(s, {
      dorsal: [md(0.22, 0.6, 1.3, [0.8, 1, 0.9, 0.7, 0.5], 13, { notch: 0.9, sweep: 35 }), md(0.6, 0.82, 0.55, [1, 0.9, 0.8, 0.6, 0.4], 11)],
      pectoral: { s: 0.3, y: -0.2, len: 0.55, ang: 55, droop: 25, tilt: 20, shape: 'fan', rays: 16, spread: 110, base: 0.25 },
      caudal: { type: 'rounded', len: 0.25, spread: 32, rays: 14 },
    });
    s.ex.eyeTentacles = { len: 0.12 };
    s.look.pat = [{ t: 'zebra', c: '#8a1e12', n: 16, w: 0.5, j: 0.6 }];
  },
  sturgeon: (s) => {
    B(s, { depth: 0.15, wr: 0.85, maxAt: 0.3, noseT: 1.0, noseB: 1.6, tailP: 1.4, ped: 0.25, back: 0.55, tailY: 0.4, snout: 0.08, snoutD: 0.35, snoutW: 0.6, nT: 1.9, nB: 3, mouth: { len: 0.04, slope: 0, under: true, y: -0.8 }, gill: 0.22 });
    F(s, {
      dorsal: [md(0.72, 0.82, 0.45, [0.9, 1, 0.7, 0.45, 0.3], 12)],
      anal: [md(0.74, 0.83, 0.4, [0.9, 1, 0.7, 0.45, 0.3], 10)],
      caudal: { type: 'heterocercal', len: 0.26, spread: 30, up: 1, down: 0.5, rays: 16, tilt: 10 },
      pectoral: { s: 0.24, y: -0.7, len: 0.14, shape: 'round', rays: 12, ang: 40, droop: 15 },
      pelvic: { s: 0.62, y: -0.95, len: 0.09, shape: 'round', rays: 8 },
    });
    L(s, { scale: 'smooth', scaleVis: 0, normal: 0.5, silver: 0.1, lateral: 0 });
    s.ex.scutes = { rows: 5, n: 14, size: 0.018 };
    s.ex.barbels = { n: 0, len: 0.05, chin: 0 };
    s.eye = { size: 0.08, s: 0.11, y: 0.5, iris: '#707060' };
  },
  paddlefish: (s) => {
    ARCH.sturgeon(s);
    s.ex.scutes = undefined;
    s.ex.bill = { len: 0.3, w: 0.06, type: 'paddle' };
    B(s, { snout: 0, mouth: { len: 0.14, slope: 0.1 } });
  },
  coelacanth: (s) => {
    B(s, { depth: 0.28, wr: 0.55, maxAt: 0.38, noseT: 1.0, noseB: 1.2, tailP: 1.0, ped: 0.4, back: 0.5, mouth: { len: 0.1, slope: 0.1 } });
    F(s, {
      dorsal: [md(0.3, 0.42, 0.55, [0.9, 1, 0.8, 0.5, 0.3], 9, { notch: 0.2 }), md(0.62, 0.7, 0.4, [0.8, 1, 0.8, 0.5, 0.3], 10, { thick: 0.04 })],
      anal: [md(0.64, 0.72, 0.38, [0.8, 1, 0.8, 0.5, 0.3], 10, { thick: 0.04 })],
      caudal: { type: 'diphycercal', len: 0.3, spread: 40, rays: 22 },
      pectoral: { s: 0.3, y: -0.4, len: 0.2, shape: 'paddle', rays: 12, lobe: 0.4, thick: 0.05, ang: 45, droop: 25 },
      pelvic: { s: 0.52, y: -0.85, len: 0.16, shape: 'paddle', rays: 10, lobe: 0.35, thick: 0.05 },
    });
    L(s, { scale: 'large', scaleN: 36, scaleVis: 0.5, normal: 1.0, top: '#1f3550', mid: '#35506e', belly: '#5d6f85', silver: 0.05 });
    s.look.pat = [{ t: 'spots', c: '#e8eef2', n: 7, w: 0.45, k: 0.6 }];
    s.eye = { size: 0.12, s: 0.1, y: 0.35, iris: '#c8e0d8', glow: 0.2 };
  },
  mola: (s) => {
    B(s, { depth: 0.9, wr: 0.28, maxAt: 0.45, noseT: 0.9, noseB: 0.9, tailP: 0.35, ped: 0.72, back: 0.5, mouth: { len: 0.03, slope: 0, lip: 0.02 }, flare: 0 });
    F(s, {
      dorsal: [md(0.72, 0.9, 0.95, [0.6, 1, 0.9, 0.6, 0.3], 14, { sweep: 25, thick: 0.03 })],
      anal: [md(0.72, 0.9, 0.95, [0.6, 1, 0.9, 0.6, 0.3], 14, { sweep: 25, thick: 0.03 })],
      caudal: { type: 'truncate', len: 0.1, spread: 40, rays: 12, thick: 0.03 },
      pectoral: { s: 0.34, y: 0, len: 0.1, rays: 10 },
      pelvic: null,
    });
    L(s, { scale: 'rough', scaleVis: 0, normal: 0.5, silver: 0.15, lateral: 0, top: '#5d6b75', mid: '#9aa6ad', belly: '#dfe4e4' });
    s.eye = { size: 0.06, s: 0.18, y: 0.2, iris: '#606a70' };
  },
  serpent: (s) => {
    ARCH.eel(s);
    B(s, { depth: 0.07, wr: 0.9, maxAt: 0.2, noseT: 1.3, noseB: 1.6, tailP: 0.7, ped: 0.08, mouth: { len: 0.05, slope: 0.1, open: 0.6, wide: 1 }, curveX: 0.1, curveK: 2.6, gill: 0.08 });
    F(s, {
      dorsal: [md(0.1, 0.98, 0.9, [1, 0.9, 0.8, 0.7, 0.5], 70, { sweep: 50, notch: 0.6 })],
      anal: [],
      caudal: { type: 'pointed', len: 0.06, spread: 40, rays: 10 },
      pectoral: { s: 0.1, y: -0.3, len: 0.07, rays: 8, shape: 'wing', ang: 50 },
    });
    L(s, { scale: 'large', scaleN: 120, scaleVis: 0.6, normal: 0.9, lateral: 0 });
    s.ex.horns = { n: 2, len: 0.08, curl: 0.5 };
    s.ex.teeth = { n: 10, size: 0.008, fang: 1.6 };
    s.ex.whiskers = { n: 2, len: 0.12 };
    s.eye = { size: 0.3, s: 0.03, y: 0.5, iris: '#ffcc33', glow: 0.5 };
  },
  oarfish: (s) => {
    ARCH.eel(s);
    B(s, { depth: 0.08, wr: 0.25, maxAt: 0.15, tailP: 0.6, ped: 0.15, curveX: 0.08, curveK: 2 });
    F(s, { dorsal: [md(0.02, 1.0, 0.6, [2.5, 0.8, 0.7, 0.6, 0.5], 80, { sweep: 30 })], anal: [], pectoral: { s: 0.08, y: -0.5, len: 0.03, rays: 6 } });
    L(s, { silver: 0.9, irid: 0.8, top: '#9aa8b8', mid: '#dde4ea', belly: '#f4f6f8', scale: 'smooth' });
  },
  panfish: (s) => {
    ARCH.percoid(s);
    B(s, { depth: 0.5, wr: 0.35, maxAt: 0.4, noseT: 1.0, noseB: 1.1, ped: 0.25, mouth: { len: 0.05, slope: 0.15 } });
    F(s, { dorsal: [md(0.3, 0.8, 0.32, [0.5, 0.8, 1, 0.95, 0.6], 20, { notch: 0.3 })], caudal: { type: 'emarginate', len: 0.24, spread: 32, rays: 17 } });
    s.look.pat = [{ t: 'ocellus', c: '#141414', c2: '#3a6', s0: 0.28, v0: 0.42, w: 0.03 }];
  },
  tetra: (s) => {
    ARCH.salmonid(s);
    B(s, { depth: 0.3, wr: 0.35, maxAt: 0.38, ped: 0.3, mouth: { len: 0.05, slope: 0.1 } });
    L(s, { scaleN: 30, scaleVis: 0.3, silver: 0.3 });
    s.eye = { size: 0.18, s: 0.1, y: 0.3, iris: '#c8d0c8' };
  },
  arowana: (s) => {
    B(s, { depth: 0.24, wr: 0.4, maxAt: 0.45, noseT: 1.4, noseB: 0.9, ped: 0.35, back: 0.4, mouthY: 0.7, tailP: 1.0, mouth: { len: 0.14, slope: -0.4, y: 0.5 }, gill: 0.24 });
    F(s, {
      dorsal: [md(0.62, 0.92, 0.35, [0.3, 0.6, 0.9, 1, 1], 30, { sweep: 50 })],
      anal: [md(0.5, 0.92, 0.35, [0.3, 0.6, 0.9, 1, 1], 30, { sweep: 50 })],
      caudal: { type: 'rounded', len: 0.2, spread: 30, rays: 14 },
      pectoral: { s: 0.25, y: -0.7, len: 0.2, shape: 'point', rays: 12 },
      pelvic: { s: 0.5, y: -0.95, len: 0.1, rays: 6 },
    });
    L(s, { scale: 'large', scaleN: 24, scaleVis: 0.9, normal: 1, silver: 0.5, irid: 0.6 });
    s.ex.barbels = { n: 0, len: 0.08, chin: 0.08 };
    s.eye = { size: 0.13, s: 0.11, y: 0.55, iris: '#c8a030' };
  },
  placoderm: (s) => {
    B(s, { depth: 0.25, wr: 0.7, maxAt: 0.25, noseT: 0.7, noseB: 0.9, tailP: 1.2, ped: 0.25, back: 0.55, nT: 2.4, nB: 2.6, gill: 0.34, gillType: 'none', mouth: { len: 0.13, slope: 0.05, open: 0.6, wide: 1.1 } });
    F(s, {
      dorsal: [md(0.45, 0.6, 0.55, [1, 0.8, 0.6, 0.4, 0.2], 10)],
      anal: [md(0.62, 0.72, 0.3, [1, 0.8, 0.6, 0.4, 0.2], 8)],
      caudal: { type: 'heterocercal', len: 0.26, spread: 34, up: 1, down: 0.6, rays: 14, tilt: 6 },
      pectoral: { s: 0.38, y: -0.5, len: 0.16, rays: 10, shape: 'wing' },
    });
    L(s, { scale: 'smooth', normal: 0.6, lateral: 0, silver: 0.1 });
    s.ex.plates = {};
    s.ex.teeth = { n: 8, size: 0.03, fang: 1.2, c: '#d8d0b8' };
    s.eye = { size: 0.08, s: 0.12, y: 0.5, iris: '#e0c070' };
  },
  sculpin: (s) => {
    B(s, { depth: 0.2, wr: 0.9, maxAt: 0.2, noseT: 0.8, noseB: 1.6, tailP: 0.9, ped: 0.3, back: 0.55, nB: 3, headW: 0.3, mouth: { len: 0.1, slope: 0.1, y: 0.2 } });
    F(s, {
      dorsal: [md(0.25, 0.45, 0.45, [0.8, 1, 0.8, 0.6, 0.5], 9, { notch: 0.5 }), md(0.46, 0.84, 0.45, [0.9, 1, 0.95, 0.8, 0.5], 16)],
      anal: [md(0.5, 0.84, 0.35, [0.9, 1, 0.9, 0.7, 0.5], 12)],
      caudal: { type: 'rounded', len: 0.2, spread: 30, rays: 12 },
      pectoral: { s: 0.25, y: -0.45, len: 0.26, ang: 50, droop: 10, shape: 'fan', rays: 16, spread: 90 },
      pelvic: { s: 0.28, y: -0.95, len: 0.1, rays: 4 },
    });
    L(s, { scale: 'rough', scaleVis: 0, normal: 0.7, silver: 0, pat: [{ t: 'mottle', c: '#3a2e22', c2: '#c9b08a', n: 10, w: 0.4 }] });
    s.eye = { size: 0.14, s: 0.1, y: 0.7, iris: '#d0a040', bulge: 0.6 };
  },
  goby: (s) => {
    ARCH.sculpin(s);
    B(s, { depth: 0.18, wr: 0.75, maxAt: 0.25, headW: 0.15 });
    L(s, { scale: 'cycloid', scaleN: 34, scaleVis: 0.3, pat: [] });
  },
  flyingfish: (s) => {
    ARCH.herring(s);
    F(s, {
      pectoral: { s: 0.26, y: 0.1, len: 0.62, ang: 70, droop: -5, tilt: 50, shape: 'wing', rays: 14, spread: 45 },
      pelvic: { s: 0.52, y: -0.8, len: 0.3, ang: 60, droop: 5, shape: 'wing', rays: 8 },
      caudal: { type: 'forked', len: 0.3, spread: 34, fork: 0.2, rays: 18, down: 1.3 },
    });
  },
  wolffish: (s) => {
    ARCH.eel(s);
    s.anim = 'swim';
    B(s, { depth: 0.16, wr: 0.7, maxAt: 0.22, noseT: 0.7, noseB: 1.2, tailP: 0.8, ped: 0.2, curveX: 0.02, mouth: { len: 0.07, slope: 0.1, lip: 0.02, open: 0.3 }, gill: 0.2, gillType: 'operculum' });
    F(s, { dorsal: [md(0.2, 0.98, 0.45, [0.8, 1, 1, 1, 0.8], 50)], anal: [md(0.5, 0.98, 0.35, [0.8, 1, 1, 1, 0.8], 30)], pectoral: { s: 0.22, y: -0.4, len: 0.16, shape: 'fan', rays: 14 }, caudal: { type: 'rounded', len: 0.08, spread: 30, rays: 12 } });
    s.ex.teeth = { n: 8, size: 0.02, fang: 1.3 };
    s.eye = { size: 0.12, s: 0.07, y: 0.5, iris: '#909070' };
  },
  cave: (s) => {
    ARCH.tetra(s);
    L(s, { silver: 0.1, top: '#f0d8d8', mid: '#f4e4e0', belly: '#faf0ec', irid: 0.6, opacity: 0.85 });
    s.eye = { size: 0.05, s: 0.1, y: 0.3, iris: '#f0c0c0', pupil: '#e0a0a0' };
  },
  seahorse: (s) => {
    s.kind = 'special';
    s.special = 'seahorse';
    s.anim = 'hover';
  },
  jellyfish: (s) => {
    s.kind = 'special';
    s.special = 'jellyfish';
    s.anim = 'pulse';
  },
  squid: (s) => {
    s.kind = 'special';
    s.special = 'squid';
    s.anim = 'tentacle';
  },
  octopus: (s) => {
    s.kind = 'special';
    s.special = 'octopus';
    s.anim = 'hover';
  },
  crab: (s) => {
    s.kind = 'special';
    s.special = 'crab';
    s.anim = 'crawl';
  },
  lobster: (s) => {
    s.kind = 'special';
    s.special = 'lobster';
    s.anim = 'crawl';
  },
  isopod: (s) => {
    s.kind = 'special';
    s.special = 'isopod';
    s.anim = 'crawl';
  },
  trash: (s) => {
    s.kind = 'special';
    s.special = 'trash';
    s.anim = 'none';
  },
};

export const ARCHETYPES = Object.keys(ARCH);

/** Expand a compact visual into a full spec. */
export function resolveSpec(id: string, vis: FishVisual | undefined): FishSpec {
  const v: FishVisual = vis && typeof vis === 'object' && 'a' in vis ? vis : { a: 'percoid' };
  const s = base();
  s.seed = v.seed ?? hashStr(id) % 100000;
  (ARCH[v.a] ?? ARCH.percoid)(s);
  if (v.d) s.body.depth *= v.d;
  if (v.w) s.body.wr *= v.w;
  if (v.body) {
    const { mouth, ...rest } = v.body;
    Object.assign(s.body, rest);
    if (mouth) s.body.mouth = { ...s.body.mouth, ...mouth };
  }
  if (v.fins) {
    for (const k of Object.keys(v.fins) as (keyof FinSet)[]) {
      const val = v.fins[k];
      if (val === undefined) continue;
      if (val === null) (s.fins as Record<string, unknown>)[k] = null;
      else if (Array.isArray(val)) (s.fins as Record<string, unknown>)[k] = val;
      else (s.fins as Record<string, unknown>)[k] = { ...((s.fins as Record<string, unknown>)[k] as object), ...(val as object) };
    }
  }
  if (v.tail && s.fins.caudal) s.fins.caudal = { ...s.fins.caudal, ...v.tail };
  if (v.c) {
    s.look.top = v.c[0];
    s.look.mid = v.c[1];
    s.look.belly = v.c[2];
    if (!v.fin) {
      const f = mixRGB(lin(v.c[1]), lin(v.c[0]), 0.45);
      s.look.fin = { ...s.look.fin, base: linToHex(f), edge: linToHex(mixRGB(f, lin(v.c[0]), 0.5)) };
    }
  }
  if (v.pat) s.look.pat = v.pat;
  if (v.fin) s.look.fin = { ...s.look.fin, ...v.fin };
  if (v.lk) Object.assign(s.look, v.lk);
  if (v.eye) s.eye.iris = v.eye;
  if (v.eyeSize) s.eye.size *= v.eyeSize;
  if (v.ex) s.ex = v.exReplace ? { ...v.ex } : { ...s.ex, ...v.ex };
  if (v.anim) s.anim = v.anim;
  if (v.params) s.params = { ...(s.params ?? {}), ...v.params };
  return s;
}
