import { Box3, Group } from 'three';
import type { ColorRole } from './palette';
import { getPiece } from './pieces';
import { parseSpec, type ModelSpec } from './spec';

export interface BuiltPart {
  index: number;
  type: string;
  role: ColorRole;
  object: Group;
  bounds: Box3;
}

export interface BuiltModel {
  spec: ModelSpec;
  group: Group;
  parts: BuiltPart[];
}

/**
 * Validates a model document and assembles its pieces, returning the world bounds of every part so rules can
 * reason about them.
 *
 * @throws {SpecError} When the document does not match the schema.
 */
export function buildParts(input: unknown): BuiltModel {
  const spec = parseSpec(input);
  const group = new Group();
  group.name = 'model';
  const parts = spec.parts.map((part, index): BuiltPart => {
    const object = getPiece(part.type).build(part.params, part.role);
    object.rotation.y = (part.rot * Math.PI) / 180;
    object.position.set(part.pos[0], part.pos[1], part.pos[2]);
    object.updateMatrixWorld(true);
    group.add(object);
    return { index, type: part.type, role: part.role, object, bounds: new Box3().setFromObject(object) };
  });
  return { spec, group, parts };
}

/**
 * Builds the 3D model for a document.
 *
 * @throws {SpecError} When the document does not match the schema.
 */
export function buildModel(input: unknown): Group {
  return buildParts(input).group;
}
