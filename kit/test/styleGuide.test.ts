import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/palette';
import { PIECES } from '../src/pieces';
import { MAX_TRIANGLES } from '../src/rules';
import { buildStyleGuide } from '../src/styleGuide';

describe('buildStyleGuide', () => {
  const guide = buildStyleGuide();

  it('explains every palette role with its color and use', () => {
    for (const [role, hex] of Object.entries(PALETTE)) {
      expect(guide).toContain(`\`${role}\``);
      expect(guide).toContain(hex);
    }
  });

  it('documents every piece with its parameters, ranges and defaults', () => {
    for (const piece of PIECES) expect(guide).toContain(`\`${piece.type}\``);
    expect(guide).toMatch(/taper.*default 1/s);
    expect(guide).toMatch(/w .*max 300/s);
  });

  it('states the rules that the validator enforces', () => {
    expect(guide).toContain(String(MAX_TRIANGLES));
    expect(guide).toMatch(/10 ?%/);
    expect(guide).toMatch(/accent/i);
    expect(guide).toMatch(/float/i);
  });

  it('explains coordinates and units', () => {
    expect(guide).toMatch(/meters/);
    expect(guide).toMatch(/y.*up/i);
    expect(guide).toMatch(/footprint/);
  });

  it('is stable between calls so prompts can be cached', () => {
    expect(buildStyleGuide()).toBe(guide);
  });

  it('stays compact enough to fit a prompt comfortably', () => {
    expect(guide.length).toBeLessThan(12_000);
  });
});
