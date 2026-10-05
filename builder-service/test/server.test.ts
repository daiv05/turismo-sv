import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server';

const TOKEN = 'test-token';
const spec = {
  kitVersion: '1.0',
  footprint: { w: 40, d: 40 },
  parts: [
    { type: 'hall', params: { w: 20, d: 20, h: 10 }, pos: [0, 0, 0], rot: 0, role: 'neutral' },
    { type: 'dome', params: { r: 6, drum: 1 }, pos: [0, 10, 0], rot: 0, role: 'accent' },
  ],
};

const render = vi.fn(async () => [Buffer.from('png-1'), Buffer.from('png-2'), Buffer.from('png-3')]);
let server: Server;
let base: string;

beforeAll(async () => {
  server = createApp({ token: TOKEN, renderer: { render }, maxBodyBytes: 200_000 });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const call = (path: string, body?: unknown, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }, method = 'POST') =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });

describe('GET /health', () => {
  it('answers without credentials', async () => {
    const response = await call('/health', undefined, {}, 'GET');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('authentication', () => {
  it('rejects missing, malformed and wrong tokens', async () => {
    for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer wrong' }, { authorization: 'Bearer test-toke' }]) {
      expect((await call('/build', { spec }, headers)).status).toBe(401);
    }
  });
});

describe('POST /build', () => {
  it('validates, builds and returns the glb, triangle count and thumbnails', async () => {
    const response = await call('/build', { spec });
    const json = (await response.json()) as { glb: string; triangles: number; thumbnails: string[]; spec: unknown };

    expect(response.status).toBe(200);
    expect(json.triangles).toBeGreaterThan(100);
    expect(json.thumbnails.map((t) => Buffer.from(t, 'base64').toString())).toEqual(['png-1', 'png-2', 'png-3']);
    await MeshoptDecoder.ready;
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(Buffer.from(json.glb, 'base64'));
    expect(doc.getRoot().listMeshes()).toHaveLength(1);
  });

  it('skips thumbnails when asked', async () => {
    render.mockClear();
    const json = (await (await call('/build', { spec, thumbnails: false })).json()) as { thumbnails: string[] };

    expect(json.thumbnails).toEqual([]);
    expect(render).not.toHaveBeenCalled();
  });

  it('returns the style violations with their paths when the rules fail', async () => {
    const bad = { ...spec, parts: [...spec.parts, { type: 'dome', params: { r: 3 }, pos: [0, 40, 0], rot: 0, role: 'accent' }] };
    const response = await call('/build', { spec: bad });
    const json = (await response.json()) as { error: string; violations: Array<{ rule: string; path: string }> };

    expect(response.status).toBe(422);
    expect(json.error).toBe('rules');
    expect(json.violations).toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'grounded', path: 'parts[2]' })]));
  });

  it('returns schema problems the same way', async () => {
    const response = await call('/build', { spec: { kitVersion: '1.0', footprint: { w: 1, d: 1 }, parts: [{ type: 'hall', params: { w: -1, d: 1, h: 1 }, pos: [0, 0, 0], role: 'neutral' }] } });
    const json = (await response.json()) as { violations: Array<{ rule: string }> };

    expect(response.status).toBe(422);
    expect(json.violations[0]?.rule).toBe('schema');
  });

  it('still returns the glb when thumbnails fail, with a warning', async () => {
    render.mockRejectedValueOnce(new Error('chromium missing'));
    const response = await call('/build', { spec });
    const json = (await response.json()) as { glb: string; thumbnails: string[]; warnings: string[] };

    expect(response.status).toBe(200);
    expect(json.glb.length).toBeGreaterThan(100);
    expect(json.thumbnails).toEqual([]);
    expect(json.warnings).toEqual(['Thumbnails unavailable']);
  });

  it('requires a spec', async () => {
    expect((await call('/build', {})).status).toBe(400);
  });
});

describe('POST /validate-upload', () => {
  it('rejects bad base64 and files that are not glb', async () => {
    expect((await call('/validate-upload', { glb: 123 })).status).toBe(400);
    const response = await call('/validate-upload', { glb: Buffer.from('not a glb').toString('base64') });

    expect(response.status).toBe(422);
    expect(((await response.json()) as { code: string }).code).toBe('invalid');
  });
});

describe('transport', () => {
  it('rejects malformed JSON', async () => {
    expect((await call('/build', '{nope')).status).toBe(400);
  });

  it('rejects bodies over the limit', async () => {
    expect((await call('/build', JSON.stringify({ spec, padding: 'x'.repeat(250_000) }))).status).toBe(413);
  });

  it('answers 404 for unknown routes and 405 for wrong methods', async () => {
    expect((await call('/nope', {})).status).toBe(404);
    expect((await call('/build', undefined, { authorization: `Bearer ${TOKEN}` }, 'GET')).status).toBe(405);
  });

  it('does not leak internals on unexpected errors', async () => {
    const original = render.getMockImplementation();
    render.mockImplementationOnce(() => {
      throw new Error('boom /secret/path');
    });
    const text = await (await call('/build', { spec })).text();

    expect(text).not.toContain('/secret/path');
    render.mockImplementation(original!);
  });
});
