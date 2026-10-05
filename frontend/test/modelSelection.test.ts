import { describe, expect, it } from 'vitest';
import { selectModels } from '../src/engine/modelSelection';

const site = (slug: string, x: number, z: number, hasModel = true) => ({ slug, x, z, hasModel });

describe('selectModels', () => {
  const sites = [site('far', 5_000, 0), site('near', 100, 0), site('mid', 600, 0), site('plain', 50, 0, false), site('edge', 1_400, 0)];

  it('picks the nearest sites that have a model within the radius', () => {
    expect(selectModels(sites, { x: 0, z: 0 }, { max: 3, radius: 1_500 })).toEqual(['near', 'mid', 'edge']);
  });

  it('never exceeds the maximum', () => {
    expect(selectModels(sites, { x: 0, z: 0 }, { max: 1, radius: 10_000 })).toEqual(['near']);
  });

  it('ignores sites without a model', () => {
    expect(selectModels(sites, { x: 0, z: 0 }, { max: 5, radius: 100 })).toEqual(['near']);
  });

  it('keeps the current ones while they stay reasonably close, to avoid flicker', () => {
    const picked = selectModels([site('a', 900, 0), site('b', 880, 0)], { x: 0, z: 0 }, { max: 1, radius: 1_500, current: ['a'] });

    expect(picked).toEqual(['a']);
  });

  it('drops a current one once it is clearly out of range', () => {
    const picked = selectModels([site('a', 2_500, 0), site('b', 880, 0)], { x: 0, z: 0 }, { max: 1, radius: 1_500, current: ['a'] });

    expect(picked).toEqual(['b']);
  });

  it('returns nothing when no site is in range', () => {
    expect(selectModels(sites, { x: 90_000, z: 0 }, { max: 3, radius: 1_500 })).toEqual([]);
  });
});
