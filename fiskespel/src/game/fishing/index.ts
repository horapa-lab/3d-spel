/**
 * Fishing system — the full Fisch-style loop. OWNER: fishing.
 *
 *   idle → charging (hold primary, ping-pong power) → casting (bobber arc) → waiting (bob, nibbles,
 *   shake buttons) → bite (dip + ring, fish rolled) → reeling (minigame, reel.ts) → caught (reveal)
 *                                                                               ↘ escaped (retry via ad)
 * Pure maths lives in roll.ts / reel.ts / passives.ts (unit-tested).
 */
import * as THREE from 'three';
import type {
  BaitDef,
  CaughtFish,
  FishDef,
  FishingAPI,
  FishingPhase,
  GameContext,
  PlayerAnim,
  ReelState,
  RodStats,
  ShakeButton,
} from '../../core/types';
import { BOBBER_LINE_NAME } from '../../core/types';
import { uid } from '../../core/rng';
import { BITE, REEL, STARTER_BOBBER } from '../../data/constants';
import { FISH } from '../../data/fish';
import { RARITIES } from '../../data/rarities';
import { buildFallbackBobber, buildFallbackFish, collectAnimators, disposeModel, FishingLine, RingPool } from './fx';
import { LUCK_BURST_SECONDS, PassiveSet } from './passives';
import { barWidthFor, createReelSim, reelDifficulty, type ReelSim } from './reel';
import {
  applyValueBonuses,
  catchXp,
  displayLengthForKg,
  fishValue,
  rollCatchLayers,
  rollSpecies,
  sizeLabelFor,
  TREASURE_MAP_CHANCE,
  type CatchRollOptions,
} from './roll';

/** Seconds for one power sweep 0 → 1 (then back down). */
const CHARGE_PERIOD = 1.05;
const MIN_CAST = 4;
const REVEAL_SECONDS = 2.6;
const ESCAPE_SECONDS = 1.1;
const RETRY_WINDOW_MS = 30_000;

interface Surface {
  y: number;
  kind: 'sea' | 'water' | 'lava' | 'ice';
}

interface Hooked {
  def: FishDef;
  kg: number;
  mutation: string | null;
  attributes: string[];
  odds: number;
  overweight: boolean;
  zone: string;
  rerolled: boolean;
  touched: boolean;
}

interface Gear {
  stats: RodStats;
  passives: PassiveSet;
  bait: BaitDef | null;
}

/** Debug hooks used by the dev-only autotest (?autotest=fishing). */
export interface FishingDebug {
  castDirOverride: THREE.Vector3 | null;
  /** Force this cast power (0..1) and skip the hold. */
  cast(power: number): boolean;
  /** Max wait before the bite (s) — shortens tests. */
  maxWait: number | null;
  forceAuto: boolean;
  /** Freeze a phase for screenshots. */
  hold: 'wait' | 'reel' | 'catch' | null;
  onFrame: ((dt: number) => void) | null;
  maxCastDistance(): number;
  surfaceAt(x: number, z: number): Surface | null;
  sim(): ReelSim | null;
}

