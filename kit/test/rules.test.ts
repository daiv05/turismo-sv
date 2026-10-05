import { describe, expect, it } from 'vitest';
import { MAX_TRIANGLES, validateModel } from '../src/rules';

const doc = (parts: unknown[], footprint = { w: 40, d: 70 }) => ({ kitVersion: '1.0', footprint, parts });
const hall = (over: object = {}) => ({ type: 'hall', params: { w: 30, d: 60, h: 18 }, pos: [0, 0, 0], rot: 0, role: 'neutral', ...over });
const dome = (over: object = {}) => ({ type: 'dome', params: { r: 9 }, pos: [0, 18, 10], rot: 0, role: 'accent', ...over });
const rules = (parts: unknown[], footprint?: { w: number; d: number }) => validateModel(doc(parts, footprint)).violations.map((v) => `${v.rule}@${v.path}`);

describe('validateModel', () => {
  it('accepts a well formed building', () => {
    const report = validateModel(doc([hall(), dome()]));

    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.triangles).toBeGreaterThan(0);
  });

  it('rejects parts that float above the ground with nothing under them', () => {
    expect(rules([hall(), dome({ pos: [0, 30, 10] })])).toEqual(['grounded@parts[1]']);
  });

  it('accepts parts resting on top of another part', () => {
    expect(rules([hall(), dome({ pos: [0, 18, 10] })])).toEqual([]);
  });

  it('does not count a part below as support when it is off to the side', () => {
    expect(rules([hall({ params: { w: 10, d: 10, h: 18 } }), dome({ pos: [20, 18, 0] })], { w: 100, d: 100 })).toEqual(['grounded@parts[1]']);
  });

  it('accepts pieces attached to a wall as supported through contact', () => {
    const windows = { type: 'window-strip', params: { n: 4, w: 20, h: 3 }, pos: [0, 5, 30.05], rot: 0, role: 'glass' };

    expect(rules([hall(), windows])).toEqual([]);
  });

  it('rejects parts that sink below the ground', () => {
    expect(rules([hall({ pos: [0, -2, 0] })])).toEqual(['grounded@parts[0]']);
  });

  it('allows the model to exceed the footprint by ten percent but not more', () => {
    expect(rules([hall({ params: { w: 43, d: 60, h: 10 } })])).toEqual([]);
    expect(rules([hall({ params: { w: 45, d: 60, h: 10 } })])).toEqual(['footprint@model']);
  });

  it('rejects models that are off center beyond the footprint margin', () => {
    expect(rules([hall({ pos: [10, 0, 0] })])).toEqual(['footprint@model']);
  });

  it('allows touching accent parts as one group', () => {
    expect(rules([hall(), dome(), dome({ pos: [0, 18, 20], params: { r: 4 } })])).toEqual([]);
  });

  it('rejects two separate accent groups and points at the second one', () => {
    const parts = [
      hall({ params: { w: 38, d: 68, h: 10 }, role: 'accent', pos: [0, 0, 0] }),
      hall({ params: { w: 2, d: 2, h: 3 }, role: 'neutral', pos: [0, 10, 0] }),
      hall({ params: { w: 2, d: 2, h: 3 }, role: 'accent', pos: [0, 13, 0] }),
    ];

    expect(rules(parts, { w: 40, d: 70 })).toEqual(['accent@parts[2]']);
  });

  it('rejects models over the triangle budget', () => {
    const parts = Array.from({ length: 40 }, (_, i) => ({ type: 'dome', params: { r: 0.9, drum: 1 }, pos: [-18 + i * 0.9, 0, 0], role: 'neutral' }));
    const report = validateModel(doc([...parts, ...parts, ...parts, ...parts, ...parts, ...parts, ...parts, ...parts].slice(0, 200)));

    expect(report.triangles).toBeGreaterThan(MAX_TRIANGLES);
    expect(report.violations.map((v) => v.rule)).toContain('budget');
  });

  it('returns schema problems as violations instead of throwing', () => {
    const report = validateModel({ kitVersion: '1.0', footprint: { w: 10, d: 10 }, parts: [{ type: 'hall', params: { w: -1 }, pos: [0, 0, 0], role: 'neutral' }] });

    expect(report.ok).toBe(false);
    expect(report.violations[0]).toMatchObject({ rule: 'schema' });
    expect(report.violations[0]!.path).toContain('parts[0]');
  });

  it('writes messages an agent can act on', () => {
    const [violation] = validateModel(doc([hall(), dome({ pos: [0, 30, 10] })])).violations;

    expect(violation!.message).toMatch(/y=30/);
    expect(violation!.message).toMatch(/ground|rest/i);
  });
});
