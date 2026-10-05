import { Document, NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { UploadError, normalizeUpload } from '../src/upload';

async function glbOf(options: { color: [number, number, number, number]; size?: [number, number, number]; offset?: [number, number, number]; triangles?: number }): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const [sx, sy, sz] = options.size ?? [2, 2, 2];
  const [ox, oy, oz] = options.offset ?? [0, 0, 0];
  const segments = Math.max(1, Math.round((options.triangles ?? 12) / 12));
  const positions: number[] = [];
  const indices: number[] = [];
  for (let s = 0; s < segments; s++) {
    const base = positions.length / 3;
    const cx = s * 0.0001;
    const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    for (const [x, y, z] of corners) positions.push((x! + cx) * sx, y! * sy, z! * sz);
    const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    for (const f of faces) indices.push(base + f[0]!, base + f[1]!, base + f[2]!);
  }
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer))
    .setMaterial(doc.createMaterial('m').setBaseColorFactor(options.color));
  const mesh = doc.createMesh('m').addPrimitive(primitive);
  const node = doc.createNode('n').setMesh(mesh).setTranslation([ox, oy, oz]);
  doc.createScene('s').addChild(node);
  return new NodeIO().writeBinary(doc);
}

async function inspect(glb: Uint8Array) {
  const doc = await new NodeIO().readBinary(glb);
  const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
  const pos = prim.getAttribute('POSITION')!;
  return { doc, prim, min: pos.getMin([0, 0, 0]), max: pos.getMax([0, 0, 0]) };
}

describe('normalizeUpload', () => {
  it('maps a blue material to the accent role and bakes it into vertex colors', async () => {
    const result = await normalizeUpload(await glbOf({ color: [0.05, 0.25, 0.7, 1] }));
    const { prim } = await inspect(result.glb);
    const color = prim.getAttribute('COLOR_0')!.getElement(0, [0, 0, 0, 0]);

    expect(result.roles).toContain('accent');
    expect(color[2]).toBeGreaterThan(color[0]!);
  });

  it('maps near white to neutral', async () => {
    const result = await normalizeUpload(await glbOf({ color: [0.97, 0.97, 0.99, 1] }));

    expect(result.roles).toEqual(['neutral']);
  });

  it('removes textures and leaves a single material', async () => {
    const { doc } = await inspect((await normalizeUpload(await glbOf({ color: [0.2, 0.7, 0.4, 1] }))).glb);

    expect(doc.getRoot().listMaterials()).toHaveLength(1);
    expect(doc.getRoot().listTextures()).toHaveLength(0);
  });

  it('puts the base on the ground and centers the model on x and z', async () => {
    const result = await normalizeUpload(await glbOf({ color: [1, 1, 1, 1], size: [10, 6, 4], offset: [30, 5, -12] }));
    const { min, max } = await inspect(result.glb);

    expect(min[1]).toBeCloseTo(0, 4);
    expect((min[0]! + max[0]!) / 2).toBeCloseTo(0, 4);
    expect((min[2]! + max[2]!) / 2).toBeCloseTo(0, 4);
  });

  it('reports the triangle count and size', async () => {
    const result = await normalizeUpload(await glbOf({ color: [1, 1, 1, 1], size: [10, 6, 4] }));

    expect(result.triangles).toBe(12);
    expect(result.size.x).toBeCloseTo(10, 3);
    expect(result.size.y).toBeCloseTo(6, 3);
  });

  it('rejects models over the triangle budget', async () => {
    await expect(normalizeUpload(await glbOf({ color: [1, 1, 1, 1], triangles: 12 * 1400 }))).rejects.toMatchObject({ code: 'budget' });
  });

  it('rejects models whose scale is clearly in the wrong unit', async () => {
    await expect(normalizeUpload(await glbOf({ color: [1, 1, 1, 1], size: [0.02, 0.02, 0.02] }))).rejects.toMatchObject({ code: 'scale' });
    await expect(normalizeUpload(await glbOf({ color: [1, 1, 1, 1], size: [4000, 4000, 4000] }))).rejects.toMatchObject({ code: 'scale' });
  });

  it('rejects models larger than the footprint plus ten percent when a footprint is given', async () => {
    const glb = await glbOf({ color: [1, 1, 1, 1], size: [50, 10, 20] });

    await expect(normalizeUpload(glb, { footprint: { w: 40, d: 40 } })).rejects.toMatchObject({ code: 'footprint' });
    await expect(normalizeUpload(glb, { footprint: { w: 50, d: 50 } })).resolves.toBeDefined();
  });

  it('rejects files that are not valid glb', async () => {
    await expect(normalizeUpload(new Uint8Array([1, 2, 3, 4]))).rejects.toBeInstanceOf(UploadError);
    await expect(normalizeUpload(new Uint8Array([1, 2, 3, 4]))).rejects.toMatchObject({ code: 'invalid' });
  });

  it('rejects documents without meshes', async () => {
    const doc = new Document();
    doc.createScene('s');
    const empty = await new NodeIO().writeBinary(doc);

    await expect(normalizeUpload(empty)).rejects.toMatchObject({ code: 'invalid' });
  });
});
