import type { AppConfig } from './api/types';

/**
 * Address of the tileset to load: the version the backend declares current, a local build chosen with the
 * `?tileset=` override, or the local dev build when the backend cannot be reached.
 */
export function tilesetUrl(config: Pick<AppConfig, 'tileset'> | null, override?: string | null): string {
  if (override) return `/tiles/${encodeURIComponent(override)}/tileset.json`;
  const base = config?.tileset?.base_url;
  if (base) return `${base.replace(/\/?$/, '/')}tileset.json`;
  return '/tiles/dev/tileset.json';
}
