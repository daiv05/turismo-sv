import { PALETTE } from '@turismo/kit/palette';
import type { Rgb } from './mesh';

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Converts a `#RRGGBB` color to the linear RGB values glTF vertex colors expect.
 *
 * @throws {RangeError} When the value is not a six digit hex color.
 */
export function hexToLinear(hex: string): Rgb {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new RangeError(`Expected a #RRGGBB color, received ${hex}`);
  }
  return [
    channel(parseInt(hex.slice(1, 3), 16)),
    channel(parseInt(hex.slice(3, 5), 16)),
    channel(parseInt(hex.slice(5, 7), 16)),
  ];
}

export const SKIRT_COLOR: Rgb = hexToLinear(PALETTE.secondary);

/**
 * Picks a palette role by elevation: lowlands in vegetation green, mid ground in the base tone and high
 * ground in the secondary tone.
 */
export function terrainColor(height: number): Rgb {
  if (height < 800) return hexToLinear(PALETTE.vegetation);
  if (height < 1500) return hexToLinear(PALETTE.ground);
  return hexToLinear(PALETTE.secondary);
}
