export type Ring = Array<[number, number]>;

export type MultiPolygon = Ring[][];

export interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Even-odd point in polygon test. Each polygon is an outer ring followed by hole rings.
 */
export function pointInMultiPolygon(x: number, y: number, polygons: MultiPolygon): boolean {
  return polygons.some((rings) => {
    const [outer, ...holes] = rings;
    return outer !== undefined && inRing(x, y, outer) && !holes.some((hole) => inRing(x, y, hole));
  });
}

export function bboxOfRings(polygons: MultiPolygon): Bbox {
  const box: Bbox = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        box.minX = Math.min(box.minX, x);
        box.maxX = Math.max(box.maxX, x);
        box.minY = Math.min(box.minY, y);
        box.maxY = Math.max(box.maxY, y);
      }
    }
  }
  return box;
}

export interface Mask {
  bbox: Bbox;
  cols: number;
  rows: number;
  data: Uint8Array;
}

/**
 * Rasterizes polygons into a coverage mask by even-odd scanline fill, sampling each cell at its center.
 * Orders of magnitude faster than testing every cell against every ring.
 *
 * @throws {RangeError} When the raster has no cells.
 */
export function rasterizeMask(polygons: MultiPolygon, bbox: Bbox, cols: number, rows: number): Mask {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    throw new RangeError(`Mask needs at least one cell, received ${cols}x${rows}`);
  }
  const data = new Uint8Array(cols * rows);
  const cellW = (bbox.maxX - bbox.minX) / cols;
  const cellH = (bbox.maxY - bbox.minY) / rows;
  const rings = polygons.flat();
  for (let j = 0; j < rows; j++) {
    const y = bbox.minY + (j + 0.5) * cellH;
    const crossings: number[] = [];
    for (const ring of rings) {
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const [xa, ya] = ring[a] as [number, number];
        const [xb, yb] = ring[b] as [number, number];
        if (ya > y !== yb > y) {
          crossings.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
        }
      }
    }
    crossings.sort((p, q) => p - q);
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      const from = Math.max(0, Math.ceil((crossings[c]! - bbox.minX) / cellW - 0.5));
      const to = Math.min(cols - 1, Math.floor((crossings[c + 1]! - bbox.minX) / cellW - 0.5));
      for (let i = from; i <= to; i++) data[j * cols + i] = 1;
    }
  }
  return { bbox, cols, rows, data };
}

export function maskAt(mask: Mask, x: number, y: number): boolean {
  const { bbox, cols, rows } = mask;
  if (x < bbox.minX || x >= bbox.maxX || y < bbox.minY || y >= bbox.maxY) return false;
  const i = Math.floor(((x - bbox.minX) / (bbox.maxX - bbox.minX)) * cols);
  const j = Math.floor(((y - bbox.minY) / (bbox.maxY - bbox.minY)) * rows);
  return mask.data[j * cols + i] === 1;
}
