import { Color } from 'three';
import { PALETTE, type ColorRole } from './palette';

export type LinearRgb = [number, number, number];

/**
 * Linear RGB values of a palette role, as glTF vertex colors expect.
 */
export function roleColor(role: ColorRole): LinearRgb {
  const color = new Color(PALETTE[role]);
  return [color.r, color.g, color.b];
}
