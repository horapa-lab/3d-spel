// OWNER: ui. Touch controls: floating joystick (left), drag-to-look (right), Cast/Reel, Interact, Jump, Sprint.
import type { UIC } from './common';
import { icon } from './icons';
import { clamp, el } from './util';

export interface TouchUI {
  el: HTMLElement;
  update(dt: number): void;
}

export function createTouch(u: UIC): TouchUI {
  const inp = u.game.input;
  const root = el('div', 'ri-layer ri-touch');
  root.innerHTML = `
  <div class="ri-t-look"></div>
  <div class="ri-t-joyzone"><div class="ri-t-joy"><i class="ri-t-knob"></i><span class="ri-t-arrows"></span></div></div>
  <div class="ri-t-btns">
    <button class="ri-t-btn ri-t-sprint" data-b="sprint" aria-label="Sprint">${icon('sprint')}</button>
    <button class="ri-t-btn ri-t-jump" data-b="jump" aria-label="Jump">${icon('jump')}</button>
    <button class="ri-t-btn ri-t-act" data-b="interact" aria-label="Interact" hidden>${icon('talk')}<small>Talk</small></button>
    <button class="ri-t-btn ri-t-primary" data-b="primary" aria-label="Cast"><span class="ri-t-prim-ic">${icon('rod')}</span><b>Cast</b></button>
  </div>`;
  u.root.appendChild(root);
  const joyZone = root.querySelector('.ri-t-joyzone') as HTMLElement;
  const joy = root.querySelector('.ri-t-joy') as HTMLElement;
  const knob = root.querySelector('.ri-t-knob') as HTMLElement;
  const look = root.querySelector('.ri-t-look') as HTMLElement;
  const prim = root.querySelector('.ri-t-primary') as HTMLElement;
  const primLabel = prim.querySelector('b')!;
  const primIc = prim.querySelector('.ri-t-prim-ic') as HTMLElement;
  const actBtn = root.querySelector('.ri-t-act') as HTMLElement;
  const sprintBtn = root.querySelector('.ri-t-sprint') as HTMLElement;

  // joystick
  let joyId = -1;
  let cx = 0;
  let cy = 0;
  const R = 52;
  joyZone.addEventListener('pointerdown', (e) => {
    if (joyId !== -1) return;
    joyId = e.pointerId;
    joyZone.setPointerCapture(e.pointerId);
    const zr = joyZone.getBoundingClientRect();
    cx = e.clientX;
    cy = e.clientY;
    joy.style.left = `${cx - zr.left}px`;
    joy.style.top = `${cy - zr.top}px`;
    joy.classList.add('on');
    e.preventDefault();
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    inp.setVirtualMove(clamp(dx / R, -1, 1), clamp(-dy / R, -1, 1));
  });
  const joyEnd = (e: PointerEvent) => {
    if (e.pointerId !== joyId) return;
    joyId = -1;
    knob.style.transform = '';
    joy.classList.remove('on');
    joy.style.left = '';
    joy.style.top = '';
    inp.setVirtualMove(0, 0);
  };
  joyZone.addEventListener('pointerup', joyEnd);
  joyZone.addEventListener('pointercancel', joyEnd);

  // look
  const lookIds = new Map<number, { x: number; y: number }>();
  look.addEventListener('pointerdown', (e) => {
    look.setPointerCapture(e.pointerId);
    lookIds.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  look.addEventListener('pointermove', (e) => {
    const p = lookIds.get(e.pointerId);
    if (!p) return;
    inp.addLook((e.clientX - p.x) * 1.6, (e.clientY - p.y) * 1.6);
    p.x = e.clientX;
    p.y = e.clientY;
  });
  const lookEnd = (e: PointerEvent) => lookIds.delete(e.pointerId);
  look.addEventListener('pointerup', lookEnd);
  look.addEventListener('pointercancel', lookEnd);

  // buttons
  let sprintOn = false;
  root.querySelectorAll<HTMLElement>('.ri-t-btn').forEach((b) => {
    const name = b.dataset.b as 'primary' | 'interact' | 'jump' | 'sprint';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      if (name === 'sprint') {
        sprintOn = !sprintOn;
        inp.setVirtualButton('sprint', sprintOn);
        b.classList.toggle('on', sprintOn);
        return;
      }
      inp.setVirtualButton(name, true);
    });
    const up = () => {
      b.classList.remove('down');
      if (name !== 'sprint') inp.setVirtualButton(name, false);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  });
  void sprintBtn;

  let lastKey = '';
  return {
    el: root,
    update() {
      const ph = u.fishing.phase;
      const busy = u.isOpen();
      root.classList.toggle('hidden', busy);
      root.classList.toggle('fishing', ph !== 'idle');
      const label = ph === 'reeling' ? 'Reel' : ph === 'charging' ? 'Release' : ph === 'waiting' || ph === 'bite' ? 'Reel in' : 'Cast';
      const near = u.nearest();
      const key = `${label}|${near?.id ?? ''}`;
      if (key === lastKey) return;
      lastKey = key;
      primLabel.textContent = label;
      primIc.innerHTML = icon(ph === 'reeling' ? 'refresh' : 'rod');
      prim.classList.toggle('reel', ph === 'reeling');
      actBtn.hidden = !near || ph !== 'idle';
    },
  };
}
