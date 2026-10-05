import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentTypeFor, publishDirectory, type ObjectStore } from '../src/publish';

async function tree(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tiles-'));
  await mkdir(join(dir, 'tiles'));
  await writeFile(join(dir, 'tileset.json'), '{"asset":{}}');
  await writeFile(join(dir, 'tiles', '0_0_0.glb'), Buffer.from([1, 2, 3]));
  await writeFile(join(dir, 'tiles', '1_0_0.glb'), Buffer.from([4, 5]));
  return dir;
}

function store(failures = 0): ObjectStore & { puts: Array<{ key: string; type: string; cache: string; size: number }> } {
  const puts: Array<{ key: string; type: string; cache: string; size: number }> = [];
  let left = failures;
  return {
    puts,
    async put(key, body, type, cache) {
      if (left-- > 0) throw new Error('transient');
      puts.push({ key, type, cache, size: body.length });
    },
  };
}

describe('contentTypeFor', () => {
  it('knows the tile formats', () => {
    expect(contentTypeFor('a/tileset.json')).toBe('application/json');
    expect(contentTypeFor('a/0_0_0.glb')).toBe('model/gltf-binary');
    expect(contentTypeFor('a/readme.bin')).toBe('application/octet-stream');
  });
});

describe('publishDirectory', () => {
  it('uploads every file under the prefix with its content type and long lived caching', async () => {
    const s = store();
    const result = await publishDirectory(s, await tree(), 'tiles/v1', { concurrency: 2, retries: 2 });

    expect(s.puts.map((p) => p.key).sort()).toEqual(['tiles/v1/tiles/0_0_0.glb', 'tiles/v1/tiles/1_0_0.glb', 'tiles/v1/tileset.json']);
    expect(s.puts.every((p) => p.cache === 'public, max-age=31536000, immutable')).toBe(true);
    expect(s.puts.find((p) => p.key.endsWith('.glb'))!.type).toBe('model/gltf-binary');
    expect(result).toEqual({ files: 3, bytes: 17 });
  });

  it('uploads the tileset last so a half published version is never loadable', async () => {
    const s = store();
    await publishDirectory(s, await tree(), 'tiles/v1', { concurrency: 1, retries: 0 });

    expect(s.puts.at(-1)!.key).toBe('tiles/v1/tileset.json');
  });

  it('retries transient failures', async () => {
    const s = store(2);
    await publishDirectory(s, await tree(), 'tiles/v1', { concurrency: 1, retries: 3 });

    expect(s.puts).toHaveLength(3);
  });

  it('fails when a file keeps failing, without claiming success', async () => {
    await expect(publishDirectory(store(100), await tree(), 'tiles/v1', { concurrency: 1, retries: 1 })).rejects.toThrow(/transient/);
  });

  it('refuses unsafe prefixes', async () => {
    await expect(publishDirectory(store(), await tree(), '../x', { concurrency: 1, retries: 0 })).rejects.toThrow(RangeError);
    await expect(publishDirectory(store(), await tree(), '', { concurrency: 1, retries: 0 })).rejects.toThrow(RangeError);
  });

  it('rejects a directory without a tileset', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'empty-'));

    await expect(publishDirectory(store(), dir, 'tiles/v1', { concurrency: 1, retries: 0 })).rejects.toThrow(/tileset\.json/);
  });
});
