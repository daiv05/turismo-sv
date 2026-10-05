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
