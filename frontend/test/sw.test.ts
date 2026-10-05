import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Strategy {
  cache: string;
  mode: string;
  limit?: number;
}
type StrategyFor = (url: string, request: { method: string; mode: string }, origin: string) => Strategy | null;

const source = readFileSync(new URL('../../backend/public/sw.js', import.meta.url), 'utf8');
const listeners: Record<string, unknown> = {};
const fakeSelf = { addEventListener: (type: string, fn: unknown) => (listeners[type] = fn), location: { origin: 'https://turismo.test' } } as Record<string, unknown>;
new Function('self', 'caches', source)(fakeSelf, {});
const strategyFor = fakeSelf.strategyFor as StrategyFor;
const get = { method: 'GET', mode: 'cors' };
const origin = 'https://turismo.test';

describe('service worker strategies', () => {
  it('serves page navigations network first so content stays fresh, with the cached shell offline', () => {
    expect(strategyFor(`${origin}/lugar/x`, { method: 'GET', mode: 'navigate' }, origin)).toEqual({ cache: 'shell-v1', mode: 'network-first' });
  });

  it('caches the hashed build assets forever', () => {
    expect(strategyFor(`${origin}/app/assets/index-abc.js`, get, origin)).toMatchObject({ mode: 'cache-first', cache: 'assets-v1' });
  });

  it('caches terrain tiles from any host with a size limit', () => {
    expect(strategyFor('https://cdn.test/tiles/v3/tiles/5_12_18.glb', get, origin)).toMatchObject({ mode: 'cache-first', cache: 'tiles-v1', limit: 400 });
    expect(strategyFor('http://127.0.0.1:8333/turismo/tiles/dev/tileset.json', get, origin)).toMatchObject({ cache: 'tiles-v1' });
  });

  it('revalidates model, sprite and photo files in the background', () => {
    expect(strategyFor('https://cdn.test/models/1/v2/model.glb', get, origin)).toMatchObject({ mode: 'stale-while-revalidate', cache: 'content-v1' });
    expect(strategyFor('https://cdn.test/sprites/a.png', get, origin)).toMatchObject({ cache: 'content-v1' });
  });

  it('serves the public API network first and never touches the internal one', () => {
    expect(strategyFor(`${origin}/api/places?cell=2/0/0`, get, origin)).toMatchObject({ mode: 'network-first', cache: 'api-v1' });
    expect(strategyFor(`${origin}/api/internal/models/1/callback`, get, origin)).toBeNull();
  });

  it('leaves unrelated requests, other origins and non GET requests alone', () => {
    expect(strategyFor(`${origin}/admin/places`, get, origin)).toBeNull();
    expect(strategyFor('https://evil.test/app/assets/x.js', get, origin)).toBeNull();
    expect(strategyFor('https://evil.test/api/places', get, origin)).toBeNull();
    expect(strategyFor(`${origin}/api/places`, { method: 'POST', mode: 'cors' }, origin)).toBeNull();
  });

  it('registers the lifecycle handlers', () => {
    expect(Object.keys(listeners).sort()).toEqual(['activate', 'fetch', 'install']);
  });
});
