import Anthropic from '@anthropic-ai/sdk';
import type { AgentDeps } from '../server';
import { AnthropicLlm } from './llm';
import type { ReferenceImage } from './generate';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function downloadImage(url: string, fetcher: typeof fetch = fetch): Promise<ReferenceImage> {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Reference image request failed with status ${response.status}`);
  const mediaType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!IMAGE_TYPES.has(mediaType)) throw new Error(`Unsupported reference image type: ${mediaType || 'unknown'}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Reference image is larger than 5 MB');
  return { mediaType, base64: bytes.toString('base64') };
}

export function postJson(token: string, fetcher: typeof fetch = fetch) {
  return async (url: string, body: Record<string, unknown>): Promise<void> => {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Callback answered ${response.status}`);
  };
}

/**
 * Builds the agent dependencies from the environment, or returns undefined when no API key is configured so the
 * service starts and /generate answers 503 instead of failing at runtime.
 */
export function agentFromEnv(env: NodeJS.ProcessEnv, token: string): AgentDeps | undefined {
  if (!env.ANTHROPIC_API_KEY) return undefined;
  const hosts = (value: string | undefined) => (value ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return {
    llm: new AnthropicLlm(new Anthropic(), env.AGENT_MODEL || undefined),
    fetchImage: (url) => downloadImage(url),
    postCallback: postJson(token),
    callbackHosts: hosts(env.CALLBACK_HOSTS),
    referenceHosts: hosts(env.REFERENCE_HOSTS),
    critiqueRounds: Number(env.CRITIQUE_ROUNDS ?? 1),
  };
}
