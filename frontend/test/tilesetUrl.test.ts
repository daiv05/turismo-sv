import { describe, expect, it } from 'vitest';
import { tilesetUrl } from '../src/tilesetUrl';

describe('tilesetUrl', () => {
  it('uses the current version published by the backend', () => {
    expect(tilesetUrl({ tileset: { version: 'v2', base_url: 'https://cdn.test/tiles/v2/' } })).toBe('https://cdn.test/tiles/v2/tileset.json');
  });

  it('adds the missing slash after the base URL', () => {
    expect(tilesetUrl({ tileset: { version: 'v2', base_url: 'https://cdn.test/tiles/v2' } })).toBe('https://cdn.test/tiles/v2/tileset.json');
  });

  it('lets a developer pick a local build with the override', () => {
    expect(tilesetUrl({ tileset: { version: 'v2', base_url: 'https://cdn.test/v2/' } }, 'smoke')).toBe('/tiles/smoke/tileset.json');
  });

  it('falls back to the local dev build when there is no config or no version', () => {
    expect(tilesetUrl(null)).toBe('/tiles/dev/tileset.json');
    expect(tilesetUrl({ tileset: null })).toBe('/tiles/dev/tileset.json');
  });

  it('encodes the override so it cannot add path segments', () => {
    expect(tilesetUrl(null, '../x/y')).toBe('/tiles/..%2Fx%2Fy/tileset.json');
  });
});
