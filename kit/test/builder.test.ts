import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { buildModel, buildParts } from '../src/builder';
import { triangleCount } from '../src/pieces';
import { SpecError } from '../src/spec';

const base = (parts: unknown[], footprint = { w: 40, d: 70 }) => ({ kitVersion: '1.0', footprint, parts });
const hall = (over: object = {}) => ({ type: 'hall', params: { w: 30, d: 60, h: 18 }, pos: [0, 0, 0], rot: 0, role: 'neutral', ...over });

function size(object: Object3D): Vector3 {
  return new Box3().setFromObject(object).getSize(new Vector3());
}

describe('buildModel', () => {
  it('assembles every part into one group', () => {
    const group = buildModel(base([hall(), { type: 'dome', params: { r: 9 }, pos: [0, 18, 10], role: 'accent' }]));

    expect(group.children).toHaveLength(2);
    expect(triangleCount(group)).toBeGreaterThan(0);
  });

  it('places parts at their position', () => {
    const group = buildModel(base([hall({ pos: [5, 2, -3] })]));
    const box = new Box3().setFromObject(group);

    expect(box.min.y).toBeCloseTo(2, 6);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(5, 6);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(-3, 6);
  });

  it('rotates parts around the vertical axis in degrees', () => {
    const turned = size(buildModel(base([hall({ rot: 90 })])));

    expect(turned.x).toBeCloseTo(60, 4);
    expect(turned.z).toBeCloseTo(30, 4);
  });

  it('throws a SpecError for invalid documents instead of building them', () => {
    expect(() => buildModel(base([{ type: 'hall', params: { w: -1, d: 1, h: 1 }, pos: [0, 0, 0], role: 'neutral' }]))).toThrow(SpecError);
  });

  it('uses one shared material for every mesh', () => {
    const group = buildModel(base([hall(), hall({ pos: [0, 18, 0] })]));
    const materials = new Set<unknown>();
    group.traverse((o) => {
      if ((o as Mesh).isMesh) materials.add((o as Mesh).material);
    });

    expect(materials.size).toBe(1);
  });
});

describe('buildParts', () => {
  it('reports the world bounds of each part in document order', () => {
    const { parts } = buildParts(base([hall(), hall({ pos: [0, 18, 0], params: { w: 10, d: 10, h: 5 } })]));

    expect(parts.map((p) => p.index)).toEqual([0, 1]);
    expect(parts[1]!.bounds.min.y).toBeCloseTo(18, 6);
    expect(parts[1]!.bounds.max.y).toBeCloseTo(23, 6);
  });
});