export function createFishing(ctx: GameContext): FishingAPI {
  const { scene, events, input } = ctx;
  const params = new URLSearchParams(location.search);
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // ── visuals
  const line = new FishingLine();
  const rings = new RingPool();
  scene.add(line.mesh, rings.group);
  let bobber: THREE.Object3D | null = null;
  let bobberId = '';
  let bobberAttach: THREE.Object3D | null = null;
  let bobberAnims: ((t: number) => void)[] = [];
  const bobberPos = new THREE.Vector3();
  const bobberHome = new THREE.Vector3(); // landing point (fight drifts around it)
  const tipPos = new THREE.Vector3();

  // ── state
  let phase: FishingPhase = 'idle';
  let phaseT = 0;
  let clockT = 0;
  let chargeT = 0;
  let castFrom = new THREE.Vector3();
  let castTo = new THREE.Vector3();
  let castDist = 0;
  let castApex = 0;
  let castDur = 1;
  let castLand: { inWater: boolean; surface: Surface | null; reason: string | null } = { inWater: false, surface: null, reason: null };
  let retrieving = false; // failed cast / escape: bobber reels back
  let retrieveFrom = new THREE.Vector3();
  let surface: Surface | null = null;
  let gear: Gear | null = null;
  let waitLeft = 0;
  let waitElapsed = 0;
  let nibbleIn = 2;
  let nibbleT = -1;
  let dipT = -1;
  let settleT = 0;
  let shakeSeq = 1;
  let autoShakeIn = 1;
  let hooked: Hooked | null = null;
  let sim: ReelSim | null = null;
  let lastDarts = 0;
  let splashIn = 0.5;
  let revealModel: THREE.Object3D | null = null;
  let revealAnims: ((t: number) => void)[] = [];
  let revealInHands = false;
  let revealFrom = new THREE.Vector3();
  let revealRarityHigh = false;
  let luckBurstUntil = 0;
  let luckBurstValue = 0;
  let lastEscaped: { hooked: Hooked; pos: THREE.Vector3; home: THREE.Vector3; player: THREE.Vector3; at: number; retried: boolean; surface: Surface; zone: string; gear: Gear } | null = null;
  let retriedFight = false;
  let lastMode: string | null = null;
  const lastPlayerPos = new THREE.Vector3(NaN, 0, 0);
  const delayed: { at: number; fn: () => void }[] = [];

  const reelState: ReelState = {
    barPos: 0.4,
    barWidth: REEL.baseBarWidth,
    fishPos: 0.5,
    progress: REEL.startProgress,
    inside: true,
    locked: true,
    perfect: true,
    rarity: 'common',
    fishName: null,
    overweight: false,
    difficulty: 0,
  };

  const debug: FishingDebug = {
    castDirOverride: null,
    cast(power) {
      if (phase !== 'idle' && phase !== 'charging') return false;
      if (phase === 'idle') setPhase('charging');
      api.castPower = Math.min(1, Math.max(0, power));
      release();
      return true;
    },
    maxWait: null,
    forceAuto: false,
    hold: null,
    onFrame: null,
    maxCastDistance: () => maxCastDistance(),
    surfaceAt: (x, z) => surfaceAt(x, z),
    sim: () => sim,
  };

  // ── helpers
  const now = () => clockT;
  const toast = (text: string, kind: 'info' | 'good' | 'bad' | 'rare' = 'info') => events.emit('ui:toast', { text, kind });
  const anim = (a: PlayerAnim) => {
    try {
      ctx.player.setAnim(a);
    } catch {
      /* player not ready */
    }
  };

  function setPhase(p: FishingPhase) {
    if (phase === p) return;
    phase = p;
    phaseT = 0;
    api.phase = p;
    events.emit('fishing:phase', { phase: p });
  }

  function surfaceAt(x: number, z: number): Surface | null {
    const local = ctx.world.localWaterAt?.(x, z);
    if (local) return { y: local.y, kind: local.kind };
    if (ctx.world.terrainHeight(x, z) < -0.3) return { y: ctx.ocean.heightAt(x, z), kind: 'sea' };
    return null;
  }
  const surfaceY = (s: Surface, x: number, z: number) => (s.kind === 'sea' ? ctx.ocean.heightAt(x, z) : s.y);

  function readGear(): Gear {
    const eco = ctx.economy;
    const rod = eco.equippedRod();
    let passives: PassiveSet;
    if (eco.activeEffects) {
      passives = new PassiveSet(eco.activeEffects().map((e) => ({ ...e, name: e.source })));
    } else {
      passives = PassiveSet.from(rod, eco.rodEnchants(rod.id));
    }
    return { stats: eco.effectiveRodStats(), passives, bait: eco.equippedBait() };
  }

  function maxCastDistance(): number {
    let tier = 1;
    try {
      tier = ctx.economy.equippedRod().tier || 1;
    } catch {
      /* economy not ready */
    }
    return Math.min(40, 16 + 1.2 * (tier - 1));
  }

  function ensureBobber() {
    const want = ctx.economy.save.equippedBobber || STARTER_BOBBER;
    if (bobber && bobberId === want) return;
    if (bobber) scene.remove(bobber);
    let obj: THREE.Object3D;
    try {
      obj = ctx.registry.has('bobber') && ctx.registry.list('bobber').includes(want) ? ctx.registry.build('bobber', want) : buildFallbackBobber();
    } catch {
      obj = buildFallbackBobber();
    }
    obj.name = 'fishingBobber';
    bobber = obj;
    bobberId = want;
    bobberAttach = obj.getObjectByName(BOBBER_LINE_NAME) ?? null;
    bobberAnims = collectAnimators(obj);
    obj.visible = false;
    scene.add(obj);
  }

  function lineEnd(target: THREE.Vector3): THREE.Vector3 {
    if (bobber && bobberAttach) {
      bobber.updateMatrixWorld(true);
      return bobberAttach.getWorldPosition(target);
    }
    return target.copy(bobberPos).add(v3.set(0, 0.08, 0));
  }

  function hideRig() {
    line.visible = false;
    if (bobber) bobber.visible = false;
    retrieving = false;
  }

  function clearShakes() {
    api.shakeButtons = [];
  }

  function placeShake(prev?: ShakeButton): ShakeButton {
    let x = 0.5;
    let y = 0.5;
    for (let i = 0; i < 8; i++) {
      x = 0.22 + Math.random() * 0.56;
      y = 0.26 + Math.random() * 0.46;
      if (!prev || Math.hypot(x - prev.x, y - prev.y) > 0.18) break;
    }
    return { id: shakeSeq++, x, y, ttl: 1.5 + Math.random() * 0.6 };
  }

  function lock(on: boolean) {
    try {
      ctx.player.locked = on;
    } catch {
      /* ignore */
    }
  }

  function endReveal() {
    if (revealModel) {
      try {
        if (revealInHands) ctx.player.showCatch(null);
      } catch {
        /* ignore */
      }
      revealModel.parent?.remove(revealModel);
      disposeModel(revealModel);
    }
    revealModel = null;
    revealAnims = [];
    revealInHands = false;
  }

  /** Back to idle from anywhere (quietly). */
  function reset(anim_ = true) {
    endReveal();
    hideRig();
    clearShakes();
    rings.clear();
    sim = null;
    hooked = null;
    api.reel = null;
    api.hookedRarity = null;
    api.bobberPosition = null;
    api.castPower = 0;
    input.reelingMode = false;
    lock(false);
    if (anim_) anim('idle');
    setPhase('idle');
  }

  // ── charging / casting
  function canStartCharge(): boolean {
    if (input.blocked) return false;
    const p = ctx.player;
    if (!p || p.mode === 'swim') return false;
    if (ctx.platform.adPlaying?.()) return false;
    return true;
  }

  function release() {
    ensureBobber();
    const power = api.castPower;
    const p = ctx.player;
    p.rodTip(castFrom);
    const dir = debug.castDirOverride ? v1.copy(debug.castDirOverride) : p.castDirection(v1);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const maxD = maxCastDistance();
    castDist = MIN_CAST + (maxD - MIN_CAST) * Math.pow(power, 0.9);
    const tx = castFrom.x + dir.x * castDist;
    const tz = castFrom.z + dir.z * castDist;
    // luck burst (per cast)
    gear = readGear();
    const burst = gear.passives.roll('luck_burst');
    if (burst) {
      luckBurstUntil = now() + LUCK_BURST_SECONDS;
      luckBurstValue = burst.value ?? 0.5;
      toast(`Luck Burst! +${Math.round(luckBurstValue * 100)}% luck for ${LUCK_BURST_SECONDS}s`, 'good');
    }
    // where does it land?
    const s = surfaceAt(tx, tz);
    let endY = s ? surfaceY(s, tx, tz) : ctx.world.terrainHeight(tx, tz);
    castTo.set(tx, endY, tz);
    castApex = 1.1 + castDist * 0.12;
    castLand = { inWater: !!s, surface: s, reason: s ? null : ctx.world.terrainHeight(tx, tz) > 0.15 ? 'land' : 'shallow' };
    // did the arc hit a cliff / hill on the way?
    for (let i = 1; i <= 20; i++) {
      const u = i / 20;
      arcPoint(u, v2);
      const g = ctx.world.terrainHeight(v2.x, v2.z);
      const local = ctx.world.localWaterAt?.(v2.x, v2.z);
      if (g > 0.15 && !local && v2.y < g + 0.05) {
        castTo.set(v2.x, g, v2.z);
        castDist = Math.hypot(v2.x - castFrom.x, v2.z - castFrom.z);
        castLand = { inWater: false, surface: null, reason: 'land' };
        endY = g;
        break;
      }
    }
    castDur = 0.45 + castDist * 0.022;
    bobberPos.copy(castFrom);
    if (bobber) {
      bobber.visible = true;
      bobber.position.copy(bobberPos);
    }
    line.visible = true;
    events.emit('cast:start', { power });
    anim('cast_release');
    setPhase('casting');
  }

  function arcPoint(u: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(castFrom, castTo, u);
    out.y += 4 * castApex * u * (1 - u);
    return out;
  }

  function land() {
    const pos = castTo.clone();
    if (!castLand.inWater || !castLand.surface) {
      events.emit('cast:land', { position: pos, zone: null, inWater: false });
      toast(castLand.reason === 'shallow' ? 'Too shallow here — cast further out.' : 'Cast into the water!', 'info');
      startRetrieve();
      return;
    }
    surface = castLand.surface;
    const zone = ctx.world.zoneAt(pos.x, pos.z);
    api.currentZone = zone;
    events.emit('cast:land', { position: pos, zone, inWater: true });
    const g = gear ?? readGear();
    gear = g;
    const missing = g.passives.missingRequirement(zone);
    if (missing) {
      toast(
        missing === 'heat_proof'
          ? 'Your line would melt! You need a heat-proof rod to fish in lava.'
          : 'The trench swallows your line. You need an abyss-proof rod to fish here.',
        'bad',
      );
      startRetrieve();
      return;
    }
    // bait is used when the cast lands in water
    if (g.bait) {
      try {
        ctx.economy.consumeBait();
      } catch {
        /* ignore */
      }
    }
    bobberHome.copy(pos);
    bobberPos.copy(pos);
    api.bobberPosition = bobberPos;
    if (surface.kind !== 'lava') ctx.ocean.splash(pos, 0.3 + 0.3 * api.castPower);
    rings.spawn(pos, 0.9, 0.9, 0.55, surface.kind === 'lava' ? 0xffa050 : 0xffffff);
    // bite timer: random(min,max) / (1 + lure) / global lure multiplier, floor BITE.minFloor
    const lure = (g.stats.lureSpeed ?? 0) + (g.bait?.stats.lureSpeed ?? 0);
    let wait = (BITE.minSeconds + Math.random() * (BITE.maxSeconds - BITE.minSeconds)) / Math.max(0.2, 1 + lure);
    wait /= Math.max(0.1, safe(() => ctx.economy.lureMultiplier(), 1));
    if (api.castPower >= 0.95) wait *= 0.85; // perfect cast
    wait = Math.max(BITE.minFloor, wait);
    if (g.passives.roll('quick_bite')) wait = 0.35;
    if (debug.maxWait !== null) wait = Math.min(wait, debug.maxWait);
    waitLeft = wait;
    waitElapsed = 0;
    nibbleIn = 1.2 + Math.random() * 2;
    nibbleT = -1;
    settleT = 0;
    autoShakeIn = 0.9;
    api.shakeButtons = [];
    anim('fishing_idle');
    setPhase('waiting');
  }

  function startRetrieve() {
    retrieving = true;
    retrieveFrom.copy(bobberPos);
    phaseT = 0;
    clearShakes();
  }

  // ── bite / reel
  function bite() {
    const g = gear ?? readGear();
    const env = ctx.clock.get();
    const zone = api.currentZone ?? ctx.world.zoneAt(bobberHome.x, bobberHome.z);
    const time = env.isNight ? 'night' : 'day';
    const burst = luckBurstUntil > now() ? luckBurstValue : 0;
    const luck = (g.stats.luck ?? 0) + (g.bait?.stats.luck ?? 0) + g.passives.situationalLuck({ zone, weather: env.weather, time, burstLuck: burst });
    const opts: CatchRollOptions = {
      zone,
      env: { isNight: env.isNight, weather: env.weather, season: env.season, event: env.event },
      luck,
      luckMultiplier: safe(() => ctx.economy.luckMultiplier(), 1),
      bait: g.bait,
      mutationMultiplier: safe(() => ctx.economy.mutationMultiplier(), 1),
      sizeUp: Math.min(1, g.passives.value('size_up')),
      rarityUpChance: g.passives.chance('rarity_up'),
      mutationTouch: g.passives.all('mutation_touch').filter((p) => p.mutation).map((p) => ({ chance: p.chance ?? 0.05, mutation: p.mutation! })),
    };
    const s = rollSpecies(opts, FISH);
    if (!s) {
      toast('Nothing seems to bite here…', 'info');
      startRetrieve();
      setPhase('escaped');
      return;
    }
    const layers = rollCatchLayers(s.def, opts);
    const heavy = g.passives.has('heavy_lifter');
    const maxKg = (g.stats.maxKg ?? Infinity) * (heavy ? 1 + g.passives.value('heavy_lifter') : 1);
    hooked = {
      def: s.def,
      kg: layers.kg,
      mutation: layers.mutation,
      attributes: layers.attributes,
      odds: s.odds,
      overweight: layers.kg > maxKg,
      zone,
      rerolled: s.rerolled,
      touched: layers.touched,
    };
    api.hookedRarity = s.def.rarity;
    retriedFight = false;
    clearShakes();
    dipT = 0;
    const order = RARITIES[s.def.rarity]?.order ?? 1;
    if (surface?.kind !== 'lava') ctx.ocean.splash(bobberPos, 0.45 + 0.08 * order);
    rings.spawn(bobberPos, 1.4 + 0.15 * order, 1.0, 0.8, surface?.kind === 'lava' ? 0xffa050 : 0xffffff);
    events.emit('fish:bite', { rarity: s.def.rarity });
    setPhase('bite');
  }

  function startReel(h: Hooked, g: Gear) {
    const def = h.def;
    const heavy = g.passives.has('heavy_lifter');
    const gainMult =
      (RARITIES[def.rarity]?.progressMult ?? 1) *
      (def.progressMult ?? 1) *
      (h.overweight && !heavy ? 0.5 : 1) *
      (1 + g.passives.value('reel_power'));
    const resilience = Math.max(
      0.05,
      (def.resilience || 1) * (1 + (g.stats.resilience ?? 0)) * (1 + g.passives.value('calm_waters')) * (1 + (g.bait?.stats.resilience ?? 0)),
    );
    const barWidth = barWidthFor(g.stats.control ?? 0);
    const auto = autoActive();
    sim = createReelSim({ barWidth, resilience, rarity: def.rarity, gainMult, auto });
    lastDarts = 0;
    splashIn = 0.4;
    Object.assign(reelState, {
      barPos: sim.state.barPos,
      barWidth: sim.state.barWidth,
      fishPos: sim.state.fishPos,
      progress: sim.state.progress,
      inside: true,
      locked: true,
      perfect: sim.state.perfect,
      rarity: def.rarity,
      fishName: null,
      overweight: h.overweight && !heavy,
      difficulty: reelDifficulty(def.rarity, resilience, barWidth),
    });
    api.reel = reelState;
    input.reelingMode = true;
    anim('reel');
    events.emit('fish:hooked', { fishId: def.id, rarity: def.rarity });
    setPhase('reeling');
  }

  function autoActive(): boolean {
    return debug.forceAuto || (!!ctx.economy.save.settings?.autoReelUnlocked && api.autoReel);
  }

  function caught() {
    const h = hooked!;
    const g = gear ?? readGear();
    const s = sim!.state;
    const perfect = s.perfect && !sim!.auto;
    const def = h.def;
    const eco = ctx.economy;
    const coinBonus = g.passives.value('coin_bonus');
    const value = applyValueBonuses(fishValue(def, h.kg, h.mutation, h.attributes), { coinBonus, perfectBonus: g.passives.value('perfect_bonus'), perfect });
    const fish: CaughtFish = {
      uid: uid(),
      fishId: def.id,
      kg: h.kg,
      mutation: h.mutation,
      attributes: h.attributes,
      size: sizeLabelFor(def, h.kg),
      value,
      zone: h.zone,
      caughtAt: Date.now(),
      perfect,
      odds: h.odds,
    };
    const firstTime = !eco.save.bestiary?.[def.id];
    let stored = true;
    try {
      stored = eco.addCatch(fish);
    } catch (err) {
      console.error('[fishing] addCatch failed', err);
    }
    if (!stored) toast('Your backpack is full — sell some fish!', 'bad');
    const xpBonus = g.passives.value('xp_bonus');
    eco.addXp(catchXp(def, { perfect, xpMultiplier: safe(() => eco.xpMultiplier(), 1), xpBonus }), 'catch');
    if (perfect) {
      eco.addCoins(REEL.perfectBonusCoins, 'perfect catch');
      events.emit('fish:perfect', {});
    }
    if (Math.random() < TREASURE_MAP_CHANCE * (1 + g.passives.value('treasure_sense'))) {
      eco.grantItem('treasure_map', 1);
      toast('You fished up a soggy treasure map!', 'rare');
    }
    const order = RARITIES[def.rarity]?.order ?? 1;
    if (order >= 5) safe(() => ctx.platform.happytime(), undefined);
    api.lastCatch = fish;
    reelState.fishName = def.name;
    reelState.progress = 1;
    events.emit('fish:caught', { fish, def, firstTime });
    // double catch: a second copy of the same species with its own weight/mutation roll
    if (g.passives.roll('double_catch')) {
      const env = ctx.clock.get();
      const layers = rollCatchLayers(def, {
        zone: h.zone,
        env: { isNight: env.isNight, weather: env.weather, season: env.season, event: env.event },
        luck: 0,
        mutationMultiplier: safe(() => eco.mutationMultiplier(), 1),
        sizeUp: Math.min(1, g.passives.value('size_up')),
      });
      const twin: CaughtFish = {
        ...fish,
        uid: uid(),
        kg: layers.kg,
        mutation: layers.mutation,
        attributes: layers.attributes,
        size: layers.size,
        value: applyValueBonuses(fishValue(def, layers.kg, layers.mutation, layers.attributes), { coinBonus }),
        perfect: false,
      };
      const ok2 = safe(() => eco.addCatch(twin), false);
      eco.addXp(catchXp(def, { xpMultiplier: safe(() => eco.xpMultiplier(), 1), xpBonus }), 'double catch');
      toast(`Double catch! Another ${def.name} (${twin.kg} kg)`, 'good');
      if (ok2) delayed.push({ at: now() + 1.3, fn: () => events.emit('fish:caught', { fish: twin, def, firstTime: false }) });
    }
    // reveal: fish flies from the water into the angler's hands
    const model = buildFishModel(def, h);
    revealModel = model;
    revealAnims = collectAnimators(model);
    revealInHands = false;
    revealFrom.copy(bobberPos);
    revealRarityHigh = order >= 4;
    model.position.copy(bobberPos);
    scene.add(model);
    if (surface?.kind !== 'lava') ctx.ocean.splash(bobberPos, 0.7);
    rings.spawn(bobberPos, 2, 1.1, 0.8);
    hideRig();
    input.reelingMode = false;
    sim = null;
    api.hookedRarity = null;
    anim(order >= 5 ? 'celebrate' : 'hold_fish');
    setPhase('caught');
  }

  function escaped() {
    const h = hooked!;
    lastEscaped = {
      hooked: h,
      pos: bobberPos.clone(),
      home: bobberHome.clone(),
      player: ctx.player.position.clone(),
      at: Date.now(),
      retried: retriedFight,
      surface: surface ?? { y: 0, kind: 'sea' },
      zone: h.zone,
      gear: gear ?? readGear(),
    };
    events.emit('fish:escaped', { fishId: h.def.id });
    input.reelingMode = false;
    sim = null;
    hooked = null;
    api.hookedRarity = null;
    startRetrieve();
    anim('fishing_idle');
    setPhase('escaped');
  }

  function buildFishModel(def: FishDef, h: Hooked): THREE.Object3D {
    let obj: THREE.Object3D;
    try {
      obj =
        ctx.registry.has('fish') && ctx.registry.list('fish').includes(def.id)
          ? ctx.registry.build('fish', def.id, { mutation: h.mutation, attributes: h.attributes, lod: 0 })
          : buildFallbackFish(RARITIES[def.rarity]?.color ?? '#9ab');
    } catch (err) {
      console.error('[fishing] fish model failed', err);
      obj = buildFallbackFish(RARITIES[def.rarity]?.color ?? '#9ab');
    }
    const wrap = new THREE.Group();
    wrap.name = `caught:${def.id}`;
    obj.scale.multiplyScalar(displayLengthForKg(h.kg));
    wrap.add(obj);
    wrap.userData.fishId = def.id;
    wrap.userData.kg = h.kg;
    return wrap;
  }

  // ── cancel triggers
  events.on('ui:open', ({ panel }) => {
    if (panel === 'catch') return;
    if (phase === 'caught' || phase === 'escaped') finishAfter();
    else if (phase !== 'idle') reset();
  });
  events.on('boat:board', () => phase !== 'idle' && reset());
  events.on('boat:leave', () => phase !== 'idle' && reset());

  function finishAfter() {
    reset();
  }

  // ── per-frame
  function updateBobberFloat(dt: number) {
    if (!bobber || !surface) return;
    const sy = surfaceY(surface, bobberPos.x, bobberPos.z);
    let off = 0;
    // settle after landing
    settleT += dt;
    off += -0.07 * Math.exp(-4 * settleT) * Math.cos(10 * settleT);
    // gentle idle bob (local pools have no waves)
    if (surface.kind !== 'sea') off += 0.006 * Math.sin(clockT * 2.3);
    // nibble
    if (nibbleT >= 0) {
      nibbleT += dt;
      off += -0.035 * Math.sin(Math.min(1, nibbleT / 0.28) * Math.PI);
      if (nibbleT > 0.28) nibbleT = -1;
    }
    // bite dip
    if (dipT >= 0) {
      dipT += dt;
      off += -0.16 * Math.exp(-2.5 * dipT) * (0.7 + 0.3 * Math.cos(dipT * 22));
    }
    bobberPos.y = sy + off;
    bobber.position.copy(bobberPos);
    // tilt with the waves
    if (surface.kind === 'sea') {
      ctx.ocean.normalAt(bobberPos.x, bobberPos.z, v3);
      qTmp.setFromUnitVectors(up, v3);
      bobber.quaternion.slerp(qTmp, Math.min(1, dt * 6));
    }
  }

  function updateLine(dt: number) {
    if (!line.visible) return;
    const p = ctx.player;
    p.rodTip(tipPos);
    const end = lineEnd(v2);
    const dist = Math.hypot(end.x - tipPos.x, end.z - tipPos.z);
    const env = ctx.clock.get();
    line.setLight(THREE.MathUtils.smoothstep(env.sunElevation, -0.2, 0.25));
    let sag = 0;
    let vib = 0;
    const bow = v1.set(Math.cos(env.windDir), 0, Math.sin(env.windDir)).multiplyScalar(env.windStrength * 0.02 * dist);
    if (phase === 'casting' && !retrieving) {
      sag = 0.04 * dist;
      bow.multiplyScalar(0.3);
    } else if (phase === 'reeling') {
      sag = 0.008 * dist;
      const fv = sim ? Math.abs(sim.state.fishVel) : 0;
      vib = 0.006 + 0.02 * fv + (sim && !sim.state.inside ? 0.01 : 0);
      bow.multiplyScalar(0.2);
    } else if (phase === 'bite') {
      sag = 0.02 * dist;
      vib = 0.01;
    } else if (retrieving) {
      sag = 0.05 * dist * (1 - Math.min(1, phaseT / 0.6));
    } else {
      sag = 0.07 * dist + 0.2;
    }
    const floorY = surface ? surfaceY(surface, (tipPos.x + end.x) / 2, (tipPos.z + end.z) / 2) + 0.01 : undefined;
    line.update(tipPos, end, { sag, bow, vib, time: clockT, floorY }, ctx.camera, ctx.renderer.domElement.clientHeight || innerHeight);
  }

  function updateReveal(dt: number) {
    if (!revealModel) return;
    const t = phaseT;
    for (const f of revealAnims) f(clockT);
    const fly = 0.45;
    if (t < fly && !revealInHands) {
      const u = t / fly;
      const p = ctx.player;
      v1.copy(p.position).add(v2.set(0, 1.35, 0));
      revealModel.position.lerpVectors(revealFrom, v1, u);
      revealModel.position.y += Math.sin(u * Math.PI) * 1.4;
      revealModel.rotation.set(0, clockT * 7, Math.sin(clockT * 20) * 0.4);
      return;
    }
    if (!revealInHands) {
      revealInHands = true;
      scene.remove(revealModel);
      revealModel.position.set(0, 0, 0);
      revealModel.rotation.set(0, 0, 0);
      try {
        ctx.player.showCatch(revealModel);
      } catch {
        /* ignore */
      }
      if (!revealModel.parent) scene.add(revealModel); // player did not take it: hold it in front ourselves
      if (revealRarityHigh) anim('hold_fish');
    }
    if (revealModel.parent === scene) {
      const p = ctx.player;
      p.castDirection(v1);
      revealModel.position.copy(p.position).addScaledVector(v1, 0.55).add(v2.set(0, 1.35, 0));
      revealModel.rotation.set(0, Math.atan2(v1.x, v1.z) + Math.PI / 2, Math.sin(clockT * 6) * 0.08);
    }
  }

  function updateShakes(dt: number) {
    if (waitElapsed < 0.35) return;
    if (api.shakeButtons.length === 0) api.shakeButtons = [placeShake()];
    const b = api.shakeButtons[0];
    b.ttl -= dt;
    if (b.ttl <= 0) api.shakeButtons = [placeShake(b)];
    if (autoActive()) {
      autoShakeIn -= dt;
      if (autoShakeIn <= 0) {
        autoShakeIn = 0.8 + Math.random() * 0.4;
        api.clickShake(api.shakeButtons[0].id);
      }
    }
  }

  function update(dt: number) {
    clockT += dt;
    phaseT += dt;
    for (let i = delayed.length - 1; i >= 0; i--) {
      if (delayed[i].at <= clockT) {
        const d = delayed.splice(i, 1)[0];
        d.fn();
      }
    }
    const p = ctx.player;
    if (!p) return;

    // cancel on mode change / teleport
    if (lastMode !== null && p.mode !== lastMode && phase !== 'idle') reset();
    lastMode = p.mode;
    if (Number.isFinite(lastPlayerPos.x) && p.position.distanceToSquared(lastPlayerPos) > 16 && phase !== 'idle') reset();
    lastPlayerPos.copy(p.position);

    const moving = Math.hypot(input.move.x, input.move.y) > 0.3 || input.jumpPressed;
    if (moving && (phase === 'charging' || phase === 'waiting')) reset();
    else if (moving && (phase === 'caught' || phase === 'escaped') && phaseT > 0.3) reset();

    switch (phase) {
      case 'idle': {
        if (input.primaryPressed && canStartCharge()) {
          chargeT = 0;
          api.castPower = 0;
          lock(true);
          anim('cast_charge');
          setPhase('charging');
        }
        break;
      }
      case 'charging': {
        if (input.blocked) {
          reset();
          break;
        }
        chargeT += dt;
        const k = (chargeT / CHARGE_PERIOD) % 2;
        api.castPower = k <= 1 ? k : 2 - k;
        if (!input.primaryDown || input.primaryReleased) release();
        break;
      }
      case 'casting': {
        if (retrieving) {
          p.rodTip(tipPos);
          const u = Math.min(1, phaseT / 0.6);
          bobberPos.lerpVectors(retrieveFrom, tipPos, u * u);
          bobberPos.y += Math.sin(u * Math.PI) * 0.6;
          bobber?.position.copy(bobberPos);
          if (u >= 1) reset();
          break;
        }
        const u = Math.min(1, phaseT / castDur);
        arcPoint(u, bobberPos);
        if (bobber) {
          bobber.position.copy(bobberPos);
          bobber.rotation.x += dt * 9;
        }
        if (u >= 1) {
          if (bobber) bobber.rotation.set(0, 0, 0);
          land();
        }
        break;
      }
      case 'waiting': {
        waitElapsed += dt;
        if (debug.hold !== 'wait') waitLeft -= dt;
        nibbleIn -= dt;
        if (nibbleIn <= 0 && waitElapsed > 1) {
          nibbleIn = 1.5 + Math.random() * 3;
          nibbleT = 0;
          rings.spawn(bobberPos, 0.45, 0.6, 0.35);
        }
        updateBobberFloat(dt);
        updateShakes(dt);
        if (waitLeft <= 0 && waitElapsed >= BITE.minFloor) bite();
        break;
      }
      case 'bite': {
        updateBobberFloat(dt);
        const order = hooked ? RARITIES[hooked.def.rarity]?.order ?? 1 : 1;
        if (phaseT >= (order >= 5 ? 0.8 : 0.5) && hooked) startReel(hooked, gear ?? readGear());
        break;
      }
      case 'reeling': {
        if (!sim || !hooked) {
          reset();
          break;
        }
        const wantAuto = autoActive();
        if (wantAuto !== sim.auto) sim.setAuto(wantAuto);
        const holding = !input.blocked && input.primaryDown;
        const res = debug.hold === 'reel' && sim.state.progress > 0.55 ? null : sim.step(dt, holding);
        const s = sim.state;
        reelState.barPos = s.barPos;
        reelState.barWidth = s.barWidth;
        reelState.fishPos = s.fishPos;
        reelState.progress = s.progress;
        reelState.inside = s.inside;
        reelState.locked = s.locked;
        reelState.perfect = s.perfect;
        // bobber is dragged around by the fish and pulled in with progress
        p.rodTip(tipPos);
        v1.set(tipPos.x - bobberHome.x, 0, tipPos.z - bobberHome.z);
        const d = v1.length();
        if (d > 1e-3) v1.divideScalar(d);
        v3.set(-v1.z, 0, v1.x);
        const pull = Math.min(d * 0.6, d - 2.5) * s.progress;
        const tx = bobberHome.x + v1.x * Math.max(0, pull) + v3.x * (s.fishPos - 0.5) * Math.min(4, 1 + d * 0.12);
        const tz = bobberHome.z + v1.z * Math.max(0, pull) + v3.z * (s.fishPos - 0.5) * Math.min(4, 1 + d * 0.12);
        if (surface?.kind !== 'sea' || surfaceAt(tx, tz)) {
          const k = 1 - Math.exp(-dt * 5);
          bobberPos.x += (tx - bobberPos.x) * k;
          bobberPos.z += (tz - bobberPos.z) * k;
        }
        if (surface && bobber) {
          const sy = surfaceY(surface, bobberPos.x, bobberPos.z);
          bobberPos.y = sy - 0.05 + 0.02 * Math.sin(clockT * 17) * (s.inside ? 0.5 : 1);
          bobber.position.copy(bobberPos);
          bobber.rotation.set(Math.sin(clockT * 13) * 0.25, 0, Math.cos(clockT * 11) * 0.25);
        }
        // fight splashes
        splashIn -= dt;
        if (s.darts > lastDarts || splashIn <= 0) {
          const dart = s.darts > lastDarts;
          lastDarts = s.darts;
          splashIn = 0.5 + Math.random() * 0.5;
          if (surface?.kind !== 'lava') ctx.ocean.splash(bobberPos, dart ? 0.35 : 0.15);
          rings.spawn(bobberPos, dart ? 1.1 : 0.6, 0.7, dart ? 0.6 : 0.35, surface?.kind === 'lava' ? 0xffa050 : 0xffffff);
        }
        api.bobberPosition = bobberPos;
        if (res === 'caught') caught();
        else if (res === 'escaped') escaped();
        break;
      }
      case 'caught': {
        updateReveal(dt);
        const hold = debug.hold === 'catch';
        if (!hold && input.primaryPressed && phaseT > 0.6 && canStartCharge()) {
          // skip the reveal and start the next cast right away
          reset(false);
          chargeT = 0;
          api.castPower = 0;
          lock(true);
          anim('cast_charge');
          setPhase('charging');
        } else if (!hold && phaseT >= REVEAL_SECONDS + (revealRarityHigh ? 0.8 : 0)) reset();
        break;
      }
      case 'escaped': {
        if (retrieving && bobber) {
          p.rodTip(tipPos);
          const u = Math.min(1, phaseT / 0.7);
          bobberPos.lerpVectors(retrieveFrom, tipPos, u * u);
          bobberPos.y += Math.sin(u * Math.PI) * 0.5;
          bobber.position.copy(bobberPos);
          if (u >= 1) hideRig();
        }
        if (phaseT >= ESCAPE_SECONDS) reset();
        break;
      }
    }
    updateLine(dt);
    rings.update(dt, surface?.kind === 'sea' ? (x, z) => ctx.ocean.heightAt(x, z) : undefined);
    for (const f of bobberAnims) if (bobber?.visible) f(clockT);
    debug.onFrame?.(dt);
  }

  const api: FishingAPI & { debug: FishingDebug } = {
    phase: 'idle',
    castPower: 0,
    shakeButtons: [],
    clickShake(id) {
      if (phase !== 'waiting') return;
      const b = api.shakeButtons.find((x) => x.id === id);
      if (!b) return;
      const g = gear ?? readGear();
      waitLeft -= BITE.shakeReduce * (1 + g.passives.value('shake_master'));
      nibbleT = 0;
      rings.spawn(bobberPos, 0.5, 0.5, 0.4);
      events.emit('fish:shake', {});
      api.shakeButtons = [placeShake(b)];
    },
    reel: null,
    hookedRarity: null,
    lastCatch: null,
    bobberPosition: null,
    currentZone: null,
    autoReel: false,
    setAutoReel(on) {
      api.autoReel = on;
    },
    canRetryEscaped() {
      const e = lastEscaped;
      if (!e || e.retried) return false;
      if (phase !== 'escaped' && phase !== 'idle') return false;
      if (Date.now() - e.at > RETRY_WINDOW_MS) return false;
      return ctx.player.position.distanceTo(e.player) < 3 && ctx.player.mode !== 'swim';
    },
    retryEscaped() {
      if (!api.canRetryEscaped() || !lastEscaped) return;
      const e = lastEscaped;
      e.retried = true;
      reset(false);
      ensureBobber();
      surface = e.surface;
      gear = e.gear;
      api.currentZone = e.zone;
      bobberHome.copy(e.home);
      bobberPos.copy(e.pos);
      if (bobber) {
        bobber.visible = true;
        bobber.position.copy(bobberPos);
      }
      line.visible = true;
      hooked = e.hooked;
      retriedFight = true;
      api.hookedRarity = hooked.def.rarity;
      lock(true);
      if (surface.kind !== 'lava') ctx.ocean.splash(bobberPos, 0.5);
      startReel(hooked, gear);
    },
    cancel() {
      if (phase !== 'idle') reset();
    },
    update(dt) {
      try {
        update(dt);
      } catch (err) {
        console.error('[fishing]', err);
        try {
          reset();
        } catch {
          /* ignore */
        }
      }
    },
    debug,
  };

  if (params.get('autotest') === 'fishing') {
    events.once('game:ready', () => {
      import('./autotest')
        .then((m) => m.runFishingAutotest(ctx, api, debug))
        .catch((err) => console.error('[autotest] failed to load', err));
    });
  }
  return api;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? fallback : v;
  } catch {
    return fallback;
  }
}
