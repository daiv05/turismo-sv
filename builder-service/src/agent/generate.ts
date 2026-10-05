import { buildParts, buildStyleGuide, modelSpecJsonSchema, validateModel, type ModelSpec, type RuleViolation } from '@turismo/kit';
import { modelToGlb } from '../glb';
import type { Thumbnailer } from '../server';
import type { LlmClient, LlmContent, LlmMessage, LlmResponse, LlmUsage } from './llm';

export class GenerationFailed extends Error {
  override readonly name = 'GenerationFailed';

  constructor(readonly reason: string) {
    super(reason);
  }
}

export interface ReferenceImage {
  mediaType: string;
  base64: string;
}

export interface GenerationOptions {
  fixRounds?: number;
  critiqueRounds?: number;
}

export interface GenerationInput {
  description: string;
  footprint: { w: number; d: number };
  referenceImages: readonly ReferenceImage[];
  llm: LlmClient;
  renderer: Thumbnailer;
  options?: GenerationOptions;
}

export interface Iteration {
  kind: 'generate' | 'fix' | 'critique';
  violations: number;
  usage: LlmUsage;
}

export interface GenerationLog {
  iterations: Iteration[];
  usage: LlmUsage;
  notes: string[];
}

export interface GenerationResult {
  spec: ModelSpec;
  glb: Uint8Array;
  thumbnails: Buffer[];
  log: GenerationLog;
}

const TOOL = 'submit_model';
const EMPTY: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

function add(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

function describeViolations(violations: readonly RuleViolation[]): string {
  return violations.map((v) => `- ${v.path} [${v.rule}]: ${v.message}`).join('\n');
}

function images(list: readonly ReferenceImage[]): LlmContent[] {
  return list.map((i) => ({ type: 'image', mediaType: i.mediaType, base64: i.base64 }));
}

/**
 * Composes a kit document with Claude and checks it with the same validator the builder uses. Invalid answers are
 * sent back with their problems for up to `fixRounds` corrections. Then it renders the model and asks Claude to
 * compare it with the reference photos, keeping the improvement only when it also passes the rules.
 *
 * @throws {GenerationFailed} When no valid document is obtained from the first request.
 */
export async function runGeneration(input: GenerationInput): Promise<GenerationResult> {
  const fixRounds = input.options?.fixRounds ?? 3;
  const critiqueRounds = input.options?.critiqueRounds ?? 1;
  const log: GenerationLog = { iterations: [], usage: EMPTY, notes: [] };
  const request = {
    system: buildStyleGuide(),
    tools: [{ name: TOOL, description: 'Submit the kit document that models the site. Always answer by calling this tool.', inputSchema: modelSpecJsonSchema() }],
  };

  const messages: LlmMessage[] = [
    {
      role: 'user',
      content: [
        ...images(input.referenceImages),
        {
          type: 'text',
          text: `Model this site with the kit and answer by calling ${TOOL}.\n\nDescription: ${input.description}\n\nFootprint (meters): ${JSON.stringify(input.footprint)}. Use kitVersion "1.0".${input.referenceImages.length ? ' Use the attached photos as reference.' : ''}`,
        },
      ],
    },
  ];

  const ask = async (kind: Iteration['kind']): Promise<{ spec: unknown | undefined; response: LlmResponse; id: string | null }> => {
    const response = await input.llm.complete({ ...request, messages });
    log.usage = add(log.usage, response.usage);
    const call = response.content.find((b): b is Extract<LlmContent, { type: 'tool_use' }> => b.type === 'tool_use' && b.name === TOOL);
    messages.push({ role: 'assistant', content: response.content });
    log.iterations.push({ kind, violations: 0, usage: response.usage });
    return { spec: call?.input, response, id: call?.id ?? null };
  };

  const refine = async (first: Iteration['kind'], limit: number): Promise<{ spec?: unknown; lastProblems: string }> => {
    let kind = first;
    let lastProblems = 'The model never called the tool.';
    for (let attempt = 0; attempt <= limit; attempt++) {
      const { spec, id } = await ask(kind);
      if (spec === undefined) {
        lastProblems = 'The model answered without calling the tool.';
        messages.push({ role: 'user', content: [{ type: 'text', text: `Answer by calling ${TOOL} with a complete kit document.` }] });
      } else {
        const report = validateModel(spec);
        log.iterations[log.iterations.length - 1]!.violations = report.violations.length;
        if (report.ok) return { spec, lastProblems: '' };
        lastProblems = describeViolations(report.violations);
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', toolUseId: id!, isError: true, content: `The document was rejected:\n${lastProblems}\nFix every problem and call ${TOOL} again.` }],
        });
      }
      kind = 'fix';
    }
    return { lastProblems };
  };

  const first = await refine('generate', fixRounds);
  if (first.spec === undefined) throw new GenerationFailed(`No valid model after ${fixRounds} corrections:\n${first.lastProblems}`);
  let best = first.spec;

  const render = async (spec: unknown): Promise<{ glb: Uint8Array; thumbnails: Buffer[] }> => {
    const glb = await modelToGlb(buildParts(spec).group, { compress: true });
    try {
      return { glb, thumbnails: await input.renderer.render(glb) };
    } catch {
      log.notes.push('Thumbnails unavailable');
      return { glb, thumbnails: [] };
    }
  };

  let rendered = await render(best);
  for (let round = 0; round < critiqueRounds && rendered.thumbnails.length > 0; round++) {
    const checkpoint = messages.length;
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'These are renders of your model from three angles, followed by the reference photos if any.' },
        ...rendered.thumbnails.map((t): LlmContent => ({ type: 'image', mediaType: 'image/png', base64: t.toString('base64') })),
        ...images(input.referenceImages),
        { type: 'text', text: `Compare them with the description and the photos. Call ${TOOL} with an improved document, or with the same one if it is already good.` },
      ],
    });
    // The assistant turn that produced the last tool call needs a result before a new user turn.
    const last = messages[checkpoint - 1];
    if (last?.role === 'assistant') {
      const call = last.content.find((b) => b.type === 'tool_use');
      if (call && call.type === 'tool_use') {
        (messages[checkpoint] as LlmMessage).content.unshift({ type: 'tool_result', toolUseId: call.id, content: 'Accepted. Renders follow.' });
      }
    }
    const improved = await refine('critique', fixRounds);
    if (improved.spec === undefined) {
      log.notes.push(`The critique round ${round + 1} did not produce a valid model; keeping the previous one.`);
      break;
    }
    best = improved.spec;
    rendered = await render(best);
  }

  return { spec: buildParts(best).spec, glb: rendered.glb, thumbnails: rendered.thumbnails, log };
}
