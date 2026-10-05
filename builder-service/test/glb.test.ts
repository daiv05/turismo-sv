import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { buildModel, triangleCount } from '@turismo/kit';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { modelToGlb } from '../src/glb';

const spec = {
  kitVersion: '1.0',
  footprint: { w: 40, d: 40 },
  parts: [
    { type: 'hall', params: { w: 20, d: 20, h: 10 }, pos: [0, 0, 0], rot: 0, role: 'neutral' },
    { type: 'dome', params: { r: 6, drum: 1 }, pos: [0, 10, 0], rot: 0, role: 'accent' },
    { type: 'hall', params: { w: 6, d: 6, h: 4 }, pos: [12, 0, 0], rot: 45, role: 'secondary' },
  ],
};

async function read(glb: Uint8Array) {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(glb);
}

describe('modelToGlb', () => {
  it('writes a single mesh with every triangle of the model', async () => {
    const group = buildModel(spec);
    const doc = await read(await modelToGlb(group, { compress: false }));
    const primitive = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

    expect(doc.getRoot().listMeshes()).toHaveLength(1);
    expect(primitive.getIndices()!.getCount() / 3).toBe(triangleCount(group));
  });

  it('bakes the transforms of each part into the vertices', async () => {
    const doc = await read(await modelToGlb(buildModel(spec), { compress: false }));
    const positions = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute('POSITION')!;
    const [min, max] = [positions.getMin([0, 0, 0]), positions.getMax([0, 0, 0])];

    expect(min[1]).toBeCloseTo(0, 5);
    expect(max[1]).toBeCloseTo(17, 4);
    expect(max[0]).toBeGreaterThan(12);
  });

  it('keeps vertex colors and uses a single unlit-free material without textures', async () => {
    const doc = await read(await modelToGlb(buildModel(spec), { compress: false }));
    const root = doc.getRoot();

    expect(root.listMeshes()[0]!.listPrimitives()[0]!.getAttribute('COLOR_0')).not.toBeNull();
    expect(root.listMaterials()).toHaveLength(1);
    expect(root.listTextures()).toHaveLength(0);
  });

  it('produces valid normals', async () => {
    const doc = await read(await modelToGlb(buildModel(spec), { compress: false }));
    const normals = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute('NORMAL')!;
    const n = normals.getArray()!;

    for (let i = 0; i < n.length; i += 3) expect(Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!)).toBeGreaterThan(0.99);
  });

  it('compresses with meshopt and still decodes to the same triangle count', async () => {
    const group = buildModel(spec);
    const plain = await modelToGlb(group, { compress: false });
    const packed = await modelToGlb(group, { compress: true });
    const doc = await read(packed);

    expect(packed.byteLength).toBeLessThan(plain.byteLength);
    expect(doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute('POSITION')!.getCount()).toBeGreaterThan(0);
    expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
  });

  it('is deterministic', async () => {
    const a = await modelToGlb(buildModel(spec), { compress: true });
    const b = await modelToGlb(buildModel(spec), { compress: true });

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
