import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { terrainToGlb } from '../src/gltf';
import { createGrid } from '../src/heightfield';
import { buildTerrainMesh } from '../src/mesh';

const grid = createGrid({ minX: 0, maxX: 40, minZ: 0, maxZ: 40 }, 9, 9, (x, z) => x + z);
const mesh = buildTerrainMesh(grid, { skirtDepth: 10, isLand: () => true, colorForHeight: () => [0.2, 0.4, 0.6], skirtColor: [0, 0, 0] });

async function read(glb: Uint8Array) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io.readBinary(glb);
}

describe('terrainToGlb', () => {
  it('writes a glb with positions, vertex colors and indices', async () => {
    const doc = await read(await terrainToGlb(mesh, { compress: false }));
    const primitive = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
    expect(primitive.getAttribute('POSITION')!.getCount()).toBe(mesh.positions.length / 3);
    expect(primitive.getAttribute('COLOR_0')!.getCount()).toBe(mesh.positions.length / 3);
    expect(primitive.getIndices()!.getCount()).toBe(mesh.indices.length);
  });

  it('keeps geometry after meshopt compression', async () => {
    const plain = await terrainToGlb(mesh, { compress: false });
    const packed = await terrainToGlb(mesh, { compress: true });
    const doc = await read(packed);
    const primitive = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
    expect(primitive.getIndices()!.getCount()).toBe(mesh.indices.length);
    expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
    expect(packed.byteLength).toBeLessThan(plain.byteLength);
  });

  it('rejects an empty mesh', async () => {
    await expect(terrainToGlb({ positions: new Float32Array(), colors: new Float32Array(), indices: new Uint32Array() }, { compress: false })).rejects.toThrow(RangeError);
  });
});
