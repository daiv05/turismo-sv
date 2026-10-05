import { CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { z } from 'zod';
import { box, count, cylinder, definePiece, gablePrism, hemisphere, hipRoof, positive } from './kit';

const SQRT2 = Math.SQRT2;

export const hall = definePiece({
  type: 'hall',
  description: 'Rectangular block with a flat top, the main body of most buildings.',
  params: z.object({
    w: positive(300).describe('width in meters along x'),
    d: positive(300).describe('depth in meters along z'),
    h: positive(120).describe('height in meters'),
  }),
  example: { w: 30, d: 60, h: 18 },
  build: (p, role) => [{ geometry: box(p.w, p.h, p.d), role }],
});

export const plinth = definePiece({
  type: 'plinth',
  description: 'Low rectangular base or platform that a building or monument stands on.',
  params: z.object({
    w: positive(300).describe('width in meters along x'),
    d: positive(300).describe('depth in meters along z'),
    h: positive(20).describe('height in meters'),
  }),
  example: { w: 40, d: 70, h: 1 },
  build: (p, role) => [{ geometry: box(p.w, p.h, p.d), role }],
});

export const tower = definePiece({
  type: 'tower',
  description: 'Square or rectangular tower that can narrow towards the top.',
  params: z.object({
    w: positive(60).describe('width at the base in meters along x'),
    d: positive(60).describe('depth at the base in meters along z'),
    h: positive(150).describe('height in meters'),
    taper: z.number().min(0.2).max(1).default(1).describe('top size divided by base size, 1 for straight walls'),
  }),
  example: { w: 8, d: 8, h: 30, taper: 0.8 },
  build: (p, role) => {
    const geometry = new CylinderGeometry((p.w * p.taper) / SQRT2, p.w / SQRT2, p.h, 4, 1)
      .rotateY(Math.PI / 4)
      .scale(1, 1, p.d / p.w)
      .translate(0, p.h / 2, 0);
    return [{ geometry, role }];
  },
});

export const belfry = definePiece({
  type: 'belfry',
  description: 'Bell tower: a solid shaft, an open stage held by four posts, and a pyramid roof.',
  params: z.object({
    h: positive(120).describe('total height in meters'),
    w: positive(30).describe('width of the shaft in meters'),
  }),
  example: { h: 35, w: 6 },
  build: (p, role) => {
    const shaft = 0.62 * p.h;
    const stage = 0.23 * p.h;
    const post = 0.2 * p.w;
    const offset = p.w / 2 - post / 2;
    const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ geometry: box(post, stage, post, shaft, sx * offset, sz * offset), role })));
    return [
      { geometry: box(p.w, shaft, p.w), role },
      ...posts,
      { geometry: hipRoof(p.w * 1.15, p.w * 1.15, 0.15 * p.h, 0, shaft + stage), role: 'secondary' },
    ];
  },
});

export const dome = definePiece({
  type: 'dome',
  description: 'Hemispherical dome, optionally on a cylindrical drum.',
  params: z.object({
    r: positive(60).describe('radius in meters'),
    drum: z.number().min(0).max(60).default(0).describe('height of the cylindrical drum under the dome in meters, 0 for none'),
  }),
  example: { r: 9, drum: 3 },
  build: (p, role) => [
    ...(p.drum > 0 ? [{ geometry: cylinder(p.r, p.r, p.drum, 16), role }] : []),
    { geometry: hemisphere(p.r, p.drum), role },
  ],
});

export const gableRoof = definePiece({
  type: 'gable-roof',
  description: 'Two slope roof with its ridge running along z.',
  params: z.object({
    w: positive(300).describe('width in meters along x'),
    d: positive(300).describe('depth in meters along z, the ridge length'),
    h: positive(60).describe('height of the ridge above the eaves in meters'),
  }),
  example: { w: 30, d: 60, h: 8 },
  build: (p, role) => [{ geometry: gablePrism(p.w, p.d, p.h), role }],
});

export const hipRoofPiece = definePiece({
  type: 'hip-roof',
  description: 'Roof sloping on four sides, a pyramid when the ridge is zero.',
  params: z.object({
    w: positive(300).describe('width in meters along x'),
    d: positive(300).describe('depth in meters along z'),
    h: positive(60).describe('height in meters'),
    ridge: z.number().min(0).max(1).default(1).describe('ridge length, 0 for a pyramid and 1 for the full hip'),
  }),
  example: { w: 20, d: 12, h: 5, ridge: 1 },
  build: (p, role) => [{ geometry: hipRoof(p.w, p.d, p.h, p.ridge), role }],
});

