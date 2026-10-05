import { describe, expect, it, vi } from 'vitest';
import { CellCache } from '../src/engine/cellCache';

describe('CellCache', () => {
  it('loads a cell once and serves it from memory afterwards', async () => {
    const load = vi.fn().mockResolvedValue(['a']);
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10 });

    expect(await cache.get('2/0/0')).toEqual(['a']);
    expect(await cache.get('2/0/0')).toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    let resolve!: (v: string[]) => void;
    const load = vi.fn().mockReturnValue(new Promise<string[]>((r) => (resolve = r)));
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10 });

    const both = Promise.all([cache.get('k'), cache.get('k')]);
    resolve(['x']);

    expect(await both).toEqual([['x'], ['x']]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads after the entry expires', async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValue(['a']);
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10, now: () => now });

    await cache.get('k');
    now = 1001;
    await cache.get('k');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('serves stale data when a refresh fails', async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValueOnce(['old']).mockRejectedValueOnce(new Error('offline'));
    const onStale = vi.fn();
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10, now: () => now, onStale });

    await cache.get('k');
    now = 5000;

    expect(await cache.get('k')).toEqual(['old']);
    expect(onStale).toHaveBeenCalledWith('k', expect.any(Error));
  });

  it('rejects when nothing is cached and the load fails, and retries next time', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(['ok']);
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10 });

    await expect(cache.get('k')).rejects.toThrow('boom');
    expect(await cache.get('k')).toEqual(['ok']);
  });

  it('evicts the least recently used cell beyond the limit', async () => {
    const load = vi.fn(async (key: string) => [key]);
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 2 });

    await cache.get('a');
    await cache.get('b');
    await cache.get('a');
    await cache.get('c');

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('can drop everything, for example when filters change', async () => {
    const load = vi.fn().mockResolvedValue(['a']);
    const cache = new CellCache<string[]>(load, { ttlMs: 1000, maxCells: 10 });
    await cache.get('k');

    cache.clear();
    await cache.get('k');

    expect(load).toHaveBeenCalledTimes(2);
  });
});
