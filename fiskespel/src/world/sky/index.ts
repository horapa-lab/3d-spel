// OWNER: render/ocean/sky agent.
/**
 * Physically based sky: sky-view LUT (Rayleigh/Mie/ozone), clouds, stars, moon, aurora, meteors,
 * height fog, sun/moon shadow light following the camera (texel snapped), PMREM env map (throttled),
 * rain streaks and lightning. Smooth weather transitions via renderState.look.
 */
import * as THREE from 'three';
import type { EnvState, GameContext, SkyAPI } from '../../core/types';
import { ShaderBaker } from '../../render/bake';
import { getNoiseTextures } from '../../render/noiseTextures';
import { renderState, onQualityChange } from '../../render/state';
import { targetLook, smoothLook, defaultLook, copyLook } from '../../render/look';
import { fogShared } from '../../render/fog';
import { SKY_LUT_FRAG, sunTransmittance, inscatterCPU } from './atmosphere';
import { createSkyUniforms, createSkyDomeMaterial, MAX_METEORS, type SkyUniforms } from './skyShader';
import { createRain } from './rain';

/** Shared sky uniforms (the ocean includes them for reflections). */
export let skyUniforms: SkyUniforms | null = null;
/** Raw (unfiltered) sky cube used for cheap water reflections. */
export let skyCube: THREE.CubeTexture | null = null;

const SUN_E = 3.4; // sun illuminance at noon (three units)
const SKY_GAIN = 4.2; // radiance gain of the sky LUT

const fullTri = new THREE.BufferGeometry();
fullTri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

