/**
 * Boot + main loop. OWNER: integrator (lead). Systems are created in dependency order.
 *
 * Debug URL params (used by screenshots / the gauntlet):
 *   ?pos=x,y,z        teleport player
 *   ?cam=x,y,z&look=x,y,z   freeze a cinematic camera (player update still runs)
 *   ?day=0..1         dayProgress override  (0 sunrise, .25 noon, .5 sunset, .75 midnight)
 *   ?weather=storm    weather override
 *   ?event=crimson_moon
 *   ?quality=low|medium|high|ultra
 *   ?nohud=1          hide UI
 */
import * as THREE from 'three';
import './styles.css';
import type { GameContext, QualityTier, Weather } from './core/types';
import { EventBus } from './core/events';
import { registry } from './core/registry';
import './models/index';
import { createRenderSystem, detectQuality } from './render/index';
import { createSky } from './world/sky/index';
import { createOcean } from './world/ocean/index';
import { createWorld } from './world/index';
import { createWorldClock } from './game/world-state/clock';
import { createInput } from './game/player/input';
import { createPlayer } from './game/player/index';
import { createFishing } from './game/fishing/index';
import { createEconomy } from './game/economy/index';
import { createPlatform } from './platform/crazygames';
import { createUI } from './ui/index';
import { createAudio } from './audio/index';

const params = new URLSearchParams(location.search);
const vec = (s: string | null) => (s ? new THREE.Vector3(...s.split(',').map(Number)) : null);

function setLoading(p: number, text: string) {
  const bar = document.getElementById('loading-bar');
  const label = document.getElementById('loading-text');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (label) label.textContent = text;
}

async function boot() {
  const platform = await createPlatform();
  platform.loadingStart();
  setLoading(0.05, 'Waking up the sea…');

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const quality = ((params.get('quality') as QualityTier | null) ?? detectQuality()) as QualityTier;
  const render = createRenderSystem(canvas, quality);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 12000);
  const events = new EventBus<import('./core/types').GameEvents>();
  const clock = createWorldClock();
  const dbg = clock as typeof clock & { debugSet?: (o: Record<string, unknown>) => void };
  if (params.has('day') || params.has('weather') || params.has('event')) {
    dbg.debugSet?.({
      ...(params.has('day') ? { dayProgress: Number(params.get('day')) } : {}),
      ...(params.has('weather') ? { weather: params.get('weather') as Weather } : {}),
      ...(params.has('event') ? { event: params.get('event') } : {}),
    });
  }
  clock.attach?.(events);
  const input = createInput(canvas);

  const ctx = {
    renderer: render.renderer,
    scene,
    camera,
    events,
    clock,
    input,
    quality,
    registry,
    platform,
    render,
  } as unknown as GameContext;

  const tick = () => new Promise((r) => setTimeout(r, 0));
  setLoading(0.15, 'Painting the sky…');
  await tick();
  ctx.sky = createSky(ctx);
  setLoading(0.3, 'Filling the ocean…');
  await tick();
  ctx.ocean = createOcean(ctx);
  setLoading(0.45, 'Raising the islands…');
  await tick();
  ctx.world = createWorld(ctx);
  setLoading(0.7, 'Loading your tackle box…');
  await tick();
  ctx.economy = await createEconomy(ctx);
  ctx.player = createPlayer(ctx);
  ctx.fishing = createFishing(ctx);
  ctx.audio = createAudio(ctx);
  ctx.ui = createUI(ctx);
  if (params.get('nohud') === '1') document.getElementById('ui-root')!.style.display = 'none';

  const pos = vec(params.get('pos'));
  if (pos) ctx.player.teleport(pos);
  const camPos = vec(params.get('cam'));
  const camLook = vec(params.get('look'));

  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    render.resize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  setLoading(1, 'Ready!');
  platform.loadingStop();
  document.getElementById('loading')?.classList.add('done');
  events.emit('game:ready', {});
  platform.gameplayStart();

  const unlockAudio = () => ctx.audio.unlock();
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });

  let last = performance.now();
  let frames = 0;
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      clock.update(dt);
      const env = clock.get();
      ctx.economy.update(dt);
      ctx.player.update(dt);
      if (camPos) {
        camera.position.copy(camPos);
        if (camLook) camera.lookAt(camLook);
      }
      ctx.fishing.update(dt);
      ctx.sky.update(dt, camera, env);
      ctx.ocean.update(dt, camera, env);
      ctx.world.update(dt, camera, env);
      ctx.audio.update(dt, env);
      ctx.ui.update(dt);
      render.render(scene, camera, env);
    } catch (err) {
      console.error('[loop]', err);
    }
    input.endFrame();
    frames++;
    if (frames === 30) (window as unknown as { __gameReady: boolean }).__gameReady = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __ctx: GameContext }).__ctx = ctx;
}

boot().catch((err) => {
  console.error(err);
  setLoading(1, 'Something went wrong. Please reload.');
});
