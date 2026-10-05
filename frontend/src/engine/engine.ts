import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { lonLatToScene } from '@turismo/kit/geo';
import type { Locale, PlaceSummary } from '../api/types';
import { PALETTE } from '@turismo/kit/palette';
import {
  CAMERA_FOV_DEGREES,
  applyPan,
  applyRotate,
  applyTilt,
  applyZoom,
  cameraPosition,
  easeInOut,
  framePoint,
  initialCameraState,
  interpolateCamera,
  visibleBounds,
  type CameraState,
  type GroundBounds,
} from './camera';
import { tileBudget } from './budget';
import { TypedEmitter } from './emitter';
import { ModelsLayer } from './modelsLayer';
import { PromoLayer } from './promoLayer';
import { SitesLayer } from './sitesLayer';
import { TerrainTiles } from './tiles';
import { nextPixelRatio } from './quality';
import { zoomLevelForDistance, type ZoomLevel } from './zoom';

export interface EngineEvents {
  zoomLevelChanged: { level: ZoomLevel; distance: number };
  qualityChanged: { pixelRatio: number };
  tilesError: { error: unknown };
  viewChanged: { bounds: GroundBounds; level: ZoomLevel; distance: number };
  placeSelected: { slug: string | null };
  modelError: { slug: string; error: unknown };
}

