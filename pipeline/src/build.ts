import { SKIRT_COLOR, terrainColor } from './color';
import { createGrid, type SceneRect } from './heightfield';
import { terrainToGlb } from './gltf';
import { buildTerrainMesh } from './mesh';
import { buildQuadtree, tileKey, type TileNode } from './quadtree';
import { terraceStep, quantizeGrid } from './terraces';
import { buildTileset, type Tileset } from './tileset';

export interface BuildOptions {
  bounds: SceneRect;
  levels: number;
  samples: number;
  heightAt: (x: number, z: number) => number;
  isLand: (x: number, z: number) => boolean;
  compress: boolean;
  skirtDepth?: number;
  write: (path: string, data: Uint8Array | string) => Promise<void>;
}

export interface BuildResult {
  tileset: Tileset;
  tileCount: number;
}

interface TileInfo {
  uri: string | null;
  range: [number, number];
}

/**
 * Builds the terrain tileset: every tile is sampled, snapped to terraces for its level, meshed and
 * written as a glb. Tiles without land are dropped unless a descendant has some.
 *
 * @throws {RangeError} When no tile contains land.
 */
export async function buildTileTree(options: BuildOptions): Promise<BuildResult> {
  const skirtDepth = options.skirtDepth ?? 60;
  const info = new Map<string, TileInfo>();
  let tileCount = 0;

  const visit = async (node: TileNode): Promise<TileNode | null> => {
    const key = tileKey(node);
    const grid = quantizeGrid(
      createGrid(node.bounds, options.samples, options.samples, options.heightAt),
      terraceStep(node.level, options.levels),
    );
    const mesh = buildTerrainMesh(grid, {
      skirtDepth,
      isLand: options.isLand,
      colorForHeight: terrainColor,
      skirtColor: SKIRT_COLOR,
    });

    const children: TileNode[] = [];
    for (const child of node.children) {
      const kept = await visit(child);
      if (kept) children.push(kept);
    }

    const hasContent = mesh.indices.length > 0;
    if (!hasContent && children.length === 0) return null;

    let uri: string | null = null;
    let lo = Infinity;
    let hi = -Infinity;
    if (hasContent) {
      uri = `tiles/${node.level}_${node.x}_${node.y}.glb`;
      await options.write(uri, await terrainToGlb(mesh, { compress: options.compress }));
      tileCount++;
      for (let k = 1; k < mesh.positions.length; k += 3) {
        lo = Math.min(lo, mesh.positions[k]!);
        hi = Math.max(hi, mesh.positions[k]!);
      }
    }
    for (const child of children) {
      const range = info.get(tileKey(child))!.range;
      lo = Math.min(lo, range[0]);
      hi = Math.max(hi, range[1]);
    }
    info.set(key, { uri, range: [lo, hi] });
    return { ...node, children };
  };

  const root = await visit(buildQuadtree(options.bounds, options.levels, options.samples));
  if (!root) {
    throw new RangeError('No tile contains land, check the bounds and the land mask');
  }
  const tileset = buildTileset(root, {
    contentUri: (tile) => info.get(tileKey(tile))!.uri,
    heightRange: (tile) => info.get(tileKey(tile))!.range,
  });
  await options.write('tileset.json', JSON.stringify(tileset));
  return { tileset, tileCount };
}
