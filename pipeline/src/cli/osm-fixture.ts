import { readFile } from 'node:fs/promises';
import type { Building, Exclusion } from '../buildings';

interface Feature {
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
}

/**
 * Reads generic buildings from a GeoJSON FeatureCollection of polygons, the same shape an OSM extract produces once
 * converted. It stands in for the OSM source until the extract can be downloaded.
 */
export async function loadBuildings(path: string): Promise<Building[]> {
  const collection = JSON.parse(await readFile(path, 'utf8')) as { features: Feature[] };
  return collection.features.flatMap((f, i): Building[] => {
    if (f.geometry?.type !== 'Polygon') return [];
    const ring = (f.geometry.coordinates as Array<Array<[number, number]>>)[0];
    if (!ring) return [];
    const levels = Number(f.properties?.['building:levels']);
    return [{ id: String(f.properties?.id ?? i), ring, ...(Number.isFinite(levels) ? { levels } : {}), ...(typeof f.properties?.building === 'string' ? { kind: f.properties.building } : {}) }];
  });
}

/**
 * Reads the footprints of sites with an approved model, as exported by `php artisan tilesets:exclusions`.
 */
export async function loadExclusions(path: string): Promise<Exclusion[]> {
  const collection = JSON.parse(await readFile(path, 'utf8')) as { features: Feature[] };
  return collection.features.flatMap((f) => (f.geometry?.type === 'Polygon' ? [{ type: 'Polygon' as const, coordinates: f.geometry.coordinates as Array<Array<[number, number]>> }] : []));
}
