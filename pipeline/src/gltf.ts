import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import type { TerrainMesh } from './mesh';

export interface GlbOptions {
  compress: boolean;
}

/**
 * Serializes a terrain mesh to a binary glTF with vertex colors and no textures, optionally compressed
 * with meshopt.
 *
 * @throws {RangeError} When the mesh has no triangles.
 */
export async function terrainToGlb(mesh: TerrainMesh, options: GlbOptions): Promise<Uint8Array> {
  if (mesh.indices.length === 0) {
    throw new RangeError('Cannot write a glb for an empty mesh');
  }
  const doc = new Document();
  const buffer = doc.createBuffer();
  const position = doc.createAccessor().setType('VEC3').setArray(mesh.positions).setBuffer(buffer);
  const color = doc.createAccessor().setType('VEC3').setArray(mesh.colors).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(mesh.indices).setBuffer(buffer);
  const material = doc.createMaterial('terrain').setDoubleSided(false).setRoughnessFactor(1).setMetallicFactor(0);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('COLOR_0', color)
    .setIndices(indices)
    .setMaterial(material);
  const gltfMesh = doc.createMesh('terrain').addPrimitive(primitive);
  const node = doc.createNode('terrain').setMesh(gltfMesh);
  doc.createScene('scene').addChild(node);

  const io = new NodeIO();
  if (options.compress) {
    await MeshoptEncoder.ready;
    doc.createExtension(EXTMeshoptCompression).setRequired(true);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    io.registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  }
  return io.writeBinary(doc);
}
