/**
 * DEV-ONLY smoke test: index.html?autotest=fishing[&hold=wait|reel|catch]
 * Places the player at the Driftwood dock/shore facing the sea, casts, shakes once, auto-reels and
 * reports every phase via console.warn (tools/render.mjs prints warnings). `hold` freezes that
 * phase (and frames a camera on it) so a screenshot can be taken. Loaded lazily; never in normal play.
 */
import * as THREE from 'three';
import type { FishingAPI, GameContext } from '../../core/types';
import type { FishingDebug } from './index';

export function runFishingAutotest(ctx: GameContext, api: FishingAPI, debug: FishingDebug): void {
  const params = new URLSearchParams(location.search);
  const hold = (params.get('hold') as FishingDebug['hold']) ?? null;
  const camFree = !params.has('cam');
  let t = 0;
  const log = (msg: string) => console.warn(`[autotest] t=${t.toFixed(1)} ${msg}`);
  const world = ctx.world;
  const island = world.islands[0];
  if (!island) {
    log('FAIL no islands');
    return;
  }
  const maxD = debug.maxCastDistance();
  const power = 0.7;
  const castD = 4 + (maxD - 4) * Math.pow(power, 0.9);

  const isLand = (x: number, z: number) => world.terrainHeight(x, z) > 0.15 && !world.localWaterAt?.(x, z);
  /** Direction from `p` whose cast lands in deep open water with no land in between. */
  const findDir = (p: THREE.Vector3): THREE.Vector3 | null => {
    const out = new THREE.Vector3(p.x - island.center.x, 0, p.z - island.center.z).normalize();
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const lx = p.x + d.x * castD;
      const lz = p.z + d.z * castD;
      if (world.terrainHeight(lx, lz) > -1.2 || !debug.surfaceAt(lx, lz)) continue;
      let clear = true;
      for (let k = 2; k < 10; k++) {
        const u = (k / 10) * castD;
        if (isLand(p.x + d.x * u, p.z + d.z * u)) clear = false;
      }
      if (!clear) continue;
      const score = d.dot(out) + 0.001 * world.terrainHeight(lx, lz) * -1;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  };

  // candidate standing spots: the dock (boat spawn interactable), then the shore towards the boat spawn
  const cands: { name: string; pos: THREE.Vector3 }[] = [];
  const dock = world.interactables.find((i) => i.kind === 'boat_spawn' && i.locationId === island.id) ?? world.interactables.find((i) => i.kind === 'boat_spawn');
  if (dock) cands.push({ name: 'dock', pos: dock.position.clone() });
  {
    const a = island.spawn.clone();
    const b = island.boatSpawn.clone();
    const n = Math.max(1, Math.ceil(a.distanceTo(b)));
    let lastLand: THREE.Vector3 | null = null;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (isLand(p.x, p.z)) lastLand = p;
      else if (lastLand) break;
    }
    if (lastLand) {
      const back = new THREE.Vector3().subVectors(a, b).setY(0).normalize().multiplyScalar(0.8);
      lastLand.add(back);
      lastLand.y = world.terrainHeight(lastLand.x, lastLand.z);
      cands.push({ name: 'shore', pos: lastLand });
    }
  }
  cands.push({ name: 'spawn', pos: island.spawn.clone() });

  let ci = -1;
  let dir = new THREE.Vector3(0, 0, 1);
  let placedAt = 0;
  let started = false;
  let shook = false;
  let done = false;
  const tryNext = (): boolean => {
    while (++ci < cands.length) {
      const c = cands[ci];
      const d = findDir(c.pos);
      if (!d) {
        log(`candidate ${c.name} has no water within ${castD.toFixed(1)} m`);
        continue;
      }
      dir = d;
      ctx.player.teleport(c.pos.clone());
      try {
        ctx.player.heading = Math.atan2(d.x, d.z);
      } catch {
        /* read-only */
      }
      debug.castDirOverride = d.clone();
      placedAt = t;
      log(`placed at ${c.name} (${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(1)}, ${c.pos.z.toFixed(1)}) facing ${((Math.atan2(d.x, d.z) * 180) / Math.PI).toFixed(0)}° cast ${castD.toFixed(1)} m`);
      return true;
    }
    return false;
  };
  if (!tryNext()) {
    log('FAIL no spot with water in reach');
    return;
  }

  debug.maxWait = 2.2;
  debug.forceAuto = true;
  debug.hold = null;

  const ev = ctx.events;
  ev.on('fishing:phase', ({ phase }) => {
    log(`phase=${phase}`);
    if ((hold === 'wait' && phase === 'waiting') || (hold === 'reel' && phase === 'reeling') || (hold === 'catch' && phase === 'caught')) debug.hold = hold;
  });
  ev.on('cast:start', ({ power: p }) => log(`cast:start power=${p.toFixed(2)}`));
  ev.on('cast:land', ({ zone, inWater, position }) => log(`cast:land inWater=${inWater} zone=${zone} at (${position.x.toFixed(1)}, ${position.y.toFixed(2)}, ${position.z.toFixed(1)})`));
  ev.on('fish:shake', () => log('fish:shake'));
  ev.on('fish:bite', ({ rarity }) => log(`fish:bite rarity=${rarity}`));
  ev.on('fish:hooked', ({ fishId, rarity }) => log(`fish:hooked ${fishId} (${rarity})`));
  ev.on('fish:caught', ({ fish, def, firstTime }) => {
    log(`fish:caught ${def.name} ${fish.kg} kg size=${fish.size} mutation=${fish.mutation} attrs=[${fish.attributes}] value=${fish.value} odds=1/${fish.odds} perfect=${fish.perfect} first=${firstTime}`);
    log(`economy coins=${ctx.economy.coins()} level=${ctx.economy.level()} xp=${ctx.economy.xp()} backpack=${ctx.economy.save.backpack.length}`);
    if (!done) {
      done = true;
      log('PASS full loop cast → wait → bite → reel → catch');
    }
  });
  ev.on('fish:escaped', ({ fishId }) => log(`fish:escaped ${fishId}`));
  ev.on('ui:toast', ({ text, kind }) => log(`toast(${kind}) ${text}`));

  const cam = ctx.camera;
  const look = new THREE.Vector3();
  debug.onFrame = (dt) => {
    t += dt;
    const p = ctx.player;
    if (!started && t - placedAt > 0.8) {
      if (p.mode === 'swim') {
        log(`player is swimming at candidate ${cands[ci].name}; trying next`);
        if (!tryNext()) {
          log('FAIL could not stand anywhere');
          started = true;
        }
        return;
      }
      started = debug.cast(power);
      log(started ? 'casting' : 'FAIL could not cast');
    }
    if (api.phase === 'waiting' && !shook && api.shakeButtons.length) {
      shook = true;
      api.clickShake(api.shakeButtons[0].id);
    }
    if (!done && t > 150) {
      done = true;
      log(`FAIL timeout in phase ${api.phase}`);
    }
    if (!camFree || !hold) return;
    // frame the action
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    if (api.phase === 'caught') {
      cam.position.copy(p.position).addScaledVector(dir, 3.4).addScaledVector(side, 1.4).add(new THREE.Vector3(0, 1.9, 0));
      look.copy(p.position).add(new THREE.Vector3(0, 1.3, 0));
    } else {
      const b = api.bobberPosition ?? p.position.clone().addScaledVector(dir, castD);
      cam.position.copy(p.position).addScaledVector(dir, -4.5).addScaledVector(side, 2.6).add(new THREE.Vector3(0, 3.2, 0));
      look.copy(p.position).add(new THREE.Vector3(0, 1.2, 0)).lerp(b, 0.6);
    }
    cam.lookAt(look);
  };
}
