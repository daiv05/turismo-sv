import { describe, expect, it, vi } from 'vitest';
import { runGeneration, GenerationFailed } from '../src/agent/generate';
import type { LlmClient, LlmRequest, LlmResponse } from '../src/agent/llm';

const good = {
  kitVersion: '1.0',
  footprint: { w: 40, d: 40 },
  parts: [
    { type: 'hall', params: { w: 20, d: 20, h: 10 }, pos: [0, 0, 0], rot: 0, role: 'neutral' },
    { type: 'dome', params: { r: 6, drum: 1 }, pos: [0, 10, 0], rot: 0, role: 'accent' },
  ],
};
const floating = { ...good, parts: [...good.parts, { type: 'dome', params: { r: 3 }, pos: [0, 40, 0], rot: 0, role: 'accent' }] };

const toolUse = (input: unknown, id = 'tu_1'): LlmResponse => ({
  content: [{ type: 'tool_use', id, name: 'submit_model', input }],
  stopReason: 'tool_use',
  usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 },
});
const text = (t: string): LlmResponse => ({ content: [{ type: 'text', text: t }], stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 } });

function llm(...responses: LlmResponse[]): LlmClient & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    complete: vi.fn(async (request: LlmRequest) => {
      calls.push(structuredClone(request));
      const next = responses.shift();
      if (!next) throw new Error('unexpected extra LLM call');
      return next;
    }),
  };
}
const renderer = { render: vi.fn(async () => [Buffer.from('a'), Buffer.from('b'), Buffer.from('c')]) };
const base = { description: 'Una iglesia con cúpula azul', footprint: { w: 40, d: 40 }, referenceImages: [], renderer };

describe('runGeneration', () => {
  it('returns the model when the first answer is valid and critique is off', async () => {
    const result = await runGeneration({ ...base, llm: llm(toolUse(good)), options: { critiqueRounds: 0 } });

    expect(result.spec).toEqual(expect.objectContaining({ kitVersion: '1.0' }));
    expect(result.glb.byteLength).toBeGreaterThan(100);
    expect(result.thumbnails).toHaveLength(3);
    expect(result.log.iterations).toHaveLength(1);
  });

  it('sends the style guide, the schema tool and the description, without forcing the tool', async () => {
    const fake = llm(toolUse(good));
    await runGeneration({ ...base, llm: fake, options: { critiqueRounds: 0 } });
    const request = fake.calls[0]!;

    expect(request.system).toContain('Style guide');
    expect(request.tools[0]).toMatchObject({ name: 'submit_model' });
    expect(JSON.stringify(request.tools[0]!.inputSchema)).toContain('footprint');
    expect(JSON.stringify(request.messages)).toContain('Una iglesia con cúpula azul');
    expect(request).not.toHaveProperty('toolChoice');
  });

  it('feeds validation errors back and accepts the corrected model', async () => {
    const fake = llm(toolUse(floating, 'a'), toolUse(good, 'b'));
    const result = await runGeneration({ ...base, llm: fake, options: { critiqueRounds: 0 } });
    const feedback = JSON.stringify(fake.calls[1]!.messages.at(-1));

    expect(feedback).toContain('tool_result');
    expect(feedback).toContain('floats');
    expect(feedback).toContain('parts[2]');
    expect(result.log.iterations.map((i) => i.kind)).toEqual(['generate', 'fix']);
  });

  it('gives up after three failed corrections and reports the last problems', async () => {
    const fake = llm(toolUse(floating, '1'), toolUse(floating, '2'), toolUse(floating, '3'), toolUse(floating, '4'));

    await expect(runGeneration({ ...base, llm: fake, options: { critiqueRounds: 0 } })).rejects.toMatchObject({ name: 'GenerationFailed', reason: expect.stringContaining('floats') });
    expect(fake.calls).toHaveLength(4);
  });

  it('asks again when the model answers with text instead of the tool', async () => {
    const fake = llm(text('Claro, aquí tienes...'), toolUse(good));
    const result = await runGeneration({ ...base, llm: fake, options: { critiqueRounds: 0 } });

    expect(result.spec).toBeDefined();
    expect(JSON.stringify(fake.calls[1]!.messages.at(-1))).toMatch(/submit_model/);
  });

  it('runs the visual critique with the renders and the reference photos, and keeps the improved model', async () => {
    const improved = { ...good, parts: [...good.parts, { type: 'plaza-floor', params: { w: 30, d: 30 }, pos: [0, 0, 0], rot: 0, role: 'secondary' }] };
    const fake = llm(toolUse(good, 'a'), toolUse(improved, 'b'));
    const result = await runGeneration({ ...base, referenceImages: [{ mediaType: 'image/jpeg', base64: 'AAAA' }], llm: fake, options: { critiqueRounds: 1 } });
    const critique = JSON.stringify(fake.calls[1]!.messages.at(-1));

    expect(critique.match(/"type":"image"/g)?.length).toBe(4);
    expect(result.spec.parts).toHaveLength(3);
    expect(result.log.iterations.map((i) => i.kind)).toEqual(['generate', 'critique']);
  });

  it('keeps the previous model when the critique proposes something invalid', async () => {
    const fake = llm(toolUse(good, 'a'), toolUse(floating, 'b'), toolUse(floating, 'c'), toolUse(floating, 'd'), toolUse(floating, 'e'));
    const result = await runGeneration({ ...base, llm: fake, options: { critiqueRounds: 1 } });

    expect(result.spec.parts).toHaveLength(2);
    expect(result.log.notes.join(' ')).toMatch(/critique/i);
  });

  it('accumulates token usage across calls', async () => {
    const result = await runGeneration({ ...base, llm: llm(toolUse(good), toolUse(good)), options: { critiqueRounds: 1 } });

    expect(result.log.usage).toEqual({ inputTokens: 2000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });

  it('still returns the model when thumbnails cannot be rendered', async () => {
    const broken = { render: vi.fn(async () => { throw new Error('no chromium'); }) };
    const result = await runGeneration({ ...base, renderer: broken, llm: llm(toolUse(good)), options: { critiqueRounds: 0 } });

    expect(result.thumbnails).toEqual([]);
  });

  it('exposes GenerationFailed as an error type', () => {
    expect(new GenerationFailed('x')).toBeInstanceOf(Error);
  });
});
