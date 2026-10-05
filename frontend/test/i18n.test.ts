import { describe, expect, it } from 'vitest';
import { STRINGS, t } from '../src/i18n';

describe('t', () => {
  it('returns the string for the locale', () => {
    expect(t('directions', 'es')).toBe('Cómo llegar');
    expect(t('directions', 'en')).toBe('Directions');
  });

  it('has every key in both languages', () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      expect(value.es, `${key} es`).toBeTruthy();
      expect(value.en, `${key} en`).toBeTruthy();
    }
  });

  it('interpolates named parameters', () => {
    expect(t('promotionEnds', 'en', { date: 'Oct 5' })).toContain('Oct 5');
  });

  it('leaves unknown placeholders untouched instead of printing undefined', () => {
    expect(t('promotionEnds', 'es')).not.toContain('undefined');
  });
});
