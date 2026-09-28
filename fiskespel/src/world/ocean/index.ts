// OWNER: render/ocean/sky agent. Stub.
import * as THREE from 'three';
import type { GameContext, OceanAPI } from '../../core/types';

export function createOcean(ctx: Pick<GameContext, 'scene' | 'renderer' | 'quality' | 'camera'>): OceanAPI {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1f6f9a, roughness: 0.15, metalness: 0.1 }),
  );
  ctx.scene.add(mesh);
  return {
    object: mesh,
    heightAt: () => 0,
    normalAt: (_x, _z, t) => t.set(0, 1, 0),
    splash() {},
    isUnderwater: (cam) => cam.position.y < 0,
    update(_dt, camera) { mesh.position.set(camera.position.x, 0, camera.position.z); },
  };
}
