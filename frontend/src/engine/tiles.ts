import { TilesRenderer } from '3d-tiles-renderer';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { Group, Mesh, MeshLambertMaterial, type Camera, type Object3D, type WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { TileBudget } from './budget';

export interface TerrainTilesEvents {
  onError?: (error: unknown) => void;
}

/**
 * Streams the terrain tileset. Tiles are authored in a Z up frame, so the group is rotated to the scene's
 * Y up frame. When a tile fails to load the renderer keeps showing its parent, so the previous detail stays.
 */
export class TerrainTiles {
  readonly group = new Group();
  private readonly tiles: TilesRenderer;
  private readonly material = new MeshLambertMaterial({ vertexColors: true });
  private loadedVersion = 0;

  constructor(url: string, camera: Camera, renderer: WebGLRenderer, budget: TileBudget, events: TerrainTilesEvents = {}) {
    this.tiles = new TilesRenderer(url);
    this.tiles.registerPlugin(new GLTFExtensionsPlugin({ meshoptDecoder: MeshoptDecoder }));
    this.tiles.errorTarget = budget.errorTarget;
    this.tiles.lruCache.minBytesSize = budget.minBytes;
    this.tiles.lruCache.maxBytesSize = budget.maxBytes;
    this.tiles.setCamera(camera);
    this.tiles.setResolutionFromRenderer(camera, renderer);
    this.tiles.addEventListener('load-model', (event: { scene: Object3D }) => {
      this.loadedVersion++;
      event.scene.traverse((object) => {
        if ((object as Mesh).isMesh) (object as Mesh).material = this.material;
      });
    });
    this.tiles.addEventListener('load-error', (event: { error: unknown }) => events.onError?.(event.error));
    this.group.rotation.x = -Math.PI / 2;
    this.group.add(this.tiles.group);
  }

  /**
   * Counter that changes whenever a tile is loaded, so dependents can re-sample the terrain.
   */
  get version(): number {
    return this.loadedVersion;
  }

  update(): void {
    this.tiles.update();
  }

  resize(camera: Camera, renderer: WebGLRenderer): void {
    this.tiles.setResolutionFromRenderer(camera, renderer);
  }

  dispose(): void {
    this.tiles.dispose();
    this.material.dispose();
  }
}
