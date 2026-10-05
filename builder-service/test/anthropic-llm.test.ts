import { describe, expect, it, vi } from 'vitest';
import { AnthropicLlm } from '../src/agent/llm';

function fake(response: object) {
  const create = vi.fn(async (_body: Record<string, unknown>) => response);
  return { create, client: { messages: { create } } as never };
}

const usage = { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 };

describe('AnthropicLlm', () => {
  it('sends the current model, a cached system prompt, the tool and images, without forcing the tool', async () => {
    const { create, client } = fake({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage });
    await new AnthropicLlm(client).complete({
      system: 'STYLE',
      tools: [{ name: 'submit_model', description: 'd', inputSchema: { type: 'object' } }],
      messages: [{ role: 'user', content: [{ type: 'image', mediaType: 'image/png', base64: 'QQ==' }, { type: 'text', text: 'hi' }] }],
    });
    const body = create.mock.calls[0]![0] as Record<string, any>;

    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.system[0]).toMatchObject({ text: 'STYLE', cache_control: { type: 'ephemeral' } });
    expect(body.tools[0]).toMatchObject({ name: 'submit_model', input_schema: { type: 'object' } });
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QQ==' } });
  });

  it('maps tool use blocks, tool results and usage', async () => {
    const { create, client } = fake({ content: [{ type: 'tool_use', id: 'tu', name: 'submit_model', input: { a: 1 } }], stop_reason: 'tool_use', usage });
    const result = await new AnthropicLlm(client).complete({
      system: 's',
      tools: [],
      messages: [{ role: 'user', content: [{ type: 'tool_result', toolUseId: 'x', content: 'bad', isError: true }] }],
    });

    expect(result.content).toEqual([{ type: 'tool_use', id: 'tu', name: 'submit_model', input: { a: 1 } }]);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 2 });
    expect((create.mock.calls[0]![0] as any).messages[0].content[0]).toEqual({ type: 'tool_result', tool_use_id: 'x', content: 'bad', is_error: true });
  });

  it('turns a refusal into a text answer instead of throwing', async () => {
    const { client } = fake({ content: [], stop_reason: 'refusal', usage });
    const result = await new AnthropicLlm(client).complete({ system: 's', tools: [], messages: [] });

    expect(result.stopReason).toBe('refusal');
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });
});
