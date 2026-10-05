import { z } from 'zod';
import { COLOR_ROLES, type ColorRole } from './palette';
import { PIECES } from './pieces';

export const KIT_VERSION = '1.0';

const role = z.enum(COLOR_ROLES as unknown as [ColorRole, ...ColorRole[]]);
const finite = z.number().refine(Number.isFinite, 'must be a finite number');

const placement = {
  pos: z.tuple([finite, finite, finite]).describe('position [x, y, z] in meters of the center of the piece base, relative to the center of the footprint'),
  rot: z.number().min(-360).max(360).default(0).describe('rotation in degrees around the vertical axis'),
  role: role.describe('palette role that colors the piece'),
};

const partSchemas = PIECES.map((piece) =>
  z.object({ type: z.literal(piece.type), params: piece.params.strict(), ...placement }),
);

export const partSchema = z.discriminatedUnion('type', partSchemas as unknown as [(typeof partSchemas)[number], ...(typeof partSchemas)[number][]]);

export const modelSpecSchema = z.object({
  kitVersion: z.literal(KIT_VERSION),
  footprint: z.object({
    w: z.number().positive().max(500).describe('footprint width in meters along x'),
    d: z.number().positive().max(500).describe('footprint depth in meters along z'),
  }),
  parts: z.array(partSchema).min(1).max(200),
});

export type ModelSpec = z.output<typeof modelSpecSchema>;
export type ModelPart = ModelSpec['parts'][number];

export interface SpecIssue {
  path: string;
  message: string;
}

export class SpecError extends Error {
  override readonly name = 'SpecError';

  constructor(readonly issues: SpecIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  }
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key)), '') || 'spec';
}

/**
 * Validates a model document and fills piece defaults.
 *
 * @throws {SpecError} Listing every problem with the path of the offending field.
 */
export function parseSpec(input: unknown): ModelSpec {
  const result = modelSpecSchema.safeParse(input);
  if (result.success) return result.data;
  throw new SpecError(result.error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message })));
}

/**
 * JSON Schema of the model document, handed to the agent as the tool input schema.
 */
export function modelSpecJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(modelSpecSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}