export interface EngineOptions {
  tilesetUrl?: string;
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
  private terrain: TerrainTiles | null = null;
  private readonly sites = new SitesLayer();
  private readonly promos = new PromoLayer();
  private locale: Locale = 'es';
  private readonly models = new ModelsLayer({ onError: (slug, error) => this.events.emit('modelError', { slug, error }) });
  private flight: { from: CameraState; to: CameraState; started: number; duration: number } | null = null;
  private lastViewKey = '';
  private viewTimer = 0;
  private pointerDown: { x: number; y: number } | null = null;
  private readonly pointer = new Vector2();
  private elevation = 0;
  private elevationGoal = 0;
  private elevationKey = '';
  private readonly elevationRay = new Raycaster();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: EngineOptions = {},
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene.background = new Color(PALETTE.ground);
    this.buildScene(options.tilesetUrl === undefined);
    this.scene.add(this.sites.group, this.models.group, this.promos.group);
    if (options.tilesetUrl !== undefined) this.loadTerrain(options.tilesetUrl);
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
    clearTimeout(this.viewTimer);
    this.terrain?.dispose();
    this.sites.dispose();
    this.models.dispose();
    this.promos.dispose();
    this.renderer.dispose();
  }

  /**
   * Language of the text drawn on promotion badges.
   */
  setLocale(locale: Locale): void {
    this.locale = locale;
  }

  /**
   * Replaces the places drawn on the map.
   */
  setPlaces(places: readonly PlaceSummary[]): void {
    this.sites.setPlaces(places);
  }

  /**
   * Highlights a place and flies the camera to it. Pass null to clear the selection.
   */
  select(slug: string | null, options: { fly?: boolean } = {}): void {
    this.sites.setSelected(slug);
    if (slug && options.fly !== false) {
      const at = this.sites.positionOf(slug);
      if (at) this.flyTo({ x: at.x, z: at.z }, 900);
    }
  }

  /**
   * Animates the camera to a scene point.
   */
  flyTo(point: { x: number; z: number }, distance: number, durationMs = 1200): void {
    this.flight = { from: this.state, to: framePoint(this.state, point, distance), started: performance.now(), duration: durationMs };
  }

  /**
   * Animates the camera to a WGS84 coordinate.
   *
   * @throws {RangeError} When the coordinate lies outside El Salvador's projection bounds.
   */
  flyToLonLat(lon: number, lat: number, distance: number, durationMs = 1200): void {
    this.flyTo(lonLatToScene({ lon, lat }), distance, durationMs);
  }

  resize(): void {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.terrain?.resize(this.camera, this.renderer);
  }

  private loadTerrain(url: string): void {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.terrain = new TerrainTiles(url, this.camera, this.renderer, tileBudget({ isMobile, deviceMemoryGb: memory }), {
      onError: (error) => this.events.emit('tilesError', { error }),
    });
    this.scene.add(this.terrain.group);
  }

  private buildScene(withPlaceholderLand: boolean): void {
    const oceanMaterial = new MeshLambertMaterial({ color: PALETTE.water, depthWrite: false });
    const ocean = new Mesh(new PlaneGeometry(4_000_000, 4_000_000), oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -5;
    ocean.renderOrder = -1;
    this.scene.add(ocean);

    if (withPlaceholderLand) {
      const land = new Mesh(new PlaneGeometry(260_000, 120_000), new MeshLambertMaterial({ color: PALETTE.neutral }));
      land.rotation.x = -Math.PI / 2;
      this.scene.add(land);
    }

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
      this.flight = null;
      this.pointerDown = { x: e.clientX, y: e.clientY };
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
    on('pointerup', (e) => {
      this.drag = null;
      const down = this.pointerDown;
      this.pointerDown = null;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && e.button === 0) this.pickAt(e);
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

  private pickAt(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    const origin = new Vector3(this.pointer.x, this.pointer.y, -1).unproject(this.camera);
    const target = new Vector3(this.pointer.x, this.pointer.y, 1).unproject(this.camera);
    const direction = target.sub(origin).normalize();
    const slug = this.promos.pick(origin, direction) ?? this.sites.pick(origin, direction);
    this.sites.setSelected(slug);
    this.events.emit('placeSelected', { slug });
  }

  /**
   * Follows the terrain height under the camera target so the rig never ends up below the surface.
   * The height is re-sampled only when the target moved or new tiles loaded, then eased in.
   */
  private updateElevation(): void {
    if (!this.terrain) return;
    const key = `${this.state.target.x.toFixed(0)}|${this.state.target.z.toFixed(0)}|${this.terrain.version}`;
    if (key !== this.elevationKey) {
      this.elevationKey = key;
      this.elevationRay.set(new Vector3(this.state.target.x, 20_000, this.state.target.z), new Vector3(0, -1, 0));
      this.elevationRay.far = 40_000;
      const hit = this.elevationRay.intersectObject(this.terrain.group, true)[0];
      if (hit) this.elevationGoal = Math.max(0, hit.point.y);
    }
    this.elevation += (this.elevationGoal - this.elevation) * 0.2;
    if (Math.abs(this.elevationGoal - this.elevation) < 0.5) this.elevation = this.elevationGoal;
  }

  private advanceFlight(): void {
    if (!this.flight) return;
    const t = (performance.now() - this.flight.started) / this.flight.duration;
    this.state = interpolateCamera(this.flight.from, this.flight.to, easeInOut(t));
    if (t >= 1) this.flight = null;
  }

  private scheduleViewChange(): void {
    const key = `${this.state.target.x.toFixed(0)}|${this.state.target.z.toFixed(0)}|${this.state.distance.toFixed(0)}|${this.state.yaw.toFixed(1)}|${this.state.tilt.toFixed(1)}|${this.camera.aspect.toFixed(2)}`;
    if (key === this.lastViewKey) return;
    this.lastViewKey = key;
    clearTimeout(this.viewTimer);
    this.viewTimer = window.setTimeout(() => {
      this.events.emit('viewChanged', {
        bounds: visibleBounds({ ...this.state, elevation: this.elevation }, this.camera.aspect),
        level: zoomLevelForDistance(this.state.distance),
        distance: this.state.distance,
      });
    }, 150);
  }

  private tick(): void {
    this.advanceFlight();
    this.updateElevation();
    const rig: CameraState = { ...this.state, elevation: this.elevation };
    const p = cameraPosition(rig);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(this.state.target.x, this.elevation, this.state.target.z);
    this.camera.near = Math.max(10, this.state.distance * 0.02);
    this.camera.far = this.state.distance * 8;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.terrain?.update();
    this.sites.update(this.state.distance, this.terrain?.group ?? null, this.terrain?.version ?? 0);
    this.models.update(this.sites.siteList(), this.state.target, this.state.distance);
    this.sites.setHidden(this.models.shownSlugs());
    this.promos.update(this.sites.siteList(), this.locale, performance.now() / 1000, this.state.distance);
    this.renderer.render(this.scene, this.camera);
    this.scheduleViewChange();

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
