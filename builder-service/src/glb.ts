import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';

export interface GlbOptions {
  compress: boolean;
}

interface Flat {
  positions: number[];
  normals: number[];
  colors: number[];
}

function flatten(root: Object3D): Flat {
  root.updateMatrixWorld(true);
  const flat: Flat = { positions: [], normals: [], colors: [] };
  const p = new Vector3();
  const n = new Vector3();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as BufferGeometry;
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!source.getAttribute('normal')) source.computeVertexNormals();
    const position = source.getAttribute('position');
    const normal = source.getAttribute('normal');
    const color = source.getAttribute('color');
    const normalMatrix = mesh.normalMatrix.clone().setFromMatrix4(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      flat.positions.push(p.x, p.y, p.z);
      flat.normals.push(n.x, n.y, n.z);
      flat.colors.push(color?.getX(i) ?? 1, color?.getY(i) ?? 1, color?.getZ(i) ?? 1);
    }
  });
  return flat;
}

/**
 * Exports a built model as one glb: every part is merged into a single mesh with its transform baked in,
 * vertex colors and no textures, optionally compressed with meshopt.
 */
export async function modelToGlb(root: Object3D, options: GlbOptions): Promise<Uint8Array> {
  const flat = flatten(root);
  const doc = new Document();
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const buffer = doc.createBuffer();
  const attribute = (array: number[], type: 'VEC3') =>
    doc.createAccessor().setType(type).setArray(new Float32Array(array)).setBuffer(buffer);
  const material = doc.createMaterial('style').setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(false);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', attribute(flat.positions, 'VEC3'))
    .setAttribute('NORMAL', attribute(flat.normals, 'VEC3'))
    .setAttribute('COLOR_0', attribute(flat.colors, 'VEC3'))
    .setMaterial(material);
  const mesh = doc.createMesh('model').addPrimitive(primitive);
  doc.createScene('scene').addChild(doc.createNode('model').setMesh(mesh));

  await doc.transform(weld());
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  if (options.compress) {
    await MeshoptEncoder.ready;
    doc.createExtension(EXTMeshoptCompression).setRequired(true);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  }
  return io.writeBinary(doc);
}

