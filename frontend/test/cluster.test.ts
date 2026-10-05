import { describe, expect, it } from 'vitest';
import { clusterPlaces } from '../src/engine/cluster';

const p = (slug: string, x: number, z: number, priority = 0) => ({ slug, x, z, priority });

describe('clusterPlaces', () => {
  it('groups places that fall in the same grid cell', () => {
    const clusters = clusterPlaces([p('a', 10, 10), p('b', 50, 60), p('c', 5_000, 5_000)], 1_000);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.count).sort()).toEqual([1, 2]);
  });

  it('places the cluster at the centroid of its members', () => {
    const [cluster] = clusterPlaces([p('a', 0, 0), p('b', 100, 200)], 1_000);

    expect(cluster).toMatchObject({ x: 50, z: 100, count: 2 });
  });

  it('keeps member slugs ordered by priority and names the most important one', () => {
    const [cluster] = clusterPlaces([p('low', 0, 0, 1), p('high', 10, 10, 9), p('mid', 20, 20, 5)], 1_000);

    expect(cluster?.slugs).toEqual(['high', 'mid', 'low']);
    expect(cluster?.leader).toBe('high');
  });

  it('is stable for negative coordinates', () => {
    const clusters = clusterPlaces([p('a', -1, -1), p('b', 1, 1)], 1_000);

    expect(clusters).toHaveLength(2);
  });

  it('returns nothing for no places and rejects non positive cell sizes', () => {
    expect(clusterPlaces([], 1_000)).toEqual([]);
    expect(() => clusterPlaces([p('a', 0, 0)], 0)).toThrow(RangeError);
  });
});
