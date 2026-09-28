/**
 * Fish materials: MeshPhysicalMaterial + an injected deform (swim bend / flap / pulse / fin flutter)
 * and mutation shading (tint, overlay pattern, glow, glitter). Textures are cached & shared;
 * material instances are per fish so each fish animates with its own uniforms.
 */
import * as THREE from 'three';
import type { AnimMode } from './types';

export interface FishUniforms {
  uTime: { value: number };
  uSwim: { value: THREE.Vector4 }; // amp, freq, wavenumber, headStart
  uFlut: { value: number };
}

export function makeUniforms(amp: number, freq: number, k: number, head: number): FishUniforms {
  return { uTime: { value: 0 }, uSwim: { value: new THREE.Vector4(amp, freq, k, head) }, uFlut: { value: 1 } };
}

const MODE_ID: Record<AnimMode, number> = { swim: 0, eel: 0, flap: 1, pulse: 2, hover: 3, tentacle: 4, crawl: 3, none: 5 };

const DEFORM_HEAD = /* glsl */ `
uniform float uTime;
uniform vec4 uSwim;
uniform float uFlut;
attribute vec4 aFlut;
varying vec2 vFishUv;
vec3 fishDisp(vec3 p, inout vec3 n) {
  vec3 d = vec3(0.0);
  float s = 0.5 - p.z;
#if FISH_MODE == 0
  float w = smoothstep(uSwim.w, 1.1, s);
  w = w * w * (1.0 + 0.5 * s);
  float ph = uTime * uSwim.y - uSwim.z * s;
  float dx = uSwim.x * (w * sin(ph) - 0.12 * (1.0 - s) * sin(uTime * uSwim.y + 0.6));
  float e = 0.01;
  float s2 = s + e;
  float w2 = smoothstep(uSwim.w, 1.1, s2);
  w2 = w2 * w2 * (1.0 + 0.5 * s2);
  float dx2 = uSwim.x * (w2 * sin(uTime * uSwim.y - uSwim.z * s2) - 0.12 * (1.0 - s2) * sin(uTime * uSwim.y + 0.6));
  float dxds = (dx2 - dx) / e;
  d.x = dx;
  n = normalize(vec3(n.x, n.y, n.z + dxds * n.x));
#elif FISH_MODE == 1
  float span = 0.5;
  float ax = abs(p.x) / span;
  float ph = uTime * uSwim.y - uSwim.z * s;
  float dy = uSwim.x * ax * ax * sin(ph);
  d.y = dy;
  float gx = uSwim.x * 2.0 * ax / span * sign(p.x) * sin(ph);
  n = normalize(vec3(n.x - gx * n.y, n.y, n.z));
#elif FISH_MODE == 2
  float k = uSwim.x * sin(uTime * uSwim.y) * smoothstep(-0.2, 0.3, p.y);
  d.xz = p.xz * k;
  float dep = clamp(-p.y, 0.0, 1.0);
  d.x += uSwim.x * 0.6 * dep * dep * sin(uTime * uSwim.y * 0.7 - dep * 6.0);
  d.z += uSwim.x * 0.4 * dep * dep * cos(uTime * uSwim.y * 0.6 - dep * 5.0);
#elif FISH_MODE == 3
  d.y = uSwim.x * 0.3 * sin(uTime * uSwim.y);
  d.x = uSwim.x * 0.2 * sin(uTime * uSwim.y * 0.5 + p.z * 3.0);
#elif FISH_MODE == 4
  float t4 = clamp(s - uSwim.w, 0.0, 1.0);
  d.x = uSwim.x * t4 * t4 * sin(uTime * uSwim.y - uSwim.z * s + p.x * 8.0);
  d.y = uSwim.x * 0.6 * t4 * t4 * cos(uTime * uSwim.y * 0.8 - uSwim.z * s + p.x * 6.0);
#endif
  d += aFlut.xyz * sin(uTime * 7.0 * uFlut + aFlut.w);
  return d;
}
`;

export interface MutShade {
  tint?: THREE.Color;
  tintK?: number;
  pattern?: THREE.Texture | null;
  patColor?: THREE.Color;
  patGlow?: number;
  patRepeat?: [number, number];
  glitter?: number;
  rim?: THREE.Color | null;
  rimK?: number;
}

const FRAG_HEAD = /* glsl */ `
varying vec2 vFishUv;
uniform float uTime;
#ifdef FISH_TINT
uniform vec3 uTint;
uniform float uTintK;
#endif
#ifdef FISH_PAT
uniform sampler2D uPatMap;
uniform vec3 uPatColor;
uniform float uPatGlow;
uniform vec2 uPatRepeat;
#endif
#ifdef FISH_GLIT
uniform float uGlitter;
float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
#endif
#ifdef FISH_RIM
uniform vec3 uRim;
uniform float uRimK;
#endif
`;

