import Anthropic from '@anthropic-ai/sdk';

export interface LlmTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type LlmContent =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; base64: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean };

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: LlmContent[];
}

export interface LlmRequest {
  system: string;
  tools: LlmTool[];
  messages: LlmMessage[];
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResponse {
  content: LlmContent[];
  stopReason: string | null;
  usage: LlmUsage;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

function toParam(message: LlmMessage): Anthropic.MessageParam {
  return {
    role: message.role,
    content: message.content.map((block): Anthropic.ContentBlockParam => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'image':
          return { type: 'image', source: { type: 'base64', media_type: block.mediaType as 'image/png', data: block.base64 } };
        case 'tool_use':
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        case 'tool_result':
          return { type: 'tool_result', tool_use_id: block.toolUseId, content: block.content, ...(block.isError ? { is_error: true } : {}) };
      }
    }),
  };
}

/**
 * Claude through the official SDK. The tool is not forced because forced tool choice is rejected by the current
 * models; the system prompt and the loop's feedback make the model call it instead. The system prompt carries a
 * cache breakpoint because the style guide is identical across requests.
 */
export class AnthropicLlm implements LlmClient {
  constructor(
    private readonly client: Pick<Anthropic, 'messages'>,
    private readonly model: string = DEFAULT_MODEL,
    private readonly maxTokens = 16_000,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      tools: request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema, strict: false })),
      tool_choice: { type: 'auto' },
      messages: request.messages.map(toParam),
    });
    if (response.stop_reason === 'refusal') {
      return { content: [{ type: 'text', text: 'The model declined this request.' }], stopReason: 'refusal', usage: this.usage(response.usage) };
    }
    return {
      content: response.content.flatMap((block): LlmContent[] => {
        if (block.type === 'text') return [{ type: 'text', text: block.text }];
        if (block.type === 'tool_use') return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }];
        return [];
      }),
      stopReason: response.stop_reason,
      usage: this.usage(response.usage),
    };
  }

  private usage(u: Anthropic.Usage): LlmUsage {
    return {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    };
  }
}
