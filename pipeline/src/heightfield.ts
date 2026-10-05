export interface SceneRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Regular grid of elevations in scene meters. Vertex (i, j) sits at x = minX + i * dx and z = minZ + j * dz,
 * with the vertices of a row stored consecutively.
 */
export interface HeightGrid {
  bounds: SceneRect;
  cols: number;
  rows: number;
  data: Float32Array;
}

function assertGridShape(bounds: SceneRect, cols: number, rows: number): void {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2) {
    throw new RangeError(`Grid needs at least 2x2 vertices, received ${cols}x${rows}`);
  }
  if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) {
    throw new RangeError('Grid bounds must have positive width and depth');
  }
}

/**
 * Creates a grid by sampling an elevation function at every vertex.
 *
 * @throws {RangeError} When the shape has fewer than 2x2 vertices or the bounds are degenerate.
 */
export function createGrid(bounds: SceneRect, cols: number, rows: number, heightAt: (x: number, z: number) => number): HeightGrid {
  assertGridShape(bounds, cols, rows);
  const grid: HeightGrid = { bounds, cols, rows, data: new Float32Array(cols * rows) };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const { x, z } = gridPosition(grid, i, j);
      grid.data[j * cols + i] = heightAt(x, z);
    }
  }
  return grid;
}

export function gridPosition(grid: HeightGrid, i: number, j: number): { x: number; z: number } {
  const { minX, maxX, minZ, maxZ } = grid.bounds;
  return {
    x: minX + (i * (maxX - minX)) / (grid.cols - 1),
    z: minZ + (j * (maxZ - minZ)) / (grid.rows - 1),
  };
}

/**
 * Bilinear elevation lookup. Points outside the grid take the value of the nearest border.
 */
export function heightAtGrid(grid: HeightGrid, x: number, z: number): number {
  const { minX, maxX, minZ, maxZ } = grid.bounds;
  const fx = Math.min(grid.cols - 1, Math.max(0, ((x - minX) / (maxX - minX)) * (grid.cols - 1)));
  const fz = Math.min(grid.rows - 1, Math.max(0, ((z - minZ) / (maxZ - minZ)) * (grid.rows - 1)));
  const i0 = Math.min(grid.cols - 2, Math.floor(fx));
  const j0 = Math.min(grid.rows - 2, Math.floor(fz));
  const tx = fx - i0;
  const tz = fz - j0;
  const at = (i: number, j: number): number => grid.data[j * grid.cols + i] ?? 0;
  const top = at(i0, j0) * (1 - tx) + at(i0 + 1, j0) * tx;
  const bottom = at(i0, j0 + 1) * (1 - tx) + at(i0 + 1, j0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

/**
 * Resamples a window of a grid at a new resolution.
 */
export function sampleGrid(source: HeightGrid, window: SceneRect, cols: number, rows: number): HeightGrid {
  return createGrid(window, cols, rows, (x, z) => heightAtGrid(source, x, z));
}
