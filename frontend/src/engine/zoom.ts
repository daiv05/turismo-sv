export type ZoomLevel = 'country' | 'department' | 'city' | 'street';

export type SiteLod = 'bubble' | 'pin' | 'model';

export const ZOOM_LEVELS: readonly ZoomLevel[] = Object.freeze(['country', 'department', 'city', 'street']);

const ZOOM_THRESHOLDS: Readonly<Record<Exclude<ZoomLevel, 'street'>, number>> = Object.freeze({
  country: 120_000,
  department: 30_000,
  city: 4_000,
});

const SITE_LOD_THRESHOLDS = Object.freeze({ bubble: 20_000, pin: 1_500 });

function assertDistance(distance: number): void {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError(`Distance must be a non negative finite number, received ${distance}`);
  }
}

/**
 * Maps the camera distance to the target in scene meters to a semantic zoom level.
 * A distance exactly on a threshold belongs to the coarser level.
 *
 * @param distance Camera distance in meters.
 * @throws {RangeError} When the distance is negative or not finite.
 */
export function zoomLevelForDistance(distance: number): ZoomLevel {
  assertDistance(distance);
  if (distance >= ZOOM_THRESHOLDS.country) return 'country';
  if (distance >= ZOOM_THRESHOLDS.department) return 'department';
  if (distance >= ZOOM_THRESHOLDS.city) return 'city';
  return 'street';
}

/**
 * Chooses how a site is drawn at a given camera distance.
 *
 * @param distance Camera distance in meters.
 * @throws {RangeError} When the distance is negative or not finite.
 */
export function lodForSite(distance: number): SiteLod {
  assertDistance(distance);
  if (distance >= SITE_LOD_THRESHOLDS.bubble) return 'bubble';
  if (distance >= SITE_LOD_THRESHOLDS.pin) return 'pin';
  return 'model';
}
