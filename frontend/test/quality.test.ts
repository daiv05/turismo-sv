import { describe, expect, it } from 'vitest';
import { QUALITY_LIMITS, nextPixelRatio } from '../src/engine/quality';

describe('nextPixelRatio', () => {
  it('lowers the ratio when the frame rate is under target', () => {
    expect(nextPixelRatio(2, 20)).toBeLessThan(2);
  });

  it('raises the ratio when there is headroom', () => {
    expect(nextPixelRatio(1, 60, 2)).toBeGreaterThan(1);
  });

  it('never goes below the floor or above the device ratio', () => {
    expect(nextPixelRatio(QUALITY_LIMITS.minPixelRatio, 5)).toBe(QUALITY_LIMITS.minPixelRatio);
    expect(nextPixelRatio(2, 120, 2)).toBe(2);
  });

  it('caps the ratio at the global maximum', () => {
    expect(nextPixelRatio(QUALITY_LIMITS.maxPixelRatio, 120, 3)).toBe(QUALITY_LIMITS.maxPixelRatio);
  });

  it('keeps the ratio inside the dead band', () => {
    expect(nextPixelRatio(1.5, 52, 2)).toBe(1.5);
  });
});
