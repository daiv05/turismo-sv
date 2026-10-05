import { mkdir, writeFile } from 'node:fs/promises';
import { DATA_DIR } from './paths';

const ENDPOINT = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const REGIONS: Record<string, [number, number, number, number]> = {
  'gran-san-salvador': [13.6, -89.35, 13.85, -89.05],
  'centro-historico': [13.69, -89.205, 13.708, -89.18],
};

/**
 * Downloads buildings and roads of a region from Overpass as JSON with geometry, ready for the build step.
 */
const name = process.argv[2] ?? 'centro-historico';
const bbox = REGIONS[name];
if (!bbox) {
  console.error(`Unknown region "${name}". Available: ${Object.keys(REGIONS).join(', ')}`);
  process.exit(1);
}

const query = `[out:json][timeout:120];(way["building"](${bbox.join(',')});way["highway"](${bbox.join(',')}););out geom;`;
const response = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(180_000) });
if (!response.ok) {
  console.error(`Overpass answered ${response.status}. If the host is blocked, allow it or download an extract by other means.`);
  process.exit(1);
}
await mkdir(DATA_DIR, { recursive: true });
const file = `${DATA_DIR}osm-${name}.json`;
await writeFile(file, await response.text());
console.log(`Saved ${file}. Build with OSM_FILE=${file}`);
