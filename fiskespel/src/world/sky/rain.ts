/** Rain streaks (GPU-animated instanced quads around the camera) + lightning bolts. OWNER: render. */
import * as THREE from 'three';
import type { Look } from '../../render/look';
import { renderState } from '../../render/state';

const MAX_DROPS = 12000;

export function createRain(scene: THREE.Scene, _renderer: THREE.WebGLRenderer) {
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const seeds = new Float32Array(MAX_DROPS * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  quad.instanceCount = 0;
  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uFall: { value: new THREE.Vector3(0, -9, 0) },
    uBox: { value: 22 },
    uHeight: { value: 26 },
    uColor: { value: new THREE.Color(0.6, 0.65, 0.7) },
    uAlpha: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform vec3 uCam; uniform float uTime; uniform vec3 uFall; uniform float uBox; uniform float uHeight;
      varying vec2 vUv; varying float vFade;
      void main() {
        vec3 size = vec3(2.0 * uBox, uHeight, 2.0 * uBox);
        vec3 p = aSeed.xyz * size + uFall * uTime * (0.85 + 0.3 * aSeed.w);
        vec3 origin = uCam - vec3(uBox, uHeight * 0.45, uBox);
        p = origin + mod(p - origin, size);
        vec3 dir = normalize(uFall);
        vec3 toCam = normalize(uCam - p);
        vec3 side = normalize(cross(dir, toCam));
        float len = 0.45 + 0.35 * aSeed.w;
        vec3 wp = p + side * position.x * 0.012 + dir * position.y * len;
        vUv = position.xy + vec2(0.5, 0.0);
        float d = length(p.xz - uCam.xz);
        vFade = (1.0 - smoothstep(uBox * 0.6, uBox, d)) * smoothstep(0.0, 0.5, p.y) * smoothstep(0.3, 2.0, length(p - uCam));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha;
      varying vec2 vUv; varying float vFade;
      void main() {
        float a = (1.0 - abs(vUv.x * 2.0 - 1.0)) * sin(vUv.y * 3.14159) * vFade * uAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    fog: false,
  });
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  mesh.name = 'rain';
  scene.add(mesh);
  renderState.prepassHidden.add(mesh);
  let count = 4000;

  // ── lightning bolt ribbon
  const boltGeo = new THREE.BufferGeometry();
  const MAXP = 64;
  const boltPos = new Float32Array(MAXP * 2 * 3);
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
  const idx: number[] = [];
  for (let i = 0; i < MAXP - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  boltGeo.setIndex(idx);
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6.5, 9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const bolt = new THREE.Mesh(boltGeo, boltMat);
  bolt.frustumCulled = false;
  bolt.visible = false;
  scene.add(bolt);
  renderState.prepassHidden.add(bolt);
  let boltLife = 0;
  const pts: THREE.Vector3[] = [];

  function buildBolt(from: THREE.Vector3, to: THREE.Vector3, cam: THREE.Vector3) {
    pts.length = 0;
    pts.push(from.clone(), to.clone());
    let segs = 1;
    let rough = from.distanceTo(to) * 0.18;
    while (segs < 32) {
      const next: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const m = a.clone().lerp(b, 0.5);
        m.x += (Math.random() - 0.5) * rough;
        m.z += (Math.random() - 0.5) * rough;
        next.push(a, m);
      }
      next.push(pts[pts.length - 1]);
      pts.splice(0, pts.length, ...next);
      segs *= 2;
      rough *= 0.55;
    }
    const n = Math.min(MAXP, pts.length);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[Math.min(n - 1, i + 1)];
      const dir = q.clone().sub(p).normalize();
      const toCam = cam.clone().sub(p).normalize();
      const side = new THREE.Vector3().crossVectors(dir, toCam).normalize();
      const w = 2.2 * (1 - i / n * 0.6);
      boltPos.set([p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w], i * 6);
    }
    boltGeo.setDrawRange(0, (n - 1) * 6);
    boltGeo.attributes.position.needsUpdate = true;
  }

  return {
    setCount(n: number) {
      count = Math.min(MAX_DROPS, n);
    },
    strike(cam: THREE.Vector3, dir: { x: number; y: number; z: number }) {
      const d = 700 + Math.random() * 1600;
      const h = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const base = cam.clone().addScaledVector(h, d);
      base.y = 0;
      const top = base.clone();
      top.y = 1100;
      top.x += (Math.random() - 0.5) * 300;
      buildBolt(top, base, cam);
      boltLife = 0.35;
      bolt.visible = true;
    },
    update(dt: number, camera: THREE.Camera, look: Look, t: number, sunColor: THREE.Color, sunI: number, zen: THREE.Color) {
      const r = look.rain;
      quad.instanceCount = r > 0.02 ? Math.floor(count * Math.min(1, r * 1.3)) : 0;
      mesh.visible = quad.instanceCount > 0;
      uniforms.uCam.value.copy(camera.position);
      uniforms.uTime.value = t % 1000;
      const wind = look.windSpeed * 0.35;
      uniforms.uFall.value.set(Math.cos(look.windDir) * wind, -9.5, Math.sin(look.windDir) * wind);
      uniforms.uColor.value.setRGB(zen.r * 1.4 + sunColor.r * sunI * 0.05 + 0.03, zen.g * 1.4 + sunColor.g * sunI * 0.05 + 0.035, zen.b * 1.4 + sunColor.b * sunI * 0.05 + 0.04);
      uniforms.uAlpha.value = 0.28 + 0.2 * r;
      if (boltLife > 0) {
        boltLife -= dt;
        const f = Math.max(0, boltLife / 0.35);
        boltMat.opacity = f * (0.6 + 0.4 * Math.sin(boltLife * 90));
        if (boltLife <= 0) bolt.visible = false;
      }
    },
  };
}
