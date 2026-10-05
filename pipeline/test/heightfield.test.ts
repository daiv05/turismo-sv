import { describe, expect, it } from 'vitest';
import { createGrid, gridPosition, heightAtGrid, sampleGrid } from '../src/heightfield';

const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 50 };

describe('createGrid', () => {
  it('samples a height function at every vertex', () => {
    const grid = createGrid(bounds, 5, 3, (x, z) => x + z);
    expect(grid.cols).toBe(5);
    expect(grid.rows).toBe(3);
    expect(grid.data[0]).toBe(0);
    expect(grid.data[4]).toBe(100);
    expect(grid.data[2 * 5 + 4]).toBe(150);
  });

  it('rejects grids with fewer than two vertices per side', () => {
    expect(() => createGrid(bounds, 1, 3, () => 0)).toThrow(RangeError);
  });

  it('rejects degenerate bounds', () => {
    expect(() => createGrid({ minX: 0, maxX: 0, minZ: 0, maxZ: 1 }, 3, 3, () => 0)).toThrow(RangeError);
  });
});

describe('gridPosition', () => {
  it('maps vertex indices to scene coordinates', () => {
    const grid = createGrid(bounds, 5, 3, () => 0);
    expect(gridPosition(grid, 4, 2)).toEqual({ x: 100, z: 50 });
    expect(gridPosition(grid, 1, 1)).toEqual({ x: 25, z: 25 });
  });
});

describe('heightAtGrid', () => {
  it('interpolates bilinearly between vertices', () => {
    const grid = createGrid(bounds, 5, 3, (x, z) => x + z);
    expect(heightAtGrid(grid, 12.5, 12.5)).toBeCloseTo(25, 6);
  });

  it('clamps to the border outside the grid', () => {
    const grid = createGrid(bounds, 5, 3, (x) => x);
    expect(heightAtGrid(grid, -500, 10)).toBe(0);
    expect(heightAtGrid(grid, 500, 10)).toBe(100);
  });
});

describe('sampleGrid', () => {
  it('resamples a sub window at a different resolution', () => {
    const grid = createGrid(bounds, 5, 3, (x, z) => x + z);
    const window = sampleGrid(grid, { minX: 0, maxX: 50, minZ: 0, maxZ: 50 }, 3, 3);
    expect(window.data[0]).toBe(0);
    expect(window.data[8]).toBeCloseTo(100, 6);
  });
});
