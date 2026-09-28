/**
 * Sky radiance GLSL shared by the sky dome, the env-map cube pass and the ocean reflection.
 * All materials reference ONE uniforms object (skyUniforms) so updates propagate everywhere.
 */
import * as THREE from 'three';
import { ATMOS_GLSL, SKY_LUT_SAMPLE_GLSL } from './atmosphere';
import { FOG_FUNC_GLSL } from '../../render/glsl';

export const MAX_METEORS = 6;

export function createSkyUniforms() {
  return {
    uSkyLut: { value: null as THREE.Texture | null },
    uSkyLutSize: { value: new THREE.Vector2(256, 128) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    /** Sky radiance scale for the sun / moon halves of the LUT (rgb). */
    uSunE: { value: new THREE.Vector3(1, 1, 1) },
    uMoonE: { value: new THREE.Vector3(0, 0, 0) },
    /** Sun disk radiance (rgb, HDR). */
    uSunDisk: { value: new THREE.Vector3(30, 30, 30) },
    uMoonDisk: { value: new THREE.Vector3(1, 1, 1) },
    uMoonSize: { value: 0.016 },
    uStars: { value: 0 },
    uCloudTex: { value: null as THREE.Texture | null },
    /** coverage, density, darkness, softness */
    uCloudA: { value: new THREE.Vector4(0.3, 0.6, 0.1, 1) },
    /** xy base offset (m), zw detail offset (m) */
    uCloudOff: { value: new THREE.Vector4() },
    uCloudLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uCloudLight: { value: new THREE.Vector3(1, 1, 1) },
    uCloudAmb: { value: new THREE.Vector3(0.3, 0.35, 0.4) },
    uCamPos: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    /** xyz direction, w intensity */
    uFlash: { value: new THREE.Vector4(0, 1, 0, 0) },
    uAurora: { value: 0 },
    uCrimson: { value: 0 },
    uMeteorA: { value: Array.from({ length: MAX_METEORS }, () => new THREE.Vector4(0, 1, 0, -100)) },
    uMeteorB: { value: Array.from({ length: MAX_METEORS }, () => new THREE.Vector4(0, 1, 0, 1)) },
    uFogCol: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
    uFogSun: { value: new THREE.Vector3(0, 0, 0) },
    /** x density, y falloff, z camera height, w sky-fog strength */
    uFogP: { value: new THREE.Vector4(0.0001, 0.001, 2, 0) },
    uDesat: { value: 0 },
    /** Colour multiplier of the whole sky (event grades). */
    uSkyTint: { value: new THREE.Vector3(1, 1, 1) },
  };
}

export type SkyUniforms = ReturnType<typeof createSkyUniforms>;

/**
 * Sky functions. Define SKY_TEX(tex, uv) before including (texture() or textureLod()).
 */
export const SKY_GLSL = /* glsl */ `
uniform sampler2D uSkyLut;
uniform vec2 uSkyLutSize;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunE;
uniform vec3 uMoonE;
uniform vec3 uSunDisk;
uniform vec3 uMoonDisk;
uniform float uMoonSize;
uniform float uStars;
uniform sampler2D uCloudTex;
uniform vec4 uCloudA;
uniform vec4 uCloudOff;
uniform vec3 uCloudLightDir;
uniform vec3 uCloudLight;
uniform vec3 uCloudAmb;
uniform vec3 uCamPos;
uniform float uTime;
uniform vec4 uFlash;
uniform float uAurora;
uniform float uCrimson;
uniform vec4 uMeteorA[${MAX_METEORS}];
uniform vec4 uMeteorB[${MAX_METEORS}];
uniform vec3 uFogCol;
uniform vec3 uFogSun;
uniform vec4 uFogP;
uniform float uDesat;
uniform vec3 uSkyTint;

${ATMOS_GLSL}
${SKY_LUT_SAMPLE_GLSL}
${FOG_FUNC_GLSL}

float skyHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 skyHash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

vec3 atmosphere(vec3 v) {
  vec3 a = texture(uSkyLut, skyLutUv(v, uSunDir, 0.0)).rgb * uSunE;
  vec3 b = texture(uSkyLut, skyLutUv(v, uMoonDir, 1.0)).rgb * uMoonE;
  return a + b;
}

vec3 horizonFog(vec3 v) {
  float mu = max(dot(normalize(vec3(v.x, 0.0, v.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5)), 0.0);
  float muS = max(dot(v, uSunDir), 0.0);
  return uFogCol + uFogSun * (0.35 * pow(muS, 6.0) + 0.65 * pow(muS, 48.0));
}

// ── clouds: single curved layer, lit with a directional self-shadow tap
float cloudShape(vec2 p, out float lowF) {
  vec4 n = SKY_TEX(uCloudTex, (p + uCloudOff.xy) * (1.0 / 15000.0));
  lowF = n.a;
  float det = SKY_TEX(uCloudTex, (p + uCloudOff.zw) * (1.0 / 3100.0)).g;
  float shape = mix(n.r, n.b, 0.5) * 0.85 + (n.a - 0.5) * 0.45 + (det - 0.5) * 0.26;
  return shape;
}
vec4 cloudLayer(vec3 v, out float tHit) {
  tHit = 1e9;
  if (v.y <= 0.0 || uCloudA.x < 0.01) return vec4(0.0);
  const float R = 6360000.0;
  const float H = 1700.0;
  float b = R * v.y;
  float c = 2.0 * R * H + H * H;
  float t = c / (b + sqrt(b * b + c));
  tHit = t;
  vec2 p = uCamPos.xz + v.xz * t;
  float lowF;
  float s = cloudShape(p, lowF);
  float cov = uCloudA.x;
  float thr = 1.02 - cov * 1.05;
  float soft = 0.12 + 0.3 * uCloudA.w;
  float dens = smoothstep(thr, thr + soft, s);
  if (dens <= 0.001) return vec4(0.0);
  // self shadow: density toward the light
  vec2 ld = uCloudLightDir.xz;
  float ll = length(ld);
  ld = ll > 1e-4 ? ld / ll : vec2(0.0);
  float lowF2;
  float s2 = cloudShape(p + ld * (380.0 + 900.0 * (1.0 - clamp(uCloudLightDir.y, 0.0, 1.0))), lowF2);
  float dens2 = smoothstep(thr, thr + soft, s2);
  float thick = dens * uCloudA.y;
  float alpha = 1.0 - exp(-thick * 3.2);
  float shadow = exp(-max(dens2 - dens * 0.35, 0.0) * 2.4 * uCloudA.y);
  float mu = dot(v, uCloudLightDir);
  float hg = phaseMie(mu, 0.6) * 4.0 * PI;
  float powder = 1.0 - exp(-thick * 5.0);
  vec3 direct = uCloudLight * shadow * (0.35 + 0.25 * hg * (1.0 - alpha * 0.6)) * mix(1.0, powder, 0.35);
  float darkBase = uCloudA.z * smoothstep(0.2, 1.0, dens);
  vec3 amb = uCloudAmb * (1.0 - 0.55 * darkBase) * (0.8 + 0.2 * lowF);
  vec3 col = direct * (1.0 - 0.8 * darkBase) + amb;
  // lightning inside the clouds
  if (uFlash.w > 0.0) {
    float fa = max(dot(v, uFlash.xyz), 0.0);
    col += vec3(0.75, 0.8, 1.0) * uFlash.w * (pow(fa, 12.0) * 6.0 + pow(fa, 2.0) * 0.8) * (0.4 + dens);
  }
  // aerial perspective toward the horizon
  float haze = 1.0 - exp(-t / 38000.0);
  col = mix(col, atmosphere(normalize(vec3(v.x, max(v.y, 0.02), v.z))), haze * 0.9);
  return vec4(col, alpha * (1.0 - haze * 0.55));
}

// ── stars on cube-face cells (anti-aliased)
vec3 starLayer(vec3 v, float scale, float prob, float gain) {
  vec3 a = abs(v);
  vec2 uv;
  float face;
  if (a.x > a.y && a.x > a.z) { uv = v.yz / a.x; face = v.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y > a.z) { uv = v.xz / a.y; face = v.y > 0.0 ? 2.0 : 3.0; }
  else { uv = v.xy / a.z; face = v.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = (uv * 0.5 + 0.5) * scale;
  vec2 ig = floor(g);
  vec2 fg = fract(g);
  vec3 h = skyHash33(vec3(ig, face * 97.0 + scale));
  if (h.z > prob) return vec3(0.0);
  vec2 c = 0.2 + 0.6 * skyHash33(vec3(ig + 13.7, face)).xy;
  vec2 d = fg - c;
  float px = max(fwidth(g.x), 1e-4);
  float sig = max(px * 0.55, 0.05);
  float I = exp(-dot(d, d) / (2.0 * sig * sig)) * (0.05 * 0.05) / (sig * sig);
  float mag = pow(h.x, 6.0) * 0.9 + 0.1 * h.y;
  float tw = 0.75 + 0.25 * sin(uTime * (1.5 + 3.0 * h.y) + h.x * 40.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.82, 0.6), h.y);
  return tint * I * mag * tw * gain;
}
vec3 stars(vec3 v) {
  if (uStars < 0.01 || v.y < -0.02) return vec3(0.0);
  vec3 n = normalize(vec3(0.35, 0.62, 0.7));
  float bd = dot(v, n);
  float band = exp(-bd * bd / 0.025);
  vec3 col = starLayer(v, 170.0, 0.55, 1.6) + starLayer(v, 420.0, 0.45 + 0.4 * band, 0.8);
  // milky way glow with dust lanes
  vec2 mp = vec2(atan(v.z, v.x) * 0.6, bd * 3.0);
  float dust = SKY_TEX(uCloudTex, mp * vec2(0.5, 0.35) + 0.3).r;
  float glow = band * (0.4 + 0.6 * smoothstep(0.35, 0.75, dust));
  col += vec3(0.55, 0.62, 0.8) * glow * 0.022;
  float ext = smoothstep(-0.02, 0.25, v.y);
  return col * uStars * ext;
}

// ── moon disk with maria + glow halo
vec3 moon(vec3 v, float withDisk) {
  float size = uMoonSize;
  float cosA = clamp(dot(v, uMoonDir), -1.0, 1.0);
  float ang = acos(cosA);
  vec3 glowC = uMoonDisk * mix(vec3(0.55, 0.62, 0.8), vec3(1.0, 0.25, 0.2), uCrimson);
  vec3 col = glowC * (exp(-ang / (size * 2.2)) * 0.14 + exp(-ang / 0.14) * 0.025 + exp(-ang / 0.5) * 0.006 * (1.0 + 5.0 * uCrimson));
  if (withDisk > 0.5 && ang < size * 1.3) {
    vec3 right = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, uMoonDir);
    vec2 q = vec2(dot(v, right), dot(v, up)) / size;
    float r2 = dot(q, q);
    float aa = fwidth(ang) / size;
    float mask = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0 + aa * 1.5, sqrt(r2));
    vec3 nrm = vec3(q, sqrt(max(0.0, 1.0 - r2)));
    vec3 sl = normalize(vec3(dot(uSunDir, right), dot(uSunDir, up), -dot(uSunDir, uMoonDir)));
    sl = normalize(mix(sl, vec3(-0.25, 0.1, 1.0), 0.75));
    float lit = smoothstep(-0.05, 0.25, dot(nrm, sl));
    float m1 = SKY_TEX(uCloudTex, q * 0.22 + vec2(0.31, 0.57)).r;
    float m2 = SKY_TEX(uCloudTex, q * 0.6 + vec2(0.11, 0.77)).b;
    float albedo = 0.62 + 0.38 * smoothstep(0.35, 0.65, m1) - 0.12 * m2;
    float limb = 0.72 + 0.28 * nrm.z;
    vec3 base = mix(vec3(0.95, 0.96, 1.0), vec3(1.0, 0.18, 0.1), uCrimson);
    col = mix(col, uMoonDisk * base * albedo * limb * (0.04 + lit), mask);
  }
  return col;
}

vec3 sunDisk(vec3 v) {
  float ang = acos(clamp(dot(v, uSunDir), -1.0, 1.0));
  const float R = 0.0068;
  float aa = max(fwidth(ang), 1e-5);
  float mask = 1.0 - smoothstep(R - aa, R + aa, ang);
  float r = clamp(ang / R, 0.0, 1.0);
  float limb = 1.0 - 0.6 * (1.0 - sqrt(max(0.0, 1.0 - r * r)));
  return uSunDisk * mask * limb;
}

// ── aurora curtains (ray-marched slices)
vec3 aurora(vec3 v) {
  if (uAurora < 0.01 || v.y < 0.0) return vec3(0.0);
  vec3 acc = vec3(0.0);
  float fade = smoothstep(0.0, 0.18, v.y);
  for (int i = 0; i < 22; i++) {
    float fi = float(i);
    float h = 1.0 + fi * 0.055;
    vec2 p = v.xz / (v.y * 1.1 + 0.08) * h * 0.16;
    vec2 q = p + vec2(0.13, 0.41);
    float w = SKY_TEX(uCloudTex, q * 0.19 + vec2(uTime * 0.0012, 0.0)).a;
    float band = SKY_TEX(uCloudTex, vec2(q.x * 0.11 + w * 0.35 + uTime * 0.0009, q.y * 0.03 + w * 0.22)).r;
    float ridge = pow(1.0 - abs(band * 2.0 - 1.0), 26.0);
    float fl = SKY_TEX(uCloudTex, vec2(q.x * 0.9, fi * 0.013 + uTime * 0.004)).g;
    vec3 col = mix(vec3(0.1, 1.0, 0.5), vec3(0.62, 0.25, 1.0), smoothstep(6.0, 21.0, fi));
    acc += col * ridge * (0.55 + 0.45 * fl) * (1.0 - fi / 22.0 * 0.55);
  }
  return acc * fade * uAurora * 0.12;
}

vec3 meteors(vec3 v) {
  vec3 acc = vec3(0.0);
  float px = max(length(fwidth(v)), 4e-4);
  for (int i = 0; i < ${MAX_METEORS}; i++) {
    vec4 A = uMeteorA[i];
    vec4 B = uMeteorB[i];
    float u = (uTime - A.w) / B.w;
    if (u < 0.0 || u > 1.0) continue;
    vec3 head = normalize(mix(A.xyz, B.xyz, u));
    vec3 tail = normalize(mix(A.xyz, B.xyz, max(u - 0.4, 0.0)));
    vec3 ab = head - tail;
    float tt = clamp(dot(v - tail, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
    float d = length(v - (tail + ab * tt));
    float w = px * 0.9;
    float I = exp(-d * d / (w * w)) * tt * tt * sin(u * PI);
    acc += mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.8, 0.55), tt) * I * 5.0;
  }
  return acc;
}

vec3 applySkyFog(vec3 col, vec3 v, float tMax) {
  // exponential height fog to distance tMax (weather fog only; clear haze lives in the LUT)
  vec3 ray = v * tMax;
  float od = heightFogDepth(uFogP.x, uFogP.y, uFogP.z, ray) * uFogP.w;
  return mix(col, horizonFog(v), 1.0 - exp(-od));
}

/**
 * Full sky radiance in direction v. sharp = 1 adds sun/moon disks, stars and meteors.
 */
vec3 skyRadiance(vec3 v, float sharp) {
  vec3 va = normalize(vec3(v.x, max(v.y, 0.0), v.z));
  vec3 col = atmosphere(va);
  col += aurora(v);
  if (sharp > 0.5) {
    col += stars(v);
    col += meteors(v);
    col += sunDisk(v);
  }
  col += moon(v, sharp);
  float tHit;
  vec4 cl = cloudLayer(v, tHit);
  col = col * (1.0 - cl.a) + cl.rgb * cl.a;
  // weather desaturation (overcast)
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum), uDesat);
  col *= uSkyTint;
  // blend into the fog colour right at the horizon (matches the far ocean / fogged islands)
  float hb = smoothstep(-0.002, 0.045, v.y);
  col = mix(horizonFog(v), col, hb);
  col = applySkyFog(col, v, min(tHit, 30000.0));
  return col;
}
`;

/** Sky dome: a full-screen triangle drawn at the far plane (after opaques, early-z friendly). */
export function createSkyDomeMaterial(uniforms: SkyUniforms, envPass: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 clip = vec4(position.xy, 1.0, 1.0);
        vec4 vp = inverse(projectionMatrix) * clip;
        vp /= vp.w;
        vDir = vp.xyz * mat3(viewMatrix);
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #define SKY_TEX(t, uv) texture(t, uv)
      varying vec3 vDir;
      ${SKY_GLSL}
      void main() {
        vec3 v = normalize(vDir);
        vec3 col = skyRadiance(v, ${envPass ? '0.0' : '1.0'});
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
  });
}
