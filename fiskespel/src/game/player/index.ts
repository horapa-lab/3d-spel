// OWNER: player/characters agent. Stub player: capsule + orbit camera.
import * as THREE from 'three';
import type { GameContext, PlayerAPI } from '../../core/types';

export function createPlayer(ctx: GameContext): PlayerAPI {
  const obj = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 6, 12), new THREE.MeshStandardMaterial({ color: 0xff7755 }));
  obj.position.y = 0.85;
  const root = new THREE.Group();
  root.add(obj);
  ctx.scene.add(root);
  const spawn = ctx.world.islands[0]?.spawn ?? new THREE.Vector3();
  root.position.copy(spawn);
  let yaw = 0, pitch = 0.35, dist = 9;
  const api: PlayerAPI = {
    object: root, position: root.position, heading: 0, mode: 'walk', locked: false,
    rodTip: (t) => t.copy(root.position).add(new THREE.Vector3(0, 2.2, 0)),
    castDirection: (t) => t.set(Math.sin(yaw), 0, Math.cos(yaw)),
    setAnim() {}, showCatch() {}, equipRod() {}, nearestInteractable: null,
    spawnBoat: () => false, boardBoat: () => false, leaveBoat() {},
    teleport(p) { root.position.copy(p); },
    camera: ctx.camera,
    update(dt) {
      const i = ctx.input;
      yaw -= i.look.x * 0.005; pitch = THREE.MathUtils.clamp(pitch + i.look.y * 0.004, -0.2, 1.2);
      dist = THREE.MathUtils.clamp(dist + i.zoom, 3, 30);
      if (!api.locked && !i.blocked) {
        const sp = i.sprint ? 12 : 6;
        const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const r = new THREE.Vector3(-f.z, 0, f.x);
        root.position.addScaledVector(f, i.move.y * sp * dt).addScaledVector(r, i.move.x * sp * dt);
      }
      root.position.y = Math.max(ctx.world.terrainHeight(root.position.x, root.position.z), -0.8);
      const c = ctx.camera;
      c.position.set(root.position.x - Math.sin(yaw) * Math.cos(pitch) * dist, root.position.y + 1.6 + Math.sin(pitch) * dist, root.position.z - Math.cos(yaw) * Math.cos(pitch) * dist);
      c.lookAt(root.position.x, root.position.y + 1.6, root.position.z);
    },
  };
  return api;
}
