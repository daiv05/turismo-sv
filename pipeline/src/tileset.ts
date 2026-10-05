import type { TileNode } from './quadtree';

export interface TilesetTile {
  boundingVolume: { box: number[] };
  geometricError: number;
  refine?: 'REPLACE';
  content?: { uri: string };
  children?: TilesetTile[];
}

export interface Tileset {
  asset: { version: '1.1' };
  geometricError: number;
  root: TilesetTile;
}

export interface TilesetOptions {
  contentUri: (tile: TileNode) => string | null;
  heightRange: (tile: TileNode) => [number, number];
}

/**
 * Converts a tile tree into a 3D Tiles 1.1 tileset. Bounding volumes use the tileset's Z up frame
 * (x east, y north, z up), which is the scene frame rotated so that scene z points south.
 */
export function buildTileset(root: TileNode, options: TilesetOptions): Tileset {
  const convert = (node: TileNode, isRoot: boolean): TilesetTile => {
    const { minX, maxX, minZ, maxZ } = node.bounds;
    const [lo, hi] = options.heightRange(node);
    const halfX = (maxX - minX) / 2;
    const halfY = (maxZ - minZ) / 2;
    const halfZ = Math.max(1, (hi - lo) / 2);
    const tile: TilesetTile = {
      boundingVolume: { box: [(minX + maxX) / 2, -(minZ + maxZ) / 2, (lo + hi) / 2, halfX, 0, 0, 0, halfY, 0, 0, 0, halfZ] },
      geometricError: node.geometricError,
    };
    if (isRoot) tile.refine = 'REPLACE';
    const uri = options.contentUri(node);
    if (uri !== null) tile.content = { uri };
    if (node.children.length > 0) tile.children = node.children.map((child) => convert(child, false));
    return tile;
  };
  const rootTile = convert(root, true);
  return { asset: { version: '1.1' }, geometricError: Math.max(1, root.geometricError * 2), root: rootTile };
}
