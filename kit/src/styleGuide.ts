import { z } from 'zod';
import { PALETTE, type ColorRole } from './palette';
import { PIECES } from './pieces';
import { FOOTPRINT_MARGIN, MAX_TRIANGLES } from './rules';
import { KIT_VERSION } from './spec';

const ROLE_USE: Record<ColorRole, string> = {
  ground: 'ground and base terrain',
  neutral: 'building bodies and generic walls',
  secondary: 'roofs, bases and details',
  accent: 'the single dominant element of a featured site (dome, main tower, monument), also pins and selection',
  glass: 'windows and glazed surfaces',
  vegetation: 'trees and green areas',
  water: 'water surfaces',
  promo: 'promotion badges only, never on a model',
};

interface JsonProperty {
  type?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  default?: unknown;
}

function describeParams(piece: (typeof PIECES)[number]): string {
  const schema = z.toJSONSchema(piece.params, { io: 'input', unrepresentable: 'any' }) as { properties?: Record<string, JsonProperty> };
  return Object.entries(schema.properties ?? {})
    .map(([name, p]) => {
      const bounds = [
        p.exclusiveMinimum !== undefined ? `above ${p.exclusiveMinimum}` : p.minimum !== undefined ? `min ${p.minimum}` : null,
        p.maximum !== undefined ? `max ${p.maximum}` : null,
        p.default !== undefined ? `default ${JSON.stringify(p.default)}` : null,
      ].filter(Boolean);
      return `  - \`${name}\` ${p.type ?? 'number'}${bounds.length ? ` (${bounds.join(', ')})` : ''}: ${p.description ?? ''}`.trimEnd();
    })
    .join('\n');
}

/**
 * Plain text description of the style, the piece catalog and the rules, written for the agent that composes
 * model documents. It is generated from the same definitions the validator uses, so it cannot drift from them.
 */
export function buildStyleGuide(): string {
  const palette = (Object.keys(PALETTE) as ColorRole[]).map((role) => `- \`${role}\` ${PALETTE[role]}: ${ROLE_USE[role]}`).join('\n');
  const pieces = PIECES.map((piece) => `### \`${piece.type}\`\n${piece.description}\n${describeParams(piece)}`).join('\n\n');

  return `# Style guide for 3D models (kit ${KIT_VERSION})

The look is an isometric low-poly toy diorama: simple volumes, a restricted palette and one saturated accent. You never produce meshes, only a JSON document that composes catalog pieces.

## Document and coordinates
- Units are meters. The y axis points up and y=0 is the ground. x is east and z is south.
- \`footprint\` is the site's plot as { w, d }. All \`pos\` values are relative to the center of the footprint.
- \`pos\` is the center of the piece's base. A piece grows upward from there, so a roof at \`pos\` y equal to the wall height sits on the wall.
- \`rot\` turns a piece around the vertical axis, in degrees.
- Every part needs \`type\`, \`params\`, \`pos\`, \`role\`; \`rot\` defaults to 0. Do not invent parameters.

## Palette
Colors are only palette roles, never hexadecimal values.
${palette}

## Rules
The document is rejected, with the list of problems, when any of these fail:
- Nothing floats or sinks: every piece must touch the ground (base at y=0) or touch another piece that is supported.
- The whole model must stay within the footprint plus ${Math.round((FOOTPRINT_MARGIN - 1) * 100)}% on each axis, centered on it.
- At most ${MAX_TRIANGLES} triangles in total.
- Use the \`accent\` role on one contiguous group of touching pieces, not scattered. Most pieces should be \`neutral\` or \`secondary\`.
- At most 200 parts.

## Composition tips
- Start with a \`plinth\` or \`steps\`, then the main \`hall\`, then roofs, towers and domes on top.
- Put \`window-strip\` and \`door\` against a wall, a few centimeters in front of it (z of the wall plus 0.05), at the height where they belong.
- Use \`plaza-floor\`, trees, \`fountain\` and \`bench\` for the surroundings and keep them inside the footprint.
- Prefer few, well proportioned pieces over many small ones.

## Piece catalog
${pieces}
`;
}
