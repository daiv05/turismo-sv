import { describe, expect, it } from 'vitest';
import { bboxOfRings, pointInMultiPolygon, type MultiPolygon } from '../src/geometry';

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
