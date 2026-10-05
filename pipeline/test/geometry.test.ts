import { describe, expect, it } from 'vitest';
import { bboxOfRings, maskAt, pointInMultiPolygon, rasterizeMask, type MultiPolygon } from '../src/geometry';

const square: MultiPolygon = [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]];
const donut: MultiPolygon = [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]]];

describe('pointInMultiPolygon', () => {
  it('detects points inside and outside', () => {
    expect(pointInMultiPolygon(5, 5, square)).toBe(true);
    expect(pointInMultiPolygon(15, 5, square)).toBe(false);
  });

  it('treats holes as outside', () => {
    expect(pointInMultiPolygon(5, 5, donut)).toBe(false);
    expect(pointInMultiPolygon(1, 1, donut)).toBe(true);
  });

  it('handles several polygons', () => {
    const two: MultiPolygon = [...square, [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]];
    expect(pointInMultiPolygon(25, 25, two)).toBe(true);
    expect(pointInMultiPolygon(15, 15, two)).toBe(false);
  });
});

describe('bboxOfRings', () => {
  it('returns the extent of all vertices', () => {
    expect(bboxOfRings(donut)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
  });
});

describe('rasterizeMask', () => {
  const box = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  it('agrees with the point in polygon test on cell centers', () => {
    const mask = rasterizeMask(donut, box, 20, 20);
    for (let j = 0; j < 20; j++) {
      for (let i = 0; i < 20; i++) {
        const x = box.minX + ((i + 0.5) * (box.maxX - box.minX)) / 20;
        const y = box.minY + ((j + 0.5) * (box.maxY - box.minY)) / 20;
        expect(mask.data[j * 20 + i] === 1).toBe(pointInMultiPolygon(x, y, donut));
      }
    }
  });

  it('looks up values by coordinate and treats outside as empty', () => {
    const mask = rasterizeMask(square, box, 10, 10);
    expect(maskAt(mask, 5, 5)).toBe(true);
    expect(maskAt(mask, 50, 5)).toBe(false);
    expect(maskAt(mask, -1, -1)).toBe(false);
  });

  it('rejects empty rasters', () => {
    expect(() => rasterizeMask(square, box, 0, 10)).toThrow(RangeError);
  });
});
