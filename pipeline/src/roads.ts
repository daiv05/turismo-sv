import { lonLatToScene } from '@turismo/kit/geo';
import { PALETTE } from '@turismo/kit/palette';
import { hexToLinear } from './color';
import type { TerrainMesh } from './mesh';

export interface Road {
  id: string;
  kind: string;
  line: Array<[number, number]>;
}

const WIDTHS: Record<string, number> = {
  motorway: 14, trunk: 12, primary: 10, secondary: 8, tertiary: 6.5, unclassified: 5, residential: 5,
  living_street: 4.5, service: 3.5, pedestrian: 3, footway: 1.5, path: 1.5, cycleway: 2, steps: 1.5, track: 3,
};

/**
 * Stylized width in meters of a road class. Unknown classes use the residential width.
 */
export function roadWidth(kind: string): number {
  return WIDTHS[kind] ?? WIDTHS.residential!;
}

export interface RoadOptions {
  heightAt: (x: number, z: number) => number;
  lift?: number;
}

/**
 * Builds each road as a flat ribbon draped on the terrain and lifted slightly to avoid z-fighting. Corners use the
 * averaged normal scaled to keep the width constant, so bends do not pinch.
 */
export function extrudeRoads(roads: readonly Road[], options: RoadOptions): TerrainMesh {
  const lift = options.lift ?? 0.3;
  const color = hexToLinear(PALETTE.secondary);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (const road of roads) {
    const raw = road.line.map(([lon, lat]) => lonLatToScene({ lon, lat }));
    const pts = raw.filter((p, i) => i === 0 || Math.hypot(p.x - raw[i - 1]!.x, p.z - raw[i - 1]!.z) > 1e-6);
    if (pts.length < 2) continue;
    const half = roadWidth(road.kind) / 2;
    const base = positions.length / 3;

    pts.forEach((p, i) => {
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(pts.length - 1, i + 1)]!;
      const a = unit(p.x - prev.x, p.z - prev.z);
      const b = unit(next.x - p.x, next.z - p.z);
      const dir = unit(a.x + b.x, a.z + b.z);
      const nx = -dir.z;
      const nz = dir.x;
      const dot = Math.max(0.35, nx * -a.z + nz * a.x);
      const offset = half / dot;
      const y = options.heightAt(p.x, p.z) + lift;
      positions.push(p.x + nx * offset, y, p.z + nz * offset, p.x - nx * offset, y, p.z - nz * offset);
      colors.push(...color, ...color);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const [l0, r0, l1, r1] = [base + 2 * i, base + 2 * i + 1, base + 2 * i + 2, base + 2 * i + 3];
      indices.push(l0, l1, r0, r0, l1, r1);
    }
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint32Array(indices) };
}

function unit(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  return length < 1e-9 ? { x: 1, z: 0 } : { x: x / length, z: z / length };
}
