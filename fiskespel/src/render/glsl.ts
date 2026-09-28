/** Shared GLSL snippets (OWNER: render). */

/** Hashes + periodic gradient / cellular noise, all tileable with integer period `per`. */
export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
// periodic gradient noise, range ~[-1,1]
float pnoise(vec2 p, vec2 per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 i00 = mod(i, per);
  vec2 i10 = mod(i + vec2(1.0, 0.0), per);
  vec2 i01 = mod(i + vec2(0.0, 1.0), per);
  vec2 i11 = mod(i + vec2(1.0, 1.0), per);
  vec2 g00 = hash22(i00) * 2.0 - 1.0;
  vec2 g10 = hash22(i10) * 2.0 - 1.0;
  vec2 g01 = hash22(i01) * 2.0 - 1.0;
  vec2 g11 = hash22(i11) * 2.0 - 1.0;
  float n00 = dot(g00, f);
  float n10 = dot(g10, f - vec2(1.0, 0.0));
  float n01 = dot(g01, f - vec2(0.0, 1.0));
  float n11 = dot(g11, f - vec2(1.0, 1.0));
  return 1.4142 * mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}
float pfbm(vec2 p, vec2 per, int oct, float gain) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * pnoise(p, per);
    n += a;
    p *= 2.0; per *= 2.0; a *= gain;
  }
  return s / n;
}
// periodic cellular noise: x = F1, y = F2
vec2 pworley(vec2 p, vec2 per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 c = mod(i + o, per);
    vec2 r = o + hash22(c) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
`;

/** Full-screen triangle vertex shader (uv in [0,1]). */
export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Height-fog + sun in-scatter shared by the patched three.js fog chunk, the sky dome and the ocean.
 * fogParams: x = height falloff (1/m), y = camera height, z = sun glow strength, w = enabled (1).
 */
export const FOG_FUNC_GLSL = /* glsl */ `
float heightFogDepth(float density, float falloff, float camY, vec3 ray) {
  float dist = length(ray);
  float dy = ray.y;
  float base = density * exp(-falloff * max(camY, -50.0));
  float k = falloff * dy;
  float f = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
  return base * dist * f;
}
`;
