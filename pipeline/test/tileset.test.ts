import { describe, expect, it } from 'vitest';
import { buildQuadtree, walkTiles } from '../src/quadtree';
import { buildTileset } from '../src/tileset';

const bounds = { minX: 0, maxX: 800, minZ: 0, maxZ: 400 };

describe('buildTileset', () => {
  const root = buildQuadtree(bounds, 2, 17);
  const tileset = buildTileset(root, {
    contentUri: (t) => `tiles/${t.level}_${t.x}_${t.y}.glb`,
    heightRange: () => [0, 100],
  });

  it('declares 3D Tiles 1.1 with replace refinement', () => {
    expect(tileset.asset.version).toBe('1.1');
    expect(tileset.root.refine).toBe('REPLACE');
  });

  it('uses a geometric error above the root error', () => {
    expect(tileset.geometricError).toBeGreaterThan(tileset.root.geometricError);
  });

  it('describes bounds in the Z up tileset frame', () => {
    const box = tileset.root.boundingVolume.box;
    expect(box[0]).toBe(400);
    expect(box[1]).toBe(-200);
    expect(box[2]).toBe(50);
    expect(box[3]).toBe(400);
    expect(box[7]).toBe(200);
    expect(box[11]).toBe(50);
  });

  it('nests children under every inner tile', () => {
    expect(tileset.root.children).toHaveLength(4);
    expect(tileset.root.children?.[0]?.geometricError).toBeLessThan(tileset.root.geometricError);
  });

  it('skips tiles the caller leaves without content', () => {
    const partial = buildTileset(root, { contentUri: (t) => (t.level === 0 ? null : `t${t.x}_${t.y}.glb`), heightRange: () => [0, 10] });
    expect(partial.root.content).toBeUndefined();
    expect(partial.root.children?.[0]?.content?.uri).toBeDefined();
  });

  it('keeps the tile count of the source tree', () => {
    const count = (node: { children?: unknown[] }): number => 1 + (node.children ?? []).reduce<number>((n, c) => n + count(c as { children?: unknown[] }), 0);
    expect(count(tileset.root)).toBe([...walkTiles(root)].length);
  });
});
