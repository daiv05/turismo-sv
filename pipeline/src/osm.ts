import type { Building } from './buildings';
import type { Road } from './roads';

interface Element {
  type?: unknown;
  id?: unknown;
  tags?: Record<string, string>;
  geometry?: Array<{ lon?: unknown; lat?: unknown }>;
}

const ROAD_KINDS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'pedestrian', 'footway', 'path', 'cycleway', 'steps', 'track']);

function points(geometry: Element['geometry']): Array<[number, number]> | null {
  if (!Array.isArray(geometry)) return null;
  const out: Array<[number, number]> = [];
  for (const p of geometry) {
    if (typeof p?.lon !== 'number' || typeof p?.lat !== 'number' || !Number.isFinite(p.lon) || !Number.isFinite(p.lat)) return null;
    out.push([p.lon, p.lat]);
  }
  return out;
}

/**
 * Turns an Overpass API answer (`out geom`) into generic buildings and roads. Elements that are not ways with
 * usable geometry, and malformed entries, are skipped rather than failing the whole extract.
 */
export function parseOverpass(data: { elements?: unknown }): { buildings: Building[]; roads: Road[] } {
  const buildings: Building[] = [];
  const roads: Road[] = [];
  for (const element of (Array.isArray(data.elements) ? data.elements : []) as Array<Element | null>) {
    if (!element || element.type !== 'way' || !element.tags) continue;
    const line = points(element.geometry);
    if (!line) continue;
    const id = `way/${String(element.id)}`;

    if (element.tags.building && line.length >= 3) {
      const ring = line.at(0)!.join() === line.at(-1)!.join() ? line : [...line, line[0]!];
      const levels = Number(element.tags['building:levels']);
      buildings.push({
        id,
        ring,
        ...(Number.isFinite(levels) && levels > 0 ? { levels } : {}),
        ...(element.tags.building !== 'yes' ? { kind: element.tags.building } : {}),
      });
    } else if (element.tags.highway && ROAD_KINDS.has(element.tags.highway) && line.length >= 2) {
      roads.push({ id, kind: element.tags.highway, line });
    }
  }
  return { buildings, roads };
}
