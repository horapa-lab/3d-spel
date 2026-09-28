// OWNER: render/ocean/sky agent. Stub — replace with the real renderer + post-processing.
import * as THREE from 'three';
import type { EnvState, QualityTier, RenderAPI } from '../core/types';

export function detectQuality(): QualityTier {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? 'low' : 'medium';
}

export function createRenderSystem(canvas: HTMLCanvasElement, quality: QualityTier): RenderAPI {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  let fpsAvg = 60;
  let last = performance.now();
  const api: RenderAPI = {
    renderer,
    quality,
    setQuality(q) { api.quality = q; },
    resize(w, h) { renderer.setSize(w, h, false); },
    render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, _env: EnvState) {
      const now = performance.now();
      const dt = Math.max(1, now - last);
      last = now;
      fpsAvg = fpsAvg * 0.95 + (1000 / dt) * 0.05;
      renderer.render(scene, camera);
    },
    fps: () => fpsAvg,
  };
  return api;
}
