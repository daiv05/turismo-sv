import { lonLatToScene } from '@turismo/kit/geo';
import { PALETTE } from '@turismo/kit/palette';
import { hexToLinear } from './color';
import { bboxOfRings, pointInMultiPolygon, type MultiPolygon } from './geometry';
import type { TerrainMesh } from './mesh';
import type { TileNode } from './quadtree';

export interface Building {
  id: string;
  ring: Array<[number, number]>;
  levels?: number;
  kind?: string;
}

export interface Exclusion {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

const LEVEL_HEIGHT = 3;
const MAX_HEIGHT = 150;
const DEFAULT_HEIGHT = 8;
const KIND_HEIGHTS: Record<string, number> = { house: 6, church: 14, cathedral: 20, apartments: 18, commercial: 10, industrial: 9 };

/**
 * Height of a generic building in meters: three meters per level when known, otherwise a default for its kind.
 * Nonsense values from map data fall back to the default and anything taller than 150 m is capped.
 */
export function buildingHeight(building: { levels?: number; kind?: string }): number {
  if (building.levels !== undefined && building.levels > 0) return Math.min(MAX_HEIGHT, building.levels * LEVEL_HEIGHT);
  return (building.kind && KIND_HEIGHTS[building.kind]) || DEFAULT_HEIGHT;
}

/**
 * Whether any vertex of the building lies inside an exclusion footprint. Overlapping buildings are removed whole
 * so the model never ends up beside half a generic building.
 */
export function isExcluded(building: Building, exclusions: readonly Exclusion[]): boolean {
  if (exclusions.length === 0) return false;
  const polygons: MultiPolygon = exclusions.map((e) => e.coordinates);
  return building.ring.some(([lon, lat]) => pointInMultiPolygon(lon, lat, polygons));
}

export interface ExtrudeOptions {
  exclusions: readonly Exclusion[];
  heightAt: (x: number, z: number) => number;
}

/**
 * Extrudes footprints into walls and a flat roof in the neutral role, standing on the terrain.
 */
export function extrudeBuildings(buildings: readonly Building[], options: ExtrudeOptions): TerrainMesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = hexToLinear(PALETTE.neutral);
  const push = (x: number, y: number, z: number): number => {
    positions.push(x, y, z);
    colors.push(color[0], color[1], color[2]);
    return positions.length / 3 - 1;
  };

  for (const building of buildings) {
    const ring = building.ring.at(0)?.join() === building.ring.at(-1)?.join() ? building.ring.slice(0, -1) : building.ring;
    if (ring.length < 3 || isExcluded(building, options.exclusions)) continue;
    const points = ring.map(([lon, lat]) => lonLatToScene({ lon, lat }));
    const base = Math.min(...points.map((p) => options.heightAt(p.x, p.z)));
    const top = base + buildingHeight(building);

    const roof = points.map((p) => push(p.x, top, p.z));
    for (let i = 1; i < roof.length - 1; i++) indices.push(roof[0]!, roof[i + 1]!, roof[i]!);
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const [a0, b0, a1, b1] = [push(a.x, base, a.z), push(b.x, base, b.z), push(a.x, top, a.z), push(b.x, top, b.z)];
      indices.push(a0, a1, b0, b0, a1, b1);
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint32Array(indices) };
}

/**
 * Tiles, at every level, whose area intersects the bounding box of an exclusion footprint. These are the tiles
 * that change when a footprint is added.
 */
export function affectedTiles(root: TileNode, exclusions: readonly Exclusion[]): TileNode[] {
  const boxes = exclusions.map((e) => {
    const box = bboxOfRings([e.coordinates]);
    const a = lonLatToScene({ lon: box.minX, lat: box.minY });
    const b = lonLatToScene({ lon: box.maxX, lat: box.maxY });
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  });
  const hit = (node: TileNode): boolean =>
    boxes.some((b) => b.minX <= node.bounds.maxX && b.maxX >= node.bounds.minX && b.minZ <= node.bounds.maxZ && b.maxZ >= node.bounds.minZ);
  const found: TileNode[] = [];
  const visit = (node: TileNode): void => {
    if (!hit(node)) return;
    found.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}
