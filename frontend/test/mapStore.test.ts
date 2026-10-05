import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/api/client';
import type { AppConfig, PlaceDetail } from '../src/api/types';
import { setApi, useMapStore } from '../src/state/map';

const config: AppConfig = {
  tileset: null,
  palette: {},
  cell_sizes: [],
  categories: [
    { slug: 'monuments', name: { es: 'Monumentos', en: 'Monuments' }, icon: 'landmark', color_token: 'accent', kind: 'attraction', min_zoom: 0 },
    { slug: 'parks', name: { es: 'Parques', en: 'Parks' }, icon: 'tree', color_token: 'vegetation', kind: 'attraction', min_zoom: 1 },
  ],
  zones: [],
};

const detail = { slug: 'catedral', name: 'Catedral', lon: -89.19, lat: 13.7 } as unknown as PlaceDetail;

function api(overrides: Record<string, unknown> = {}) {
  return {
    config: vi.fn().mockResolvedValue(config),
    place: vi.fn().mockResolvedValue(detail),
    search: vi.fn().mockResolvedValue({ places: [], categories: [], promotions: [] }),
    ...overrides,
  };
}

beforeEach(() => setActivePinia(createPinia()));

describe('map store', () => {
  it('loads the configuration', async () => {
    setApi(api() as never);
    const store = useMapStore();

    await store.loadConfig();

    expect(store.categories.map((c) => c.slug)).toEqual(['monuments', 'parks']);
  });

  it('reports configuration failures without throwing', async () => {
    setApi(api({ config: vi.fn().mockRejectedValue(new ApiError('down', null)) }) as never);
    const store = useMapStore();

    await store.loadConfig();

    expect(store.error).toBe('network');
  });

  it('selects a place and loads its detail in the current locale', async () => {
    const mock = api();
    setApi(mock as never);
    const store = useMapStore();
    store.locale = 'en';

    await store.selectPlace('catedral');

    expect(store.selectedSlug).toBe('catedral');
    expect(store.detail).toEqual(detail);
    expect(mock.place).toHaveBeenCalledWith('catedral', 'en', expect.anything());
  });

  it('clears the selection', async () => {
    setApi(api() as never);
    const store = useMapStore();
    await store.selectPlace('catedral');

    store.clearSelection();

    expect(store.selectedSlug).toBeNull();
    expect(store.detail).toBeNull();
  });

  it('ignores a slow detail answer that arrives after another selection', async () => {
    let finishFirst!: (d: PlaceDetail) => void;
    const place = vi
      .fn()
      .mockReturnValueOnce(new Promise<PlaceDetail>((r) => (finishFirst = r)))
      .mockResolvedValueOnce({ ...detail, slug: 'teatro' });
    setApi(api({ place }) as never);
    const store = useMapStore();

    const first = store.selectPlace('catedral');
    await store.selectPlace('teatro');
    finishFirst(detail);
    await first;

    expect(store.detail?.slug).toBe('teatro');
  });

  it('marks a missing place as not found and keeps the app usable', async () => {
    setApi(api({ place: vi.fn().mockRejectedValue(new ApiError('gone', 404)) }) as never);
    const store = useMapStore();

    await store.selectPlace('nada');

    expect(store.detail).toBeNull();
    expect(store.error).toBe('notFound');
  });

  it('toggles category filters', () => {
    const store = useMapStore();

    store.toggleCategory('parks');
    expect(store.activeCategories).toEqual(['parks']);
    store.toggleCategory('parks');
    expect(store.activeCategories).toEqual([]);
  });

  it('exposes the filter query used for content requests', () => {
    const store = useMapStore();
    store.locale = 'en';
    store.toggleCategory('museums');

    expect(store.query).toEqual({ categories: ['museums'], locale: 'en' });
  });

  it('searches and keeps only the newest answer', async () => {
    let finishSlow!: (r: unknown) => void;
    const search = vi
      .fn()
      .mockReturnValueOnce(new Promise((r) => (finishSlow = r)))
      .mockResolvedValueOnce({ places: [{ slug: 'b', name: 'B', category: 'x' }], categories: [], promotions: [] });
    setApi(api({ search }) as never);
    const store = useMapStore();

    const slow = store.runSearch('ca');
    await store.runSearch('cat');
    finishSlow({ places: [{ slug: 'a', name: 'A', category: 'x' }], categories: [], promotions: [] });
    await slow;

    expect(store.results?.places.map((p) => p.slug)).toEqual(['b']);
  });

  it('clears results for queries that are too short', async () => {
    const mock = api();
    setApi(mock as never);
    const store = useMapStore();
    await store.runSearch('cat');

    await store.runSearch('c');

    expect(store.results).toBeNull();
    expect(mock.search).toHaveBeenCalledTimes(1);
  });
});
