import type { HeightGrid } from './heightfield';

const COARSEST_STEP_METERS = 400;
const FINEST_STEP_METERS = 15;

/**
 * Terrace height for a quadtree level: large steps at country scale and small ones at street scale,
 * interpolated geometrically between the two.
 *
 * @param level Quadtree level, 0 being the root.
 * @param levels Total number of levels.
 * @throws {RangeError} When the level is outside the tree.
 */
export function terraceStep(level: number, levels: number): number {
  if (!Number.isInteger(level) || level < 0 || level >= levels) {
    throw new RangeError(`Level ${level} is outside a tree of ${levels} levels`);
  }
  if (levels === 1) return COARSEST_STEP_METERS;
  const t = level / (levels - 1);
  return COARSEST_STEP_METERS * Math.pow(FINEST_STEP_METERS / COARSEST_STEP_METERS, t);
}

/**
 * Snaps an elevation to the nearest terrace. Anything at or below sea level stays at zero.
 *
 * @throws {RangeError} When the step is not positive.
 */
export function quantizeHeight(height: number, step: number): number {
  if (!(step > 0)) {
    throw new RangeError(`Terrace step must be positive, received ${step}`);
  }
  if (height <= 0) return 0;
  return Math.round(height / step) * step;
}

export function quantizeGrid(grid: HeightGrid, step: number): HeightGrid {
  const data = new Float32Array(grid.data.length);
  for (let k = 0; k < data.length; k++) {
    data[k] = quantizeHeight(grid.data[k] ?? 0, step);
  }
  return { ...grid, data };
}
