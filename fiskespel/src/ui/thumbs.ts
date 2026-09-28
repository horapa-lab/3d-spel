// OWNER: ui. Offscreen 3D icon renderer: registry models → cached data-URL thumbnails.
//
// ONE small WebGLRenderer (lazy), studio lighting (room env + key/rim/fill), orthographic
// camera fitted to the model's projected vertices. Jobs are queued and processed a few per
// frame inside a time budget. Undiscovered fish use a dark 2D-composited silhouette of the
// same render. `stage()` drives a live animated render (loot-box reveal) through the same renderer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ModelKind, ModelRegistry } from '../core/types';

export type ThumbKind = 'fish' | 'rod' | 'bait' | 'item' | 'bobber' | 'npc' | 'boat';

export interface ThumbOpts {
  mutation?: string | null;
  attributes?: string[];
  silhouette?: boolean;
  pose?: string;
  /** Override default camera framing. */
  framing?: 'side' | 'diag' | 'three' | 'portrait' | 'boat';
}

interface Job {
  key: string;
  kind: ThumbKind;
  id: string;
  opts: ThumbOpts;
  cbs: ((url: string | null) => void)[];
}

export interface ThumbStage {
  draw(t: number, open: number, spin: number): void;
  hasOpen: boolean;
  dispose(): void;
}

export interface Thumbs {
  /** True if a registered model exists for this kind/id. */
  has(kind: ThumbKind, id: string): boolean;
  /** Cached data URL, or null (and the job is queued). */
  get(kind: ThumbKind, id: string, opts?: ThumbOpts): string | null;
  request(kind: ThumbKind, id: string, opts: ThumbOpts, cb: (url: string | null) => void): void;
  /** Markup: an <img> when cached, else a placeholder holding `fallback` that is swapped in place when ready. */
  html(kind: ThumbKind, id: string, opts: ThumbOpts, fallback: string, cls?: string): string;
  update(dt: number): void;
  pending(): number;
  stage(canvas: HTMLCanvasElement, kind: ThumbKind, id: string, opts?: ThumbOpts): ThumbStage | null;
  /** Time budget per frame in ms (dev screenshots raise it). */
  budgetMs: number;
}

const SIZE = 256;
const KIND_CANDIDATES: Record<ThumbKind, ModelKind[]> = {
  fish: ['fish'],
  rod: ['rod'],
  bait: ['bait', 'item'],
  item: ['item', 'bait', 'bobber'],
  bobber: ['bobber', 'item'],
  npc: ['npc', 'character'],
  boat: ['boat'],
};