export const pediment = definePiece({
  type: 'pediment',
  description: 'Triangular gable over a facade or portico.',
  params: z.object({
    w: positive(100).describe('width in meters along x'),
    h: positive(30).describe('height in meters'),
    d: z.number().positive().max(10).default(1).describe('thickness in meters along z'),
  }),
  example: { w: 12, h: 3, d: 1 },
  build: (p, role) => [{ geometry: gablePrism(p.w, p.d, p.h), role }],
});

export const arcade = definePiece({
  type: 'arcade',
  description: 'Wall pierced by a row of arched openings.',
  params: z.object({
    n: count(30).describe('number of arched openings'),
    w: positive(200).describe('total width in meters along x'),
    h: positive(40).describe('height in meters'),
    d: positive(10).describe('wall thickness in meters along z'),
  }),
  example: { n: 4, w: 24, h: 8, d: 2 },
  build: (p, role) => {
    const opening = p.w / (2 * p.n + 1);
    const top = Math.min(p.h * 0.9, Math.max(p.h * 0.75, opening * 0.75));
    const radius = Math.min(opening / 2, top / 2);
    const shape = new Shape();
    shape.moveTo(-p.w / 2, 0);
    shape.lineTo(-p.w / 2, p.h);
    shape.lineTo(p.w / 2, p.h);
    shape.lineTo(p.w / 2, 0);
    for (let i = p.n - 1; i >= 0; i--) {
      const cx = -p.w / 2 + opening * (1.5 + 2 * i);
      shape.lineTo(cx + radius, 0);
      shape.lineTo(cx + radius, top - radius);
      shape.absarc(cx, top - radius, radius, 0, Math.PI, false);
      shape.lineTo(cx - radius, 0);
    }
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth: p.d, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -p.d / 2);
    return [{ geometry, role }];
  },
});

export const colonnade = definePiece({
  type: 'colonnade',
  description: 'Row of round columns carrying a straight beam.',
  params: z.object({
    n: count(40).describe('number of columns'),
    w: positive(200).describe('total width in meters along x'),
    h: positive(40).describe('height including the beam in meters'),
    r: positive(3).describe('column radius in meters'),
  }),
  example: { n: 6, w: 20, h: 9, r: 0.5 },
  build: (p, role) => {
    const columnHeight = p.h * 0.9;
    const span = Math.max(0, p.w - 2 * p.r);
    const columns = Array.from({ length: p.n }, (_, i) => ({
      geometry: cylinder(p.r * 0.9, p.r, columnHeight, 8, 0, p.n === 1 ? 0 : -span / 2 + (i * span) / (p.n - 1)),
      role,
    }));
    return [...columns, { geometry: box(p.w, p.h * 0.1, p.r * 3, columnHeight), role }];
  },
});

export const steps = definePiece({
  type: 'steps',
  description: 'Staircase rising towards negative z, with the lowest step at the front (positive z).',
  params: z.object({
    w: positive(100).describe('width in meters along x'),
    d: positive(60).describe('total depth in meters along z'),
    n: count(30).describe('number of steps'),
    h: positive(20).describe('total height in meters'),
  }),
  example: { w: 10, d: 6, n: 5, h: 2 },
  build: (p, role) =>
    Array.from({ length: p.n }, (_, i) => {
      const depth = (p.d * (p.n - i)) / p.n;
      return { geometry: box(p.w, ((i + 1) * p.h) / p.n, depth, 0, 0, p.d / 2 - depth / 2), role };
    }),
});

export const windowStrip = definePiece({
  type: 'window-strip',
  description: 'Row of window panes to place against a wall, facing positive z.',
  params: z.object({
    n: count(40).describe('number of windows'),
    w: positive(100).describe('width of the strip in meters along x'),
    h: positive(10).describe('height of each window in meters'),
  }),
  example: { n: 5, w: 20, h: 3 },
  build: (p, role) => {
    const pane = p.w / (p.n * 1.5);
    return Array.from({ length: p.n }, (_, i) => ({ geometry: box(pane, p.h, 0.15, 0, -p.w / 2 + (p.w / p.n) * (i + 0.5)), role }));
  },
});

export const door = definePiece({
  type: 'door',
  description: 'Arched door, facing positive z.',
  params: z.object({
    w: positive(10).describe('width in meters along x'),
    h: positive(15).describe('height in meters, at least the width'),
  }),
  example: { w: 3, h: 5 },
  build: (p, role) => {
    const radius = p.w / 2;
    const straight = Math.max(0, p.h - radius);
    const shape = new Shape();
    shape.moveTo(-radius, 0);
    shape.lineTo(-radius, straight);
    shape.absarc(0, straight, radius, Math.PI, 0, true);
    shape.lineTo(radius, 0);
    shape.closePath();
    return [{ geometry: new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -0.15), role }];
  },
});
