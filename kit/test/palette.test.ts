import { describe, expect, it } from 'vitest';
import { COLOR_ROLES, PALETTE, colorForRole, isColorRole } from '../src/palette';

describe('palette', () => {
  it('defines exactly the roles of the style guide', () => {
    expect([...COLOR_ROLES].sort()).toEqual(
      ['accent', 'glass', 'ground', 'neutral', 'promo', 'secondary', 'vegetation', 'water'],
    );
  });

  it('uses uppercase six digit hex values for every role', () => {
    for (const role of COLOR_ROLES) {
      expect(PALETTE[role]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('uses the Salvadoran flag blue as accent', () => {
    expect(colorForRole('accent')).toBe('#0F47AF');
  });

  it('matches the spec values', () => {
    expect(PALETTE).toEqual({
      ground: '#E8EBFA',
      neutral: '#F7F8FC',
      secondary: '#C7CDF0',
      accent: '#0F47AF',
      glass: '#9EB6FF',
      vegetation: '#6FCB8F',
      water: '#A9C8FF',
      promo: '#F2B33D',
    });
  });

  it('accepts only known role names', () => {
    expect(isColorRole('accent')).toBe(true);
    expect(isColorRole('#0F47AF')).toBe(false);
    expect(isColorRole('red')).toBe(false);
    expect(isColorRole(undefined)).toBe(false);
    expect(isColorRole(42)).toBe(false);
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true);
  });
});
