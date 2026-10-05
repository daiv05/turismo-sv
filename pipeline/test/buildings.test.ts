import { describe, expect, it } from 'vitest';
import { affectedTiles, buildingHeight, extrudeBuildings, isExcluded, type Building } from '../src/buildings';
import { buildQuadtree } from '../src/quadtree';
import { lonLatToScene } from '@turismo/kit/geo';

const square = (lon: number, lat: number, size = 0.0002): Array<[number, number]> => [
  [lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat],
];
const building = (id: string, lon: number, lat: number, extra: Partial<Building> = {}): Building => ({ id, ring: square(lon, lat), ...extra });
const exclusion = { type: 'Polygon' as const, coordinates: [square(-89.1916, 13.6987, 0.0012)] };

describe('buildingHeight', () => {
  it('uses three meters per level when known and a default per kind otherwise', () => {
    expect(buildingHeight({ levels: 4 })).toBe(12);
    expect(buildingHeight({ kind: 'house' })).toBe(6);
    expect(buildingHeight({ kind: 'church' })).toBe(14);
    expect(buildingHeight({})).toBe(8);
  });

  it('caps absurd values from bad data', () => {
    expect(buildingHeight({ levels: 500 })).toBe(150);
    expect(buildingHeight({ levels: -3 })).toBe(8);
  });
});

describe('isExcluded', () => {
  it('detects buildings inside any exclusion footprint', () => {
    expect(isExcluded(building('in', -89.1913, 13.699), [exclusion])).toBe(true);
    expect(isExcluded(building('out', -89.30, 13.60), [exclusion])).toBe(false);
  });

  it('treats a building that only overlaps the footprint as excluded, so no half buildings remain', () => {
    expect(isExcluded(building('edge', -89.1905, 13.6993, { ring: square(-89.1906, 13.6993) }), [exclusion])).toBe(true);
  });

  it('is false without exclusions', () => {
    expect(isExcluded(building('a', -89.1913, 13.699), [])).toBe(false);
  });
});

describe('extrudeBuildings', () => {
  it('builds walls and a roof for each building', () => {
    const mesh = extrudeBuildings([building('a', -89.2, 13.7, { levels: 2 })], { exclusions: [], heightAt: () => 100 });

    expect(mesh.indices.length / 3).toBe(10);
    const ys = Array.from({ length: mesh.positions.length / 3 }, (_, k) => mesh.positions[k * 3 + 1]!);
    expect(Math.min(...ys)).toBeCloseTo(100, 3);
    expect(Math.max(...ys)).toBeCloseTo(106, 3);
  });

  it('omits excluded buildings and keeps the rest', () => {
    const inside = building('in', -89.1913, 13.699);
    const outside = building('out', -89.20, 13.70);
    const withBoth = extrudeBuildings([inside, outside], { exclusions: [exclusion], heightAt: () => 0 });
    const onlyOutside = extrudeBuildings([outside], { exclusions: [], heightAt: () => 0 });

    expect(withBoth.indices.length).toBe(onlyOutside.indices.length);
    expect(withBoth.positions.length).toBe(onlyOutside.positions.length);
  });

  it('returns an empty mesh for no buildings and ignores degenerate rings', () => {
    expect(extrudeBuildings([], { exclusions: [], heightAt: () => 0 }).indices.length).toBe(0);
    expect(extrudeBuildings([{ id: 'x', ring: [[-89.2, 13.7], [-89.2, 13.7]] }], { exclusions: [], heightAt: () => 0 }).indices.length).toBe(0);
  });

  it('colors every vertex with the neutral palette role', () => {
    const mesh = extrudeBuildings([building('a', -89.2, 13.7)], { exclusions: [], heightAt: () => 0 });

    expect(mesh.colors.length).toBe(mesh.positions.length);
    expect(new Set(Array.from(mesh.colors).map((v) => v.toFixed(3))).size).toBeLessThanOrEqual(3);
  });
});

describe('affectedTiles', () => {
  const a = lonLatToScene({ lon: -89.1916, lat: 13.6987 });
  const root = buildQuadtree({ minX: a.x - 30_000, maxX: a.x + 10_000, minZ: a.z - 30_000, maxZ: a.z + 10_000 }, 3, 9);

  it('lists the tiles whose area the footprint touches, at every level', () => {
    const keys = affectedTiles(root, [exclusion]).map((t) => `${t.level}`);

    expect(keys.filter((k) => k === '0')).toHaveLength(1);
    expect(keys.filter((k) => k === '1')).toHaveLength(1);
    expect(keys.filter((k) => k === '2').length).toBeGreaterThanOrEqual(1);
    expect(keys.filter((k) => k === '2').length).toBeLessThan(16);
  });

  it('is empty when the footprint is far away', () => {
    const far = { type: 'Polygon' as const, coordinates: [square(-88.0, 13.6, 0.001)] };

    expect(affectedTiles(root, [far])).toEqual([]);
  });
});
