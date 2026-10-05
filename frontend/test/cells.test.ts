import { describe, expect, it } from 'vitest';
import { cellBounds, cellId, cellKey, cellSize, parseCellKey, visibleCells } from '../src/engine/cells';

describe('cellSize', () => {
  it('shrinks with each zoom level', () => {
    expect(cellSize('country')).toBeGreaterThan(cellSize('department'));
    expect(cellSize('department')).toBeGreaterThan(cellSize('city'));
    expect(cellSize('city')).toBeGreaterThan(cellSize('street'));
  });
});

describe('cellId and cellBounds', () => {
  it('assigns a point to the cell that contains it', () => {
    const id = cellId({ x: 1_200, z: -300 }, 'city');
    const b = cellBounds(id);
    expect(1_200).toBeGreaterThanOrEqual(b.minX);
    expect(1_200).toBeLessThan(b.maxX);
    expect(-300).toBeGreaterThanOrEqual(b.minZ);
    expect(-300).toBeLessThan(b.maxZ);
  });

  it('handles negative coordinates with floor semantics', () => {
    const id = cellId({ x: -1, z: -1 }, 'city');
    expect(id.x).toBe(-1);
    expect(id.y).toBe(-1);
  });
});

describe('visibleCells', () => {
  it('returns every cell intersecting the bounds', () => {
    const size = cellSize('city');
    const cells = visibleCells({ minX: 0, maxX: size * 2 - 1, minZ: 0, maxZ: size - 1 }, 'city');
    expect(cells.map(cellKey).sort()).toEqual(['2/0/0', '2/1/0']);
  });

  it('includes the neighbor when bounds straddle a cell edge', () => {
    const size = cellSize('city');
    const cells = visibleCells({ minX: size - 1, maxX: size + 1, minZ: 0, maxZ: 1 }, 'city');
    expect(cells).toHaveLength(2);
  });

  it('refuses to enumerate an absurd number of cells', () => {
    expect(() => visibleCells({ minX: -1e7, maxX: 1e7, minZ: -1e7, maxZ: 1e7 }, 'street')).toThrow(RangeError);
  });

  it('rejects inverted bounds', () => {
    expect(() => visibleCells({ minX: 5, maxX: 0, minZ: 0, maxZ: 1 }, 'city')).toThrow(RangeError);
  });
});

describe('cell keys', () => {
  it('round trips through the string form used by the API', () => {
    const id = cellId({ x: -5_000, z: 7_000 }, 'department');
    expect(parseCellKey(cellKey(id))).toEqual(id);
  });

  it('rejects malformed keys', () => {
    expect(() => parseCellKey('x/y')).toThrow(RangeError);
    expect(() => parseCellKey('9/0/0')).toThrow(RangeError);
  });
});
