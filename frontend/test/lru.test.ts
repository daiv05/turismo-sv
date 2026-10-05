import { describe, expect, it, vi } from 'vitest';
import { LruCache } from '../src/engine/lru';

describe('LruCache', () => {
  it('stores and returns values', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('evicts the least recently used entry and reports it', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(onEvict).toHaveBeenCalledWith('b', 2);
  });

  it('replaces a value without evicting and reports the old one', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.set('a', 2);

    expect(cache.get('a')).toBe(2);
    expect(cache.size).toBe(1);
    expect(onEvict).toHaveBeenCalledWith('a', 1);
  });

  it('can protect entries that are in use from eviction', () => {
    const cache = new LruCache<string, number>(2, undefined, (key) => key === 'a');
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('clears everything, reporting each entry', () => {
    const onEvict = vi.fn();
    const cache = new LruCache<string, number>(3, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(onEvict).toHaveBeenCalledTimes(2);
  });

  it('rejects a capacity below one', () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
  });
});
