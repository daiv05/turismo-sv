import { Group, Mesh, MeshToonMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LruCache } from './lru';
import { selectModels, type ModelSite } from './modelSelection';

export interface ModelSiteInput extends ModelSite {
  y: number;
  url: string | null;
}

export interface ModelsLayerOptions {
  maxShown?: number;
  radius?: number;
  cacheSize?: number;
  onError?: (slug: string, error: unknown) => void;
}

const SHOW_BELOW_DISTANCE = 1_500;

/**
 * Shows the approved 3D models of the sites closest to the camera target. Loaded models live in an LRU cache,
 * at most a few are on screen at once, and a model that fails to load simply leaves its site with the pin.
 */
export class ModelsLayer {
  readonly group = new Group();
  private readonly material = new MeshToonMaterial({ vertexColors: true });
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly shown = new Map<string, Object3D>();
  private readonly loading = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly cache: LruCache<string, Object3D>;
  private readonly maxShown: number;
  private readonly radius: number;

  constructor(private readonly options: ModelsLayerOptions = {}) {
    this.maxShown = options.maxShown ?? 4;
    this.radius = options.radius ?? SHOW_BELOW_DISTANCE;
    this.cache = new LruCache<string, Object3D>(
      options.cacheSize ?? 12,
      (_slug, object) => this.release(object),
      (slug) => this.shown.has(slug),
    );
  }

  /**
   * Slugs whose model is currently on screen, so their pins can be hidden.
   */
  shownSlugs(): ReadonlySet<string> {
    return new Set(this.shown.keys());
  }

  update(sites: readonly ModelSiteInput[], target: { x: number; z: number }, distance: number): void {
    const wanted = distance < SHOW_BELOW_DISTANCE ? selectModels(sites, target, { max: this.maxShown, radius: this.radius, current: [...this.shown.keys()] }) : [];
    const bySlug = new Map(sites.map((s) => [s.slug, s]));

    for (const slug of [...this.shown.keys()]) {
      if (!wanted.includes(slug)) {
        this.group.remove(this.shown.get(slug)!);
        this.shown.delete(slug);
      }
    }
    for (const slug of wanted) {
      const site = bySlug.get(slug)!;
      const cached = this.cache.get(slug);
      if (cached) {
        cached.position.set(site.x, site.y, site.z);
        if (!this.shown.has(slug)) {
          this.shown.set(slug, cached);
          this.group.add(cached);
        }
      } else if (site.url && !this.loading.has(slug) && !this.failed.has(slug)) {
        void this.load(slug, site.url);
      }
    }
  }

  dispose(): void {
    this.group.clear();
    this.shown.clear();
    this.cache.clear();
    this.material.dispose();
  }

  private async load(slug: string, url: string): Promise<void> {
    this.loading.add(slug);
    try {
      const gltf = await this.loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        if ((o as Mesh).isMesh) (o as Mesh).material = this.material;
      });
      this.cache.set(slug, gltf.scene);
    } catch (error) {
      this.failed.add(slug);
      this.options.onError?.(slug, error);
    } finally {
      this.loading.delete(slug);
    }
  }

  private release(object: Object3D): void {
    object.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose();
    });
  }
}
