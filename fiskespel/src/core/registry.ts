import * as THREE from 'three';
import type { ModelBuildOptions, ModelFamily, ModelKind, ModelRegistry } from './types';

class Registry implements ModelRegistry {
  private families = new Map<ModelKind, ModelFamily[]>();

  register(kind: ModelKind, family: ModelFamily): void {
    const list = this.families.get(kind) ?? [];
    list.push(family);
    this.families.set(kind, list);
  }

  has(kind: ModelKind): boolean {
    return (this.families.get(kind)?.length ?? 0) > 0;
  }

  list(kind: ModelKind): string[] {
    const out: string[] = [];
    for (const f of this.families.get(kind) ?? []) out.push(...f.list());
    return out;
  }

  private find(kind: ModelKind, id: string): ModelFamily | undefined {
    return (this.families.get(kind) ?? []).find((f) => f.list().includes(id));
  }

  build(kind: ModelKind, id: string, opts: ModelBuildOptions = {}): THREE.Object3D {
    const fam = this.find(kind, id);
    if (!fam) {
      console.warn(`[registry] no ${kind} model "${id}", using placeholder`);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff00ff }),
      );
      m.name = `missing:${kind}:${id}`;
      return m;
    }
    const obj = fam.build(id, opts);
    obj.userData.modelKind = kind;
    obj.userData.modelId = id;
    return obj;
  }

  describe(kind: ModelKind, id: string): string {
    return this.find(kind, id)?.describe?.(id) ?? `${kind} ${id}`;
  }
}

/** The single shared registry. Model modules call registry.register(...) at import time. */
export const registry: ModelRegistry = new Registry();
