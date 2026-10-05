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