export function createThumbs(registry: ModelRegistry): Thumbs {
  const cache = new Map<string, string | null>();
  const queue: Job[] = [];
  const jobsByKey = new Map<string, Job>();
  const tokens = new Map<string, number>();
  let tokenSeq = 1;
  const lists = new Map<ModelKind, { ids: Set<string>; at: number }>();

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let envTex: THREE.Texture | null = null;
  let rendersSinceReset = 0;
  let stageActive = 0;
  let failed = false;

  function listFor(kind: ModelKind): Set<string> {
    const now = performance.now();
    let entry = lists.get(kind);
    if (!entry || (now - entry.at > 8000 && entry.ids.size === 0)) {
      let ids: string[] = [];
      try {
        ids = registry.has(kind) ? registry.list(kind) : [];
      } catch {
        ids = [];
      }
      entry = { ids: new Set(ids), at: now };
      lists.set(kind, entry);
    }
    return entry.ids;
  }
  function resolveKind(kind: ThumbKind, id: string): ModelKind | null {
    for (const k of KIND_CANDIDATES[kind]) if (listFor(k).has(id)) return k;
    return null;
  }

  function keyOf(kind: ThumbKind, id: string, o: ThumbOpts): string {
    return `${kind}|${id}|${o.mutation ?? ''}|${(o.attributes ?? []).join('+')}|${o.pose ?? ''}|${o.framing ?? ''}|${o.silhouette ? 's' : ''}`;
  }

  function ensureRenderer(): boolean {
    if (renderer) return true;
    if (failed) return false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(1);
      renderer.setSize(SIZE, SIZE, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setClearColor(0x000000, 0);
      const pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      scene = new THREE.Scene();
      scene.environment = envTex;
      scene.environmentIntensity = 0.85;
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      const key = new THREE.DirectionalLight(0xfff1dc, 2.5);
      key.position.set(2.2, 3.2, 3.5);
      const rim = new THREE.DirectionalLight(0x9fd8ff, 2.1);
      rim.position.set(-3, 1.6, -3.4);
      const fill = new THREE.HemisphereLight(0xe4f4ff, 0x3a3226, 0.55);
      camera.add(key, rim, fill, key.target, rim.target);
      key.target.position.set(0, 0, -4);
      rim.target.position.set(0, 0, -4);
      scene.add(camera);
      return true;
    } catch (err) {
      console.warn('[ui/thumbs] WebGL thumbnail renderer unavailable', err);
      failed = true;
      renderer = null;
      return false;
    }
  }

  function resetRenderer(): void {
    if (!renderer) return;
    try {
      envTex?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    } catch {
      /* ignore */
    }
    renderer = null;
    scene = null;
    camera = null;
    envTex = null;
    rendersSinceReset = 0;
  }

  const v = new THREE.Vector3();
  function viewFor(kind: ThumbKind, framing?: ThumbOpts['framing']): { yaw: number; pitch: number; roll: number; portrait: boolean } {
    const f = framing ?? ({ fish: 'side', rod: 'diag', bait: 'three', item: 'three', bobber: 'three', npc: 'portrait', boat: 'boat' } as const)[kind];
    switch (f) {
      case 'side':
        // camera on -X side → fish head (+Z) points right; slight front 3/4 + elevation
        return { yaw: -Math.PI / 2 + 0.3, pitch: 0.2, roll: 0, portrait: false };
      case 'diag':
        return { yaw: 0.35, pitch: 0.12, roll: -Math.PI / 4, portrait: false };
      case 'portrait':
        return { yaw: 0.22, pitch: 0.06, roll: 0, portrait: true };
      case 'boat':
        return { yaw: 0.75, pitch: 0.42, roll: 0, portrait: false };
      default:
        return { yaw: 0.62, pitch: 0.4, roll: 0, portrait: false };
    }
  }

  /** Build + frame a model inside a pivot; returns pivot and fitted ortho params. */
  function prepare(kind: ThumbKind, mk: ModelKind, id: string, opts: ThumbOpts, headroom = 1): { pivot: THREE.Group; model: THREE.Object3D } | null {
    if (!scene || !camera) return null;
    let model: THREE.Object3D;
    try {
      model = registry.build(mk, id, { mutation: opts.mutation ?? null, attributes: opts.attributes ?? [], lod: 0, quality: 'high', seed: 1, pose: opts.pose });
    } catch (err) {
      console.warn(`[ui/thumbs] build failed ${mk}/${id}`, err);
      return null;
    }
    const pivot = new THREE.Group();
    pivot.add(model);
    const view = viewFor(kind, opts.framing);
    pivot.rotation.z = view.roll;
    scene.add(pivot);
    model.traverse((o) => {
      const fn = o.userData?.animate as ((t: number) => void) | undefined;
      if (typeof fn === 'function') {
        try {
          fn(0.4);
        } catch {
          /* ignore */
        }
      }
    });
    pivot.updateMatrixWorld(true);
    // world bounds (meshes only)
    const box = new THREE.Box3();
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.visible && !o.userData?.noThumbBounds) box.expandByObject(m);
    });
    if (box.isEmpty()) box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.02);
    const dir = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
    camera.position.copy(center).addScaledVector(dir, radius * 4);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    const inv = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const topCut = view.portrait ? box.max.y - (box.max.y - box.min.y) * 0.4 : -Infinity;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || o.userData?.noThumbBounds) return;
      const pos = m.geometry?.attributes?.position as THREE.BufferAttribute | undefined;
      if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (view.portrait && v.y < topCut) continue;
        v.applyMatrix4(inv);
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }
    });
    if (!Number.isFinite(minX)) {
      minX = minY = -radius;
      maxX = maxY = radius;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let half = Math.max(maxX - minX, maxY - minY) / 2;
    half *= (view.portrait ? 1.06 : 1.1) * headroom;
    if (view.portrait) {
      camera.left = cx - half;
      camera.right = cx + half;
      camera.top = maxY + half * 0.08;
      camera.bottom = maxY + half * 0.08 - half * 2;
    } else {
      camera.left = cx - half;
      camera.right = cx + half;
      camera.top = cy + half;
      camera.bottom = cy - half;
    }
    camera.near = 0.001;
    camera.far = radius * 12;
    camera.updateProjectionMatrix();
    return { pivot, model };
  }

  let sil: HTMLCanvasElement | null = null;
  function silhouetteOf(src: HTMLCanvasElement): string {
    if (!sil) {
      sil = document.createElement('canvas');
      sil.width = SIZE;
      sil.height = SIZE;
    }
    const g = sil.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, SIZE, SIZE);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    const grad = g.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, '#1c3a50');
    grad.addColorStop(1, '#08141f');
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    g.globalCompositeOperation = 'source-over';
    return sil.toDataURL('image/png');
  }

  function toUrl(c: HTMLCanvasElement): string {
    const u = c.toDataURL('image/webp', 0.92);
    return u.startsWith('data:image/webp') ? u : c.toDataURL('image/png');
  }

  function renderJob(job: Job): void {
    const mk = resolveKind(job.kind, job.id);
    if (!mk || !ensureRenderer()) {
      finish(job, null);
      return;
    }
    const baseOpts = { ...job.opts, silhouette: false };
    const prep = prepare(job.kind, mk, job.id, baseOpts);
    if (!prep) {
      finish(job, null);
      return;
    }
    let url: string | null = null;
    let silUrl: string | null = null;
    try {
      renderer!.setSize(SIZE, SIZE, false);
      renderer!.render(scene!, camera!);
      const c = renderer!.domElement;
      url = toUrl(c);
      silUrl = silhouetteOf(c);
    } catch (err) {
      console.warn('[ui/thumbs] render failed', err);
    }
    scene!.remove(prep.pivot);
    rendersSinceReset++;
    // cache both variants
    const k1 = keyOf(job.kind, job.id, baseOpts);
    const k2 = keyOf(job.kind, job.id, { ...baseOpts, silhouette: true });
    cache.set(k1, url);
    cache.set(k2, silUrl);
    const other = jobsByKey.get(job.key === k1 ? k2 : k1);
    if (other) {
      finish(other, job.key === k1 ? silUrl : url);
      const i = queue.indexOf(other);
      if (i >= 0) queue.splice(i, 1);
    }
    finish(job, job.opts.silhouette ? silUrl : url);
  }

  function finish(job: Job, url: string | null): void {
    cache.set(job.key, url);
    jobsByKey.delete(job.key);
    const tk = tokens.get(job.key);
    if (url && tk != null) {
      document.querySelectorAll<HTMLElement>(`[data-tk="${tk}"]`).forEach((ph) => {
        ph.innerHTML = `<img src="${url}" alt="" draggable="false">`;
        ph.classList.add('ri-th-ok');
        ph.removeAttribute('data-tk');
      });
    }
    for (const cb of job.cbs) {
      try {
        cb(url);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function enqueue(kind: ThumbKind, id: string, opts: ThumbOpts, cb?: (url: string | null) => void): string {
    const key = keyOf(kind, id, opts);
    let job = jobsByKey.get(key);
    if (!job) {
      job = { key, kind, id, opts, cbs: [] };
      jobsByKey.set(key, job);
      queue.push(job);
    }
    if (cb) job.cbs.push(cb);
    return key;
  }

  const api: Thumbs = {
    budgetMs: 9,
    has(kind, id) {
      return resolveKind(kind, id) != null;
    },
    get(kind, id, opts = {}) {
      const key = keyOf(kind, id, opts);
      if (cache.has(key)) return cache.get(key) ?? null;
      if (!api.has(kind, id)) {
        cache.set(key, null);
        return null;
      }
      enqueue(kind, id, opts);
      return null;
    },
    request(kind, id, opts, cb) {
      const key = keyOf(kind, id, opts);
      if (cache.has(key)) {
        cb(cache.get(key) ?? null);
        return;
      }
      if (!api.has(kind, id)) {
        cache.set(key, null);
        cb(null);
        return;
      }
      enqueue(kind, id, opts, cb);
    },
    html(kind, id, opts, fallback, cls = '') {
      const key = keyOf(kind, id, opts);
      const cached = api.get(kind, id, opts);
      if (cached) return `<span class="ri-th ri-th-ok ri-th-instant ${cls}"><img src="${cached}" alt="" draggable="false"></span>`;
      if (cache.has(key)) return `<span class="ri-th ri-th-fb ${cls}">${fallback}</span>`;
      let tk = tokens.get(key);
      if (tk == null) {
        tk = tokenSeq++;
        tokens.set(key, tk);
      }
      return `<span class="ri-th ri-th-ph ${cls}" data-tk="${tk}">${fallback}</span>`;
    },
    update() {
      if (stageActive > 0) return;
      if (!queue.length) {
        if (renderer && rendersSinceReset > 140) resetRenderer();
        return;
      }
      const t0 = performance.now();
      let n = 0;
      while (queue.length && (n === 0 || performance.now() - t0 < api.budgetMs)) {
        const job = queue.shift()!;
        if (!jobsByKey.has(job.key)) continue;
        renderJob(job);
        n++;
      }
    },
    pending: () => queue.length,
    stage(canvas, kind, id, opts = {}) {
      const mk = resolveKind(kind, id);
      if (!mk || !ensureRenderer()) return null;
      const prep = prepare(kind, mk, id, opts, 1.32);
      if (!prep) return null;
      stageActive++;
      const opens: ((t: number) => void)[] = [];
      const anims: ((t: number) => void)[] = [];
      prep.model.traverse((o) => {
        const u = o.userData ?? {};
        if (typeof u.open === 'function') opens.push(u.open);
        if (typeof u.animate === 'function') anims.push(u.animate);
      });
      const g = canvas.getContext('2d');
      let disposed = false;
      return {
        hasOpen: opens.length > 0,
        draw(t, open, spin) {
          if (disposed || !renderer || !g) return;
          for (const fn of opens) {
            try {
              fn(open);
            } catch {
              /* ignore */
            }
          }
          for (const fn of anims) {
            try {
              fn(t);
            } catch {
              /* ignore */
            }
          }
          prep.pivot.rotation.y = spin;
          const w = canvas.width;
          const h = canvas.height;
          renderer.setSize(w, h, false);
          renderer.render(scene!, camera!);
          g.clearRect(0, 0, w, h);
          g.drawImage(renderer.domElement, 0, 0, w, h);
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          scene?.remove(prep.pivot);
          renderer?.setSize(SIZE, SIZE, false);
          stageActive = Math.max(0, stageActive - 1);
        },
      };
    },
  };
  return api;
}
