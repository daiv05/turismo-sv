import { describe, expect, it } from 'vitest';
import { createGrid } from '../src/heightfield';
import { buildTerrainMesh } from '../src/mesh';

const bounds = { minX: 0, maxX: 40, minZ: 0, maxZ: 40 };
const color = (): [number, number, number] => [0.5, 0.5, 0.5];

function triangleNormals(positions: Float32Array, indices: Uint32Array): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    const p = (k: number): [number, number, number] => [positions[k * 3]!, positions[k * 3 + 1]!, positions[k * 3 + 2]!];
    const [pa, pb, pc] = [p(a), p(b), p(c)];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    out.push([u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]);
  }
  return out;
}

describe('buildTerrainMesh', () => {
  it('covers a fully land grid with two triangles per cell plus skirts', () => {
    const grid = createGrid(bounds, 5, 5, () => 100);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: () => true, colorForHeight: color, skirtColor: [0, 0, 0] });
    const topTriangles = 4 * 4 * 2;
    const skirtTriangles = 4 * 4 * 2;
    expect(mesh.indices.length / 3).toBe(topTriangles + skirtTriangles);
  });

  it('faces every top triangle upwards', () => {
    const grid = createGrid(bounds, 5, 5, (x, z) => (x + z) * 0.1);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: () => true, colorForHeight: color, skirtColor: [0, 0, 0] });
    const up = triangleNormals(mesh.positions, mesh.indices).filter((n) => Math.abs(n[1]) > Math.abs(n[0]) && Math.abs(n[1]) > Math.abs(n[2]));
    expect(up.length).toBeGreaterThan(0);
    expect(up.every((n) => n[1] > 0)).toBe(true);
  });

  it('faces skirts away from the land', () => {
    const grid = createGrid(bounds, 3, 3, () => 100);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: () => true, colorForHeight: color, skirtColor: [0, 0, 0] });
    const sideways = triangleNormals(mesh.positions, mesh.indices).filter((n) => Math.abs(n[1]) < 1e-6);
    const outward = sideways.map((n) => ({ nx: Math.sign(n[0]), nz: Math.sign(n[2]) }));
    expect(outward.some((o) => o.nx === 1)).toBe(true);
    expect(outward.some((o) => o.nx === -1)).toBe(true);
    expect(outward.some((o) => o.nz === 1)).toBe(true);
    expect(outward.some((o) => o.nz === -1)).toBe(true);
  });

  it('omits cells that are not land', () => {
    const grid = createGrid(bounds, 5, 5, () => 100);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: (x) => x < 20, colorForHeight: color, skirtColor: [0, 0, 0] });
    const xs = Array.from({ length: mesh.positions.length / 3 }, (_, k) => mesh.positions[k * 3]!);
    expect(Math.max(...xs)).toBeLessThanOrEqual(20);
  });

  it('returns an empty mesh when nothing is land', () => {
    const grid = createGrid(bounds, 5, 5, () => 0);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: () => false, colorForHeight: color, skirtColor: [0, 0, 0] });
    expect(mesh.indices.length).toBe(0);
    expect(mesh.positions.length).toBe(0);
  });

  it('has one color per vertex and valid indices', () => {
    const grid = createGrid(bounds, 5, 5, (x) => x * 10);
    const mesh = buildTerrainMesh(grid, { skirtDepth: 20, isLand: () => true, colorForHeight: color, skirtColor: [0, 0, 0] });
    expect(mesh.colors.length).toBe(mesh.positions.length);
    const vertexCount = mesh.positions.length / 3;
    expect(Math.max(...mesh.indices)).toBeLessThan(vertexCount);
  });
});
