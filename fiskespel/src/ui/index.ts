// OWNER: UI agent. Stub.
import type { GameContext, UIAPI } from '../core/types';

export function createUI(ctx: GameContext): UIAPI {
  const root = document.getElementById('ui-root')!;
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:12px;top:10px;color:#fff;font:600 14px system-ui;text-shadow:0 1px 3px #000';
  root.appendChild(hud);
  return {
    open() {}, close() {}, isOpen: () => false, toast() {},
    update() { hud.textContent = `Reel Isles (dev) — coins ${ctx.economy.coins()} — ${ctx.world.locationAt(ctx.player.position.x, ctx.player.position.z)}`; },
  };
}
