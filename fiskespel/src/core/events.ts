/** Tiny typed event bus. */
export class EventBus<M extends { [K in keyof M]: unknown }> {
  private map = new Map<keyof M, Set<(p: never) => void>>();

  on<K extends keyof M>(type: K, fn: (payload: M[K]) => void): () => void {
    let set = this.map.get(type);
    if (!set) {
      set = new Set();
      this.map.set(type, set);
    }
    set.add(fn as (p: never) => void);
    return () => this.off(type, fn);
  }

  once<K extends keyof M>(type: K, fn: (payload: M[K]) => void): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof M>(type: K, fn: (payload: M[K]) => void): void {
    this.map.get(type)?.delete(fn as (p: never) => void);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as (p: M[K]) => void)(payload);
      } catch (err) {
        console.error(`[events] handler for ${String(type)} failed`, err);
      }
    }
  }
}
