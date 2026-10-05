import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BOUNDARY_URL, DATA_DIR, DEM_TILES, demUrl } from './paths';

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function download(url: string, target: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${url} failed with status ${response.status}`);
  }
  const partial = `${target}.partial`;
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial));
  await rename(partial, target);
}

async function main(): Promise<void> {
  await mkdir(`${DATA_DIR}dem`, { recursive: true });
  for (const tile of DEM_TILES) {
    const target = `${DATA_DIR}dem/${tile}.tif`;
    if (await exists(target)) continue;
    console.log(`Downloading DEM tile ${tile}`);
    await download(demUrl(tile), target);
  }

  const boundaryTarget = `${DATA_DIR}slv-boundary.json`;
  if (!(await exists(boundaryTarget))) {
    console.log('Downloading country boundaries');
    const response = await fetch(BOUNDARY_URL);
    if (!response.ok) throw new Error(`Boundary download failed with status ${response.status}`);
    const collection = (await response.json()) as { features: Array<{ properties: Record<string, string>; geometry: { type: string; coordinates: unknown } }> };
    const feature = collection.features.find((f) => Object.values(f.properties).includes('SLV'));
    if (!feature) throw new Error('El Salvador (SLV) not found in the boundary dataset');
    await writeFile(boundaryTarget, JSON.stringify(feature.geometry));
  }
  console.log('Source data ready in', DATA_DIR);
}

await main();
