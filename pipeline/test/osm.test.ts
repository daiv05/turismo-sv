import { describe, expect, it } from 'vitest';
import { parseOverpass } from '../src/osm';

const way = (id: number, tags: Record<string, string>, pts: Array<[number, number]>) => ({
  type: 'way',
  id,
  tags,
  geometry: pts.map(([lon, lat]) => ({ lon, lat })),
});

const closed: Array<[number, number]> = [[-89.2, 13.7], [-89.1998, 13.7], [-89.1998, 13.7002], [-89.2, 13.7002], [-89.2, 13.7]];

describe('parseOverpass', () => {
  it('extracts buildings with their levels and kind', () => {
    const { buildings } = parseOverpass({ elements: [way(1, { building: 'church', 'building:levels': '2' }, closed), way(2, { building: 'yes' }, closed)] });

    expect(buildings).toEqual([
      { id: 'way/1', ring: closed, levels: 2, kind: 'church' },
      { id: 'way/2', ring: closed },
    ]);
  });

  it('extracts roads by class, ignoring paths that are not drivable or walkable ways', () => {
    const line: Array<[number, number]> = [[-89.2, 13.7], [-89.19, 13.7]];
    const { roads } = parseOverpass({ elements: [way(3, { highway: 'residential', name: 'Calle A' }, line), way(4, { highway: 'footway' }, line), way(5, { highway: 'proposed' }, line), way(6, { highway: 'construction' }, line)] });

    expect(roads.map((r) => [r.id, r.kind])).toEqual([['way/3', 'residential'], ['way/4', 'footway']]);
  });

  it('skips elements without geometry, relations, nodes and malformed entries', () => {
    const { buildings, roads } = parseOverpass({
      elements: [
        { type: 'node', id: 9, lat: 1, lon: 1 },
        { type: 'relation', id: 8, tags: { building: 'yes' } },
        { type: 'way', id: 7, tags: { building: 'yes' } },
        way(6, { building: 'yes' }, [[-89.2, 13.7], [-89.1, 13.7]]),
        { type: 'way', id: 5, tags: { highway: 'residential' }, geometry: [{ lon: 'x', lat: 1 }] },
        null as never,
      ],
    });

    expect(buildings).toEqual([]);
    expect(roads).toEqual([]);
  });

  it('closes building rings that arrive open and ignores bad level values', () => {
    const open = closed.slice(0, 4);
    const { buildings } = parseOverpass({ elements: [way(1, { building: 'yes', 'building:levels': 'many' }, open)] });

    expect(buildings[0]!.ring.at(-1)).toEqual(buildings[0]!.ring[0]);
    expect(buildings[0]).not.toHaveProperty('levels');
  });

  it('accepts an empty or missing element list', () => {
    expect(parseOverpass({})).toEqual({ buildings: [], roads: [] });
    expect(parseOverpass({ elements: [] })).toEqual({ buildings: [], roads: [] });
  });
});
