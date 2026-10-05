import {
  CanvasTexture,
  ConeGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  Raycaster,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { lonLatToScene } from '@turismo/kit/geo';
import { PALETTE, isColorRole } from '@turismo/kit/palette';
import type { PlaceSummary } from '../api/types';
import { clusterPlaces, type PlotPoint } from './cluster';
import { lodForSite, type SiteLod } from './zoom';

interface Plotted extends PlotPoint {
  place: PlaceSummary;
  y: number;
}

const BUBBLE_CELL: Record<'country' | 'department', number> = { country: 30_000, department: 10_000 };
const MAX_PINS = 2_000;

function colorFor(token: string): Color {
  return new Color(isColorRole(token) ? PALETTE[token] : PALETTE.accent);
}

function countTexture(count: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), 64, 68);
  }
  return new CanvasTexture(canvas);
}

/**
 * Draws the content layer: grouped bubbles when far, instanced pins when closer. Pins rest on the terrain by
 * casting rays down onto the loaded tiles, and picking maps a pointer ray back to a place slug.
 */
export class SitesLayer {
  readonly group = new Group();
  private plotted: Plotted[] = [];
  private lod: SiteLod | 'none' = 'none';
  private bubbleLevel: 'country' | 'department' = 'country';
  private pins: InstancedMesh | null = null;
  private heads: InstancedMesh | null = null;
  private readonly bubbles = new Group();
  private selected: string | null = null;
  private heightsVersion = -1;
  private scaleApplied = -1;
  private readonly ray = new Raycaster();
  private readonly dummy = new Object3D();
  private readonly pinGeometry = new ConeGeometry(0.5, 2, 12).rotateX(Math.PI).translate(0, 1, 0);
  private readonly headGeometry = new SphereGeometry(0.75, 16, 12).translate(0, 2.6, 0);
  private readonly material = new MeshLambertMaterial({ color: 0xffffff });

  constructor() {
    this.group.add(this.bubbles);
  }

  setPlaces(places: readonly PlaceSummary[]): void {
    this.plotted = [];
    for (const place of places) {
      try {
        const { x, z } = lonLatToScene({ lon: place.lon, lat: place.lat });
        this.plotted.push({ slug: place.slug, x, z, priority: place.priority, place, y: 0 });
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    }
    this.plotted.sort((a, b) => b.priority - a.priority);
    this.heightsVersion = -1;
    this.rebuild();
  }

  setSelected(slug: string | null): void {
    this.selected = slug;
    this.scaleApplied = -1;
  }

  positionOf(slug: string): { x: number; y: number; z: number } | null {
    const found = this.plotted.find((p) => p.slug === slug);
    return found ? { x: found.x, y: found.y, z: found.z } : null;
  }

  /**
   * Refreshes level of detail, terrain snapping and screen constant sizing for the current camera distance.
   *
   * @param terrain Loaded terrain group, or null when there is none yet.
   * @param terrainVersion Counter that changes whenever tiles load or unload.
   */
  update(distance: number, terrain: Object3D | null, terrainVersion: number): void {
    const next = lodForSite(distance);
    const level = distance >= 80_000 ? 'country' : 'department';
    if (next !== this.lod || (next === 'bubble' && level !== this.bubbleLevel)) {
      this.lod = next;
      this.bubbleLevel = level;
      this.rebuild();
    }
    if (terrain && terrainVersion !== this.heightsVersion) {
      this.heightsVersion = terrainVersion;
      this.snapToTerrain(terrain);
      this.rebuild();
    }
    const scale = Math.min(Math.max(distance * 0.012, 8), 1_500);
    if (Math.abs(scale - this.scaleApplied) > 0.01) {
      this.applyPinTransforms(scale);
      this.scaleApplied = scale;
    }
  }

  /**
   * Returns the slug of the nearest pin or bubble leader hit by the ray, or null.
   */
  pick(origin: Vector3, direction: Vector3): string | null {
    this.ray.set(origin, direction);
    if (this.lod === 'bubble') {
      const hits = this.ray.intersectObjects(this.bubbles.children, false);
      return hits[0] ? ((hits[0].object.userData.leader as string | undefined) ?? null) : null;
    }
    if (!this.pins || !this.heads) return null;
    const hits = this.ray.intersectObjects([this.heads, this.pins], false);
    const id = hits[0]?.instanceId;
    return id === undefined ? null : (this.visible()[id]?.slug ?? null);
  }

  dispose(): void {
    this.clearMeshes();
    this.pinGeometry.dispose();
    this.headGeometry.dispose();
    this.material.dispose();
  }

  private visible(): Plotted[] {
    return this.plotted.slice(0, MAX_PINS);
  }

  private snapToTerrain(terrain: Object3D): void {
    const down = new Vector3(0, -1, 0);
    const origin = new Vector3();
    for (const p of this.plotted) {
      origin.set(p.x, 20_000, p.z);
      this.ray.set(origin, down);
      this.ray.far = 40_000;
      const hit = this.ray.intersectObject(terrain, true)[0];
      if (hit) p.y = hit.point.y;
    }
    this.ray.far = Infinity;
  }

  private clearMeshes(): void {
    for (const mesh of [this.pins, this.heads]) {
      if (mesh) {
        this.group.remove(mesh);
        mesh.dispose();
      }
    }
    this.pins = this.heads = null;
    for (const child of [...this.bubbles.children]) {
      this.bubbles.remove(child);
      const sprite = child as Sprite;
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
  }

  private rebuild(): void {
    this.clearMeshes();
    if (this.plotted.length === 0 || this.lod === 'none') return;

    if (this.lod === 'bubble') {
      for (const cluster of clusterPlaces(this.plotted, BUBBLE_CELL[this.bubbleLevel])) {
        const sprite = new Sprite(new SpriteMaterial({ map: countTexture(cluster.count), depthTest: false, transparent: true }));
        const base = this.plotted.find((p) => p.slug === cluster.leader);
        sprite.position.set(cluster.x, (base?.y ?? 0) + 800, cluster.z);
        sprite.scale.setScalar(6_000 * (this.bubbleLevel === 'country' ? 1 : 0.45));
        sprite.renderOrder = 10;
        sprite.userData.leader = cluster.leader;
        this.bubbles.add(sprite);
      }
      return;
    }

    const items = this.visible();
    this.pins = new InstancedMesh(this.pinGeometry, this.material, items.length);
    this.heads = new InstancedMesh(this.headGeometry, this.material, items.length);
    items.forEach((p, i) => {
      const color = colorFor(p.place.category.color_token);
      this.pins!.setColorAt(i, color);
      this.heads!.setColorAt(i, color);
    });
    this.group.add(this.pins, this.heads);
    this.scaleApplied = -1;
  }

  private applyPinTransforms(scale: number): void {
    if (!this.pins || !this.heads) return;
    const matrix = new Matrix4();
    this.visible().forEach((p, i) => {
      const boost = p.slug === this.selected ? 1.5 : 1;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(scale * boost);
      this.dummy.updateMatrix();
      matrix.copy(this.dummy.matrix);
      this.pins!.setMatrixAt(i, matrix);
      this.heads!.setMatrixAt(i, matrix);
    });
    this.pins.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.pins.computeBoundingSphere();
    this.heads.computeBoundingSphere();
  }
}
