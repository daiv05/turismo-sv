import { describe, expect, it } from 'vitest';
import { KIT_VERSION, SpecError, modelSpecJsonSchema, parseSpec } from '../src/spec';
import { PIECES } from '../src/pieces';

const valid = {
  kitVersion: '1.0',
  footprint: { w: 40, d: 70 },
  parts: [
    { type: 'hall', params: { w: 30, d: 60, h: 18 }, pos: [0, 0, 0], rot: 0, role: 'neutral' },
    { type: 'dome', params: { r: 9 }, pos: [0, 18, 10], rot: 0, role: 'accent' },
    { type: 'belfry', params: { h: 35, w: 6 }, pos: [-12, 0, -28], rot: 0, role: 'neutral' },
  ],
};

describe('parseSpec', () => {
  it('accepts the example document of the design, filling piece defaults', () => {
    const spec = parseSpec(valid);

    expect(spec.parts).toHaveLength(3);
    expect(spec.parts[1]).toMatchObject({ type: 'dome', params: { r: 9, drum: 0 } });
  });

  it('defaults the rotation to zero', () => {
    const { rot: _rot, ...withoutRot } = valid.parts[0]!;

    expect(parseSpec({ ...valid, parts: [withoutRot] }).parts[0]?.rot).toBe(0);
  });

  it('rejects raw hexadecimal colors', () => {
    const bad = { ...valid, parts: [{ ...valid.parts[0], role: '#0F47AF' }] };

    expect(() => parseSpec(bad)).toThrow(SpecError);
  });

  it('rejects unknown piece types, unknown parameters and bad dimensions', () => {
    expect(() => parseSpec({ ...valid, parts: [{ ...valid.parts[0], type: 'spaceship' }] })).toThrow(SpecError);
    expect(() => parseSpec({ ...valid, parts: [{ ...valid.parts[0], params: { w: 1, d: 1, h: 1, color: 'red' } }] })).toThrow(SpecError);
    expect(() => parseSpec({ ...valid, parts: [{ ...valid.parts[0], params: { w: -3, d: 1, h: 1 } }] })).toThrow(SpecError);
  });

  it('rejects a different kit version and empty or oversized documents', () => {
    expect(() => parseSpec({ ...valid, kitVersion: '9.9' })).toThrow(SpecError);
    expect(() => parseSpec({ ...valid, parts: [] })).toThrow(SpecError);
    expect(() => parseSpec({ ...valid, parts: Array.from({ length: 201 }, () => valid.parts[0]) })).toThrow(SpecError);
  });

  it('reports every problem with a readable path', () => {
    const bad = {
      ...valid,
      parts: [valid.parts[0], { type: 'hall', params: { w: -1, d: 2, h: 3 }, pos: [0, 0], role: 'nope' }],
    };

    try {
      parseSpec(bad);
      expect.unreachable();
    } catch (error) {
      const paths = (error as SpecError).issues.map((i) => i.path);
      expect(paths).toContain('parts[1].params.w');
      expect(paths).toContain('parts[1].pos');
      expect(paths).toContain('parts[1].role');
      expect((error as SpecError).message).toContain('parts[1].params.w');
    }
  });

  it('rejects non finite positions', () => {
    expect(() => parseSpec({ ...valid, parts: [{ ...valid.parts[0], pos: [Number.NaN, 0, 0] }] })).toThrow(SpecError);
  });
});

describe('modelSpecJsonSchema', () => {
  it('describes the document for the agent and lists every piece type', () => {
    const schema = JSON.stringify(modelSpecJsonSchema());

    expect(schema).toContain('footprint');
    expect(schema).toContain(KIT_VERSION);
    for (const piece of PIECES) expect(schema).toContain(`"${piece.type}"`);
  });

  it('lists only palette roles as colors', () => {
    const schema = JSON.stringify(modelSpecJsonSchema());

    expect(schema).toContain('"accent"');
    expect(schema).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
