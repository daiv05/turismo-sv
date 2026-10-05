import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { buildParts, validateModel } from '@turismo/kit';
import { modelToGlb } from './glb';
import { GenerationFailed, runGeneration, type ReferenceImage } from './agent/generate';
import type { LlmClient } from './agent/llm';
import { UploadError, normalizeUpload } from './upload';

export interface Thumbnailer {
  render(glb: Uint8Array, angles?: readonly number[], size?: number): Promise<Buffer[]>;
}

export interface AgentDeps {
  llm: LlmClient;
  fetchImage: (url: string) => Promise<ReferenceImage>;
  postCallback: (url: string, body: Record<string, unknown>) => Promise<void>;
  callbackHosts: string[];
  referenceHosts: string[];
  critiqueRounds?: number;
}

export interface AppDeps {
  token: string;
  renderer: Thumbnailer;
  maxBodyBytes?: number;
  agent?: AgentDeps;
}

export type App = Server & { idle(): Promise<void> };

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

function authorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'The body must be a JSON object');
  }
}

/**
 * HTTP application of the builder service. Laravel is the only client and authenticates with a shared
 * bearer token; the service is never exposed publicly.
 */
function allowedUrl(raw: unknown, hosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    throw new HttpError(400, 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !hosts.includes(url.hostname)) {
    throw new HttpError(400, `Host not allowed: ${url.hostname || 'unknown'}`);
  }
  return url;
}

export function createApp(deps: AppDeps): App {
  const limit = deps.maxBodyBytes ?? 20_000_000;
  const background = new Set<Promise<void>>();

  const generate = async (body: Record<string, unknown>) => {
    const agent = deps.agent;
    if (!agent) throw new HttpError(503, 'The generation agent is not configured');
    const footprint = body.footprint as { w?: unknown; d?: unknown } | undefined;
    if (typeof body.jobId !== 'number' || typeof body.description !== 'string' || body.description.trim() === '' || body.description.length > 4000) {
      throw new HttpError(400, 'jobId and a description of up to 4000 characters are required');
    }
    if (!footprint || typeof footprint.w !== 'number' || typeof footprint.d !== 'number' || footprint.w <= 0 || footprint.d <= 0 || footprint.w > 500 || footprint.d > 500) {
      throw new HttpError(400, 'footprint must have positive w and d up to 500');
    }
    const callback = allowedUrl(body.callbackUrl, agent.callbackHosts);
    const references = (Array.isArray(body.referenceUrls) ? body.referenceUrls : []).slice(0, 6).map((u) => allowedUrl(u, agent.referenceHosts));
    const jobId = body.jobId;
    const description = body.description;
    const size = { w: footprint.w, d: footprint.d };

    const job = (async () => {
      let payload: Record<string, unknown>;
      try {
        const referenceImages = await Promise.all(references.map((u) => agent.fetchImage(u.toString())));
        const result = await runGeneration({
          description,
          footprint: size,
          referenceImages,
          llm: agent.llm,
          renderer: deps.renderer,
          options: { critiqueRounds: agent.critiqueRounds ?? 1 },
        });
        payload = {
          jobId,
          status: 'ok',
          spec: result.spec,
          glb: Buffer.from(result.glb).toString('base64'),
          triangles: validateModel(result.spec).triangles,
          thumbnails: result.thumbnails.map((t) => t.toString('base64')),
          log: result.log,
        };
      } catch (error) {
        const reason = error instanceof GenerationFailed ? error.reason : 'The generation failed unexpectedly';
        if (!(error instanceof GenerationFailed)) console.error('Generation error', error);
        payload = { jobId, status: 'failed', reason };
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await agent.postCallback(callback.toString(), payload);
          return;
        } catch (error) {
          console.error('Callback failed', error);
          await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
        }
      }
    })();
    background.add(job);
    void job.finally(() => background.delete(job));
    return { accepted: true, jobId };
  };

  const build = async (body: Record<string, unknown>) => {
    if (body.spec === undefined) throw new HttpError(400, 'Missing "spec"');
    const report = validateModel(body.spec);
    if (!report.ok) throw new HttpError(422, 'The model breaks the style rules', { error: 'rules', violations: report.violations });
    const { group, spec } = buildParts(body.spec);
    const glb = await modelToGlb(group, { compress: body.compress !== false });

    let thumbnails: string[] = [];
    const warnings: string[] = [];
    if (body.thumbnails !== false) {
      try {
        const images = await deps.renderer.render(glb);
        thumbnails = images.map((image) => image.toString('base64'));
      } catch (error) {
        console.error('Thumbnail rendering failed', error);
        warnings.push('Thumbnails unavailable');
      }
    }
    return { glb: Buffer.from(glb).toString('base64'), triangles: report.triangles, spec, thumbnails, warnings };
  };

  const validateUpload = async (body: Record<string, unknown>) => {
    if (typeof body.glb !== 'string') throw new HttpError(400, 'Missing base64 "glb"');
    const footprint = body.footprint as { w: number; d: number } | undefined;
    try {
      const result = await normalizeUpload(new Uint8Array(Buffer.from(body.glb, 'base64')), footprint ? { footprint } : {});
      return { glb: Buffer.from(result.glb).toString('base64'), triangles: result.triangles, size: result.size, roles: result.roles };
    } catch (error) {
      if (error instanceof UploadError) throw new HttpError(422, error.message, { error: 'upload', code: error.code });
      throw error;
    }
  };

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (path === '/health') return send(res, 200, { status: 'ok' });
        if (!authorized(req, deps.token)) return send(res, 401, { error: 'unauthorized' });

        const routes: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
          '/build': build,
          '/validate-upload': validateUpload,
          '/generate': generate,
        };
        const route = routes[path];
        if (!route) return send(res, 404, { error: 'not found' });
        if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
        const result = await route(await readJson(req, limit));
        send(res, path === '/generate' ? 202 : 200, result);
      } catch (error) {
        if (error instanceof HttpError) return send(res, error.status, { message: error.message, ...error.extra });
        console.error('Unexpected error', error);
        send(res, 500, { message: 'Internal error' });
      }
    })();
  }) as App;
  server.idle = async () => {
    while (background.size > 0) await Promise.all([...background]);
  };
  return server;
}
