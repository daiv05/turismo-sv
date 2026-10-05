import { describe, expect, it } from 'vitest';
import type { PlaceSummary } from '../src/api/types';
import { groupByCategory } from '../src/listModel';
import { supportsWebGL } from '../src/webgl';

const place = (id: number, slug: string, category: string, priority = 0): PlaceSummary => ({
  id,
  slug,
  name: slug,
  summary: null,
  lon: -89.19,
  lat: 13.7,
  priority,
  category: { slug: category, name: category.toUpperCase(), icon: 'x', color_token: 'accent', kind: 'attraction' },
  model: null,
  promotions: [],
});

describe('groupByCategory', () => {
  it('groups places under their category keeping the category order given', () => {
    const groups = groupByCategory([place(1, 'a', 'parks'), place(2, 'b', 'monuments'), place(3, 'c', 'parks')], ['monuments', 'parks']);

    expect(groups.map((g) => g.slug)).toEqual(['monuments', 'parks']);
    expect(groups[1]!.places.map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('sorts places by priority and then by name inside each group', () => {
    const groups = groupByCategory([place(1, 'zeta', 'm', 1), place(2, 'alfa', 'm', 1), place(3, 'mid', 'm', 9)], ['m']);

    expect(groups[0]!.places.map((p) => p.slug)).toEqual(['mid', 'alfa', 'zeta']);
  });

  it('puts categories that are not in the order at the end, alphabetically', () => {
    const groups = groupByCategory([place(1, 'a', 'zzz'), place(2, 'b', 'aaa'), place(3, 'c', 'm')], ['m']);

    expect(groups.map((g) => g.slug)).toEqual(['m', 'aaa', 'zzz']);
  });

  it('returns nothing for no places', () => {
    expect(groupByCategory([], ['m'])).toEqual([]);
  });
});

describe('supportsWebGL', () => {
  const doc = (context: unknown) => ({ createElement: () => ({ getContext: () => context }) }) as unknown as Document;

  it('is true when a WebGL context can be created', () => {
    expect(supportsWebGL(doc({}))).toBe(true);
  });

  it('is false when the browser refuses a context or throws', () => {
    expect(supportsWebGL(doc(null))).toBe(false);
    expect(supportsWebGL({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) } as unknown as Document)).toBe(false);
  });
});
