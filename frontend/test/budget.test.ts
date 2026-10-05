import { describe, expect, it } from 'vitest';
import { tileBudget } from '../src/engine/budget';

describe('tileBudget', () => {
  it('allows more detail and memory on desktop than on mobile', () => {
    const desktop = tileBudget({ isMobile: false, deviceMemoryGb: 16 });
    const mobile = tileBudget({ isMobile: true, deviceMemoryGb: 4 });
    expect(desktop.errorTarget).toBeLessThan(mobile.errorTarget);
    expect(desktop.maxBytes).toBeGreaterThan(mobile.maxBytes);
  });

  it('reduces memory for low memory devices', () => {
    const low = tileBudget({ isMobile: true, deviceMemoryGb: 2 });
    const mid = tileBudget({ isMobile: true, deviceMemoryGb: 8 });
    expect(low.maxBytes).toBeLessThan(mid.maxBytes);
  });

  it('keeps the minimum below the maximum', () => {
    for (const isMobile of [true, false]) {
      const b = tileBudget({ isMobile, deviceMemoryGb: 4 });
      expect(b.minBytes).toBeLessThan(b.maxBytes);
    }
  });

  it('falls back to conservative values when memory is unknown', () => {
    const b = tileBudget({ isMobile: false, deviceMemoryGb: undefined });
    expect(b.maxBytes).toBeGreaterThan(0);
  });
});
