// OWNER: world agent. Stub — replace with the real archipelago.
import * as THREE from 'three';
import type { GameContext, WorldAPI } from '../core/types';

export function createWorld(ctx: Pick<GameContext, 'scene' | 'renderer' | 'quality' | 'registry'>): WorldAPI {
  const group = new THREE.Group();
  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(60, 80, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0xd8c79a, roughness: 0.95 }),
  );
  island.position.y = -2;
  group.add(island);
  ctx.scene.add(group);
  return {
    group,
    halfSize: 3000,
    islands: [{ id: 'driftwood_harbor', name: 'Driftwood Harbor', biome: 'temperate', center: { x: 0, z: 0 }, radius: 70, spawn: new THREE.Vector3(0, 2, 0), boatSpawn: new THREE.Vector3(0, 0, 100) }],
    npcs: [],
    interactables: [],
    terrainHeight: (x, z) => (Math.hypot(x, z) < 65 ? 2 : -20),
    zoneAt: (x, z) => (Math.hypot(x, z) < 250 ? 'driftwood_harbor' : 'open_ocean'),
    locationAt: (x, z) => (Math.hypot(x, z) < 250 ? 'driftwood_harbor' : 'open_ocean'),
    collide() {},
    update() {},
  };
}
