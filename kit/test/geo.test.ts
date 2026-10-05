import { describe, expect, it } from 'vitest';
import { SCENE_ORIGIN, lonLatToScene, sceneToLonLat, type LonLat } from '../src/geo';

const CATEDRAL: LonLat = { lon: -89.191, lat: 13.699 };
const SAN_SALVADOR: LonLat = { lon: -89.2182, lat: 13.6929 };
const SANTA_ANA: LonLat = { lon: -89.5597, lat: 13.9942 };

function haversineMeters(a: LonLat, b: LonLat): number {
  const r = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

describe('lonLatToScene', () => {
  it('maps the scene origin to (0, 0)', () => {
    const p = lonLatToScene(SCENE_ORIGIN);
    expect(Math.abs(p.x)).toBeLessThan(1e-6);
    expect(Math.abs(p.z)).toBeLessThan(1e-6);
  });

  it('points north towards negative z', () => {
    const p = lonLatToScene({ lon: SCENE_ORIGIN.lon, lat: SCENE_ORIGIN.lat + 0.01 });
    expect(p.z).toBeLessThan(0);
    expect(Math.abs(p.z + 1106)).toBeLessThan(5);
  });

  it('points east towards positive x', () => {
    const p = lonLatToScene({ lon: SCENE_ORIGIN.lon + 0.01, lat: SCENE_ORIGIN.lat });
    expect(p.x).toBeGreaterThan(0);
    expect(Math.abs(p.x - 1081.5)).toBeLessThan(5);
  });

  it('preserves real distances within 0.5 percent', () => {
    const a = lonLatToScene(SAN_SALVADOR);
    const b = lonLatToScene(SANTA_ANA);
    const projected = Math.hypot(b.x - a.x, b.z - a.z);
    const real = haversineMeters(SAN_SALVADOR, SANTA_ANA);
    expect(Math.abs(projected - real) / real).toBeLessThan(0.005);
  });

  it('rejects swapped latitude and longitude', () => {
    expect(() => lonLatToScene({ lon: 13.699, lat: -89.191 })).toThrow(RangeError);
  });

  it('rejects coordinates far outside El Salvador', () => {
    expect(() => lonLatToScene({ lon: -99.13, lat: 19.43 })).toThrow(RangeError);
  });

  it('rejects non finite values', () => {
    expect(() => lonLatToScene({ lon: Number.NaN, lat: 13.7 })).toThrow(RangeError);
  });
});

describe('sceneToLonLat', () => {
  it('round trips a landmark with sub-centimeter error', () => {
    const back = sceneToLonLat(lonLatToScene(CATEDRAL));
    expect(Math.abs(back.lon - CATEDRAL.lon)).toBeLessThan(1e-7);
    expect(Math.abs(back.lat - CATEDRAL.lat)).toBeLessThan(1e-7);
  });

  it('rejects scene points that fall outside the projection bounds', () => {
    expect(() => sceneToLonLat({ x: 5_000_000, z: 0 })).toThrow(RangeError);
  });

  it('rejects non finite values', () => {
    expect(() => sceneToLonLat({ x: Number.POSITIVE_INFINITY, z: 0 })).toThrow(RangeError);
  });
});
