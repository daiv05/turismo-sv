import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { PALETTE } from '@turismo/kit/palette';
import {
  CAMERA_FOV_DEGREES,
  applyPan,
  applyRotate,
  applyTilt,
  applyZoom,
  cameraPosition,
  initialCameraState,
  type CameraState,
} from './camera';
import { TypedEmitter } from './emitter';
import { nextPixelRatio } from './quality';
import { zoomLevelForDistance, type ZoomLevel } from './zoom';

export interface EngineEvents {
  zoomLevelChanged: { level: ZoomLevel; distance: number };
  qualityChanged: { pixelRatio: number };
}

/**
 * Three.js viewer with an isometric style camera. It owns the render loop and pointer input and talks to
 * the UI only through its imperative methods and typed events.
 */
export class Engine {
  readonly events = new TypedEmitter<EngineEvents>();

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA_FOV_DEGREES, 1, 10, 4_000_000);
  private state: CameraState = initialCameraState();
  private level: ZoomLevel = zoomLevelForDistance(this.state.distance);
  private pixelRatio: number;
  private frames = 0;
  private lastSample = performance.now();
  private raf = 0;
  private drag: { x: number; y: number; mode: 'pan' | 'orbit' } | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene.background = new Color(PALETTE.ground);
    this.buildScene();
    this.bindInput();
    this.resize();
  }

  start(): void {
    const loop = (): void => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.cleanups.forEach((fn) => fn());
    this.renderer.dispose();
  }

  resize(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private buildScene(): void {
    const oceanMaterial = new MeshLambertMaterial({ color: PALETTE.water, depthWrite: false });
    const ocean = new Mesh(new PlaneGeometry(4_000_000, 4_000_000), oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -5;
    ocean.renderOrder = -1;
    this.scene.add(ocean);

    const land = new Mesh(new PlaneGeometry(260_000, 120_000), new MeshLambertMaterial({ color: PALETTE.neutral }));
    land.rotation.x = -Math.PI / 2;
    this.scene.add(land);

    this.scene.add(new AmbientLight(0xffffff, 1.8));
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(-1, 2, 1);
    this.scene.add(sun);
  }

  private bindInput(): void {
    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void): void => {
      this.canvas.addEventListener(type, handler);
      this.cleanups.push(() => this.canvas.removeEventListener(type, handler));
    };
    on('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, mode: e.button === 2 || e.shiftKey ? 'orbit' : 'pan' };
    });
    on('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      if (this.drag.mode === 'pan') {
        this.state = applyPan(this.state, { dx, dy }, this.canvas.clientHeight);
      } else {
        this.state = applyTilt(applyRotate(this.state, dx * 0.2), dy * 0.2);
      }
    });
    on('pointerup', () => {
      this.drag = null;
    });
    on('contextmenu', (e) => e.preventDefault());
    on('wheel', (e) => {
      e.preventDefault();
      this.state = applyZoom(this.state, Math.exp(e.deltaY * 0.001));
    });
    const onResize = (): void => this.resize();
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
  }

  private tick(): void {
    const p = cameraPosition(this.state);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(this.state.target.x, 0, this.state.target.z);
    this.camera.near = Math.max(10, this.state.distance * 0.02);
    this.camera.far = this.state.distance * 8;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    const level = zoomLevelForDistance(this.state.distance);
    if (level !== this.level) {
      this.level = level;
      this.events.emit('zoomLevelChanged', { level, distance: this.state.distance });
    }
    this.sampleQuality();
  }

  private sampleQuality(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastSample < 1000) return;
    const fps = (this.frames * 1000) / (now - this.lastSample);
    this.frames = 0;
    this.lastSample = now;
    const next = nextPixelRatio(this.pixelRatio, fps, window.devicePixelRatio);
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
      this.events.emit('qualityChanged', { pixelRatio: next });
    }
  }
}