/** Patch a material with the deform + optional mutation shading. */
export function patchMaterial<T extends THREE.Material>(mat: T, U: FishUniforms, mode: AnimMode, shade: MutShade = {}): T {
  const modeId = MODE_ID[mode] ?? 0;
  const defines: Record<string, string> = { FISH_MODE: String(modeId) };
  const extra: Record<string, { value: unknown }> = {};
  if (shade.tint && (shade.tintK ?? 0) > 0) {
    defines.FISH_TINT = '';
    extra.uTint = { value: shade.tint };
    extra.uTintK = { value: shade.tintK };
  }
  if (shade.pattern) {
    defines.FISH_PAT = '';
    extra.uPatMap = { value: shade.pattern };
    extra.uPatColor = { value: shade.patColor ?? new THREE.Color(1, 1, 1) };
    extra.uPatGlow = { value: shade.patGlow ?? 0 };
    extra.uPatRepeat = { value: new THREE.Vector2(...(shade.patRepeat ?? [3, 2])) };
  }
  if (shade.glitter) {
    defines.FISH_GLIT = '';
    extra.uGlitter = { value: shade.glitter };
  }
  if (shade.rim && (shade.rimK ?? 0) > 0) {
    defines.FISH_RIM = '';
    extra.uRim = { value: shade.rim };
    extra.uRimK = { value: shade.rimK };
  }
  const isDepth = (mat as unknown as { isMeshDepthMaterial?: boolean }).isMeshDepthMaterial || (mat as unknown as { isMeshDistanceMaterial?: boolean }).isMeshDistanceMaterial;
  const key = `fish:${modeId}:${Object.keys(defines).sort().join(',')}:${isDepth ? 'd' : 'c'}`;
  mat.defines = { ...(mat.defines ?? {}), ...defines };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uSwim = U.uSwim;
    sh.uniforms.uFlut = U.uFlut;
    for (const k of Object.keys(extra)) sh.uniforms[k] = extra[k] as THREE.IUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${DEFORM_HEAD}`);
    if (sh.vertexShader.includes('#include <beginnormal_vertex>') && !isDepth) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\nvec3 fishN = objectNormal;\nvec3 fishD = fishDisp(position, fishN);\nobjectNormal = fishN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += fishD;\nvFishUv = uv;`);
    } else {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvec3 fishN0 = vec3(0.0, 1.0, 0.0);\ntransformed += fishDisp(position, fishN0);\nvFishUv = uv;`,
      );
    }
    if (isDepth) return;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_HEAD}`);
    let mapInj = '';
    if (defines.FISH_TINT !== undefined) {
      mapInj += `
  {
    float fl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 tinted = uTint * (0.35 + 1.3 * fl);
    diffuseColor.rgb = mix(diffuseColor.rgb, tinted, uTintK);
  }`;
    }
    if (defines.FISH_PAT !== undefined) {
      mapInj += `
  vec4 fishPat = texture2D(uPatMap, vFishUv * uPatRepeat);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor * fishPat.rgb, fishPat.a * 0.92);`;
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${mapInj}`);
    let emInj = '';
    if (defines.FISH_PAT !== undefined) emInj += `\n  totalEmissiveRadiance += uPatColor * fishPat.a * uPatGlow;`;
    if (defines.FISH_GLIT !== undefined) {
      emInj += `
  {
    vec2 gp = vFishUv * vec2(260.0, 90.0);
    vec2 gc = floor(gp);
    float r = fhash(gc);
    vec2 go = fract(gp) - 0.5 - (vec2(fhash(gc + 3.1), fhash(gc + 7.7)) - 0.5) * 0.6;
    float tw = pow(max(0.0, sin(uTime * 2.5 + r * 40.0)), 12.0);
    float dotm = smoothstep(0.22, 0.0, length(go)) * step(0.82, r);
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * dotm * (0.25 + tw * 2.5) * uGlitter;
  }`;
    }
    if (defines.FISH_RIM !== undefined) {
      emInj += `
  {
    float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0 + 0.0, 0.0, 1.0), 1.0);
    float rimf = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
    totalEmissiveRadiance += uRim * rimf * uRimK;
  }`;
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${emInj}`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/** Depth material with the same deform (so shadows follow the bend). */
export function deformDepth(U: FishUniforms, mode: AnimMode): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  return patchMaterial(m, U, mode);
}
