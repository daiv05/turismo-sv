import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshToonMaterial,
  Shape,
  SphereGeometry,
  Box3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { z } from 'zod';
import { roleColor } from '../color';
import type { ColorRole } from '../palette';

export interface Part {
  geometry: BufferGeometry;
  role: ColorRole;
}

export interface PieceDefinition {
  type: string;
  description: string;
  params: z.ZodObject<z.ZodRawShape>;
  example: Record<string, unknown>;
  centerTolerance?: number;
  build: (params: Record<string, unknown>, role: ColorRole) => Group;
}

/**
 * Declares a piece with typed parameters. The returned definition keeps the loose shape the registry needs
 * while `build` receives the parsed, typed parameters.
 */
export function definePiece<S extends z.ZodRawShape>(def: {
  type: string;
  description: string;
  params: z.ZodObject<S>;
  example: z.input<z.ZodObject<S>>;
  centerTolerance?: number;
  build: (params: z.output<z.ZodObject<S>>, role: ColorRole) => Part[];
}): PieceDefinition {
  return {
    type: def.type,
    description: def.description,
    params: def.params as unknown as z.ZodObject<z.ZodRawShape>,
    example: def.example as Record<string, unknown>,
    ...(def.centerTolerance !== undefined ? { centerTolerance: def.centerTolerance } : {}),
    build: (params, role) => assemble(def.build(def.params.parse(params), role), def.type),
  };
}

let sharedMaterial: MeshToonMaterial | null = null;

/**
 * The single material of the style: soft toon shading over baked vertex colors.
 */
export function styleMaterial(): MeshToonMaterial {
  sharedMaterial ??= new MeshToonMaterial({ vertexColors: true });
  return sharedMaterial;
}

const AO_FLOOR = 0.82;

/**
 * Merges the parts of a piece into one mesh, painting each vertex with its role color scaled by a baked
 * ambient occlusion term: darker at the base, full brightness at the top.
 */
export function assemble(parts: Part[], name: string): Group {
  const prepared = parts.map(({ geometry, role }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv');
    g.deleteAttribute('uv1');
    return { g, role };
  });
  const top = Math.max(
    1e-6,
    ...prepared.map(({ g }) => {
      g.computeBoundingBox();
      return g.boundingBox!.max.y;
    }),
  );
  for (const { g, role } of prepared) {
    const [r, gr, b] = roleColor(role);
    const position = g.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = Math.min(1, Math.max(0, position.getY(i) / top));
      const ao = AO_FLOOR + (1 - AO_FLOOR) * t;
      colors[i * 3] = r * ao;
      colors[i * 3 + 1] = gr * ao;
      colors[i * 3 + 2] = b * ao;
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  }
  const merged = mergeGeometries(prepared.map(({ g }) => g), false);
  const mesh = new Mesh(merged, styleMaterial());
  mesh.name = name;
  const group = new Group();
  group.name = name;
  group.add(mesh);
  return group;
}

export function triangleCount(object: Object3D): number {
  let total = 0;
  object.traverse((o) => {
    const geometry = (o as Mesh).geometry as BufferGeometry | undefined;
    if (geometry) total += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
  });
  return Math.round(total);
}

export function boundsOf(object: Object3D): Box3 {
  return new Box3().setFromObject(object);
}

export const positive = (max: number) => z.number().positive().max(max);

export const count = (max: number) => z.number().int().min(1).max(max);

/** Box with its base on y = 0 (or `y0`), centered on x and z unless offsets are given. */
export function box(w: number, h: number, d: number, y0 = 0, cx = 0, cz = 0): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(cx, y0 + h / 2, cz);
}

export function cylinder(rTop: number, rBottom: number, h: number, segments: number, y0 = 0, cx = 0, cz = 0): BufferGeometry {
  return new CylinderGeometry(rTop, rBottom, h, segments).translate(cx, y0 + h / 2, cz);
}

export function hemisphere(r: number, y0 = 0): BufferGeometry {
  return new SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y0, 0);
}

/**
 * Triangular prism with the ridge along z: width `w` at the base, height `h`, depth `d`.
 */
export function gablePrism(w: number, d: number, h: number, y0 = 0): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, y0, -d / 2);
}

/**
 * Hip roof over a w by d rectangle. `ridge` scales the ridge from a point (0) to the full 45 degree hip (1).
 */
export function hipRoof(w: number, d: number, h: number, ridge: number, y0 = 0): BufferGeometry {
  const longer = Math.max(w, d);
  const shorter = Math.min(w, d);
  const hw = longer / 2;
  const hd = shorter / 2;
  const rh = ((longer - shorter) / 2) * ridge;
  const A = [-rh, h, 0];
  const B = [rh, h, 0];
  const tri = (a: number[], b: number[], c: number[]) => [...a, ...b, ...c];
  const positions = [
    ...tri([-hw, 0, hd], [hw, 0, hd], B),
    ...tri([-hw, 0, hd], B, A),
    ...tri([hw, 0, -hd], [-hw, 0, -hd], A),
    ...tri([hw, 0, -hd], A, B),
    ...tri([-hw, 0, -hd], [-hw, 0, hd], A),
    ...tri([hw, 0, hd], [hw, 0, -hd], B),
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  if (w < d) g.rotateY(Math.PI / 2);
  return g.translate(0, y0, 0);
}

export { ExtrudeGeometry, Shape };
