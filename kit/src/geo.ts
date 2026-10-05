import proj4 from 'proj4';

export interface LonLat {
  lon: number;
  lat: number;
}

export interface ScenePoint {
  x: number;
  z: number;
}

const WGS84 = 'EPSG:4326';
const UTM_16N = '+proj=utm +zone=16 +datum=WGS84 +units=m +no_defs';

export const SCENE_ORIGIN: Readonly<LonLat> = Object.freeze({ lon: -88.9, lat: 13.75 });

export const PROJECTION_BOUNDS = Object.freeze({
  minLon: -90.5,
  maxLon: -87.3,
  minLat: 12.8,
  maxLat: 14.8,
});

const [ORIGIN_EASTING, ORIGIN_NORTHING] = proj4(WGS84, UTM_16N, [SCENE_ORIGIN.lon, SCENE_ORIGIN.lat]) as [number, number];

function assertWithinBounds({ lon, lat }: LonLat): void {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new RangeError(`Coordinates must be finite numbers, received lon=${lon} lat=${lat}`);
  }
  const { minLon, maxLon, minLat, maxLat } = PROJECTION_BOUNDS;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    throw new RangeError(
      `Coordinates lon=${lon} lat=${lat} are outside El Salvador projection bounds; check that latitude and longitude are not swapped`,
    );
  }
}

/**
 * Projects WGS84 coordinates into scene meters, with x towards east and z towards south.
 *
 * @param point Longitude and latitude in degrees.
 * @returns Scene coordinates in meters relative to SCENE_ORIGIN.
 * @throws {RangeError} When the point is not finite or lies outside PROJECTION_BOUNDS.
 */
export function lonLatToScene(point: LonLat): ScenePoint {
  assertWithinBounds(point);
  const [easting, northing] = proj4(WGS84, UTM_16N, [point.lon, point.lat]) as [number, number];
  return { x: easting - ORIGIN_EASTING, z: -(northing - ORIGIN_NORTHING) };
}

/**
 * Converts scene meters back to WGS84 coordinates.
 *
 * @param point Scene coordinates in meters relative to SCENE_ORIGIN.
 * @returns Longitude and latitude in degrees.
 * @throws {RangeError} When the point is not finite or maps outside PROJECTION_BOUNDS.
 */
export function sceneToLonLat(point: ScenePoint): LonLat {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new RangeError(`Scene point must be finite, received x=${point.x} z=${point.z}`);
  }
  const [lon, lat] = proj4(UTM_16N, WGS84, [point.x + ORIGIN_EASTING, ORIGIN_NORTHING - point.z]) as [number, number];
  const result = { lon, lat };
  assertWithinBounds(result);
  return result;
}
