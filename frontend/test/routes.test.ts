import { describe, expect, it } from 'vitest';
import { parseRoute, pathFor } from '../src/routes';

describe('parseRoute', () => {
  it('recognizes place and zone deep links', () => {
    expect(parseRoute('/lugar/catedral-metropolitana')).toEqual({ kind: 'place', slug: 'catedral-metropolitana' });
    expect(parseRoute('/zona/centro-historico')).toEqual({ kind: 'zone', slug: 'centro-historico' });
  });

  it('treats everything else as home', () => {
    for (const path of ['/', '', '/otra/cosa', '/lugar', '/lugar/', '/admin']) expect(parseRoute(path)).toEqual({ kind: 'home' });
  });

  it('ignores trailing slashes and decodes the slug', () => {
    expect(parseRoute('/lugar/a%20b/')).toEqual({ kind: 'place', slug: 'a b' });
  });

  it('refuses malformed escapes and nested paths', () => {
    expect(parseRoute('/lugar/%E0%A4%A')).toEqual({ kind: 'home' });
    expect(parseRoute('/lugar/a/b')).toEqual({ kind: 'home' });
  });
});

describe('pathFor', () => {
  it('builds the deep link of a place, encoding the slug', () => {
    expect(pathFor({ kind: 'place', slug: 'plaza-libertad' })).toBe('/lugar/plaza-libertad');
    expect(pathFor({ kind: 'place', slug: 'a b' })).toBe('/lugar/a%20b');
    expect(pathFor({ kind: 'zone', slug: 'centro' })).toBe('/zona/centro');
    expect(pathFor({ kind: 'home' })).toBe('/');
  });

  it('round trips with parseRoute', () => {
    const route = { kind: 'place', slug: 'teatro nacional' } as const;

    expect(parseRoute(pathFor(route))).toEqual(route);
  });
});
