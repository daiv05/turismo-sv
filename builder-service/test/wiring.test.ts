import { describe, expect, it, vi } from 'vitest';
import { agentFromEnv, downloadImage, postJson } from '../src/agent/wiring';

const res = (body: BodyInit, init: ResponseInit) => new Response(body, init);

describe('downloadImage', () => {
  it('returns base64 and the media type', async () => {
    const f = vi.fn(async () => res(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg; charset=binary' } })) as unknown as typeof fetch;

    expect(await downloadImage('https://cdn.test/a.jpg', f)).toEqual({ mediaType: 'image/jpeg', base64: 'AQID' });
  });

  it('rejects non images, errors and oversized files', async () => {
    const html = (async () => res('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    const missing = (async () => res('', { status: 404 })) as unknown as typeof fetch;
    const huge = (async () => res(new Uint8Array(6 * 1024 * 1024), { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;

    await expect(downloadImage('u', html)).rejects.toThrow(/Unsupported/);
    await expect(downloadImage('u', missing)).rejects.toThrow(/404/);
    await expect(downloadImage('u', huge)).rejects.toThrow(/5 MB/);
  });

  it('does not follow redirects, which could reach internal hosts', async () => {
    const f = vi.fn(async () => res('', { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;
    await downloadImage('u', f);

    expect((vi.mocked(f).mock.calls[0]![1] as RequestInit).redirect).toBe('error');
  });
});

describe('postJson', () => {
  it('posts with the bearer token and fails on error statuses', async () => {
    const ok = vi.fn(async () => res('{}', { status: 200 })) as unknown as typeof fetch;
    await postJson('tok', ok)('https://laravel.test/x', { a: 1 });
    const init = vi.mocked(ok).mock.calls[0]![1] as RequestInit;

    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"a":1}');
    await expect(postJson('tok', (async () => res('', { status: 500 })) as unknown as typeof fetch)('u', {})).rejects.toThrow(/500/);
  });
});

describe('agentFromEnv', () => {
  it('is disabled without an API key', () => {
    expect(agentFromEnv({}, 'tok')).toBeUndefined();
  });

  it('parses the host allowlists when configured', () => {
    const agent = agentFromEnv({ ANTHROPIC_API_KEY: 'k', CALLBACK_HOSTS: 'php, laravel.test', REFERENCE_HOSTS: 'localhost' }, 'tok');

    expect(agent?.callbackHosts).toEqual(['php', 'laravel.test']);
    expect(agent?.referenceHosts).toEqual(['localhost']);
  });
});
