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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PALETTE } from '@turismo/kit/palette';
import { parseStudioParams } from './params';

const message = document.getElementById('message')!;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const params = parseStudioParams(window.location.search);

async function main(): Promise<void> {
  if (!params) throw new Error('No se indicó un modelo válido.');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(params.glb);
  const material = new MeshToonMaterial({ vertexColors: true });
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh) (o as Mesh).material = material;
  });

  const scene = new Scene();
  scene.background = new Color(PALETTE.ground);
  scene.add(gltf.scene);
  const bounds = new Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(1, bounds.getSize(new Vector3()).length() / 2);

  const floor = new Mesh(new PlaneGeometry(radius * 8, radius * 8), new MeshLambertMaterial({ color: PALETTE.ground }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor, new AmbientLight(0xffffff, 1.8));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-1, 2, 1);
  scene.add(sun);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const camera = new PerspectiveCamera(25, 1, radius / 20, radius * 60);
  const distance = (radius / Math.sin((25 * Math.PI) / 360)) * 1.05;
  camera.position.set(center.x + distance * 0.6, center.y + distance * 0.55, center.z + distance * 0.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(center);
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.enableDamping = true;

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  message.remove();
  canvas.dataset.ready = 'true';
}

main().catch((error: unknown) => {
  message.textContent = error instanceof Error ? error.message : 'No se pudo cargar el modelo.';
});
