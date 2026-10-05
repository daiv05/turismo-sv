import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fromFile } from 'geotiff';
import { lonLatToScene, sceneToLonLat } from '@turismo/kit/geo';
import { buildTileTree } from '../build';
import { bboxOfRings, maskAt, rasterizeMask, type MultiPolygon } from '../geometry';
import { DATA_DIR, DEM_TILES, OUT_DIR } from './paths';

const LEVELS = Number(process.env.LEVELS ?? 6);
const SAMPLES = Number(process.env.SAMPLES ?? 65);
const SOURCE_PIXELS = 1200;
const HEIGHT_SCALE = Number(process.env.HEIGHT_SCALE ?? 3);
const VERSION = process.env.TILESET_VERSION ?? 'dev';

interface DemTile {
  west: number;
  south: number;
  data: Float32Array;
}

async function loadDem(): Promise<Map<string, DemTile>> {
  const tiles = new Map<string, DemTile>();
  for (const name of DEM_TILES) {
    const match = /^([NS])(\d+)_00_([EW])(\d+)_00$/.exec(name)!;
    const south = Number(match[2]) * (match[1] === 'N' ? 1 : -1);
    const west = Number(match[4]) * (match[3] === 'W' ? -1 : 1);
    const image = await (await fromFile(`${DATA_DIR}dem/${name}.tif`)).getImage();
    const raster = (await image.readRasters({ width: SOURCE_PIXELS, height: SOURCE_PIXELS, resampleMethod: 'bilinear', interleave: true })) as Float32Array;
    tiles.set(`${south}/${west}`, { west, south, data: raster });
    console.log(`Loaded DEM ${name}`);
  }
  return tiles;
}

function demHeight(tiles: Map<string, DemTile>, lon: number, lat: number): number {
  const tile = tiles.get(`${Math.floor(lat)}/${Math.floor(lon)}`);
  if (!tile) return 0;
  const fx = Math.min(SOURCE_PIXELS - 1.001, Math.max(0, (lon - tile.west) * SOURCE_PIXELS - 0.5));
  const fy = Math.min(SOURCE_PIXELS - 1.001, Math.max(0, (tile.south + 1 - lat) * SOURCE_PIXELS - 0.5));
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const at = (a: number, b: number): number => tile.data[b * SOURCE_PIXELS + a] ?? 0;
  return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
}

async function main(): Promise<void> {
  const geometry = JSON.parse(await readFile(`${DATA_DIR}slv-boundary.json`, 'utf8')) as { type: string; coordinates: unknown };
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as MultiPolygon;
  const lonLatBox = bboxOfRings(polygons);
  const mask = rasterizeMask(polygons, lonLatBox, 4000, 2000);
  const dem = await loadDem();

  const corners = [
    lonLatToScene({ lon: lonLatBox.minX, lat: lonLatBox.minY }),
    lonLatToScene({ lon: lonLatBox.maxX, lat: lonLatBox.minY }),
    lonLatToScene({ lon: lonLatBox.minX, lat: lonLatBox.maxY }),
    lonLatToScene({ lon: lonLatBox.maxX, lat: lonLatBox.maxY }),
  ];
  const margin = 2000;
  const bounds = {
    minX: Math.min(...corners.map((c) => c.x)) - margin,
    maxX: Math.max(...corners.map((c) => c.x)) + margin,
    minZ: Math.min(...corners.map((c) => c.z)) - margin,
    maxZ: Math.max(...corners.map((c) => c.z)) + margin,
  };

  const heightAt = (x: number, z: number): number => {
    const { lon, lat } = sceneToLonLat({ x, z });
    return demHeight(dem, lon, lat);
  };
  const isLand = (x: number, z: number): boolean => {
    const { lon, lat } = sceneToLonLat({ x, z });
    return maskAt(mask, lon, lat) && demHeight(dem, lon, lat) > 0.5;
  };

  const target = `${OUT_DIR}${VERSION}/`;
  await rm(target, { recursive: true, force: true });
  const started = Date.now();
  const result = await buildTileTree({
    bounds,
    levels: LEVELS,
    samples: SAMPLES,
    heightAt,
    isLand,
    compress: true,
    heightScale: HEIGHT_SCALE,
    write: async (path, data) => {
      const file = `${target}${path}`;
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, data);
    },
  });
  console.log(`Built ${result.tileCount} tiles in ${((Date.now() - started) / 1000).toFixed(1)}s at ${target}`);
}

await main();
