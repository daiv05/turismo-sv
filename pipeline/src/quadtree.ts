import type { SceneRect } from './heightfield';

export interface TileNode {
  level: number;
  x: number;
  y: number;
  bounds: SceneRect;
  geometricError: number;
  children: TileNode[];
}

/**
 * Builds a full quadtree over the bounds. Inner tiles use their sample spacing as geometric error, so a
 * viewer refines them once that spacing is visible on screen; leaves use zero because nothing refines them.
 *
 * @param levels Number of levels, the root being level 0.
 * @param samples Vertices per tile side.
 * @throws {RangeError} When there are no levels or fewer than two samples.
 */
export function buildQuadtree(bounds: SceneRect, levels: number, samples: number): TileNode {
  if (!Number.isInteger(levels) || levels < 1) {
    throw new RangeError(`A quadtree needs at least one level, received ${levels}`);
  }
  if (!Number.isInteger(samples) || samples < 2) {
    throw new RangeError(`A tile needs at least 2 samples per side, received ${samples}`);
  }
  const build = (level: number, x: number, y: number, rect: SceneRect): TileNode => {
    const isLeaf = level === levels - 1;
    const node: TileNode = {
      level,
      x,
      y,
      bounds: rect,
      geometricError: isLeaf ? 0 : Math.max(rect.maxX - rect.minX, rect.maxZ - rect.minZ) / (samples - 1),
      children: [],
    };
    if (!isLeaf) {
      const midX = (rect.minX + rect.maxX) / 2;
      const midZ = (rect.minZ + rect.maxZ) / 2;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          node.children.push(
            build(level + 1, x * 2 + dx, y * 2 + dy, {
              minX: dx === 0 ? rect.minX : midX,
              maxX: dx === 0 ? midX : rect.maxX,
              minZ: dy === 0 ? rect.minZ : midZ,
              maxZ: dy === 0 ? midZ : rect.maxZ,
            }),
          );
        }
      }
    }
    return node;
  };
  return build(0, 0, 0, bounds);
}

export function* walkTiles(root: TileNode): Generator<TileNode> {
  yield root;
  for (const child of root.children) yield* walkTiles(child);
}

export function tileKey(tile: TileNode): string {
  return `${tile.level}/${tile.x}/${tile.y}`;
}
