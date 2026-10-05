import { gridPosition, type HeightGrid } from './heightfield';

export type Rgb = [number, number, number];

export interface TerrainMesh {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface MeshOptions {
  skirtDepth: number;
  isLand: (x: number, z: number) => boolean;
  colorForHeight: (height: number) => Rgb;
  skirtColor: Rgb;
  heightScale?: number;
}

/**
 * Builds the terrain surface for the cells whose center is land, plus vertical walls down to
 * `-skirtDepth` along every edge that borders the sea or the end of the grid. Positions use scene
 * coordinates with y up, colors are linear RGB per vertex. `heightScale` exaggerates relief in the positions
 * only, so colors still follow the real elevation.
 */
export function buildTerrainMesh(grid: HeightGrid, options: MeshOptions): TerrainMesh {
  const { cols, rows } = grid;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const topIndex = new Map<number, number>();
  const scale = options.heightScale ?? 1;

  const included = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= cols - 1 || j >= rows - 1) return false;
    const a = gridPosition(grid, i, j);
    const b = gridPosition(grid, i + 1, j + 1);
    return options.isLand((a.x + b.x) / 2, (a.z + b.z) / 2);
  };

  const pushVertex = (x: number, y: number, z: number, color: Rgb): number => {
    positions.push(x, y, z);
    colors.push(color[0], color[1], color[2]);
    return positions.length / 3 - 1;
  };

  const top = (i: number, j: number): number => {
    const key = j * cols + i;
    const existing = topIndex.get(key);
    if (existing !== undefined) return existing;
    const { x, z } = gridPosition(grid, i, j);
    const h = grid.data[key] ?? 0;
    const index = pushVertex(x, h * scale, z, options.colorForHeight(h));
    topIndex.set(key, index);
    return index;
  };

  const pushOriented = (a: number, b: number, c: number, outward: [number, number, number]): void => {
    const p = (k: number): [number, number, number] => [positions[k * 3]!, positions[k * 3 + 1]!, positions[k * 3 + 2]!];
    const [pa, pb, pc] = [p(a), p(b), p(c)];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const facing = n[0]! * outward[0] + n[1]! * outward[1] + n[2]! * outward[2];
    if (facing >= 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  };

  const skirt = (i0: number, j0: number, i1: number, j1: number, outward: [number, number, number]): void => {
    const h0 = grid.data[j0 * cols + i0] ?? 0;
    const h1 = grid.data[j1 * cols + i1] ?? 0;
    const p0 = gridPosition(grid, i0, j0);
    const p1 = gridPosition(grid, i1, j1);
    const a = pushVertex(p0.x, h0 * scale, p0.z, options.skirtColor);
    const b = pushVertex(p1.x, h1 * scale, p1.z, options.skirtColor);
    const c = pushVertex(p0.x, -options.skirtDepth, p0.z, options.skirtColor);
    const d = pushVertex(p1.x, -options.skirtDepth, p1.z, options.skirtColor);
    pushOriented(a, c, b, outward);
    pushOriented(b, c, d, outward);
  };

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      if (!included(i, j)) continue;
      indices.push(top(i, j), top(i, j + 1), top(i + 1, j));
      indices.push(top(i + 1, j), top(i, j + 1), top(i + 1, j + 1));
      if (!included(i - 1, j)) skirt(i, j, i, j + 1, [-1, 0, 0]);
      if (!included(i + 1, j)) skirt(i + 1, j, i + 1, j + 1, [1, 0, 0]);
      if (!included(i, j - 1)) skirt(i, j, i + 1, j, [0, 0, -1]);
      if (!included(i, j + 1)) skirt(i, j + 1, i + 1, j + 1, [0, 0, 1]);
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint32Array(indices) };
}

/**
 * Appends meshes to a base mesh, shifting indices so every part keeps its own vertices.
 */
export function concatMeshes(base: TerrainMesh, extras: readonly TerrainMesh[]): TerrainMesh {
  const parts = [base, ...extras.filter((m) => m.indices.length > 0)];
  if (parts.length === 1) return base;
  const positions = new Float32Array(parts.reduce((n, m) => n + m.positions.length, 0));
  const colors = new Float32Array(positions.length);
  const indices = new Uint32Array(parts.reduce((n, m) => n + m.indices.length, 0));
  let vertexOffset = 0;
  let floatOffset = 0;
  let indexOffset = 0;
  for (const part of parts) {
    positions.set(part.positions, floatOffset);
    colors.set(part.colors, floatOffset);
    indices.set(part.indices.map((i) => i + vertexOffset), indexOffset);
    vertexOffset += part.positions.length / 3;
    floatOffset += part.positions.length;
    indexOffset += part.indices.length;
  }
  return { positions, colors, indices };
}
