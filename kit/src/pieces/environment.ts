import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, SphereGeometry } from 'three';
import { z } from 'zod';
import { box, cylinder, definePiece, hipRoof, positive } from './kit';

export const plazaFloor = definePiece({
  type: 'plaza-floor',
  description: 'Thin paved slab for plazas and courtyards.',
  params: z.object({
    w: positive(400).describe('width in meters along x'),
    d: positive(400).describe('depth in meters along z'),
  }),
  example: { w: 60, d: 40 },
  build: (p, role) => [{ geometry: box(p.w, 0.2, p.d), role }],
});

export const treeRound = definePiece({
  type: 'tree-round',
  description: 'Broadleaf tree with a round crown. The role colors the crown, the trunk is fixed.',
  params: z.object({ h: positive(40).describe('total height in meters') }),
  example: { h: 8 },
  build: (p, role) => [
    { geometry: cylinder(0.04 * p.h, 0.05 * p.h, 0.4 * p.h, 6), role: 'secondary' },
    { geometry: new IcosahedronGeometry(0.32 * p.h, 0).translate(0, 0.68 * p.h, 0), role },
  ],
});

export const treeCone = definePiece({
  type: 'tree-cone',
  description: 'Conifer-like tree with a conical crown. The role colors the crown, the trunk is fixed.',
  params: z.object({ h: positive(40).describe('total height in meters') }),
  example: { h: 9 },
  build: (p, role) => [
    { geometry: cylinder(0.04 * p.h, 0.05 * p.h, 0.2 * p.h, 6), role: 'secondary' },
    { geometry: new ConeGeometry(0.28 * p.h, 0.85 * p.h, 8).translate(0, 0.15 * p.h + 0.425 * p.h, 0), role },
  ],
});

export const palm = definePiece({
  type: 'palm',
  description: 'Palm tree with six fronds. The role colors the fronds, the trunk is fixed.',
  params: z.object({ h: positive(40).describe('total height in meters') }),
  example: { h: 10 },
  build: (p, role) => [
    { geometry: new CylinderGeometry(0.03 * p.h, 0.045 * p.h, 0.82 * p.h, 6).translate(0, 0.41 * p.h, 0), role: 'secondary' },
    ...Array.from({ length: 6 }, (_, i) => ({
      geometry: new ConeGeometry(0.05 * p.h, 0.32 * p.h, 4)
        .translate(0, 0.16 * p.h, 0)
        .rotateZ(-1.1)
        .rotateY((i * Math.PI) / 3)
        .translate(0, 0.82 * p.h, 0),
      role,
    })),
  ],
});

export const bench = definePiece({
  type: 'bench',
  description: 'Park bench about 0.9 m tall.',
  params: z.object({ w: positive(10).describe('length in meters along x') }),
  example: { w: 2 },
  build: (p, role) => [
    { geometry: box(p.w, 0.08, 0.5, 0.45), role },
    { geometry: box(p.w, 0.4, 0.08, 0.53, 0, -0.21), role },
    { geometry: box(0.1, 0.45, 0.5, 0, -(p.w / 2 - 0.1)), role },
    { geometry: box(0.1, 0.45, 0.5, 0, p.w / 2 - 0.1), role },
  ],
});

export const fountain = definePiece({
  type: 'fountain',
  description: 'Round fountain with a basin, a central column and an upper bowl. The water surface is fixed.',
  params: z.object({ r: positive(20).describe('basin radius in meters') }),
  example: { r: 4 },
  build: (p, role) => [
    { geometry: cylinder(p.r, p.r, 0.6, 16), role },
    { geometry: cylinder(p.r * 0.92, p.r * 0.92, 0.05, 16, 0.6), role: 'water' },
    { geometry: cylinder(0.1 * p.r, 0.1 * p.r, 0.5 * p.r, 8, 0.6), role },
    { geometry: cylinder(0.35 * p.r, 0.2 * p.r, 0.2 * p.r, 12, 0.6 + 0.5 * p.r), role },
  ],
});

export const lamp = definePiece({
  type: 'lamp',
  description: 'Street lamp with a glass globe. The role colors the pole.',
  params: z.object({ h: z.number().min(1).max(20).describe('height in meters') }),
  example: { h: 4 },
  build: (p, role) => [
    { geometry: cylinder(0.05, 0.07, p.h - 0.4, 8), role },
    { geometry: new SphereGeometry(0.25, 8, 6).translate(0, p.h - 0.25, 0), role: 'glass' },
  ],
});

export const kiosk = definePiece({
  type: 'kiosk',
  description: 'Small kiosk: a box body under a hip roof. The roof uses the secondary color.',
  params: z.object({
    w: positive(30).describe('width in meters along x'),
    d: positive(30).describe('depth in meters along z'),
    h: positive(15).describe('total height in meters'),
  }),
  example: { w: 3, d: 3, h: 3.5 },
  build: (p, role) => [
    { geometry: box(p.w, 0.72 * p.h, p.d), role },
    { geometry: hipRoof(p.w * 1.15, p.d * 1.15, 0.28 * p.h, 1, 0.72 * p.h), role: 'secondary' },
  ],
});
