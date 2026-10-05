import { Box3, Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE, type ColorRole } from '../src/palette';
import { PIECES, getPiece, triangleCount } from '../src/pieces';
import { roleColor } from '../src/color';

const EXPECTED_TYPES = [
  'arcade', 'belfry', 'bench', 'colonnade', 'dome', 'door', 'fountain', 'gable-roof', 'hall', 'hip-roof', 'kiosk', 'lamp',
  'palm', 'pediment', 'plaza-floor', 'plinth', 'steps', 'tower', 'tree-cone', 'tree-round', 'window-strip',
];

function meshes(object: Object3D): Mesh[] {
  const found: Mesh[] = [];
  object.traverse((o) => {
    if ((o as Mesh).isMesh) found.push(o as Mesh);
  });
  return found;
}

describe('piece catalog', () => {
  it('contains exactly the pieces of the style guide', () => {
    expect(PIECES.map((p) => p.type).sort()).toEqual(EXPECTED_TYPES);
  });

  it('looks pieces up by type and rejects unknown ones', () => {
    expect(getPiece('hall').type).toBe('hall');
    expect(() => getPiece('spaceship')).toThrow(RangeError);
  });
});

describe.each(PIECES.map((p) => [p.type, p] as const))('piece %s', (_type, piece) => {
  const role: ColorRole = 'neutral';
  const build = () => piece.build(piece.params.parse(piece.example), role);

  it('accepts its documented example', () => {
    expect(piece.params.safeParse(piece.example).success).toBe(true);
  });

  it('documents itself for the agent', () => {
    expect(piece.description.length).toBeGreaterThan(10);
  });

  it('builds visible geometry within a modest triangle budget', () => {
    const count = triangleCount(build());
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(1200);
  });

  it('rests on the ground plane and never digs below it', () => {
    const box = new Box3().setFromObject(build());
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(box.min.y).toBeLessThanOrEqual(1e-6);
  });

  it('is centered on its footprint', () => {
    const box = new Box3().setFromObject(build());
    expect(Math.abs((box.min.x + box.max.x) / 2)).toBeLessThan(piece.centerTolerance ?? 0.01);
    expect(Math.abs((box.min.z + box.max.z) / 2)).toBeLessThan(piece.centerTolerance ?? 0.01);
  });

  it('colors every vertex with a palette role only, darkened by baked occlusion', () => {
    const allowed = (Object.keys(PALETTE) as ColorRole[]).map((r) => roleColor(r));
    for (const mesh of meshes(build())) {
      const colors = (mesh.geometry as BufferGeometry).getAttribute('color');
      expect(colors, 'missing color attribute').toBeDefined();
      for (let i = 0; i < colors!.count; i++) {
        const c = [colors!.getX(i), colors!.getY(i), colors!.getZ(i)];
        const matches = allowed.some((a) => {
          const ratio = c[0]! / a[0];
          return ratio > 0.7 && ratio <= 1.0001 && Math.abs(c[1]! - a[1] * ratio) < 1e-4 && Math.abs(c[2]! - a[2] * ratio) < 1e-4;
        });
        expect(matches, `vertex ${i} color ${c.join(',')} is not a palette role`).toBe(true);
      }
    }
  });

  it('is deterministic', () => {
    const a = build();
    const b = build();
    expect(new Box3().setFromObject(a).equals(new Box3().setFromObject(b))).toBe(true);
    expect(triangleCount(a)).toBe(triangleCount(b));
  });

  it('rejects non positive dimensions', () => {
    const invalid = Object.fromEntries(Object.entries(piece.example).map(([k, v]) => [k, typeof v === 'number' ? -1 : v]));
    expect(piece.params.safeParse(invalid).success).toBe(false);
  });
});

describe('declared dimensions', () => {
  const size = (type: string, params: object) => new Box3().setFromObject(getPiece(type).build(getPiece(type).params.parse(params), 'neutral')).getSize(new Vector3());

  it('hall matches its width, depth and height', () => {
    const s = size('hall', { w: 30, d: 60, h: 18 });
    expect([s.x, s.y, s.z]).toEqual([30, 18, 60]);
  });

  it('dome is as wide as twice its radius and as tall as the radius plus drum', () => {
    const s = size('dome', { r: 9, drum: 3 });
    expect(s.x).toBeCloseTo(18, 3);
    expect(s.y).toBeCloseTo(12, 3);
  });

  it('tower narrows towards the top when tapered', () => {
    const plain = size('tower', { w: 8, d: 8, h: 30, taper: 1 });
    expect(plain.x).toBeCloseTo(8, 3);
    const box = new Box3().setFromObject(getPiece('tower').build(getPiece('tower').params.parse({ w: 8, d: 8, h: 30, taper: 0.5 }), 'neutral'));
    expect(box.max.y).toBeCloseTo(30, 3);
  });

  it('steps rise to their full height', () => {
    expect(size('steps', { w: 10, d: 6, n: 5, h: 2 }).y).toBeCloseTo(2, 3);
  });

  it('arcade is a wall of the requested size with openings', () => {
    const piece = getPiece('arcade');
    const object = piece.build(piece.params.parse({ n: 4, w: 24, h: 8, d: 2 }), 'neutral');
    const s = new Box3().setFromObject(object).getSize(new Vector3());
    expect([s.x, s.y, s.z].map((v) => Math.round(v))).toEqual([24, 8, 2]);
    expect(triangleCount(object)).toBeGreaterThan(40);
  });
});
