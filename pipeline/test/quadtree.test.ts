import { describe, expect, it } from 'vitest';
import { buildQuadtree, tileKey, walkTiles } from '../src/quadtree';

const bounds = { minX: -1000, maxX: 1000, minZ: -500, maxZ: 500 };

describe('buildQuadtree', () => {
  it('creates the full tree with 4 children per inner tile', () => {
    const root = buildQuadtree(bounds, 3, 17);
    const tiles = [...walkTiles(root)];
    expect(tiles).toHaveLength(1 + 4 + 16);
    expect(tiles.filter((t) => t.level === 2).every((t) => t.children.length === 0)).toBe(true);
  });

  it('splits children so they partition the parent', () => {
    const root = buildQuadtree(bounds, 2, 17);
    const area = (b: typeof bounds): number => (b.maxX - b.minX) * (b.maxZ - b.minZ);
    expect(root.children.reduce((sum, c) => sum + area(c.bounds), 0)).toBeCloseTo(area(root.bounds), 6);
  });

  it('decreases geometric error with depth and reaches zero at the leaves', () => {
    const root = buildQuadtree(bounds, 4, 33);
    for (const tile of walkTiles(root)) {
      for (const child of tile.children) expect(child.geometricError).toBeLessThan(tile.geometricError);
      if (tile.children.length === 0) expect(tile.geometricError).toBe(0);
    }
  });

  it('derives inner error from the sample spacing', () => {
    const root = buildQuadtree({ minX: 0, maxX: 640, minZ: 0, maxZ: 320 }, 2, 65);
    expect(root.geometricError).toBeCloseTo(640 / 64, 6);
  });

  it('gives unique keys', () => {
    const root = buildQuadtree(bounds, 4, 17);
    const keys = [...walkTiles(root)].map(tileKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects invalid configurations', () => {
    expect(() => buildQuadtree(bounds, 0, 17)).toThrow(RangeError);
    expect(() => buildQuadtree(bounds, 3, 1)).toThrow(RangeError);
  });
});
