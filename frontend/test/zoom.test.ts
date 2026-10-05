import { describe, expect, it } from 'vitest';
import { lodForSite, zoomLevelForDistance, ZOOM_LEVELS } from '../src/engine/zoom';

describe('zoomLevelForDistance', () => {
  it('maps camera distance to the four semantic levels', () => {
    expect(zoomLevelForDistance(400_000)).toBe('country');
    expect(zoomLevelForDistance(60_000)).toBe('department');
    expect(zoomLevelForDistance(8_000)).toBe('city');
    expect(zoomLevelForDistance(500)).toBe('street');
  });

  it('puts boundary distances in the coarser level', () => {
    expect(zoomLevelForDistance(120_000)).toBe('country');
    expect(zoomLevelForDistance(30_000)).toBe('department');
    expect(zoomLevelForDistance(4_000)).toBe('city');
  });

  it('rejects invalid distances', () => {
    expect(() => zoomLevelForDistance(Number.NaN)).toThrow(RangeError);
    expect(() => zoomLevelForDistance(-1)).toThrow(RangeError);
  });

  it('exposes levels from coarse to fine', () => {
    expect(ZOOM_LEVELS).toEqual(['country', 'department', 'city', 'street']);
  });
});

describe('lodForSite', () => {
  it('uses bubbles far away, pins at medium range and models up close', () => {
    expect(lodForSite(50_000)).toBe('bubble');
    expect(lodForSite(6_000)).toBe('pin');
    expect(lodForSite(900)).toBe('model');
  });

  it('rejects invalid distances', () => {
    expect(() => lodForSite(-5)).toThrow(RangeError);
  });
});
