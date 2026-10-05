import { Box3 } from 'three';
import { buildParts, type BuiltPart } from './builder';
import { triangleCount } from './pieces';
import { SpecError } from './spec';

export const MAX_TRIANGLES = 15_000;
export const FOOTPRINT_MARGIN = 1.1;
const CONTACT = 0.05;

export type RuleName = 'schema' | 'budget' | 'footprint' | 'grounded' | 'accent';

export interface RuleViolation {
  rule: RuleName;
  path: string;
  message: string;
}

export interface RuleReport {
  ok: boolean;
  violations: RuleViolation[];
  triangles: number;
}

function touches(a: Box3, b: Box3): boolean {
  return a.clone().expandByScalar(CONTACT).intersectsBox(b);
}

/**
 * Groups parts that touch each other, directly or through a chain, and returns each group as a list of indexes.
 */
function connectedGroups(parts: readonly BuiltPart[]): number[][] {
  const parent = parts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (touches(parts[i]!.bounds, parts[j]!.bounds)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, number[]>();
  parts.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  return [...groups.values()];
}

/**
 * Checks a model document against the style rules of the kit: palette roles only (enforced by the schema),
 * nothing floating or buried, the footprint with a ten percent margin, one contiguous accent group and the
 * triangle budget. Schema problems are reported as violations rather than thrown.
 */
export function validateModel(input: unknown): RuleReport {
  let built;
  try {
    built = buildParts(input);
  } catch (error) {
    if (!(error instanceof SpecError)) throw error;
    return {
      ok: false,
      triangles: 0,
      violations: error.issues.map((i) => ({ rule: 'schema', path: i.path, message: i.message })),
    };
  }

  const { spec, group, parts } = built;
  const violations: RuleViolation[] = [];
  const triangles = triangleCount(group);

  if (triangles > MAX_TRIANGLES) {
    violations.push({ rule: 'budget', path: 'model', message: `The model has ${triangles} triangles, the limit is ${MAX_TRIANGLES}. Remove or simplify pieces.` });
  }

  const overall = new Box3();
  parts.forEach((p) => overall.union(p.bounds));
  const halfW = (spec.footprint.w / 2) * FOOTPRINT_MARGIN;
  const halfD = (spec.footprint.d / 2) * FOOTPRINT_MARGIN;
  if (Math.max(Math.abs(overall.min.x), Math.abs(overall.max.x)) > halfW + 1e-6 || Math.max(Math.abs(overall.min.z), Math.abs(overall.max.z)) > halfD + 1e-6) {
    violations.push({
      rule: 'footprint',
      path: 'model',
      message: `The model spans x ${overall.min.x.toFixed(1)}..${overall.max.x.toFixed(1)} and z ${overall.min.z.toFixed(1)}..${overall.max.z.toFixed(1)} but the footprint allows x ±${halfW.toFixed(1)} and z ±${halfD.toFixed(1)} (footprint plus 10%). Resize or recenter the pieces.`,
    });
  }

  const groundedGroup = new Set<number>();
  for (const group of connectedGroups(parts)) {
    if (group.some((i) => Math.abs(parts[i]!.bounds.min.y) <= CONTACT)) group.forEach((i) => groundedGroup.add(i));
  }
  for (const part of parts) {
    const path = `parts[${part.index}]`;
    const minY = part.bounds.min.y;
    if (minY < -CONTACT) {
      violations.push({ rule: 'grounded', path, message: `${part.type} sinks below the ground (its base is at y=${minY.toFixed(2)}). Raise it so its base is at y=0 or on top of another piece.` });
    } else if (!groundedGroup.has(part.index)) {
      violations.push({ rule: 'grounded', path, message: `${part.type} floats at y=${minY.toFixed(2)} with nothing underneath. Rest it on the ground (y=0) or on top of another piece it touches.` });
    }
  }

  const accent = parts.filter((p) => p.role === 'accent');
  const accentGroups = connectedGroups(accent);
  if (accentGroups.length > 1) {
    for (const extra of accentGroups.slice(1)) {
      const first = accent[Math.min(...extra)]!;
      violations.push({ rule: 'accent', path: `parts[${first.index}]`, message: `${first.type} starts a second separate group of accent pieces. Keep the accent color on one contiguous group or change its role.` });
    }
  }

  return { ok: violations.length === 0, violations, triangles };
}
