/**
 * Procedural tileable textures baked once on the GPU (cached, shared by sky and ocean).
 *  cloud: R = fbm, G = billow detail, B = cellular puffs, A = low-freq fbm
 *  foam:  R = bubble lattice, G = foam patches, B = wind streaks, A = fine grain
 */
import * as THREE from 'three';
import { ShaderBaker } from './bake';
import { NOISE_GLSL } from './glsl';

const CLOUD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 uv = vUv;
  // R: 7-octave fbm, domain warped for more natural shapes
  vec2 w = vec2(pfbm(uv * 4.0 + 1.7, vec2(4.0), 3, 0.5), pfbm(uv * 4.0 + 9.2, vec2(4.0), 3, 0.5));
  float f = pfbm(uv * 4.0 + w * 0.6, vec2(4.0), 7, 0.52);
  float r = clamp(0.5 + 0.9 * f, 0.0, 1.0);
  // G: billowy detail
  float b = 1.0 - abs(pfbm(uv * 16.0 + 3.1, vec2(16.0), 5, 0.55));
  b = pow(clamp(b, 0.0, 1.0), 1.6);
  // B: cellular puffs (inverted worley fbm)
  float c = 0.0;
  c += 0.55 * (1.0 - pworley(uv * 6.0, vec2(6.0)).x);
  c += 0.30 * (1.0 - pworley(uv * 12.0 + 0.37, vec2(12.0)).x);
  c += 0.15 * (1.0 - pworley(uv * 24.0 + 0.71, vec2(24.0)).x);
  c = clamp((c - 0.25) * 1.6, 0.0, 1.0);
  // A: low-frequency fbm
  float a = clamp(0.5 + 0.9 * pfbm(uv * 2.0 + 5.3, vec2(2.0), 4, 0.5), 0.0, 1.0);
  gl_FragColor = vec4(r, b, c, a);
}
`;

const FOAM_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
${NOISE_GLSL}
float bubbles(vec2 p, vec2 per) {
  vec2 w = pworley(p, per);
  // bright membranes between bubbles
  float edge = 1.0 - smoothstep(0.0, 0.16, w.y - w.x);
  // small holes inside large cells
  float hole = smoothstep(0.25, 0.55, w.x);
  return clamp(edge * 0.8 + (1.0 - hole) * 0.35, 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  vec2 warp = vec2(pfbm(uv * 6.0, vec2(6.0), 3, 0.5), pfbm(uv * 6.0 + 4.7, vec2(6.0), 3, 0.5)) * 0.35;
  float lat = bubbles(uv * 10.0 + warp * 4.0, vec2(10.0)) * 0.55
            + bubbles(uv * 22.0 + warp * 7.0 + 0.3, vec2(22.0)) * 0.3
            + bubbles(uv * 46.0 + 0.61, vec2(46.0)) * 0.15;
  float patches = clamp(0.5 + 1.1 * pfbm(uv * 5.0 + warp, vec2(5.0), 5, 0.55), 0.0, 1.0);
  // wind streaks: strongly anisotropic noise along +x
  float st = pfbm(vec2(uv.x * 3.0, uv.y * 40.0), vec2(3.0, 40.0), 4, 0.5);
  st = clamp(0.5 + 1.2 * st, 0.0, 1.0);
  float grain = clamp(0.5 + 0.8 * pfbm(uv * 64.0, vec2(64.0), 3, 0.6), 0.0, 1.0);
  gl_FragColor = vec4(lat, patches, st, grain);
}
`;

let cache: { cloud: THREE.Texture; foam: THREE.Texture } | null = null;

export function getNoiseTextures(renderer: THREE.WebGLRenderer): { cloud: THREE.Texture; foam: THREE.Texture } {
  if (cache) return cache;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cloud = new ShaderBaker(CLOUD_FRAG, { width: 512, height: 512, mipmaps: true, anisotropy: aniso });
  cloud.render(renderer);
  const foam = new ShaderBaker(FOAM_FRAG, { width: 512, height: 512, mipmaps: true, anisotropy: aniso });
  foam.render(renderer);
  cache = { cloud: cloud.texture, foam: foam.texture };
  return cache;
}
