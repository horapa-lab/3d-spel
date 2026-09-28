// OWNER: render/ocean/sky agent. Stub.
import * as THREE from 'three';
import type { GameContext, SkyAPI } from '../../core/types';

export function createSky(ctx: Pick<GameContext, 'scene' | 'renderer' | 'quality'>): SkyAPI {
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(100, 200, 80);
  ctx.scene.add(sun, new THREE.HemisphereLight(0xbfdfff, 0x3a3a2a, 1.0));
  ctx.scene.background = new THREE.Color(0x8ec9ff);
  const fog = new THREE.Fog(0x8ec9ff, 200, 2500);
  ctx.scene.fog = fog;
  return {
    sunDirection: sun.position.clone().normalize(),
    sun,
    envMap: null,
    fog,
    update() {},
  };
}
