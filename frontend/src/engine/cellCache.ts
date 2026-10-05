export interface CellCacheOptions {
  ttlMs: number;
  maxCells: number;
  now?: () => number;
  onStale?: (key: string, error: unknown) => void;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * In memory cache of content cells with a short expiry. Concurrent requests for one cell share a single load,
 * the least recently used cells are evicted, and a failed refresh falls back to the stale copy.
 */
export class CellCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly inflight = new Map<string, Promise<V>>();
  private readonly now: () => number;

  constructor(
    private readonly load: (key: string) => Promise<V>,
    private readonly options: CellCacheOptions,
  ) {
    this.now = options.now ?? (() => Date.now());
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  clear(): void {
    this.entries.clear();
  }

  async get(key: string): Promise<V> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > this.now()) {
      this.touch(key, entry);
      return entry.value;
    }
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const request = this.load(key)
      .then((value) => {
        this.store(key, value);
        return value;
      })
      .catch((error: unknown) => {
        if (entry) {
          this.options.onStale?.(key, error);
          return entry.value;
        }
        throw error;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, request);
    return request;
  }

  private store(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.options.ttlMs });
    while (this.entries.size > this.options.maxCells) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  private touch(key: string, entry: Entry<V>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }
}
