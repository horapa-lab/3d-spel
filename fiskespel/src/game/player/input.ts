// OWNER: player/characters agent. Stub input (keyboard + mouse).
import type { InputAPI } from '../../core/types';

export function createInput(canvas: HTMLCanvasElement): InputAPI {
  const down = new Set<string>();
  const pressed = new Set<string>();
  const api: InputAPI = {
    move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: 0,
    primaryDown: false, primaryPressed: false, primaryReleased: false, reelingMode: false,
    interactPressed: false, jumpPressed: false, sprint: false, isTouch: 'ontouchstart' in window,
    keyPressed: (c) => pressed.has(c), keyDown: (c) => down.has(c),
    setVirtualMove() {}, setVirtualButton() {}, addLook(dx, dy) { api.look.x += dx; api.look.y += dy; },
    setBlocked(b) { api.blocked = b; }, blocked: false,
    endFrame() {
      pressed.clear(); api.primaryPressed = false; api.primaryReleased = false;
      api.interactPressed = false; api.jumpPressed = false; api.look.x = 0; api.look.y = 0; api.zoom = 0;
    },
  };
  const upd = () => {
    api.move.x = (down.has('KeyD') ? 1 : 0) - (down.has('KeyA') ? 1 : 0);
    api.move.y = (down.has('KeyW') ? 1 : 0) - (down.has('KeyS') ? 1 : 0);
    api.sprint = down.has('ShiftLeft');
  };
  addEventListener('keydown', (e) => { if (!down.has(e.code)) pressed.add(e.code); down.add(e.code); if (e.code === 'KeyE') api.interactPressed = true; if (e.code === 'Space') api.jumpPressed = true; upd(); });
  addEventListener('keyup', (e) => { down.delete(e.code); upd(); });
  canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) { api.primaryDown = true; api.primaryPressed = true; } });
  addEventListener('pointerup', (e) => { if (e.button === 0 && api.primaryDown) { api.primaryDown = false; api.primaryReleased = true; } });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons & 2) api.addLook(e.movementX, e.movementY); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { api.zoom += Math.sign(e.deltaY); }, { passive: true });
  return api;
}
