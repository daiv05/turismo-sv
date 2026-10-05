import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateModel } from '../src/rules';

const dir = new URL('../models/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

describe('reference models', () => {
  it('covers the five monuments of the historic center', () => {
    expect(files).toEqual([
      'catedral-metropolitana.json', 'iglesia-el-rosario.json', 'palacio-nacional.json', 'plaza-libertad.json', 'teatro-nacional.json',
    ]);
  });

  describe.each(files)('%s', (file) => {
    const report = validateModel(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));

    it('satisfies every style rule', () => {
      expect(report.violations).toEqual([]);
    });

    it('stays well inside the triangle budget', () => {
      expect(report.triangles).toBeGreaterThan(200);
      expect(report.triangles).toBeLessThan(8_000);
    });
  });
});
