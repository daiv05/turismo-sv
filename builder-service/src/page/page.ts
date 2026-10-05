import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

declare global {
  interface Window {
    renderModel: (glbBase64: string, angles: number[], size: number, ground: string) => Promise<string[]>;
  }
}

function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

window.renderModel = async (glbBase64, angles, size, ground) => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(decode(glbBase64), '');
  const material = new MeshToonMaterial({ vertexColors: true });
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh) (o as Mesh).material = material;
  });

  const scene = new Scene();
  scene.background = new Color(ground);
  scene.add(gltf.scene);
  const bounds = new Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new Vector3());
  const radius = bounds.getSize(new Vector3()).length() / 2;

  const floor = new Mesh(new PlaneGeometry(radius * 8, radius * 8), new MeshLambertMaterial({ color: ground }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  scene.add(new AmbientLight(0xffffff, 1.8));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 2, 1);
  scene.add(sun);

  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  const camera = new PerspectiveCamera(25, 1, 1, radius * 40);
  const distance = (radius / Math.sin((25 * Math.PI) / 360)) * 1.05;
  const tilt = (40 * Math.PI) / 180;

  const images: string[] = [];
  for (const angle of angles) {
    const yaw = (angle * Math.PI) / 180;
    camera.position.set(
      center.x + distance * Math.cos(tilt) * Math.sin(yaw),
      center.y + distance * Math.sin(tilt),
      center.z + distance * Math.cos(tilt) * Math.cos(yaw),
    );
    camera.lookAt(center);
    renderer.render(scene, camera);
    images.push(canvas.toDataURL('image/png'));
  }
  renderer.dispose();
  return images;
};
