import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { LlmClient, LlmResponse } from '../src/agent/llm';
import { createApp, type App } from '../src/server';

const TOKEN = 'test-token-0123456789';
const good = { kitVersion: '1.0', footprint: { w: 40, d: 40 }, parts: [{ type: 'hall', params: { w: 20, d: 20, h: 10 }, pos: [0, 0, 0], rot: 0, role: 'neutral' }] };
const usage = { inputTokens: 5, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };
const answer = (input: unknown): LlmResponse => ({ content: [{ type: 'tool_use', id: 't', name: 'submit_model', input }], stopReason: 'tool_use', usage });

const callbacks: Array<{ url: string; body: Record<string, unknown> }> = [];
const postCallback = vi.fn(async (url: string, body: Record<string, unknown>) => void callbacks.push({ url, body }));
const fetchImage = vi.fn(async () => ({ mediaType: 'image/jpeg', base64: 'AAAA' }));
let responses: LlmResponse[] = [];
const llm: LlmClient = { complete: vi.fn(async () => responses.shift() ?? answer(good)) };

let app: App;
let base: string;

beforeAll(async () => {
  app = createApp({
    token: TOKEN,
    renderer: { render: async () => [Buffer.from('p')] },
    agent: { llm, fetchImage, postCallback, callbackHosts: ['laravel.test'], referenceHosts: ['cdn.test'], critiqueRounds: 0 },
  });
  await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => app.close(() => r())));

const generate = (body: unknown, token = TOKEN) =>
  fetch(`${base}/generate`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const request = (over: object = {}) => ({ jobId: 7, description: 'Iglesia', footprint: { w: 40, d: 40 }, callbackUrl: 'https://laravel.test/api/internal/models/7/callback', referenceUrls: [], ...over });

describe('POST /generate', () => {
  it('accepts the job right away and reports the result to the callback', async () => {
    callbacks.length = 0;
    responses = [answer(good)];
    const response = await generate(request({ referenceUrls: ['https://cdn.test/a.jpg'] }));

    expect(response.status).toBe(202);
    await app.idle();
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0]!.url).toBe('https://laravel.test/api/internal/models/7/callback');
    expect(callbacks[0]!.body).toMatchObject({ jobId: 7, status: 'ok', triangles: expect.any(Number) });
    expect((callbacks[0]!.body.log as { usage: { inputTokens: number } }).usage.inputTokens).toBeGreaterThan(0);
    expect(fetchImage).toHaveBeenCalledWith('https://cdn.test/a.jpg');
  });

  it('reports a failed generation with its reason', async () => {
    callbacks.length = 0;
    const bad = { ...good, parts: [{ ...good.parts[0], pos: [0, 30, 0] }] };
    responses = [answer(bad), answer(bad), answer(bad), answer(bad)];
    await generate(request());
    await app.idle();

    expect(callbacks[0]!.body).toMatchObject({ jobId: 7, status: 'failed' });
    expect(String(callbacks[0]!.body.reason)).toContain('floats');
  });

  it('refuses callbacks and references to hosts outside the allowlists', async () => {
    expect((await generate(request({ callbackUrl: 'https://evil.test/x' }))).status).toBe(400);
    expect((await generate(request({ referenceUrls: ['http://169.254.169.254/latest'] }))).status).toBe(400);
    expect((await generate(request({ callbackUrl: 'file:///etc/passwd' }))).status).toBe(400);
  });

  it('validates the request shape', async () => {
    expect((await generate(request({ description: '' }))).status).toBe(400);
    expect((await generate(request({ footprint: { w: -1, d: 2 } }))).status).toBe(400);
    expect((await generate(request({ jobId: 'x' }))).status).toBe(400);
  });

  it('requires the token', async () => {
    expect((await generate(request(), 'wrong')).status).toBe(401);
  });

  it('answers 503 when the agent is not configured', async () => {
    const bare = createApp({ token: TOKEN, renderer: { render: async () => [] } });
    await new Promise<void>((r) => bare.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(bare.address() as AddressInfo).port}/generate`;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(request()) });
    await new Promise<void>((r) => bare.close(() => r()));

    expect(res.status).toBe(503);
  });
});
