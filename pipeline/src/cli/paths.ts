import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
export const OUT_DIR = fileURLToPath(new URL('../../out/', import.meta.url));
export const DEM_TILES = ['N13_00_W090_00', 'N13_00_W089_00', 'N13_00_W088_00', 'N14_00_W090_00', 'N14_00_W089_00', 'N14_00_W088_00'];

export function demUrl(tile: string): string {
  return `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_${tile}_DEM/Copernicus_DSM_COG_10_${tile}_DEM.tif`;
}

export const BOUNDARY_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson';
