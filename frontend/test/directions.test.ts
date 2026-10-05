import { describe, expect, it } from 'vitest';
import { directionsUrls } from '../src/directions';

describe('directionsUrls', () => {
  it('builds Google Maps and Waze links for a coordinate', () => {
    const urls = directionsUrls(13.69888, -89.19147);

    expect(urls.google).toBe('https://www.google.com/maps/dir/?api=1&destination=13.69888%2C-89.19147');
    expect(urls.waze).toBe('https://waze.com/ul?ll=13.69888%2C-89.19147&navigate=yes');
  });

  it('rejects coordinates that are not finite', () => {
    expect(() => directionsUrls(Number.NaN, 0)).toThrow(RangeError);
  });
});
