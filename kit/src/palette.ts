export type ColorRole =
  | 'ground'
  | 'neutral'
  | 'secondary'
  | 'accent'
  | 'glass'
  | 'vegetation'
  | 'water'
  | 'promo';

export const PALETTE: Readonly<Record<ColorRole, string>> = Object.freeze({
  ground: '#E8EBFA',
  neutral: '#F7F8FC',
  secondary: '#C7CDF0',
  accent: '#0F47AF',
  glass: '#9EB6FF',
  vegetation: '#6FCB8F',
  water: '#A9C8FF',
  promo: '#F2B33D',
});

export const COLOR_ROLES: readonly ColorRole[] = Object.freeze(Object.keys(PALETTE) as ColorRole[]);

/**
 * Checks whether a value is a palette role name, rejecting raw color values.
 *
 * @param value Value to check.
 * @returns True when the value is one of the palette roles.
 */
export function isColorRole(value: unknown): value is ColorRole {
  return typeof value === 'string' && Object.hasOwn(PALETTE, value);
}

export function colorForRole(role: ColorRole): string {
  return PALETTE[role];
}
