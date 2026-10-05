import { bench, fountain, kiosk, lamp, palm, plazaFloor, treeCone, treeRound } from './environment';
import type { PieceDefinition } from './kit';
import { arcade, belfry, colonnade, dome, door, gableRoof, hall, hipRoofPiece, pediment, plinth, steps, tower, windowStrip } from './structural';

export { assemble, boundsOf, definePiece, triangleCount, styleMaterial } from './kit';
export type { PieceDefinition } from './kit';

export const PIECES: readonly PieceDefinition[] = Object.freeze([
  hall, plinth, tower, belfry, dome, gableRoof, hipRoofPiece, pediment, arcade, colonnade, steps, windowStrip, door,
  plazaFloor, treeRound, treeCone, palm, bench, fountain, lamp, kiosk,
]);

const BY_TYPE = new Map(PIECES.map((p) => [p.type, p]));

/**
 * Finds a piece by its catalog name.
 *
 * @throws {RangeError} When the type is not in the catalog.
 */
export function getPiece(type: string): PieceDefinition {
  const piece = BY_TYPE.get(type);
  if (!piece) {
    throw new RangeError(`Unknown piece type "${type}"; available: ${PIECES.map((p) => p.type).join(', ')}`);
  }
  return piece;
}
