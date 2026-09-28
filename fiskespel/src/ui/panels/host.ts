// OWNER: ui. Modal panel host: one panel at a time, back-navigation, input blocking, events.
import type { PanelId } from '../../core/types';
import type { UIC } from '../common';
import { el } from '../util';

export interface PanelCtl {
  root: HTMLElement;
  /** 'modal' = centred glass panel over a dim backdrop; 'dialog' = bottom NPC dialog. */
  kind?: 'modal' | 'dialog';
  render(): void;
  update?(dt: number): void;
  /** When true, global refreshes are skipped (animations in progress). */
  busy?(): boolean;
  onClose?(): void;
  /** Return true when the key was handled. */
  onKey?(e: KeyboardEvent): boolean;
}

export interface Nav {
  /** Open another panel; this one becomes the "back" target. */
  go(panel: string, data?: Record<string, unknown>): void;
  back: (() => void) | null;
  close(): void;
  refreshSoon(): void;
}

export type PanelFactory = (u: UIC, data: Record<string, unknown>, nav: Nav) => PanelCtl;

interface Entry {
  id: string;
  data: Record<string, unknown>;
  ctl: PanelCtl;
  from: { id: string; data: Record<string, unknown> } | null;
}

export interface PanelHost {
  el: HTMLElement;
  open(id: string, data?: Record<string, unknown>, from?: { id: string; data: Record<string, unknown> } | null): void;
  close(): void;
  isOpen(): boolean;
  current(): string | null;
  update(dt: number): void;
  refresh(): void;
  key(e: KeyboardEvent): boolean;
}

export function createPanelHost(u: UIC, factories: Record<string, PanelFactory>, hooks: { opened(id: string, data: Record<string, unknown>): void; closed(id: string): void }): PanelHost {
  const host = el('div', 'ri-modalhost');
  host.innerHTML = '<div class="ri-backdrop"></div><div class="ri-modalwrap"></div>';
  u.root.appendChild(host);
  const wrap = host.querySelector('.ri-modalwrap') as HTMLElement;
  const backdrop = host.querySelector('.ri-backdrop') as HTMLElement;
  let cur: Entry | null = null;
  let refreshQueued = false;

  backdrop.addEventListener('pointerdown', () => {
    if (cur && cur.ctl.kind !== 'dialog') api.close();
  });
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target === wrap && cur && cur.ctl.kind !== 'dialog') api.close();
  });
  host.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.dataset.act === '__close') {
      u.sfx('ui_close');
      api.close();
    } else if (t.dataset.act === '__back') {
      u.sfx('ui_click');
      goBack();
    }
  });

  function goBack() {
    if (cur?.from) api.open(cur.from.id, cur.from.data, null);
    else api.close();
  }

  function teardown(anim: boolean) {
    if (!cur) return;
    const old = cur;
    cur = null;
    try {
      old.ctl.onClose?.();
    } catch (err) {
      console.error(err);
    }
    if (anim) {
      old.ctl.root.classList.add('out');
      setTimeout(() => old.ctl.root.remove(), 220);
    } else old.ctl.root.remove();
    hooks.closed(old.id);
  }

  const api: PanelHost = {
    el: host,
    open(id, data = {}, from) {
      const f = factories[id];
      if (!f) {
        console.warn(`[ui] unknown panel ${id}`);
        return;
      }
      const prevFrom = cur ? { id: cur.id, data: cur.data } : null;
      teardown(false);
      const entry: Entry = { id, data, from: from === undefined ? null : from, ctl: null as unknown as PanelCtl };
      const nav: Nav = {
        go: (p, d) => api.open(p, d ?? {}, { id, data }),
        back: entry.from ? () => goBack() : null,
        close: () => api.close(),
        refreshSoon: () => api.refresh(),
      };
      void prevFrom;
      try {
        entry.ctl = f(u, data, nav);
      } catch (err) {
        console.error(`[ui] panel ${id} failed to build`, err);
        return;
      }
      cur = entry;
      host.classList.add('open');
      host.classList.toggle('dlg', entry.ctl.kind === 'dialog');
      wrap.appendChild(entry.ctl.root);
      entry.ctl.root.classList.add('in');
      try {
        entry.ctl.render();
      } catch (err) {
        console.error(`[ui] panel ${id} render failed`, err);
      }
      hooks.opened(id, data);
    },
    close() {
      if (!cur) return;
      teardown(true);
      host.classList.remove('open', 'dlg');
    },
    isOpen: () => !!cur,
    current: () => cur?.id ?? null,
    update(dt) {
      if (!cur) return;
      if (refreshQueued) {
        refreshQueued = false;
        if (!cur.ctl.busy?.()) {
          try {
            cur.ctl.render();
          } catch (err) {
            console.error(err);
          }
        }
      }
      try {
        cur.ctl.update?.(dt);
      } catch (err) {
        console.error(err);
      }
    },
    refresh() {
      refreshQueued = true;
    },
    key(e) {
      return cur?.ctl.onKey?.(e) ?? false;
    },
  };
  return api;
}

export type { PanelId };
