export interface PlotPoint {
  slug: string;
  x: number;
  z: number;
  priority: number;
}

export interface Cluster {
  x: number;
  z: number;
  count: number;
  slugs: string[];
  leader: string;
}

/**
 * Groups points by a square grid for the far zoom bubbles. Each cluster sits at the centroid of its members and
 * lists them by priority so the most important one can name the bubble.
 *
 * @throws {RangeError} When the cell size is not positive.
 */
export function clusterPlaces(points: readonly PlotPoint[], cellSize: number): Cluster[] {
  if (!(cellSize > 0)) {
    throw new RangeError(`Cell size must be positive, received ${cellSize}`);
  }
  const groups = new Map<string, PlotPoint[]>();
  for (const point of points) {
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.z / cellSize)}`;
    const group = groups.get(key);
    if (group) group.push(point);
    else groups.set(key, [point]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, members]) => {
      const sorted = [...members].sort((a, b) => b.priority - a.priority || (a.slug < b.slug ? -1 : 1));
      return {
        x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
        z: members.reduce((sum, m) => sum + m.z, 0) / members.length,
        count: members.length,
        slugs: sorted.map((m) => m.slug),
        leader: sorted[0]!.slug,
      };
    });
}
