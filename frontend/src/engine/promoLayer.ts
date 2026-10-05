import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3, Raycaster } from 'three';
import { PALETTE } from '@turismo/kit/palette';
import type { Locale, PromotionSummary } from '../api/types';
import { frameAt, frameUv, pickPromotion, templateLabel } from './promoSprite';

export interface PromoSite {
  slug: string;
  x: number;
  y: number;
  z: number;
  promotions: readonly PromotionSummary[];
}

interface Entry {
  slug: string;
  sprite: Sprite;
  texture: Texture;
  frames: number;
  cols: number;
  rows: number;
  fps: number;
  phase: number;
  aspect: number;
}

const SHOW_BELOW_DISTANCE = 20_000;

function badge(label: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PALETTE.promo;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, 36);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#151a33';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 68);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Floating promotion badges above the sites that have one. A badge is a template drawn on a canvas, a static
 * image, or a spritesheet animated by moving the texture window, so every kind costs one sprite.
 */
export class PromoLayer {
  readonly group = new Group();
  private entries: Entry[] = [];
  private signature = '';
  private readonly loader = new TextureLoader().setCrossOrigin('anonymous');
  private readonly ray = new Raycaster();

  update(sites: readonly PromoSite[], locale: Locale, seconds: number, distance: number): void {
    const visible = distance < SHOW_BELOW_DISTANCE;
    this.group.visible = visible;
    if (!visible) return;

    const withPromo = sites.filter((s) => s.promotions.length > 0);
    const signature = `${locale}|${withPromo.map((s) => `${s.slug}:${pickPromotion(s.promotions)?.id}`).join(',')}`;
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild(withPromo, locale);
    }

    const scale = Math.min(Math.max(distance * 0.035, 14), 2_500);
    const bySlug = new Map(withPromo.map((s) => [s.slug, s]));
    for (const entry of this.entries) {
      const site = bySlug.get(entry.slug);
      if (!site) continue;
      entry.sprite.scale.set(scale * entry.aspect, scale, 1);
      entry.sprite.position.set(site.x, site.y + scale * 4 + Math.sin(seconds * 2 + entry.phase) * scale * 0.25, site.z);
      if (entry.frames > 1) {
        const uv = frameUv(frameAt(seconds, entry.fps, entry.frames), entry.cols, entry.rows);
        entry.texture.offset.set(uv.u, uv.v);
      }
    }
  }

  /**
   * Slug of the site whose badge the ray hits, or null.
   */
  pick(origin: Vector3, direction: Vector3): string | null {
    if (!this.group.visible) return null;
    this.ray.set(origin, direction);
    const hit = this.ray.intersectObjects(this.group.children, false)[0];
    return (hit?.object.userData.slug as string | undefined) ?? null;
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    for (const entry of this.entries) {
      this.group.remove(entry.sprite);
      entry.texture.dispose();
      (entry.sprite.material as SpriteMaterial).dispose();
    }
    this.entries = [];
  }

  private rebuild(sites: readonly PromoSite[], locale: Locale): void {
    this.clear();
    sites.forEach((site, index) => {
      const promotion = pickPromotion(site.promotions);
      if (!promotion) return;
      const { sprite: def } = promotion;
      let texture: Texture;
      let frames = 1;
      let aspect = 2;
      let entry: Entry | null = null;
      if (def.type === 'template') {
        texture = badge(templateLabel(def.template_key, def.template_data, locale));
      } else if (def.url) {
        texture = this.loader.load(def.url, (loaded) => {
          const image = loaded.image as { width: number; height: number };
          if (entry && image.width && image.height) entry.aspect = image.width / def.cols / (image.height / def.rows);
        });
        texture.colorSpace = SRGBColorSpace;
        if (def.type === 'spritesheet') {
          frames = def.frames;
          texture.repeat.set(1 / def.cols, 1 / def.rows);
        }
      } else {
        return;
      }
      const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new Sprite(material);
      sprite.renderOrder = 20;
      sprite.userData.slug = site.slug;
      this.group.add(sprite);
      entry = { slug: site.slug, sprite, texture, frames, cols: def.type === 'spritesheet' ? def.cols : 1, rows: def.type === 'spritesheet' ? def.rows : 1, fps: def.fps, phase: index, aspect };
      this.entries.push(entry);
    });
  }
}
