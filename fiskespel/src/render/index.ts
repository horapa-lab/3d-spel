// OWNER: render/ocean/sky agent.
/**
 * Renderer + post chain:  scene → HDR target (MSAA on ultra) → bloom (high/ultra)
 *   → grade (exposure, white balance, saturation/contrast, flash, underwater, vignette, ACES, dither)
 *   → FXAA → screen.
 * Also: quality detection, per-tier pixel ratio / shadows, rolling FPS + auto quality.
 */
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import type { EnvState, QualityTier, RenderAPI } from '../core/types';
import { TIERS, TIER_ORDER } from './quality';
import { renderState, setSharedQuality } from './state';
import { FullscreenPass, FULLSCREEN_VERT } from './bake';
import { patchFogChunks } from './fog';

export function detectQuality(): QualityTier {
  try {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    let gpu = '';
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {
      /* ignore */
    }
    if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) return 'low';
    if (mobile) return /Apple GPU|Adreno \(TM\) (7|8)\d\d|Mali-G7[1-9]|Mali-G[89]\d/i.test(gpu) && mem >= 6 ? 'medium' : 'low';
    if (mem <= 4 || cores <= 2) return 'low';
    const strong = /NVIDIA|GeForce|RTX|Radeon RX|Radeon Pro|Apple M[1-9]|Arc/i.test(gpu);
    const weak = /Intel|UHD|HD Graphics|Iris|Mali|Adreno|PowerVR|Vega [3-8]\b/i.test(gpu);
    if (strong && cores >= 8 && mem >= 8) return /RTX|RX [67]\d\d\d|Apple M[2-9] (Pro|Max)/i.test(gpu) ? 'ultra' : 'high';
    if (strong) return 'high';
    if (weak) return cores >= 8 ? 'medium' : 'low';
    return 'medium';
  } catch {
    return 'medium';
  }
}

const GRADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform float uExposure, uSaturation, uContrast, uVignette, uFlash, uUnder, uUnderDepth, uTime, uWet;
uniform vec3 uTint, uLift, uUnderColor;
uniform vec2 uRes;
vec3 aces(vec3 x) {
  // Narkowicz fit with a slightly softer shoulder
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 uv = vUv;
  if (uUnder > 0.0) {
    // gentle refraction wobble underwater
    uv += uUnder * 0.0025 * vec2(sin(uv.y * 40.0 + uTime * 1.7), cos(uv.x * 34.0 + uTime * 1.3));
  }
  vec3 col = texture2D(tScene, uv).rgb;
  col *= uExposure;
  col *= uTint;
  col += uLift;
  if (uUnder > 0.0) {
    float depthF = clamp(uUnderDepth / 25.0, 0.0, 1.0);
    vec3 wc = uUnderColor * (1.0 - 0.6 * depthF);
    col = mix(col, col * vec3(0.55, 0.85, 0.95) + wc * 0.25, uUnder);
    // light from above
    col += uUnder * wc * 0.6 * smoothstep(0.3, 1.0, vUv.y) * (1.0 - depthF);
  }
  col += vec3(0.85, 0.9, 1.0) * uFlash;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(lum), col, uSaturation), 0.0);
  col = aces(col);
  // contrast around mid grey (display space)
  col = clamp((col - 0.18) * uContrast + 0.18, 0.0, 1.0);
  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  float vig = 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
  col *= vig;
  col = toSRGB(col);
  col += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createRenderSystem(canvas: HTMLCanvasElement, quality: QualityTier): RenderAPI {
  patchFogChunks();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x000000, 1);

  const urlQuality = new URLSearchParams(location.search).get('quality');
  let tier = TIERS[quality];
  setSharedQuality(quality);

  let width = Math.max(1, innerWidth);
  let height = Math.max(1, innerHeight);
  let pr = 1;
  let mainRT: THREE.WebGLRenderTarget;
  let ldrRT: THREE.WebGLRenderTarget;
  let bloom: UnrealBloomPass | null = null;

  const gradeMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: GRADE_FRAG,
    uniforms: {
      tScene: { value: null },
      uExposure: { value: 1 },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uVignette: { value: 0.2 },
      uFlash: { value: 0 },
      uUnder: { value: 0 },
      uUnderDepth: { value: 0 },
      uUnderColor: { value: new THREE.Color() },
      uTime: { value: 0 },
      uWet: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uLift: { value: new THREE.Color(0, 0, 0) },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const grade = new FullscreenPass(gradeMat);
  const fxaaMat = new THREE.ShaderMaterial({
    vertexShader: FXAAShader.vertexShader,
    fragmentShader: FXAAShader.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
    depthTest: false,
    depthWrite: false,
  });
  const fxaa = new FullscreenPass(fxaaMat);

  const makeTargets = () => {
    mainRT?.dispose();
    ldrRT?.dispose();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    mainRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: tier.msaa,
      depthBuffer: true,
      depthTexture,
    });
    mainRT.texture.name = 'hdrScene';
    ldrRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    renderState.sceneDepth = depthTexture;
    renderState.viewport.set(w, h);
    if (tier.bloom) {
      if (!bloom) bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.15, 0.55, 1.2);
      bloom.setSize(w, h);
    } else if (bloom) {
      bloom.dispose();
      bloom = null;
    }
    (fxaaMat.uniforms.resolution.value as THREE.Vector2).set(1 / w, 1 / h);
    gradeMat.uniforms.uRes.value.set(w, h);
  };

  const applyTier = () => {
    pr = Math.min(window.devicePixelRatio || 1, tier.pixelRatio);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = tier.shadowMapSize > 0;
    makeTargets();
  };
  applyTier();

  // fps + auto quality
  let fpsAvg = 60;
  let last = performance.now();
  const started = performance.now();
  let lowTime = 0;
  let highTime = 0;
  const startTier = quality;

  const api: RenderAPI & { autoQuality?: boolean } = {
    renderer,
    quality,
    autoQuality: !urlQuality,
    setQuality(q: QualityTier) {
      if (!TIERS[q] || q === api.quality) return;
      api.quality = q;
      tier = TIERS[q];
      setSharedQuality(q);
      applyTier();
    },
    resize(w: number, h: number) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      makeTargets();
    },
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, env: EnvState) {
      const now = performance.now();
      const dtMs = now - last;
      last = now;
      if (dtMs < 250) fpsAvg = fpsAvg * 0.94 + (1000 / Math.max(1, dtMs)) * 0.06;
      renderState.frame++;
      renderer.info.reset();

      // auto quality (after warm-up, only when not forced by URL / user)
      if (api.autoQuality && now - started > 8000 && dtMs < 250) {
        const dt = dtMs / 1000;
        if (fpsAvg < 36) { lowTime += dt; highTime = 0; } else if (fpsAvg > 57) { highTime += dt; lowTime = 0; } else { lowTime = Math.max(0, lowTime - dt); highTime = Math.max(0, highTime - dt); }
        const i = TIER_ORDER.indexOf(api.quality);
        if (lowTime > 4 && i > 0) { lowTime = 0; api.setQuality(TIER_ORDER[i - 1]); }
        else if (highTime > 15 && i < TIER_ORDER.indexOf(startTier)) { highTime = 0; api.setQuality(TIER_ORDER[i + 1]); }
      }

      for (const fn of renderState.beforeMain) fn(renderer, camera);
      renderer.setRenderTarget(mainRT);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);

      if (bloom) {
        bloom.strength = renderState.grade.bloomStrength;
        bloom.threshold = renderState.grade.bloomThreshold;
        bloom.radius = 0.55;
        const prevAuto = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        bloom.render(renderer, mainRT, mainRT, 0.016, false);
        renderer.shadowMap.autoUpdate = prevAuto;
      }

      const g = renderState.grade;
      const U = gradeMat.uniforms;
      U.tScene.value = mainRT.texture;
      U.uExposure.value = g.exposure;
      U.uSaturation.value = g.saturation;
      U.uContrast.value = g.contrast;
      U.uVignette.value = g.vignette;
      U.uFlash.value = g.flash;
      U.uUnder.value = g.underwater;
      U.uUnderDepth.value = g.underwaterDepth;
      (U.uUnderColor.value as THREE.Color).copy(g.underwaterColor);
      (U.uTint.value as THREE.Color).copy(g.tint);
      (U.uLift.value as THREE.Color).copy(g.lift);
      U.uTime.value = env.time;
      U.uWet.value = g.wet;
      const prevAuto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      if (tier.fxaa) {
        grade.render(renderer, ldrRT);
        fxaaMat.uniforms.tDiffuse.value = ldrRT.texture;
        fxaa.render(renderer, null);
      } else {
        grade.render(renderer, null);
      }
      renderer.shadowMap.autoUpdate = prevAuto;
    },
    fps: () => fpsAvg,
  };
  return api;
}
