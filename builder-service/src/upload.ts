import { Document, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, prune, weld } from '@gltf-transform/functions';
import { MAX_TRIANGLES, FOOTPRINT_MARGIN, roleColor, COLOR_ROLES, type ColorRole } from '@turismo/kit';
import { MeshoptDecoder } from 'meshoptimizer';

export type UploadErrorCode = 'invalid' | 'budget' | 'scale' | 'footprint';

export class UploadError extends Error {
  override readonly name = 'UploadError';

  constructor(
    readonly code: UploadErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface UploadOptions {
  footprint?: { w: number; d: number };
}

export interface UploadResult {
  glb: Uint8Array;
  triangles: number;
  size: { x: number; y: number; z: number };
  roles: ColorRole[];
}

const MIN_DIMENSION = 0.5;
const MAX_DIMENSION = 500;

function nearestRole(rgba: readonly number[]): ColorRole {
  let best: ColorRole = 'neutral';
  let bestDistance = Infinity;
  for (const role of COLOR_ROLES) {
    const [r, g, b] = roleColor(role);
    const distance = (rgba[0]! - r) ** 2 + (rgba[1]! - g) ** 2 + (rgba[2]! - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = role;
    }
  }
  return best;
}

function triangleCountOf(primitive: Primitive): number {
  const indices = primitive.getIndices();
  return (indices ? indices.getCount() : primitive.getAttribute('POSITION')!.getCount()) / 3;
}

/**
 * Brings an externally modeled glb into the style: every material becomes the nearest palette role baked into
 * vertex colors, textures are dropped, and the model is placed on the ground and centered. It is rejected when
 * it is over the triangle budget, in an implausible scale, or too big for the footprint.
 *
 * @throws {UploadError} With a code telling which check failed.
 */
export async function normalizeUpload(input: Uint8Array, options: UploadOptions = {}): Promise<UploadResult> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  let doc: Document;
  try {
    doc = await io.readBinary(input);
  } catch {
    throw new UploadError('invalid', 'The file is not a valid glb.');
  }
  if (doc.getRoot().listMeshes().length === 0) {
    throw new UploadError('invalid', 'The glb has no meshes.');
  }

  await doc.transform(flatten(), join({ keepMeshes: false, keepNamed: false }), weld(), prune());
  const primitives = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  if (primitives.length === 0) throw new UploadError('invalid', 'The glb has no geometry.');

  const triangles = primitives.reduce((sum, p) => sum + triangleCountOf(p), 0);
  if (triangles > MAX_TRIANGLES) {
    throw new UploadError('budget', `The model has ${triangles} triangles, the limit is ${MAX_TRIANGLES}.`);
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const primitive of primitives) {
    const position = primitive.getAttribute('POSITION')!;
    const v = [0, 0, 0];
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v);
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a]!, v[a]!);
        max[a] = Math.max(max[a]!, v[a]!);
      }
    }
  }
  const size = { x: max[0]! - min[0]!, y: max[1]! - min[1]!, z: max[2]! - min[2]! };
  const largest = Math.max(size.x, size.y, size.z);
  if (largest < MIN_DIMENSION || largest > MAX_DIMENSION) {
    throw new UploadError('scale', `The largest dimension is ${largest.toFixed(3)} m. Models must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} m; check the export units.`);
  }
  if (options.footprint) {
    const limitW = options.footprint.w * FOOTPRINT_MARGIN;
    const limitD = options.footprint.d * FOOTPRINT_MARGIN;
    if (size.x > limitW + 1e-6 || size.z > limitD + 1e-6) {
      throw new UploadError('footprint', `The model is ${size.x.toFixed(1)} x ${size.z.toFixed(1)} m but the footprint allows ${limitW.toFixed(1)} x ${limitD.toFixed(1)} m.`);
    }
  }

  const shift = [-(min[0]! + max[0]!) / 2, -min[1]!, -(min[2]! + max[2]!) / 2];
  const roles = new Set<ColorRole>();
  const material = doc.createMaterial('style').setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(false);
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  for (const primitive of primitives) {
    const role = nearestRole(primitive.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1]);
    roles.add(role);
    const position = primitive.getAttribute('POSITION')!;
    const v = [0, 0, 0];
    const colors = new Float32Array(position.getCount() * 3);
    const [r, g, b] = roleColor(role);
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v);
      position.setElement(i, [v[0]! + shift[0]!, v[1]! + shift[1]!, v[2]! + shift[2]!]);
      colors.set([r, g, b], i * 3);
    }
    for (const semantic of primitive.listSemantics()) {
      if (semantic !== 'POSITION' && semantic !== 'NORMAL') primitive.setAttribute(semantic, null);
    }
    primitive.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(colors).setBuffer(buffer));
    primitive.setMaterial(material);
  }
  await doc.transform(prune());

  return { glb: await io.writeBinary(doc), triangles, size, roles: [...roles].sort() };
}
