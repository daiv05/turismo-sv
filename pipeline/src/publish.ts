import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string, cacheControl: string): Promise<void>;
}

export interface PublishOptions {
  concurrency: number;
  retries: number;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const TYPES: Record<string, string> = { '.json': 'application/json', '.glb': 'model/gltf-binary' };

export function contentTypeFor(path: string): string {
  return TYPES[extname(path)] ?? 'application/octet-stream';
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)])));
  return nested.flat();
}

/**
 * Uploads a built tileset folder under a versioned prefix. Files are immutable because the prefix carries the
 * version, and `tileset.json` goes last so a version that is only partly uploaded can never be loaded.
 *
 * @throws {RangeError} When the prefix is empty or could escape the bucket folder.
 * @throws {Error} When the folder has no tileset.json or an upload keeps failing.
 */
export async function publishDirectory(store: ObjectStore, dir: string, prefix: string, options: PublishOptions): Promise<{ files: number; bytes: number }> {
  if (!prefix || prefix.startsWith('/') || prefix.split('/').includes('..')) {
    throw new RangeError(`Unsafe publish prefix: "${prefix}"`);
  }
  const files = await listFiles(dir);
  const keyOf = (file: string): string => `${prefix}/${relative(dir, file).split(sep).join('/')}`;
  const tileset = files.find((f) => relative(dir, f) === 'tileset.json');
  if (!tileset) throw new Error(`No tileset.json found in ${dir}`);

  let bytes = 0;
  const upload = async (file: string): Promise<void> => {
    const body = await readFile(file);
    for (let attempt = 0; ; attempt++) {
      try {
        await store.put(keyOf(file), body, contentTypeFor(file), IMMUTABLE);
        bytes += body.length;
        return;
      } catch (error) {
        if (attempt >= options.retries) throw error;
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }
  };

  const queue = files.filter((f) => f !== tileset);
  const workers = Array.from({ length: Math.max(1, options.concurrency) }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) await upload(file);
  });
  await Promise.all(workers);
  await upload(tileset);
  return { files: files.length, bytes };
}