export function createSky(ctx: Pick<GameContext, 'scene' | 'renderer' | 'quality'>): SkyAPI {
  const { scene, renderer } = ctx;
  let tier = renderState.tier;
  const u = createSkyUniforms();
  skyUniforms = u;
  const noise = getNoiseTextures(renderer);
  u.uCloudTex.value = noise.cloud;

  // ── sky-view LUT
  const lutMat = { uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() }, uMie: { value: 1 }, uMs: { value: 1 }, uSize: { value: new THREE.Vector2() } };
  let lut: ShaderBaker;
  const makeLut = () => {
    const [w, h] = tier.skyLut;
    lut?.dispose();
    lut = new ShaderBaker(SKY_LUT_FRAG, { width: w * 2, height: h, type: THREE.HalfFloatType, wrap: THREE.ClampToEdgeWrapping, uniforms: lutMat });
    lutMat.uSize.value.set(w * 2, h);
    u.uSkyLut.value = lut.texture;
    u.uSkyLutSize.value.set(w * 2, h);
  };
  makeLut();
  let lutSig = new THREE.Vector4(9, 9, 9, 9);

  // ── dome
  const dome = new THREE.Mesh(fullTri, createSkyDomeMaterial(u, false));
  dome.frustumCulled = false;
  dome.renderOrder = 1000;
  dome.name = 'skyDome';
  scene.add(dome);
  renderState.prepassHidden.add(dome);

  // ── env cube + PMREM
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(fullTri, createSkyDomeMaterial(u, true));
  envDome.frustumCulled = false;
  envScene.add(envDome);
  let cubeRT: THREE.WebGLCubeRenderTarget;
  let cubeCam: THREE.CubeCamera;
  const makeCube = () => {
    cubeRT?.dispose();
    cubeRT = new THREE.WebGLCubeRenderTarget(tier.envSize, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    cubeCam = new THREE.CubeCamera(0.1, 10, cubeRT);
    skyCube = cubeRT.texture;
  };
  makeCube();
  const pmrem = new THREE.PMREMGenerator(renderer);
  let pmremRT: THREE.WebGLRenderTarget | null = null;
  let envTimer = 1e9;
  const envSig = new Float32Array(8).fill(99);

  // ── lights
  const sun = new THREE.DirectionalLight(0xffffff, SUN_E);
  sun.name = 'sun';
  sun.castShadow = tier.shadowMapSize > 0;
  const applyShadow = () => {
    sun.castShadow = tier.shadowMapSize > 0;
    sun.shadow.mapSize.set(tier.shadowMapSize || 512, tier.shadowMapSize || 512);
    const e = tier.shadowExtent;
    const cam = sun.shadow.camera;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e;
    cam.near = 1; cam.far = 700;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2;
    sun.shadow.map?.dispose();
    (sun.shadow as unknown as { map: null }).map = null;
  };
  applyShadow();
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x2a3a40, 0.2);
  scene.add(hemi);

  // ── fog
  const fog = new THREE.FogExp2(0x9fb8cc, 0.0002);
  scene.fog = fog;

  // ── weather fx
  const rain = createRain(scene, renderer);

  onQualityChange((_q, s) => {
    const old = tier;
    tier = s;
    if (old.skyLut[0] !== s.skyLut[0]) { makeLut(); lutSig.set(9, 9, 9, 9); }
    if (old.envSize !== s.envSize) { makeCube(); envTimer = 1e9; envSig.fill(99); }
    if (old.shadowMapSize !== s.shadowMapSize || old.shadowExtent !== s.shadowExtent) applyShadow();
    rain.setCount(s.rainDrops);
  });
  rain.setCount(tier.rainDrops);

  // ── per-frame state
  const look = defaultLook();
  const tgt = defaultLook();
  let firstFrame = true;
  const sunDir = new THREE.Vector3(0, 1, 0);
  const moonDir = new THREE.Vector3(0, -1, 0);
  const lightDir = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const tmpC2 = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const cloudOff = new THREE.Vector4();
  let flash = 0;
  let flashTimer = 3;
  let meteorTimer = 0;
  let meteorSlot = 0;

  const api: SkyAPI = {
    sunDirection: sunDir,
    sun,
    envMap: null,
    fog,
    update(dt: number, camera: THREE.Camera, env: EnvState) {
      targetLook(env, tgt);
      if (firstFrame) copyLook(look, tgt);
      else smoothLook(look, tgt, dt, 0.5);
      firstFrame = false;
      copyLook(renderState.look, look);
      const t = env.time;
      u.uTime.value = t;

      // sun & moon paths (tilted great circles)
      const th = env.dayProgress * Math.PI * 2;
      const lat = 0.42;
      sunDir.set(Math.cos(th), Math.sin(th) * Math.cos(lat), Math.sin(th) * Math.sin(lat)).normalize();
      const tm = th + Math.PI + 0.35;
      moonDir.set(Math.cos(tm) * 0.92, Math.sin(tm) * 0.9 + 0.12, -Math.sin(tm) * 0.38 + 0.1).normalize();
      if (look.crimson > 0.01) {
        // big red moon sits low and dramatic
        moonDir.y = THREE.MathUtils.lerp(moonDir.y, Math.min(moonDir.y, 0.26), look.crimson);
        moonDir.normalize();
      }
      u.uSunDir.value.copy(sunDir);
      u.uMoonDir.value.copy(moonDir);

      const mie = 1 + look.desat * 2.5 + look.fog * 250 + look.cloudCover * 0.6;
      const dim = look.sunDim;
      // sky radiance scales
      const nightF = THREE.MathUtils.smoothstep(-sunDir.y, -0.02, 0.2);
      const moonUp = THREE.MathUtils.smoothstep(moonDir.y, -0.05, 0.12);
      const skyDim = 1 - dim * 0.55;
      u.uSunE.value.setScalar(SUN_E * SKY_GAIN * skyDim);
      const moonSky = 0.045 * (0.6 + 0.4 * moonUp) * (1 + look.crimson * 0.6);
      u.uMoonE.value.set(moonSky * (0.55 + look.crimson * 1.5), moonSky * (0.7 - look.crimson * 0.35), moonSky * (1.25 - look.crimson * 0.8));
      // sun disk radiance
      sunTransmittance(sunDir.y, mie, tmpC);
      const sunVis = 1 - dim * 0.97;
      u.uSunDisk.value.set(tmpC.r, tmpC.g, tmpC.b).multiplyScalar(60 * sunVis);
      const moonB = 1.1 * (1 - look.cloudCover * 0.4) * (1 + look.crimson * 0.4);
      u.uMoonDisk.value.setScalar(moonB);
      u.uMoonSize.value = THREE.MathUtils.lerp(0.016, 0.062, look.crimson);
      u.uStars.value = nightF * (1 - look.cloudCover * 0.85) * (1 - Math.min(1, look.fog * 120));
      u.uAurora.value = look.aurora * nightF;
      u.uCrimson.value = look.crimson;
      u.uDesat.value = look.desat * 0.55;
      u.uSkyTint.value.set(1 + look.crimson * 0.35, 1 - look.crimson * 0.35, 1 - look.crimson * 0.3);
      if (look.golden > 0) u.uSkyTint.value.multiply(tmpV.set(1 + 0.12 * look.golden, 1 + 0.04 * look.golden, 1 - 0.12 * look.golden));

      // LUT refresh (throttled by change)
      const ls = new THREE.Vector4(sunDir.y, moonDir.y, Math.atan2(moonDir.z, moonDir.x) - Math.atan2(sunDir.z, sunDir.x), mie);
      if (Math.abs(ls.x - lutSig.x) > 0.002 || Math.abs(ls.y - lutSig.y) > 0.004 || Math.abs(ls.z - lutSig.z) > 0.01 || Math.abs(ls.w - lutSig.w) > 0.05) {
        lutSig = ls;
        lutMat.uSunDir.value.copy(sunDir);
        lutMat.uMoonDir.value.copy(moonDir);
        lutMat.uMie.value = mie;
        lutMat.uMs.value = 1;
        lut.render(renderer);
      }

      // ── directional light: sun by day, moon by night
      const useMoon = sunDir.y < -0.035;
      lightDir.copy(useMoon ? moonDir : sunDir);
      if (useMoon) {
        sunTransmittance(Math.max(moonDir.y, 0.02), mie, tmpC);
        const mi = 0.42 * moonUp * (1 - look.cloudCover * 0.55) * (1 + look.crimson * 0.5);
        tmpC2.setRGB(0.55 + 0.6 * look.crimson, 0.68 - 0.4 * look.crimson, 1.0 - 0.6 * look.crimson);
        sun.color.copy(tmpC).multiply(tmpC2);
        sun.intensity = mi;
      } else {
        sunTransmittance(Math.max(sunDir.y, 0.0), mie, tmpC);
        const horizonFade = THREE.MathUtils.smoothstep(sunDir.y, -0.035, 0.04);
        sun.color.copy(tmpC);
        if (look.golden > 0) sun.color.lerp(tmpC2.setRGB(1.0, 0.78, 0.42), 0.35 * look.golden);
        sun.intensity = SUN_E * (1 - dim * 0.93) * horizonFade;
      }
      // lightning flash boosts the ambient
      if (look.lightning > 0.2) {
        flashTimer -= dt;
        if (flashTimer <= 0) {
          flashTimer = 3 + Math.random() * 9 / look.lightning;
          flash = 1;
          const a = Math.random() * Math.PI * 2;
          u.uFlash.value.set(Math.cos(a), 0.25 + Math.random() * 0.35, Math.sin(a));
          const f = u.uFlash.value;
          const l = Math.hypot(f.x, f.y, f.z);
          f.x /= l; f.y /= l; f.z /= l;
          rain.strike(camera.position, f);
        }
      }
      flash = Math.max(0, flash - dt * 3.2);
      const fl = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(flash * 40)) : 0;
      u.uFlash.value.w = fl * 2.2;
      renderState.grade.flash = fl * 0.35;

      // shadow camera follows the view, snapped to shadow texels
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
      fwd.normalize();
      const ext = tier.shadowExtent;
      const focus = tmpV.copy(camera.position).addScaledVector(fwd, ext * 0.55);
      focus.y = Math.max(0, Math.min(focus.y, camera.position.y));
      const texel = (2 * ext) / Math.max(256, tier.shadowMapSize);
      const lz = lightDir.clone().normalize();
      const lx = new THREE.Vector3().crossVectors(Math.abs(lz.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), lz).normalize();
      const ly = new THREE.Vector3().crossVectors(lz, lx);
      const px = Math.round(focus.dot(lx) / texel) * texel;
      const py = Math.round(focus.dot(ly) / texel) * texel;
      const pz = focus.dot(lz);
      const snapped = new THREE.Vector3().addScaledVector(lx, px).addScaledVector(ly, py).addScaledVector(lz, pz);
      sun.target.position.copy(snapped);
      sun.position.copy(snapped).addScaledVector(lz, 350);
      sun.target.updateMatrixWorld();

      // ── sky colours for ambient / fog (CPU mirror)
      const dayE = SUN_E * SKY_GAIN * skyDim;
      const hz = new THREE.Vector3(-sunDir.x, 0.03, -sunDir.z);
      if (hz.lengthSq() < 1e-4) hz.set(1, 0.03, 0);
      hz.normalize();
      const away = inscatterCPU(hz, sunDir, mie, 1, new THREE.Color()).multiplyScalar(dayE);
      const toward = inscatterCPU(new THREE.Vector3(sunDir.x, 0.03, sunDir.z).normalize(), sunDir, mie, 1, new THREE.Color()).multiplyScalar(dayE);
      const zen = inscatterCPU(new THREE.Vector3(0, 1, 0), sunDir, mie, 1, new THREE.Color()).multiplyScalar(dayE);
      const mAway = inscatterCPU(hz, moonDir, mie, 1, new THREE.Color());
      const mZen = inscatterCPU(new THREE.Vector3(0, 1, 0), moonDir, mie, 1, new THREE.Color());
      const me = u.uMoonE.value;
      away.r += mAway.r * me.x; away.g += mAway.g * me.y; away.b += mAway.b * me.z;
      zen.r += mZen.r * me.x; zen.g += mZen.g * me.y; zen.b += mZen.b * me.z;
      // night floor (airglow) so nights are blue, not black
      const floor = new THREE.Color(0.006, 0.009, 0.018).multiplyScalar(1 + look.crimson * 0.5);
      if (look.crimson > 0) floor.lerp(new THREE.Color(0.018, 0.004, 0.004), look.crimson * 0.7);
      away.add(floor);
      zen.add(floor);
      // overcast: clouds turn the sky into a grey dome
      const overcast = THREE.MathUtils.smoothstep(look.cloudCover, 0.55, 1.0);
      const cloudGrey = (zen.r + zen.g + zen.b) / 3 * (1.4 - look.cloudDark * 0.9);
      away.lerp(tmpC.setRGB(cloudGrey, cloudGrey * 1.02, cloudGrey * 1.08), overcast * 0.7);
      const fogLum = (away.r + away.g + away.b) / 3;
      away.lerp(tmpC.setRGB(fogLum, fogLum, fogLum), look.desat * 0.5);
      const fogCol = away;
      const fogSun = toward.sub(away).multiplyScalar(1 - dim).max(new THREE.Color(0, 0, 0));
      if (look.crimson > 0) fogCol.lerp(tmpC.setRGB(fogLum * 1.6, fogLum * 0.45, fogLum * 0.45), look.crimson * 0.5);
      u.uFogCol.value.set(fogCol.r, fogCol.g, fogCol.b);
      u.uFogSun.value.set(fogSun.r, fogSun.g, fogSun.b);
      fog.color.copy(fogCol);
      fog.density = look.fog;
      const falloff = 1 / Math.max(20, look.fogHeight);
      u.uFogP.value.set(look.fog, falloff, camera.position.y, THREE.MathUtils.smoothstep(look.fog, 0.0003, 0.004));
      fogShared.fogSunColor.value.x = fogSun.r;
      fogShared.fogSunColor.value.y = fogSun.g;
      fogShared.fogSunColor.value.z = fogSun.b;
      fogShared.fogSunDir.value.x = sunDir.x;
      fogShared.fogSunDir.value.y = sunDir.y;
      fogShared.fogSunDir.value.z = sunDir.z;
      fogShared.fogParams.value.x = falloff;
      fogShared.fogParams.value.y = camera.position.y;
      fogShared.fogParams.value.w = 1;

      // clouds
      const cloudAmb = new THREE.Color().copy(zen).multiplyScalar(2.3).lerp(new THREE.Color(cloudGrey, cloudGrey, cloudGrey).multiplyScalar(2.0), 0.4);
      u.uCloudAmb.value.set(cloudAmb.r, cloudAmb.g, cloudAmb.b).multiplyScalar(1 - look.cloudDark * 0.55);
      u.uCloudLightDir.value.copy(lightDir);
      const cl = new THREE.Color().copy(sun.color).multiplyScalar(sun.intensity * 0.55 / Math.max(0.05, 1 - dim * 0.93));
      if (useMoon) cl.multiplyScalar(0.12);
      u.uCloudLight.value.set(cl.r, cl.g, cl.b).multiplyScalar(1 - look.cloudDark * 0.6);
      u.uCloudA.value.set(look.cloudCover, look.cloudDensity, look.cloudDark, 1 - look.cloudCover * 0.5);
      const wx = Math.cos(look.windDir);
      const wz = Math.sin(look.windDir);
      const cs = (4 + look.windSpeed * 1.2) * dt;
      cloudOff.x -= wx * cs; cloudOff.y -= wz * cs;
      cloudOff.z -= wx * cs * 1.4; cloudOff.w -= wz * cs * 1.4;
      u.uCloudOff.value.copy(cloudOff);
      u.uCamPos.value.copy(camera.position);

      // hemisphere fill
      hemi.color.setRGB(zen.r, zen.g, zen.b).multiplyScalar(1.2);
      hemi.groundColor.setRGB(fogCol.r * 0.35, fogCol.g * 0.45, fogCol.b * 0.5);
      hemi.intensity = (pmremRT ? 0.18 : 1.0) + fl * 2.5;

      // meteors
      if (look.meteors > 0.2 && nightF > 0.5) {
        meteorTimer -= dt;
        if (meteorTimer <= 0) {
          meteorTimer = 0.25 + Math.random() * 1.1;
          const a = Math.random() * Math.PI * 2;
          const el = 0.35 + Math.random() * 0.7;
          const s = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
          const d = new THREE.Vector3(Math.cos(a + 1.6 + Math.random()), -0.8 - Math.random(), Math.sin(a + 1.6)).normalize();
          const e = s.clone().addScaledVector(d, 0.25 + Math.random() * 0.35).normalize();
          const A = u.uMeteorA.value[meteorSlot];
          const B = u.uMeteorB.value[meteorSlot];
          A.set(s.x, s.y, s.z, t);
          B.set(e.x, e.y, e.z, 0.5 + Math.random() * 0.9);
          meteorSlot = (meteorSlot + 1) % MAX_METEORS;
        }
      }

      // exposure / grade by time of day and weather
      const g = renderState.grade;
      const dayness = THREE.MathUtils.smoothstep(sunDir.y, -0.08, 0.25);
      const golden = 1 - THREE.MathUtils.smoothstep(sunDir.y, 0.05, 0.35);
      g.exposure = THREE.MathUtils.lerp(2.6 + look.crimson * 0.4, 1.0 + dim * 0.35, dayness) * (1 + golden * dayness * 0.12);
      g.saturation = 1.06 - look.desat * 0.2 + look.golden * 0.08;
      g.contrast = 1.04 + look.cloudDark * 0.04;
      g.tint.setRGB(1, 1, 1);
      if (look.crimson > 0) g.tint.lerp(tmpC.setRGB(1.25, 0.72, 0.72), look.crimson);
      if (look.golden > 0) g.tint.lerp(tmpC.setRGB(1.12, 1.0, 0.78), look.golden * 0.6);
      if (dayness < 1) g.tint.lerp(tmpC.setRGB(0.82, 0.92, 1.12), (1 - dayness) * (1 - look.crimson));
      g.vignette = 0.22 + look.cloudDark * 0.1 + (1 - dayness) * 0.08;
      g.bloomStrength = 0.1 + golden * dayness * 0.08 + look.crimson * 0.1 + look.aurora * 0.08;
      g.wet = look.rain;

      // rain
      rain.update(dt, camera, look, t, sun.color, sun.intensity, zen);

      // ── env map (throttled)
      envTimer += dt;
      const sig = [sunDir.x, sunDir.y, sunDir.z, look.cloudCover, look.fog * 100, look.aurora, look.crimson, moonDir.y];
      let diff = 0;
      for (let i = 0; i < 8; i++) diff = Math.max(diff, Math.abs(sig[i] - envSig[i]));
      if ((diff > 0.01 && envTimer > tier.envInterval) || envTimer > 20 || !pmremRT) {
        envTimer = 0;
        envSig.set(sig);
        u.uCamPos.value.set(0, camera.position.y, 0);
        cubeCam.update(renderer, envScene);
        u.uCamPos.value.copy(camera.position);
        pmremRT = pmrem.fromCubemap(cubeRT.texture, pmremRT);
        api.envMap = pmremRT.texture;
        scene.environment = pmremRT.texture;
        skyCube = cubeRT.texture;
      }
      scene.environmentIntensity = 1;
    },
  };
  return api;
}
