import { describe, expect, it } from 'vitest';
import { buildTileTree } from '../src/build';
import { terrainColor, hexToLinear } from '../src/color';
import type { Tileset, TilesetTile } from '../src/tileset';

const bounds = { minX: -800, maxX: 800, minZ: -400, maxZ: 400 };
const island = (x: number, z: number): number => Math.max(0, 250 - Math.hypot(x / 2, z));
const isLand = (x: number, z: number): boolean => island(x, z) > 0;

async function run(levels: number, samples: number) {
  const files = new Map<string, Uint8Array | string>();
  const result = await buildTileTree({
    bounds,
    levels,
    samples,
    heightAt: island,
    isLand,
    compress: false,
    write: async (path, data) => void files.set(path, data),
  });
  return { files, result };
}

function collect(tile: TilesetTile, out: TilesetTile[] = []): TilesetTile[] {
  out.push(tile);
  tile.children?.forEach((c) => collect(c, out));
  return out;
}

describe('buildTileTree', () => {
  it('writes the tileset and one glb per tile with land', async () => {
    const { files, result } = await run(3, 9);
    const tileset = JSON.parse(files.get('tileset.json') as string) as Tileset;
    const uris = collect(tileset.root).flatMap((t) => (t.content ? [t.content.uri] : []));
    expect(uris.length).toBeGreaterThan(0);
    for (const uri of uris) expect(files.has(uri)).toBe(true);
    expect(result.tileCount).toBe(uris.length);
  });

  it('prunes tiles that only contain ocean', async () => {
    const { files } = await run(4, 9);
    const tileset = JSON.parse(files.get('tileset.json') as string) as Tileset;
    const total = collect(tileset.root).length;
    expect(total).toBeLessThan(1 + 4 + 16 + 64);
  });

  it('keeps the root even when it has land', async () => {
    const { files } = await run(2, 9);
    const tileset = JSON.parse(files.get('tileset.json') as string) as Tileset;
    expect(tileset.root.content?.uri).toBe('tiles/0_0_0.glb');
  });

  it('refines with lower error towards the leaves', async () => {
    const { files } = await run(3, 9);
    const tileset = JSON.parse(files.get('tileset.json') as string) as Tileset;
    for (const tile of collect(tileset.root)) {
      for (const child of tile.children ?? []) expect(child.geometricError).toBeLessThan(tile.geometricError);
    }
  });

  it('fails clearly when there is no land at all', async () => {
    await expect(
      buildTileTree({ bounds, levels: 2, samples: 5, heightAt: () => 0, isLand: () => false, compress: false, write: async () => {} }),
    ).rejects.toThrow(RangeError);
  });
});

describe('terrainColor', () => {
  it('uses vegetation near sea level and secondary on high ground', () => {
    expect(terrainColor(50)).toEqual(hexToLinear('#6FCB8F'));
    expect(terrainColor(2000)).toEqual(hexToLinear('#C7CDF0'));
  });

  it('converts sRGB hex to linear values in range', () => {
    const [r, g, b] = hexToLinear('#FFFFFF');
    expect([r, g, b]).toEqual([1, 1, 1]);
    const [dr] = hexToLinear('#808080');
    expect(dr).toBeGreaterThan(0.2);
    expect(dr).toBeLessThan(0.25);
  });

  it('rejects malformed hex values', () => {
    expect(() => hexToLinear('red')).toThrow(RangeError);
  });
});

describe('buildings and exclusions in tiles', () => {
  const bounds2 = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
  const base = { bounds: bounds2, levels: 3, samples: 9, heightAt: () => 50, isLand: () => true, compress: false };
  const ring = (lon: number, lat: number): Array<[number, number]> => [[lon, lat], [lon + 0.0002, lat], [lon + 0.0002, lat + 0.0002], [lon, lat + 0.0002], [lon, lat]];
  const buildings = [
    { id: 'in', ring: ring(-88.9, 13.75), levels: 3 },
    { id: 'far', ring: ring(-88.895, 13.745), levels: 3 },
  ];

  async function sizes(extra: object) {
    const files = new Map<string, Uint8Array | string>();
    await buildTileTree({ ...base, ...extra, write: async (path: string, data: Uint8Array | string) => void files.set(path, data) } as never);
    return { files, leaf: (files.get('tiles/2_1_1.glb') as Uint8Array | undefined)?.byteLength ?? 0, all: [...files.entries()].filter(([k]) => k.endsWith('.glb')).reduce((n, [, v]) => n + (v as Uint8Array).byteLength, 0) };
  }

  it('adds generic buildings to tiles from the configured level on', async () => {
    const without = await sizes({});
    const withBuildings = await sizes({ buildings: () => buildings, buildingsFromLevel: 2 });

    expect(withBuildings.all).toBeGreaterThan(without.all);
  });

  it('does not add buildings to coarse tiles', async () => {
    const coarse = await sizes({ buildings: () => buildings, buildingsFromLevel: 3 });
    const without = await sizes({});

    expect(coarse.all).toBe(without.all);
  });

  it('leaves out the buildings that fall inside an exclusion footprint', async () => {
    const exclusion = { type: 'Polygon' as const, coordinates: [[[-88.9005, 13.7495], [-88.8995, 13.7495], [-88.8995, 13.7505], [-88.9005, 13.7505], [-88.9005, 13.7495]]] as Array<[number, number]>[] };
    const all = await sizes({ buildings: () => buildings, buildingsFromLevel: 2 });
    const excluded = await sizes({ buildings: () => buildings, buildingsFromLevel: 2, exclusions: [exclusion] });
    const none = await sizes({});

    expect(excluded.all).toBeLessThan(all.all);
    expect(excluded.all).toBeGreaterThan(none.all);
  });
});

describe('roads in tiles', () => {
  const base = { bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 }, levels: 3, samples: 9, heightAt: () => 50, isLand: () => true, compress: false };
  const roads = [{ id: 'r', kind: 'primary', line: [[-88.905, 13.75], [-88.895, 13.75]] as Array<[number, number]> }];

  async function total(extra: object): Promise<number> {
    const files = new Map<string, Uint8Array | string>();
    await buildTileTree({ ...base, ...extra, write: async (path: string, data: Uint8Array | string) => void files.set(path, data) } as never);
    return [...files.entries()].filter(([k]) => k.endsWith('.glb')).reduce((n, [, v]) => n + (v as Uint8Array).byteLength, 0);
  }

  it('adds roads from the configured level on and only there', async () => {
    const none = await total({});

    expect(await total({ roads: () => roads, roadsFromLevel: 2 })).toBeGreaterThan(none);
    expect(await total({ roads: () => roads, roadsFromLevel: 3 })).toBe(none);
  });

  it('combines roads and buildings in the same tile', async () => {
    const onlyRoads = await total({ roads: () => roads, roadsFromLevel: 2 });
    const ring: Array<[number, number]> = [[-88.9, 13.75], [-88.8998, 13.75], [-88.8998, 13.7502], [-88.9, 13.7502], [-88.9, 13.75]];

    expect(await total({ roads: () => roads, roadsFromLevel: 2, buildings: () => [{ id: 'b', ring }], buildingsFromLevel: 2 })).toBeGreaterThan(onlyRoads);
  });
});
