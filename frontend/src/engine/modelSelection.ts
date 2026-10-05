export interface ModelSite {
  slug: string;
  x: number;
  z: number;
  hasModel: boolean;
}

export interface SelectionOptions {
  max: number;
  radius: number;
  current?: readonly string[];
}

const KEEP_FACTOR = 1.5;

/**
 * Chooses which sites show their 3D model: the nearest ones with a model inside the radius, up to a maximum.
 * Models that are already showing stay while they remain within 1.5 times the radius, so a site on the edge of
 * the range does not flicker between pin and model.
 */
export function selectModels(sites: readonly ModelSite[], target: { x: number; z: number }, options: SelectionOptions): string[] {
  const distance = (s: ModelSite): number => Math.hypot(s.x - target.x, s.z - target.z);
  const candidates = sites.filter((s) => s.hasModel).map((s) => ({ slug: s.slug, d: distance(s) }));
  const kept = candidates
    .filter((c) => options.current?.includes(c.slug) && c.d <= options.radius * KEEP_FACTOR)
    .sort((a, b) => a.d - b.d)
    .slice(0, options.max);
  const keptSlugs = new Set(kept.map((c) => c.slug));
  const fresh = candidates
    .filter((c) => !keptSlugs.has(c.slug) && c.d <= options.radius)
    .sort((a, b) => a.d - b.d)
    .slice(0, options.max - kept.length);
  return [...kept, ...fresh].sort((a, b) => a.d - b.d).map((c) => c.slug);
}
