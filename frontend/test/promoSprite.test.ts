import { describe, expect, it } from 'vitest';
import type { PromotionSummary } from '../src/api/types';
import { frameAt, frameUv, pickPromotion, templateLabel } from '../src/engine/promoSprite';

const promo = (over: Partial<PromotionSummary> & { id: number }): PromotionSummary => ({
  title: 'T',
  body: null,
  ends_at: '2030-01-01T00:00:00Z',
  sprite: { type: 'template', url: null, frames: 1, cols: 1, rows: 1, fps: 8, template_key: 'new', template_data: null },
  ...over,
});

describe('frameAt', () => {
  it('advances at the given frame rate and loops', () => {
    expect(frameAt(0, 10, 4)).toBe(0);
    expect(frameAt(0.1, 10, 4)).toBe(1);
    expect(frameAt(0.35, 10, 4)).toBe(3);
    expect(frameAt(0.4, 10, 4)).toBe(0);
  });

  it('holds still for a single frame or a zero rate', () => {
    expect(frameAt(5, 10, 1)).toBe(0);
    expect(frameAt(5, 0, 8)).toBe(0);
  });

  it('copes with negative time', () => {
    expect(frameAt(-0.1, 10, 4)).toBe(3);
  });
});

describe('frameUv', () => {
  it('maps a frame to its cell with the first row at the top', () => {
    expect(frameUv(0, 3, 2)).toEqual({ u: 0, v: 0.5, scaleU: 1 / 3, scaleV: 0.5 });
    expect(frameUv(4, 3, 2)).toEqual({ u: 1 / 3, v: 0, scaleU: 1 / 3, scaleV: 0.5 });
  });

  it('rejects frames outside the grid', () => {
    expect(() => frameUv(6, 3, 2)).toThrow(RangeError);
    expect(() => frameUv(-1, 3, 2)).toThrow(RangeError);
  });
});

describe('templateLabel', () => {
  it('labels each template in the requested language', () => {
    expect(templateLabel('percent-off', { value: 20 }, 'es')).toBe('-20%');
    expect(templateLabel('two-for-one', null, 'es')).toBe('2x1');
    expect(templateLabel('new', null, 'es')).toBe('NUEVO');
    expect(templateLabel('new', null, 'en')).toBe('NEW');
    expect(templateLabel('free-gift', { item: 'Café' }, 'es')).toBe('GRATIS');
  });

  it('falls back to a generic label for unknown templates', () => {
    expect(templateLabel('mystery', null, 'en')).toBe('DEAL');
  });
});

describe('pickPromotion', () => {
  it('chooses the promotion that ends first among equals, otherwise the highest priority', () => {
    const list = [promo({ id: 1 }), promo({ id: 2 })];

    expect(pickPromotion(list)?.id).toBe(1);
  });

  it('returns null when there are none', () => {
    expect(pickPromotion([])).toBeNull();
  });
});
