import type { Locale, PromotionSummary } from '../api/types';

/**
 * Index of the animation frame to show at a time in seconds, looping over the sheet.
 */
export function frameAt(seconds: number, fps: number, frames: number): number {
  if (frames <= 1 || fps <= 0) return 0;
  const index = Math.floor(seconds * fps) % frames;
  return index < 0 ? index + frames : index;
}

export interface FrameUv {
  u: number;
  v: number;
  scaleU: number;
  scaleV: number;
}

/**
 * Texture offset and scale of a frame in a grid whose first frame is the top left cell. WebGL's v axis points up.
 *
 * @throws {RangeError} When the frame is outside the grid.
 */
export function frameUv(frame: number, cols: number, rows: number): FrameUv {
  if (!Number.isInteger(frame) || frame < 0 || frame >= cols * rows) {
    throw new RangeError(`Frame ${frame} is outside a ${cols}x${rows} grid`);
  }
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  return { u: col / cols, v: 1 - (row + 1) / rows, scaleU: 1 / cols, scaleV: 1 / rows };
}

const LABELS: Record<string, { es: string; en: string }> = {
  'two-for-one': { es: '2x1', en: '2x1' },
  new: { es: 'NUEVO', en: 'NEW' },
  'free-gift': { es: 'GRATIS', en: 'FREE' },
};

/**
 * Short text drawn on a template badge.
 */
export function templateLabel(key: string | null, data: Record<string, unknown> | null, locale: Locale): string {
  if (key === 'percent-off') return `-${Number(data?.value ?? 0)}%`;
  return (key && LABELS[key]?.[locale]) || 'DEAL';
}

/**
 * Promotion drawn over a site. The API already orders them by priority, so the first one wins.
 */
export function pickPromotion(promotions: readonly PromotionSummary[]): PromotionSummary | null {
  return promotions[0] ?? null;
}
