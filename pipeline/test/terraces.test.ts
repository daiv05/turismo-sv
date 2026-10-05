import { describe, expect, it } from 'vitest';
import { createGrid } from '../src/heightfield';
import { quantizeGrid, quantizeHeight, terraceStep } from '../src/terraces';

describe('terraceStep', () => {
  it('uses larger steps at coarser levels', () => {
    expect(terraceStep(0, 6)).toBeGreaterThan(terraceStep(5, 6));
  });

  it('rejects levels outside the quadtree', () => {
    expect(() => terraceStep(6, 6)).toThrow(RangeError);
    expect(() => terraceStep(-1, 6)).toThrow(RangeError);
  });
});

describe('quantizeHeight', () => {
  it('snaps heights to the nearest step', () => {
    expect(quantizeHeight(149, 100)).toBe(100);
    expect(quantizeHeight(151, 100)).toBe(200);
  });

  it('keeps zero and negative sea values at zero', () => {
    expect(quantizeHeight(-3, 100)).toBe(0);
  });

  it('rejects non positive steps', () => {
    expect(() => quantizeHeight(10, 0)).toThrow(RangeError);
  });
});

describe('quantizeGrid', () => {
  it('produces only multiples of the step', () => {
    const grid = createGrid({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, 5, 5, (x, z) => x * 37 + z * 11);
    const q = quantizeGrid(grid, 50);
    for (const h of q.data) expect(h % 50).toBe(0);
  });

  it('does not mutate the input', () => {
    const grid = createGrid({ minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, 3, 3, () => 123);
    quantizeGrid(grid, 50);
    expect(grid.data[0]).toBe(123);
  });
});
