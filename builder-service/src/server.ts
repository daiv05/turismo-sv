import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { buildParts, validateModel } from '@turismo/kit';
import { modelToGlb } from './glb';
import { UploadError, normalizeUpload } from './upload';

export interface Thumbnailer {
  render(glb: Uint8Array, angles?: readonly number[], size?: number): Promise<Buffer[]>;
}

export interface AppDeps {
  token: string;
  renderer: Thumbnailer;
  maxBodyBytes?: number;
}

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
export function createApp(deps: AppDeps): Server {
  const limit = deps.maxBodyBytes ?? 20_000_000;

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

  return createServer((req, res) => {
    void (async () => {
      try {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (path === '/health') return send(res, 200, { status: 'ok' });
        if (!authorized(req, deps.token)) return send(res, 401, { error: 'unauthorized' });

        const routes: Record<string, (body: Record<string, unknown>) => Promise<unknown>> = {
          '/build': build,
          '/validate-upload': validateUpload,
        };
        const route = routes[path];
        if (!route) return send(res, 404, { error: 'not found' });
        if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
        send(res, 200, await route(await readJson(req, limit)));
      } catch (error) {
        if (error instanceof HttpError) return send(res, error.status, { message: error.message, ...error.extra });
        console.error('Unexpected error', error);
        send(res, 500, { message: 'Internal error' });
      }
    })();
  });
}
