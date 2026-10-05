import { describe, expect, it } from 'vitest';
import { extrudeRoads, roadWidth, type Road } from '../src/roads';

const road = (kind: string, pts: Array<[number, number]>): Road => ({ id: 'r', kind, line: pts });
const straight: Array<[number, number]> = [[-89.2, 13.7], [-89.199, 13.7], [-89.198, 13.7]];

describe('roadWidth', () => {
  it('is wider for bigger road classes', () => {
    expect(roadWidth('motorway')).toBeGreaterThan(roadWidth('primary'));
    expect(roadWidth('primary')).toBeGreaterThan(roadWidth('residential'));
    expect(roadWidth('residential')).toBeGreaterThan(roadWidth('footway'));
  });

  it('has a default for unknown classes', () => {
    expect(roadWidth('mystery')).toBe(roadWidth('residential'));
  });
});

describe('extrudeRoads', () => {
  it('builds a ribbon of two triangles per segment', () => {
    const mesh = extrudeRoads([road('residential', straight)], { heightAt: () => 10 });

    expect(mesh.indices.length / 3).toBe(4);
    expect(mesh.positions.length / 3).toBe(6);
  });

  it('is as wide as the road class and lies a little above the terrain', () => {
    const mesh = extrudeRoads([road('primary', straight)], { heightAt: () => 10, lift: 0.4 });
    const edge = (i: number) => Math.hypot(mesh.positions[2 * i * 3]! - mesh.positions[(2 * i + 1) * 3]!, mesh.positions[2 * i * 3 + 2]! - mesh.positions[(2 * i + 1) * 3 + 2]!);
    const ys = new Set(Array.from({ length: mesh.positions.length / 3 }, (_, k) => mesh.positions[k * 3 + 1]!.toFixed(2)));

    for (let i = 0; i < 3; i++) expect(edge(i)).toBeCloseTo(roadWidth('primary'), 3);
    expect([...ys]).toEqual(['10.40']);
  });

  it('follows the terrain height along the road', () => {
    const mesh = extrudeRoads([road('residential', straight)], { heightAt: (x) => x * 0.01 });
    const ys = Array.from({ length: mesh.positions.length / 3 }, (_, k) => mesh.positions[k * 3 + 1]!);

    expect(new Set(ys.map((y) => y.toFixed(2))).size).toBeGreaterThan(1);
  });

  it('faces upward', () => {
    const mesh = extrudeRoads([road('residential', straight)], { heightAt: () => 0 });
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!];
      const p = (k: number) => [mesh.positions[k * 3]!, mesh.positions[k * 3 + 1]!, mesh.positions[k * 3 + 2]!];
      const [pa, pb, pc] = [p(a), p(b), p(c)];
      const ny = (pb[2]! - pa[2]!) * (pc[0]! - pa[0]!) - (pb[0]! - pa[0]!) * (pc[2]! - pa[2]!);
      expect(ny).toBeGreaterThan(0);
    }
  });

  it('ignores roads with fewer than two distinct points', () => {
    expect(extrudeRoads([road('residential', [[-89.2, 13.7]]), road('residential', [[-89.2, 13.7], [-89.2, 13.7]])], { heightAt: () => 0 }).indices.length).toBe(0);
  });

  it('colors the ribbon with the secondary palette role', () => {
    const mesh = extrudeRoads([road('residential', straight)], { heightAt: () => 0 });

    expect(new Set(Array.from(mesh.colors).map((v) => v.toFixed(3))).size).toBeLessThanOrEqual(3);
  });

  it('keeps the width through a bend instead of pinching', () => {
    const bend: Array<[number, number]> = [[-89.2, 13.7], [-89.199, 13.7], [-89.199, 13.701]];
    const mesh = extrudeRoads([road('residential', bend)], { heightAt: () => 0 });
    const n = mesh.positions.length / 3;
    const pair = (i: number) => Math.hypot(mesh.positions[(2 * i) * 3]! - mesh.positions[(2 * i + 1) * 3]!, mesh.positions[(2 * i) * 3 + 2]! - mesh.positions[(2 * i + 1) * 3 + 2]!);

    expect(n).toBe(6);
    for (let i = 0; i < 3; i++) expect(pair(i)).toBeGreaterThan(roadWidth('residential') * 0.9);
  });
});
