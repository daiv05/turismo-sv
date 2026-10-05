/**
 * Least recently used cache with a capacity, an eviction hook for releasing resources and an optional guard
 * that protects entries still in use.
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict?: (key: K, value: V) => void,
    private readonly isPinned?: (key: K, value: V) => boolean,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Capacity must be an integer of at least 1, received ${capacity}`);
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    const previous = this.map.get(key);
    if (previous !== undefined) {
      this.map.delete(key);
      this.onEvict?.(key, previous);
    }
    this.map.set(key, value);
    for (const [candidate, candidateValue] of this.map) {
      if (this.map.size <= this.capacity) break;
      if (candidate === key || this.isPinned?.(candidate, candidateValue)) continue;
      this.map.delete(candidate);
      this.onEvict?.(candidate, candidateValue);
    }
  }

  clear(): void {
    for (const [key, value] of this.map) this.onEvict?.(key, value);
    this.map.clear();
  }
}
