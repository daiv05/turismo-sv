import type { ApiClient, PlacesQuery } from '../api/client';
import type { PlaceSummary, PlacesResponse } from '../api/types';
import { CellCache } from './cellCache';
import { cellKey, parseCellKey, visibleCells, type CellId, type SceneBounds } from './cells';
import { ZOOM_LEVELS, type ZoomLevel } from './zoom';

export interface ContentControllerDeps {
  api: Pick<ApiClient, 'places'>;
  onPlaces: (places: PlaceSummary[]) => void;
  onError: (error: unknown) => void;
}

const WORLD_LIMIT = 250_000;
const CELL_TTL_MS = 60_000;
const MAX_CACHED_CELLS = 200;

/**
 * Turns camera views into content requests: finds the visible grid cells, loads them through an expiring cache
 * and publishes the merged places. A cell that fails does not hide the cells that loaded, and answers that arrive
 * after the view moved on are dropped.
 */
export class ContentController {
  private query: PlacesQuery = { categories: [], locale: 'es' };
  private readonly cache: CellCache<PlacesResponse>;
  private lastKey = '';
  private lastView: { bounds: SceneBounds; level: ZoomLevel } | null = null;
  private generation = 0;

  constructor(private readonly deps: ContentControllerDeps) {
    this.cache = new CellCache<PlacesResponse>((key) => deps.api.places(parseCellKey(key), this.query), {
      ttlMs: CELL_TTL_MS,
      maxCells: MAX_CACHED_CELLS,
      onStale: (_key, error) => deps.onError(error),
    });
  }

  async setFilters(query: PlacesQuery): Promise<void> {
    this.query = { categories: [...query.categories], locale: query.locale };
    this.cache.clear();
    this.lastKey = '';
    if (this.lastView) {
      await this.updateView(this.lastView.bounds, this.lastView.level);
    }
  }

  /**
   * Enumerates the cells of a view, falling back to coarser levels while the view would span too many cells.
   */
  private cellsFor(bounds: SceneBounds, level: ZoomLevel): CellId[] {
    for (let index = ZOOM_LEVELS.indexOf(level); index >= 0; index--) {
      try {
        return visibleCells(bounds, ZOOM_LEVELS[index]!);
      } catch (error) {
        if (!(error instanceof RangeError) || index === 0) throw error;
      }
    }
    return [];
  }

  async updateView(bounds: SceneBounds, level: ZoomLevel): Promise<void> {
    this.lastView = { bounds, level };
    const clamped: SceneBounds = {
      minX: Math.max(-WORLD_LIMIT, bounds.minX),
      maxX: Math.min(WORLD_LIMIT, bounds.maxX),
      minZ: Math.max(-WORLD_LIMIT, bounds.minZ),
      maxZ: Math.min(WORLD_LIMIT, bounds.maxZ),
    };
    if (clamped.minX > clamped.maxX || clamped.minZ > clamped.maxZ) return;

    const keys = this.cellsFor(clamped, level).map(cellKey);
    const signature = keys.join('|');
    if (signature === this.lastKey) return;
    this.lastKey = signature;
    const generation = ++this.generation;

    const results = await Promise.allSettled(keys.map((key) => this.cache.get(key)));
    if (generation !== this.generation) return;

    const byId = new Map<number, PlaceSummary>();
    let failed: unknown;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const place of result.value.data) byId.set(place.id, place);
      } else {
        failed ??= result.reason;
      }
    }
    if (failed !== undefined) {
      this.lastKey = '';
      this.deps.onError(failed);
    }
    this.deps.onPlaces([...byId.values()]);
  }
}
