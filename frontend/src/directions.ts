export interface DirectionsLinks {
  google: string;
  waze: string;
}

/**
 * Builds the navigation links offered by the "Directions" button.
 *
 * @throws {RangeError} When the coordinates are not finite numbers.
 */
export function directionsUrls(lat: number, lon: number): DirectionsLinks {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new RangeError(`Coordinates must be finite, received lat=${lat} lon=${lon}`);
  }
  const pair = encodeURIComponent(`${lat},${lon}`);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${pair}`,
    waze: `https://waze.com/ul?ll=${pair}&navigate=yes`,
  };
}
