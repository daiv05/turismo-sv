import { ZOOM_LEVELS, type ZoomLevel } from './zoom';

export interface CellId {
  z: number;
  x: number;
  y: number;
}

export interface SceneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const CELL_SIZES: Readonly<Record<ZoomLevel, number>> = Object.freeze({
  country: 200_000,
  department: 50_000,
  city: 10_000,
  street: 2_500,
});

const MAX_CELLS = 400;

export function cellSize(level: ZoomLevel): number {
  return CELL_SIZES[level];
}

/**
 * Finds the fixed grid cell that contains a scene point. The cell's `y` index runs along the scene z axis.
 */
export function cellId(point: { x: number; z: number }, level: ZoomLevel): CellId {
  const size = CELL_SIZES[level];
  return { z: ZOOM_LEVELS.indexOf(level), x: Math.floor(point.x / size), y: Math.floor(point.z / size) };
}

export function cellBounds(id: CellId): SceneBounds {
  const size = CELL_SIZES[levelOf(id)];
  return { minX: id.x * size, maxX: (id.x + 1) * size, minZ: id.y * size, maxZ: (id.y + 1) * size };
}

/**
 * Lists the grid cells that intersect the given scene bounds.
 *
 * @throws {RangeError} When the bounds are inverted or would span more than the allowed number of cells.
 */
export function visibleCells(bounds: SceneBounds, level: ZoomLevel): CellId[] {
  if (bounds.minX > bounds.maxX || bounds.minZ > bounds.maxZ) {
    throw new RangeError('Bounds are inverted');
  }
  const first = cellId({ x: bounds.minX, z: bounds.minZ }, level);
  const last = cellId({ x: bounds.maxX, z: bounds.maxZ }, level);
  const count = (last.x - first.x + 1) * (last.y - first.y + 1);
  if (count > MAX_CELLS) {
    throw new RangeError(`Bounds span ${count} cells at level ${level}, the limit is ${MAX_CELLS}`);
  }
  const cells: CellId[] = [];
  for (let y = first.y; y <= last.y; y++) {
    for (let x = first.x; x <= last.x; x++) {
      cells.push({ z: first.z, x, y });
    }
  }
  return cells;
}

export function cellKey(id: CellId): string {
  return `${id.z}/${id.x}/${id.y}`;
}

/**
 * Parses the `{z}/{x}/{y}` form used by the places API.
 *
 * @throws {RangeError} When the key is malformed or its level index is unknown.
 */
export function parseCellKey(key: string): CellId {
  const parts = key.split('/').map(Number);
  const [z, x, y] = parts;
  if (parts.length !== 3 || !parts.every(Number.isInteger) || z === undefined || x === undefined || y === undefined) {
    throw new RangeError(`Malformed cell key: ${key}`);
  }
  if (z < 0 || z >= ZOOM_LEVELS.length) {
    throw new RangeError(`Unknown zoom level index in cell key: ${key}`);
  }
  return { z, x, y };
}

function levelOf(id: CellId): ZoomLevel {
  const level = ZOOM_LEVELS[id.z];
  if (level === undefined) {
    throw new RangeError(`Unknown zoom level index: ${id.z}`);
  }
  return level;
}
